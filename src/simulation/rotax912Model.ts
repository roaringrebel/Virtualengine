import { AtmosphericState, FlightControlsState, FaultState, Rotax912State, EngineStatus } from '../types/simulation';
import { SIMULATION_CONFIG } from './simulationConfig';

/**
 * Reduced-Order Rotax 912 ULS Simulation Model
 * 4-cylinder, 4-stroke liquid/air-cooled aero piston engine
 * Displacement: 1,352 cm³, Max Power: 100 hp (73.5 kW) @ 5,800 RPM
 * Single-point physics simulation for synthetic telemetry generation.
 */
export class Rotax912EngineModel {
  public static readonly IDLE_RPM = SIMULATION_CONFIG.engineIdleRpm;
  public static readonly MAX_CONTINUOUS_RPM = SIMULATION_CONFIG.engineMaxContinuousRpm;
  public static readonly MAX_TAKEOFF_RPM = SIMULATION_CONFIG.engineMaxTakeoffRpm;
  public static readonly MAX_POWER_HP = SIMULATION_CONFIG.engineMaxPowerHp;
  public static readonly DISPLACEMENT_CC = SIMULATION_CONFIG.engineDisplacementCc;

  // Internal state variables
  public currentRpm: number = 0;
  public manifoldPressure: number = 29.92;
  public fuelFlow: number = 0;
  public fuelPressure: number = 0;
  public vibration: number = 0;
  public startupTimer: number = 0;
  public engineCondition: number = 1.0;

  constructor() {
    this.currentRpm = 0;
    this.startupTimer = 0;
    this.engineCondition = 1.0;
  }

  public reset(): void {
    this.currentRpm = 0;
    this.manifoldPressure = SIMULATION_CONFIG.seaLevelPressureInHg;
    this.fuelFlow = 0;
    this.fuelPressure = 0;
    this.vibration = 0;
    this.startupTimer = 0;
    this.engineCondition = 1.0;
  }

  /**
   * Updates the engine state using discrete numerical integration
   */
  public update(
    dt: number,
    engineOn: boolean,
    controls: FlightControlsState,
    atmosphere: AtmosphericState,
    fault: FaultState,
    simTime: number
  ): Rotax912State {
    if (!engineOn) {
      this.startupTimer = 0;
      const isStopping = this.currentRpm > 50;
      // Spool down to 0
      this.currentRpm = Math.max(0, this.currentRpm - 1400 * dt);
      this.manifoldPressure = atmosphere.pressureInHg;
      this.fuelFlow = 0;
      this.fuelPressure = 0;
      this.vibration = 0;

      return {
        engineOn: false,
        rpm: Math.round(this.currentRpm),
        targetRpm: 0,
        torque: 0,
        powerHp: 0,
        powerKw: 0,
        manifoldPressure: Number(this.manifoldPressure.toFixed(1)),
        fuelFlow: 0,
        fuelPressure: 0,
        vibration: 0,
        status: isStopping ? 'STOPPING' : 'OFF',
        efficiencyLossRatio: 0,
        engineCondition: 1.0
      };
    }

    // Engine is ON: Track startup sequence
    this.startupTimer += dt;
    let engineStatus: EngineStatus = 'RUNNING';

    const { throttle, engineLoad, airspeed } = controls;
    const throttleNorm = Math.max(0, Math.min(100, throttle)) / 100;
    const loadNorm = Math.max(0, Math.min(100, engineLoad)) / 100;

    // 1. Manifold Absolute Pressure (MAP) inHg
    const ramAirEffect = (airspeed / 200.0) * 0.8;
    const baseMap = 12.0 + throttleNorm * (atmosphere.pressureInHg - 11.5 + ramAirEffect);
    let targetMAP = Math.max(10.0, Math.min(36.0, baseMap));

    // 2. RPM Target & Startup Curve
    let baseTargetRpm = Rotax912EngineModel.IDLE_RPM;
    if (this.startupTimer < 0.8) {
      engineStatus = 'STARTING'; // Cranking phase
      baseTargetRpm = 450;
    } else if (this.startupTimer < 1.6) {
      engineStatus = 'STARTING'; // Ignition & initial combustion
      baseTargetRpm = 1100;
    } else if (this.startupTimer < 2.5) {
      engineStatus = 'STARTING'; // Spool up to idle
      baseTargetRpm = Rotax912EngineModel.IDLE_RPM;
    } else {
      // Normal operating governor curve
      const availablePowerRatio = Math.max(0.65, atmosphere.densityRatio);
      const loadPenalty = (loadNorm - 0.70) * 320;
      baseTargetRpm = Rotax912EngineModel.IDLE_RPM +
        throttleNorm * (Rotax912EngineModel.MAX_TAKEOFF_RPM - Rotax912EngineModel.IDLE_RPM) * availablePowerRatio - loadPenalty;

      if (throttle < 20) {
        engineStatus = 'IDLE';
      } else {
        engineStatus = 'RUNNING';
      }
    }

    // 3. Fault Specific Biases & Efficiency Derating
    let faultRpmBias = 0;
    let faultVibrationBias = 0;
    let faultFuelFlowBias = 0;
    let faultFuelPressureBias = 0;
    let efficiencyLossRatio = 0.0;
    const sevMultiplier = SIMULATION_CONFIG.faultMultipliers[fault.severity] || 1.0;

    switch (fault.activeFault) {
      case 'EXCESSIVE_VIBRATION': {
        const progress = Math.min(1.0, fault.elapsedSeconds / 3.0);
        faultVibrationBias = (4.8 * sevMultiplier * progress) + Math.sin(simTime * 22.0) * 0.8;
        faultRpmBias = -Math.abs(Math.sin(simTime * 14.0) * 80 * sevMultiplier * progress) - (120 * sevMultiplier * progress);
        efficiencyLossRatio = 0.18 * sevMultiplier * progress;
        engineStatus = 'FAULT';
        break;
      }
      case 'RPM_INSTABILITY': {
        const hunting = (Math.sin(simTime * 3.5) * 320 + Math.cos(simTime * 1.8) * 180) * sevMultiplier;
        faultRpmBias = hunting;
        faultVibrationBias = (Math.abs(hunting) / 120) * 1.2;
        faultFuelFlowBias = (hunting / 400) * 2.5;
        efficiencyLossRatio = 0.12 * sevMultiplier;
        engineStatus = 'FAULT';
        break;
      }
      case 'FUEL_PRESSURE_DROP': {
        const progress = Math.min(1.0, fault.elapsedSeconds / 4.0);
        faultFuelPressureBias = -1.8 * sevMultiplier * progress;
        faultRpmBias = -Math.abs(Math.sin(simTime * 8.0) * 220 * sevMultiplier * progress) - (450 * sevMultiplier * progress);
        faultVibrationBias = 1.6 * sevMultiplier * progress;
        efficiencyLossRatio = 0.32 * sevMultiplier * progress;
        engineStatus = 'FAULT';
        break;
      }
      case 'OVERHEATING': {
        const progress = Math.min(1.0, fault.elapsedSeconds / 6.0);
        faultRpmBias = -380 * sevMultiplier * progress;
        faultVibrationBias = 1.4 * sevMultiplier * progress;
        efficiencyLossRatio = 0.28 * sevMultiplier * progress;
        engineStatus = 'FAULT';
        break;
      }
      case 'LOW_OIL_PRESSURE': {
        const progress = Math.min(1.0, fault.elapsedSeconds / 4.0);
        faultRpmBias = -220 * sevMultiplier * progress;
        faultVibrationBias = 2.1 * sevMultiplier * progress;
        efficiencyLossRatio = 0.20 * sevMultiplier * progress;
        engineStatus = 'FAULT';
        break;
      }
      case 'COOLING_PROBLEM': {
        const progress = Math.min(1.0, fault.elapsedSeconds / 5.0);
        faultRpmBias = -180 * sevMultiplier * progress;
        efficiencyLossRatio = 0.15 * sevMultiplier * progress;
        engineStatus = 'FAULT';
        break;
      }
      case 'HIGH_CHT': {
        const progress = Math.min(1.0, fault.elapsedSeconds / 4.0);
        faultRpmBias = -150 * sevMultiplier * progress;
        efficiencyLossRatio = 0.12 * sevMultiplier * progress;
        engineStatus = 'FAULT';
        break;
      }
      case 'NORMAL':
      default:
        break;
    }

    // Engine Condition update (0.0 to 1.0)
    const targetCondition = Math.max(0.20, 1.0 - efficiencyLossRatio);
    this.engineCondition += (targetCondition - this.engineCondition) * Math.min(1.0, dt * 0.5);

    const minOperationalRpm = this.startupTimer < 2.5 ? 0 : Rotax912EngineModel.IDLE_RPM - 250;
    const finalTargetRpm = Math.max(minOperationalRpm, baseTargetRpm + faultRpmBias);

    // Smooth RPM dynamic response with inertia
    const tau = this.startupTimer < 2.5 ? 0.45 : 0.75; // seconds
    const alpha = 1.0 - Math.exp(-dt / tau);
    this.currentRpm += (finalTargetRpm - this.currentRpm) * alpha;

    // Smooth MAP integration
    this.manifoldPressure += (targetMAP - this.manifoldPressure) * 0.15;

    // 4. Power and Torque Calculations
    // Power = Torque * AngularVelocity (omega = 2*pi*RPM/60)
    const peakTorqueRpm = 5100;
    const torqueShape = 1.0 - Math.pow((this.currentRpm - peakTorqueRpm) / 4500, 2);
    const healthFactor = this.engineCondition;
    const availableTorque = Math.max(10, 128.0 * Math.max(0.15, torqueShape) * Math.max(0.15, throttleNorm) * atmosphere.densityRatio * healthFactor);

    const omega = (2 * Math.PI * this.currentRpm) / 60.0;
    const powerWatts = availableTorque * omega;
    const powerHp = powerWatts / 745.7;
    const powerKw = powerWatts / 1000.0;

    // 5. Fuel Flow Model (L/h)
    const baseFuelFlow = 3.5 + (powerHp / Rotax912EngineModel.MAX_POWER_HP) * 22.5 * Math.max(0.2, loadNorm);
    const targetFuelFlow = Math.max(2.0, baseFuelFlow + faultFuelFlowBias);
    this.fuelFlow += (targetFuelFlow - this.fuelFlow) * 0.12;

    // 6. Fuel Pressure Model (bar)
    const baseFuelPressure = 3.4 + (this.currentRpm / 5800.0) * 0.2 - (this.fuelFlow / 30.0) * 0.15;
    const targetFuelPressure = Math.max(0.4, baseFuelPressure + faultFuelPressureBias);
    this.fuelPressure += (targetFuelPressure - this.fuelPressure) * 0.15;

    // 7. Vibration Model (mm/s RMS)
    const baseVibration = 1.1 + (this.currentRpm / 5800.0) * 1.0 + (throttleNorm * 0.3);
    const resonanceRpm = 4200;
    const sigma = 350;
    const resonancePeak = 0.6 * Math.exp(-Math.pow(this.currentRpm - resonanceRpm, 2) / (2 * Math.pow(sigma, 2)));
    const targetVibration = Math.max(0.5, baseVibration + resonancePeak + faultVibrationBias);
    this.vibration += (targetVibration - this.vibration) * 0.2;

    return {
      engineOn: true,
      rpm: Math.round(this.currentRpm),
      targetRpm: Math.round(finalTargetRpm),
      torque: Number(availableTorque.toFixed(1)),
      powerHp: Number(powerHp.toFixed(1)),
      powerKw: Number(powerKw.toFixed(1)),
      manifoldPressure: Number(this.manifoldPressure.toFixed(1)),
      fuelFlow: Number(this.fuelFlow.toFixed(1)),
      fuelPressure: Number(this.fuelPressure.toFixed(1)),
      vibration: Number(this.vibration.toFixed(1)),
      status: engineStatus,
      efficiencyLossRatio: Number(efficiencyLossRatio.toFixed(2)),
      engineCondition: Number(this.engineCondition.toFixed(2))
    };
  }
}
