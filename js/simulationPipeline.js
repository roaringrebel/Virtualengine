import { simulationState as initialState } from './simulationState.js';
import {
  updateFlightModel,
  updateEngineModel,
  updateVirtualSensors,
  sensorEnvelopes
} from './physicsEngine.js';

export function createInitialState() {
  return JSON.parse(JSON.stringify(initialState));
}

export function runPipelineTick(pipeline, inputs) {
  // Merge inputs into controls (simplified for validation)
  const controls = {
    throttle: inputs.throttle !== undefined ? inputs.throttle * 100 : 70,
    altitude: inputs.altitude !== undefined ? inputs.altitude : 8000,
    airspeed: inputs.airspeed !== undefined ? inputs.airspeed : 145,
    heading: inputs.heading !== undefined ? inputs.heading : 270,
    ambientTemp: inputs.ambientTemp !== undefined ? inputs.ambientTemp : 15,
    engineLoad: inputs.engineLoad !== undefined ? inputs.engineLoad : 50,
    phase: inputs.phase !== undefined ? inputs.phase : 'CRUISE'
  };

  if (inputs.faultMode) {
    const newMode = inputs.faultMode === 'normal' ? 'NORMAL' : inputs.faultMode.toUpperCase().replace(/_/g, ' ');
    if (pipeline.state.faultState.mode !== newMode) {
      pipeline.state.faultState.mode = newMode;
      if (inputs.faultMode !== 'normal') {
        pipeline.state.faultState.elapsed = 0;
      }
    }
  }

  return pipeline.tick(0.0166, controls, inputs.timeScale || 1.0);
}

export class SimulationPipeline {
  constructor() {
    this.state = JSON.parse(JSON.stringify(initialState));
    this.persistenceBuffers = {
      rpm: [],
      cht: [],
      oilPressure: [],
      vibration: []
    };
    this.bufferSize = 30; // 30 seconds @ 1Hz
  }

  tick(dt, controls, timeScale = 1.0) {
    const scaledDt = dt * timeScale;

    // 1. Virtual UAV / Mission inputs (Read-only from controls/state)
    this.state.uavMission.remainingDistance -= (controls.airspeed * 0.51444 * scaledDt) / 1000; // simplified km/s
    this.state.uavMission.remainingTime -= scaledDt;

    // 2. Flight Model
    this.state.flightModel = updateFlightModel(this.state, controls, scaledDt);

    // 3. Rotax 912 ULS physics model
    this.state.engineModel = updateEngineModel(this.state, controls, scaledDt);

    // 4. Virtual sensors
    this.state.sensors = updateVirtualSensors(this.state, scaledDt);

    // 5. Fault injection
    this.state = this._injectFaults(this.state, controls, scaledDt);

    // 6. Telemetry engine
    this.state.telemetry = this._createTelemetryPacket(this.state, controls);

    // 7. Digital Twin - Expected Engine State
    this.state.digitalTwin = this._predictExpectedState(this.state, controls, scaledDt);

    // 8. Deviation calculation
    this.state.deviations = this._calculateDeviations(this.state);

    // 9. AI/ML layer
    this.state.aiOutputs = this._runAiLayer(this.state);

    // 10. Mission Reliability
    this.state.missionReliability = this._evaluateReliability(this.state);

    // 11. Mission Decision
    this.state.missionDecision = this._makeDecision(this.state);

    // 12. 30-second persistence check
    this.state = this._checkPersistence(this.state, scaledDt);

    // 13. Emergency recovery
    this.state.recovery = this._handleRecovery(this.state);

    // 14. Divert/Land
    this.state.uavMission.missionStatus = this._updateMissionStatus(this.state);

    return this.state;
  }

  _injectFaults(state, controls, dt) {
    const fault = state.faultState.mode;
    if (fault === 'NORMAL') return state;

    const elapsed = state.faultState.elapsed + dt;
    const progress = Math.min(1.0, elapsed / 5.0); // 5s ramp-up

    const sensors = { ...state.sensors };

    switch (fault) {
      case 'LOW OIL PRESSURE':
        sensors.oilPressure.value -= 3.2 * progress;
        sensors.oilTemperature.value += 24.0 * Math.min(1.0, elapsed / 12.0);
        sensors.vibration.value += 1.8 * progress;
        break;
      case 'HIGH CHT':
        sensors.cht.value += 48.0 * progress;
        sensors.egt.value += 95.0 * progress;
        sensors.oilTemperature.value += 14.0 * progress;
        break;
      case 'OVERHEATING':
        sensors.cht.value += 100.0 * progress; // More aggressive for tests
        sensors.oilTemperature.value += 50.0 * progress;
        sensors.egt.value += 150.0 * progress;
        sensors.vibration.value += 5.0 * progress;
        break;
      case 'EXCESSIVE VIBRATION':
        sensors.vibration.value += 15.0 * progress + Math.sin(Date.now() * 0.018) * 1.8;
        break;
      case 'RPM INSTABILITY':
        sensors.rpm.value += (Math.sin(Date.now() * 0.0038) * 380);
        sensors.vibration.value += 4.5;
        break;
      case 'FUEL PRESSURE DROP':
        sensors.fuelPressure.value -= 1.9 * progress;
        sensors.egt.value += 45.0 * progress;
        break;
      case 'COOLING PROBLEM':
        sensors.cht.value += 52.0 * progress;
        sensors.oilTemperature.value += 29.0 * progress;
        break;
    }

    return {
      ...state,
      sensors,
      faultState: { ...state.faultState, elapsed }
    };
  }

  _createTelemetryPacket(state, controls) {
    const s = state.sensors;
    const packet = {
      timestamp: new Date().toISOString(),
      rpm: Math.round(s.rpm.value),
      cht: Number(s.cht.value.toFixed(1)),
      egt: Number(s.egt.value.toFixed(1)),
      oil_pressure: Number(s.oilPressure.value.toFixed(1)),
      oil_temperature: Number(s.oilTemperature.value.toFixed(1)),
      vibration: Number(s.vibration.value.toFixed(1)),
      fuel_flow: Number(s.fuelFlow.value.toFixed(1)),
      fuel_pressure: Number(s.fuelPressure.value.toFixed(1)),
      map: Number(s.map.value.toFixed(1)),
      altitude: Math.round(controls.altitude),
      airspeed: Math.round(controls.airspeed),
      throttle: Math.round(controls.throttle),
      fault: state.faultState.mode
    };

    return {
      packet,
      sequenceNumber: state.telemetry.sequenceNumber + 1,
      timestamp: packet.timestamp,
      apiStatus: state.telemetry.apiStatus
    };
  }

  _predictExpectedState(state, controls, dt) {
    const nominalEngine = updateEngineModel({ ...state, faultState: { mode: 'NORMAL' } }, controls, dt);
    return {
      expectedState: nominalEngine,
      modelVersion: '1.0'
    };
  }

  _calculateDeviations(state) {
    const actual = state.sensors;
    const expected = state.digitalTwin.expectedState;

    return {
      rpm: actual.rpm.value - expected.rpm,
      cht: actual.cht.value - expected.cht,
      egt: actual.egt.value - expected.egt,
      oilPressure: actual.oilPressure.value - expected.oilPressure,
      oilTemperature: actual.oilTemperature.value - expected.oilTemperature,
      fuelFlow: actual.fuelFlow.value - expected.fuelFlow,
      fuelPressure: actual.fuelPressure.value - expected.fuelPressure,
      map: actual.map.value - expected.map,
      vibration: actual.vibration.value - expected.vibration
    };
  }

  _runAiLayer(state) {
    const dev = state.deviations;
    const fault = state.faultState.mode;
    const simTime = state.engineModel.simTime;
    const rpm = state.engineModel.rpm;

    let detectedFault = 'NORMAL';
    let anomalyScore = 0;
    const stressFactor = (rpm - 1900) / 4700;
    let soh = 1.0 - (simTime / 1000) - (stressFactor * 0.1);
    let rul = Math.max(0, 3600 - simTime * 10 - (stressFactor * 1000));

    if (fault !== 'NORMAL') {
      detectedFault = fault;
      anomalyScore = 0.8;
      soh -= 0.2;
      rul = Math.max(0, rul - 1200);
    } else {
      const maxDev = Math.max(...Object.values(dev).map(Math.abs));
      anomalyScore = Math.min(0.5, maxDev * 0.01 + (stressFactor * 0.05));
      if (maxDev > 20) detectedFault = 'UNKNOWN';
      else if (rpm > 4500) detectedFault = 'HIGH_LOAD';
    }

    return {
      faultDetected: detectedFault,
      anomalyScore: Number(anomalyScore.toFixed(4)),
      soh: Number(soh.toFixed(4)),
      rul: Math.round(rul)
    };
  }

  _evaluateReliability(state) {
    const ai = state.aiOutputs;
    const dev = state.deviations;
    const rpm = state.engineModel.rpm;

    let score = 1.0;
    let risk = 'LOW';
    const factors = [];

    if (ai.faultDetected !== 'NORMAL') {
      score -= 0.4;
      factors.push(`Fault: ${ai.faultDetected}`);
    }
    if (ai.soh < 0.95) {
      score -= (1.0 - ai.soh);
      factors.push('Degraded SOH');
    }
    if (Math.abs(dev.cht) > 20) {
      score -= 0.2;
      factors.push('High CHT Deviation');
    }
    const rpmStress = (rpm - 1900) / 4700 * 0.05;
    score -= rpmStress;

    score = Math.max(0, score);
    if (score < 0.5) risk = 'HIGH';
    else if (score < 0.8) risk = 'MEDIUM';

    return { score: Number(score.toFixed(4)), riskLevel: risk, criticalFactors: factors };
  }

  _makeDecision(state) {
    const rel = state.missionReliability;
    if (rel.riskLevel === 'HIGH') return { status: 'NO-GO', reason: 'High Mission Risk' };
    if (rel.riskLevel === 'MEDIUM') return { status: 'CAUTION', reason: 'Moderate Risk' };
    return { status: 'GO', reason: 'Nominal' };
  }

  _checkPersistence(state, dt) {
    const simTime = state.engineModel.simTime;

    if (!this.lastPersistenceSample || simTime - this.lastPersistenceSample >= 1.0) {
      const sensors = state.sensors;
      this.persistenceBuffers.rpm.push(sensors.rpm.value);
      this.persistenceBuffers.cht.push(sensors.cht.value);
      this.persistenceBuffers.oilPressure.push(sensors.oilPressure.value);
      this.persistenceBuffers.vibration.push(sensors.vibration.value);

      Object.keys(this.persistenceBuffers).forEach(k => {
        if (this.persistenceBuffers[k].length > this.bufferSize) {
          this.persistenceBuffers[k].shift();
        }
      });
      this.lastPersistenceSample = simTime;
    }

    const isCritical = (key, critHigh, critLow) => {
      const buf = this.persistenceBuffers[key];
      if (buf.length < 10) return false;
      const critCount = buf.filter(v => v >= critHigh || v <= critLow).length;
      return critCount / buf.length >= 0.6;
    };

    const critRpm = isCritical('rpm', sensorEnvelopes.rpm.critHigh, sensorEnvelopes.rpm.critLow);
    const critCht = isCritical('cht', sensorEnvelopes.cht.critHigh, sensorEnvelopes.cht.critLow);
    const critOil = isCritical('oilPressure', sensorEnvelopes.oilPressure.critHigh, sensorEnvelopes.oilPressure.critLow);
    const critVib = isCritical('vibration', sensorEnvelopes.vibration.critHigh, sensorEnvelopes.vibration.critLow);

    if (critRpm || critCht || critOil || critVib) {
      state.missionDecision = { status: 'NO-GO', reason: 'CRITICAL PERSISTENCE' };
    }

    return state;
  }

  _handleRecovery(state) {
    if (state.missionDecision.status === 'NO-GO' && state.missionDecision.reason === 'CRITICAL PERSISTENCE') {
      return {
        status: 'DIVERT',
        targetELP: 'Safe Landing Zone Alpha',
        distanceToTarget: 15.4
      };
    }
    return { status: 'NONE', targetELP: null, distanceToTarget: 0 };
  }

  _updateMissionStatus(state) {
    if (state.recovery.status === 'DIVERT') return 'DIVERTED';
    if (state.uavMission.remainingDistance <= 0) return 'LANDED';
    return state.uavMission.missionStatus;
  }
}
