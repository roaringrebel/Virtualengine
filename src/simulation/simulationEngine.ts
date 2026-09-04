import { calculateAtmosphere } from './atmosphericModel';
import { Rotax912EngineModel } from './rotax912Model';
import { Rotax912ThermalModel } from './thermalModel';
import { SensorSuiteModel } from './sensorModel';
import { createInitialFaultState, FAULT_DEFINITIONS } from './faultModel';
import { FaultSeverity, FaultType, FlightPhase, SimulationState } from '../types/simulation';
import { TelemetryPacket } from '../types/telemetry';
import { UAVPosition, Waypoint } from '../types/mission';

export const MISSION_WAYPOINTS: Waypoint[] = [
  { id: 'wp1', name: 'WP1 — TAKEOFF', lat: 32.5380, lon: 77.2020, altitudeFt: 500, targetAirspeedKmh: 95, type: 'TAKEOFF', description: 'Runway departure and initial climb' },
  { id: 'wp2', name: 'WP2 — 8,000 ft', lat: 32.5450, lon: 77.2130, altitudeFt: 8000, targetAirspeedKmh: 135, type: 'CLIMB', description: 'Climb to mission cruise altitude' },
  { id: 'wp3', name: 'WP3 — Surveillance Area', lat: 32.5580, lon: 77.2280, altitudeFt: 8000, targetAirspeedKmh: 145, type: 'SURVEILLANCE', description: 'Active tactical reconnaissance sector' },
  { id: 'wp4', name: 'WP4 — RETURN', lat: 32.5510, lon: 77.2420, altitudeFt: 4500, targetAirspeedKmh: 130, type: 'RETURN', description: 'Descent to recovery corridor' },
  { id: 'base', name: 'BASE — RUNWAY', lat: 32.5380, lon: 77.2020, altitudeFt: 0, targetAirspeedKmh: 0, type: 'BASE', description: 'Home airbase runway' },
];

export class SimulationEngine {
  private engineModel = new Rotax912EngineModel();
  private thermalModel = new Rotax912ThermalModel();
  private sensorModel = new SensorSuiteModel();

  public state: SimulationState;
  public uavPosition: UAVPosition;
  private waypoints = MISSION_WAYPOINTS;
  private currentWpIndex = 0;

  constructor() {
    const initialControls = {
      throttle: 70,
      altitude: 8000,
      airspeed: 145,
      heading: 270,
      ambientTemp: 30,
      engineLoad: 70,
    };

    const initialAtmosphere = calculateAtmosphere(initialControls.altitude, initialControls.ambientTemp);
    const initialFault = createInitialFaultState();

    // Default to Engine OFF / STANDBY on initial load
    const initialEngine = this.engineModel.update(0.1, false, initialControls, initialAtmosphere, initialFault, 0);
    this.thermalModel.cht = initialControls.ambientTemp;
    this.thermalModel.egt = initialControls.ambientTemp;
    this.thermalModel.oilTemperature = initialControls.ambientTemp;
    this.thermalModel.oilPressure = 0;
    const initialThermal = this.thermalModel.update(0.1, initialEngine, initialControls, initialAtmosphere, initialFault);
    const initialSensors = this.sensorModel.processReadings(initialEngine, initialThermal, true, 0);

    this.state = {
      isRunning: true,
      engineOn: false, // Engine OFF initially
      simTimeSeconds: 0,
      speedMultiplier: 1.0,
      sensorNoiseEnabled: true,
      flightPhase: 'STANDBY',
      controls: initialControls,
      atmosphere: initialAtmosphere,
      engine: initialEngine,
      thermal: initialThermal,
      sensors: initialSensors,
      fault: initialFault,
    };

    this.uavPosition = {
      lat: 32.5380,
      lon: 77.2020,
      altitude: 0,
      airspeed: 0,
      heading: 270,
      currentWaypointIndex: 0,
      distanceToNextKm: 0,
      missionProgressPercent: 0,
    };
  }

  public setEngineOn(isOn: boolean): void {
    this.state.engineOn = isOn;
    if (!isOn) {
      this.state.flightPhase = 'STANDBY';
      this.uavPosition.airspeed = 0;
    } else {
      if (this.state.controls.throttle > 50) {
        this.state.flightPhase = 'CRUISE';
        this.uavPosition.airspeed = this.state.controls.airspeed;
      } else {
        this.state.flightPhase = 'STARTUP';
      }
    }
  }

  public setControl<K extends keyof SimulationState['controls']>(key: K, value: number): void {
    this.state.controls[key] = value;
    this.updateFlightPhaseFromControls();
  }

  public setFault(faultType: FaultType, severity: FaultSeverity = 'MEDIUM'): void {
    const def = FAULT_DEFINITIONS[faultType];
    this.state.fault = {
      activeFault: faultType,
      severity,
      elapsedSeconds: 0,
      description: def.description,
      propagationPath: def.propagation
    };
  }

  public clearFault(): void {
    this.setFault('NORMAL');
  }

  public resetSimulation(): void {
    this.setEngineOn(false);
    this.state.controls = {
      throttle: 70,
      altitude: 8000,
      airspeed: 145,
      heading: 270,
      ambientTemp: 30,
      engineLoad: 70,
    };
    this.clearFault();
    this.uavPosition = {
      lat: 32.5380,
      lon: 77.2020,
      altitude: 0,
      airspeed: 0,
      heading: 270,
      currentWaypointIndex: 0,
      distanceToNextKm: 0,
      missionProgressPercent: 0,
    };
  }

  private updateFlightPhaseFromControls(): void {
    if (!this.state.engineOn) {
      this.state.flightPhase = 'STANDBY';
      return;
    }
    const { throttle, altitude, airspeed } = this.state.controls;
    if (throttle < 20 && altitude < 100) {
      this.state.flightPhase = 'STARTUP';
    } else if (throttle >= 85 && altitude < 1500) {
      this.state.flightPhase = 'TAKEOFF';
    } else if (throttle >= 75 && altitude < 6000) {
      this.state.flightPhase = 'CLIMB';
    } else if (throttle <= 40 && altitude > 2000) {
      this.state.flightPhase = 'DESCENT';
    } else if (throttle <= 30 && altitude <= 1000) {
      this.state.flightPhase = 'LANDING';
    } else {
      this.state.flightPhase = 'CRUISE';
    }
  }

  /**
   * Main Physics Tick
   */
  public update(dtSeconds: number): void {
    const effectiveDt = dtSeconds * this.state.speedMultiplier;
    this.state.simTimeSeconds += effectiveDt;
    this.state.fault.elapsedSeconds += effectiveDt;

    // 1. Atmosphere
    this.state.atmosphere = calculateAtmosphere(
      this.state.engineOn ? this.state.controls.altitude : 0,
      this.state.controls.ambientTemp
    );

    // 2. Engine Physics
    this.state.engine = this.engineModel.update(
      effectiveDt,
      this.state.engineOn,
      this.state.controls,
      this.state.atmosphere,
      this.state.fault,
      this.state.simTimeSeconds
    );

    // 3. Thermal & Fluids
    this.state.thermal = this.thermalModel.update(
      effectiveDt,
      this.state.engine,
      this.state.controls,
      this.state.atmosphere,
      this.state.fault
    );

    // 4. Virtual Sensors
    this.state.sensors = this.sensorModel.processReadings(
      this.state.engine,
      this.state.thermal,
      this.state.sensorNoiseEnabled,
      this.state.simTimeSeconds
    );

    // 5. UAV Navigation & Mission Progress
    if (this.state.engineOn) {
      this.updateUAVNavigation(effectiveDt);
    }
  }

  private updateUAVNavigation(dt: number): void {
    const speedKmS = (this.state.controls.airspeed / 3600);
    const distanceMovedKm = speedKmS * dt;
    
    // Increment progress %
    this.uavPosition.missionProgressPercent = (this.uavPosition.missionProgressPercent + (distanceMovedKm / 60) * 100) % 100;
    if (this.uavPosition.missionProgressPercent > 99.5) this.uavPosition.missionProgressPercent = 5;

    this.uavPosition.altitude = this.state.controls.altitude;
    this.uavPosition.airspeed = this.state.controls.airspeed;
    this.uavPosition.heading = this.state.controls.heading;

    // Advance position coordinates along route
    const targetWp = this.waypoints[this.currentWpIndex];
    if (targetWp) {
      const dLat = targetWp.lat - this.uavPosition.lat;
      const dLon = targetWp.lon - this.uavPosition.lon;
      const dist = Math.sqrt(dLat * dLat + dLon * dLon);

      if (dist < 0.002) {
        this.currentWpIndex = (this.currentWpIndex + 1) % this.waypoints.length;
      } else {
        const step = 0.00018 * dt * (this.state.controls.airspeed / 145);
        this.uavPosition.lat += (dLat / dist) * step;
        this.uavPosition.lon += (dLon / dist) * step;
      }
      this.uavPosition.distanceToNextKm = Number((dist * 111).toFixed(1));
    }
  }

  /**
   * Generates Telemetry JSON packet matching external interface contract
   */
  public getTelemetryPacket(): TelemetryPacket {
    return {
      timestamp: new Date().toISOString(),
      aircraft: 'MALE_UAV',
      engine: 'ROTAX_912_ULS',
      flight_phase: this.state.flightPhase,
      engine_on: this.state.engineOn,
      rpm: this.state.sensors.rpm.value,
      cht: this.state.sensors.cht.value,
      egt: this.state.sensors.egt.value,
      oil_pressure: this.state.sensors.oilPressure.value,
      oil_temperature: this.state.sensors.oilTemperature.value,
      vibration: this.state.sensors.vibration.value,
      fuel_flow: this.state.sensors.fuelFlow.value,
      fuel_pressure: this.state.sensors.fuelPressure.value,
      map: this.state.sensors.map.value,
      altitude: Math.round(this.state.engineOn ? this.state.controls.altitude : 0),
      airspeed: Math.round(this.state.engineOn ? this.state.controls.airspeed : 0),
      heading: Math.round(this.state.controls.heading),
      throttle: Math.round(this.state.controls.throttle),
      engine_load: Math.round(this.state.engineOn ? this.state.controls.engineLoad : 0),
      ambient_temp: Math.round(this.state.controls.ambientTemp),
      fault: this.state.fault.activeFault,
      fault_severity: this.state.fault.severity
    };
  }
}
