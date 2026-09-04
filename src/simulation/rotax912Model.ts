import { AtmosphericState, FlightControlsState, FaultState, Rotax912State } from '../types/simulation';

/**
 * Reduced-Order Rotax 912 ULS Simulation Model
 * 4-cylinder, 4-stroke liquid/air-cooled engine, 1,352 cm³, 100 hp @ 5,800 RPM
 */

export class Rotax912EngineModel {
  // Rotax 912 ULS Specifications
  public static readonly IDLE_RPM = 1600;
  public static readonly MAX_CONTINUOUS_RPM = 5500;
  public static readonly MAX_TAKEOFF_RPM = 5800;
  public static readonly MAX_POWER_HP = 100.0;
  public static readonly DISPLACEMENT_CC = 1352;

  // Internal state variables
  public currentRpm: number = 0;
  public manifoldPressure: number = 29.92;
  public fuelFlow: number = 0;
  public fuelPressure: number = 0;
  public vibration: number = 0;

  constructor() {
    this.currentRpm = 0;
  }

  /**
   * Updates the engine state using discrete numerical integration
   * @param dt Timestep in seconds
   * @param engineOn Whether ignition/engine master is active
   * @param controls Flight controls (throttle, load, airspeed, etc.)
   * @param atmosphere Atmospheric conditions (density, pressure)
   * @param fault Active fault configuration
   * @param simTime Simulation clock in seconds
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
      // Engine OFF state - Spool down to 0
      this.currentRpm = Math.max(0, this.currentRpm - 1200 * dt);
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
        status: 'OFF'
      };
    }

    const { throttle, engineLoad, airspeed } = controls;
    const throttleNorm = Math.max(0, Math.min(100, throttle)) / 100;
    const loadNorm = Math.max(0, Math.min(100, engineLoad)) / 100;

    // 1. Manifold Absolute Pressure (MAP)
    // Idle (~12 inHg), WOT (~Ambient pressure + slight ram-air boost)
    const ramAirEffect = (airspeed / 200) * 0.8;
    const baseMap = 12.0 + throttleNorm * (atmosphere.pressureInHg - 11.5 + ramAirEffect);
    let targetMAP = Math.max(10.0, Math.min(36.0, baseMap));

    // 2. RPM Target Model
    // Equation: RPM_target = RPM_idle + (RPM_max - RPM_idle) * throttleEffect - loadEffect + altitudeEffect
    const availablePowerRatio = Math.max(0.70, atmosphere.densityRatio);
    const loadPenalty = (loadNorm - 0.70) * 350; // extra load slightly slows down engine
    let baseTargetRpm = Rotax912EngineModel.IDLE_RPM + 
      throttleNorm * (Rotax912EngineModel.MAX_TAKEOFF_RPM - Rotax912EngineModel.IDLE_RPM) * availablePowerRatio - loadPenalty;

    // 3. Fault Specific Biases
    let faultRpmBias = 0;
    let faultVibrationBias = 0;
    let faultFuelFlowBias = 0;
    let faultFuelPressureBias = 0;
    const sevMultiplier = fault.severity === 'LOW' ? 0.5 : fault.severity === 'HIGH' ? 1.5 : 1.0;

    switch (fault.activeFault) {
      case 'EXCESSIVE_VIBRATION': {
        // High vibration + slight RPM drag
        const progress = Math.min(1.0, fault.elapsedSeconds / 3.0);
        faultVibrationBias = (4.8 * sevMultiplier * progress) + Math.sin(simTime * 22.0) * 0.8;
        faultRpmBias = Math.sin(simTime * 14.0) * 60 * sevMultiplier;
        break;
      }
      case 'RPM_INSTABILITY': {
        // Governor hunting / ignition coil skip
        const hunting = (Math.sin(simTime * 3.5) * 320 + Math.cos(simTime * 1.8) * 180) * sevMultiplier;
        faultRpmBias = hunting;
        faultVibrationBias = (Math.abs(hunting) / 120) * 1.2;
        faultFuelFlowBias = (hunting / 400) * 2.5;
        break;
      }
      case 'FUEL_PRESSURE_DROP': {
        // Fuel pump failure
        const progress = Math.min(1.0, fault.elapsedSeconds / 4.0);
        faultFuelPressureBias = -1.8 * sevMultiplier * progress;
        faultRpmBias = -Math.abs(Math.sin(simTime * 8.0) * 220 * sevMultiplier * progress);
        faultVibrationBias = 1.6 * sevMultiplier * progress;
        break;
      }
      case 'OVERHEATING': {
        // Power sag due to thermal expansion and detonation margin
        const progress = Math.min(1.0, fault.elapsedSeconds / 6.0);
        faultRpmBias = -250 * sevMultiplier * progress;
        break;
      }
      case 'NORMAL':
      default:
        break;
    }

    const finalTargetRpm = Math.max(Rotax912EngineModel.IDLE_RPM - 200, baseTargetRpm + faultRpmBias);

    // First-Order Dynamic Response (Spool Inertia)
    // RPM(t+dt) = RPM(t) + (RPM_target - RPM(t)) * (dt / tau)
    const tau = 0.75; // seconds
    const alpha = 1.0 - Math.exp(-dt / tau);
    this.currentRpm += (finalTargetRpm - this.currentRpm) * alpha;

    // Smooth MAP integration
    this.manifoldPressure += (targetMAP - this.manifoldPressure) * 0.15;

    // 4. Power and Torque Calculations
    // Torque curve modeled for Rotax 912 ULS (Max torque ~128 Nm at 5,100 RPM)
    const normalizedRpm = this.currentRpm / 5800;
    const peakTorqueRpm = 5100;
    const torqueShape = 1.0 - Math.pow((this.currentRpm - peakTorqueRpm) / 4500, 2);
    const availableTorque = Math.max(20, 128 * Math.max(0.2, torqueShape) * throttleNorm * atmosphere.densityRatio);
    
    // Angular velocity: omega = 2 * pi * RPM / 60
    const omega = (2 * Math.PI * this.currentRpm) / 60;
    // Power (Watts) = Torque * AngularVelocity
    const powerWatts = availableTorque * omega;
    const powerHp = powerWatts / 745.7;
    const powerKw = powerWatts / 1000.0;

    // 5. Fuel Flow Model (L/h)
    // FuelFlow = BaseFuelFlow + FuelCoefficient * EnginePower
    // Rotax 912 ULS consumes ~18.5 L/h at 70% cruise (70 hp), ~25-27 L/h at WOT
    const baseFuelFlow = 3.5 + (powerHp / Rotax912EngineModel.MAX_POWER_HP) * 22.5 * loadNorm;
    const targetFuelFlow = Math.max(2.0, baseFuelFlow + faultFuelFlowBias);
    this.fuelFlow += (targetFuelFlow - this.fuelFlow) * 0.12;

    // 6. Fuel Pressure Model (bar)
    // Mechanical pump maintains 3.2 - 3.6 bar in normal conditions
    const baseFuelPressure = 3.4 + (this.currentRpm / 5800) * 0.2 - (this.fuelFlow / 30) * 0.15;
    const targetFuelPressure = Math.max(0.4, baseFuelPressure + faultFuelPressureBias);
    this.fuelPressure += (targetFuelPressure - this.fuelPressure) * 0.15;

    // 7. Vibration Model (mm/s RMS) with Resonance Peak
    // Base vibration ~1.2 - 2.3 mm/s + resonance near 4,200 RPM
    const baseVibration = 1.1 + (this.currentRpm / 5800) * 1.0 + (throttleNorm * 0.3);
    const resonanceRpm = 4200;
    const sigma = 350;
    const resonancePeak = 0.6 * Math.exp(-Math.pow(this.currentRpm - resonanceRpm, 2) / (2 * Math.pow(sigma, 2)));
    const targetVibration = Math.max(0.5, baseVibration + resonancePeak + faultVibrationBias);
    this.vibration += (targetVibration - this.vibration) * 0.2;

    // Status assessment
    let status: Rotax912State['status'] = 'NOMINAL';
    if (this.currentRpm > 5650 || this.vibration > 4.5 || this.fuelPressure < 2.5) {
      status = 'WARNING';
    }
    if (this.vibration > 7.5 || this.fuelPressure < 1.8) {
      status = 'CRITICAL';
    }

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
      status
    };
  }
}
