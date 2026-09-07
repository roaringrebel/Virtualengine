import { AtmosphericState, FlightControlsState, FaultState, Rotax912State, ThermalState } from '../types/simulation';

/**
 * Thermal Balance Model for Rotax 912 ULS
 * Calculates CHT, EGT, Oil Temperature, and Oil Pressure using physical differential equations.
 */

export class Rotax912ThermalModel {
  public cht: number = 25.0;            // Starts at ambient
  public egt: number = 25.0;
  public oilTemperature: number = 25.0;
  public oilPressure: number = 0;

  // Thermal capacities
  private static readonly CHT_THERMAL_CAPACITY = 2.5; // Thermal inertia seconds
  private static readonly OIL_THERMAL_CAPACITY = 3.5;

  constructor() {
    this.cht = 25.0;
    this.egt = 25.0;
    this.oilTemperature = 25.0;
    this.oilPressure = 0;
  }

  public update(
    dt: number,
    engine: Rotax912State,
    controls: FlightControlsState,
    atmosphere: AtmosphericState,
    fault: FaultState
  ): ThermalState {
    const ambientTemp = atmosphere.temperatureCelsius;

    if (!engine.engineOn || engine.rpm < 200) {
      // Engine OFF: Temperatures slowly decay to ambient, oil pressure drops to 0
      this.cht += (ambientTemp - this.cht) * 0.1 * dt;
      this.egt += (ambientTemp - this.egt) * 0.2 * dt;
      this.oilTemperature += (ambientTemp - this.oilTemperature) * 0.08 * dt;
      this.oilPressure = Math.max(0, this.oilPressure - 4.0 * dt);

      return {
        cht: Number(this.cht.toFixed(1)),
        egt: Number(this.egt.toFixed(1)),
        oilTemperature: Number(this.oilTemperature.toFixed(1)),
        oilPressure: Number(this.oilPressure.toFixed(1)),
      };
    }

    const effectiveAirspeed = controls.airspeed || controls.targetAirspeed || 140;
    const coolingAirflowFactor = Math.max(0.6, Math.min(1.4, effectiveAirspeed / 145.0));
    const ambientOffset = (ambientTemp - 25.0) * 0.45;
    const throttleNorm = (controls.throttle || 70) / 100.0;
    const loadNorm = (controls.engineLoad || 70) / 100.0;
    const rpmNorm = (engine.rpm || 1600) / 5800.0;

    // 1. Base Equilibrium Targets
    // Nominal cruise CHT: ~92.4°C, EGT: ~788°C, Oil Temp: ~88.1°C, Oil Pressure: ~5.1 bar
    let targetCht = 78.0 + (throttleNorm * 22.0) + (loadNorm * 14.0) + (rpmNorm * 10.0) + ambientOffset - ((coolingAirflowFactor - 1.0) * 8.0);
    let targetEgt = 680.0 + (throttleNorm * 120.0) + (rpmNorm * 40.0) + (loadNorm * 30.0) + (ambientOffset * 0.5);
    let targetOilTemp = 74.0 + (throttleNorm * 18.0) + (loadNorm * 12.0) + ambientOffset - ((coolingAirflowFactor - 1.0) * 6.0);
    let targetOilPressure = 4.6 + (rpmNorm * 1.0) - (throttleNorm * 0.2) - (Math.max(0, targetOilTemp - 90.0) * 0.02);

    const sevMultiplier = fault.severity === 'LOW' ? 0.7 : fault.severity === 'HIGH' ? 1.4 : 1.0;

    // 2. Exact Fault Dynamic Injection
    switch (fault.activeFault) {
      case 'OVERHEATING': {
        // Dual thermal runaway: CHT > 135°C (triggers Overheating Critical in sihaimodel)
        targetCht = 138.5 * sevMultiplier;
        targetEgt = 895.0 * sevMultiplier;
        targetOilTemp = 116.0 * sevMultiplier;
        targetOilPressure = Math.max(1.8, 3.2 - (0.6 * sevMultiplier)); // oil viscosity drops
        break;
      }
      case 'HIGH_CHT': {
        // Severe CHT elevation
        targetCht = 146.0 * sevMultiplier;
        targetEgt = 890.0 * sevMultiplier;
        targetOilTemp = 115.0 * sevMultiplier;
        break;
      }
      case 'COOLING_PROBLEM': {
        // Cowl / radiator blockage
        targetCht = 142.0 * sevMultiplier;
        targetEgt = 880.0 * sevMultiplier;
        targetOilTemp = 122.0 * sevMultiplier;
        break;
      }
      case 'LOW_OIL_PRESSURE': {
        // Oil pump failure: Oil pressure < 2.0 bar (175 kPa in sihaimodel), friction heat
        targetOilPressure = 1.75 / sevMultiplier;
        targetOilTemp = 126.0 * sevMultiplier;
        targetCht = 122.0 * sevMultiplier;
        break;
      }
      case 'NORMAL':
      default:
        // Nominal equilibrium
        targetCht = 92.4;
        targetEgt = 788.2;
        targetOilTemp = 88.1;
        targetOilPressure = 5.1;
        break;
    }

    // Dynamic response convergence toward target
    const rateCht = fault.activeFault !== 'NORMAL' ? 0.45 : 0.25;
    const rateEgt = fault.activeFault !== 'NORMAL' ? 0.60 : 0.35;
    const rateOilTemp = fault.activeFault !== 'NORMAL' ? 0.35 : 0.20;
    const rateOilPres = fault.activeFault !== 'NORMAL' ? 0.55 : 0.30;

    this.cht += (targetCht - this.cht) * rateCht * Math.min(1.0, dt * 8);
    this.egt += (targetEgt - this.egt) * rateEgt * Math.min(1.0, dt * 8);
    this.oilTemperature += (targetOilTemp - this.oilTemperature) * rateOilTemp * Math.min(1.0, dt * 8);
    this.oilPressure += (targetOilPressure - this.oilPressure) * rateOilPres * Math.min(1.0, dt * 8);

    return {
      cht: Number(this.cht.toFixed(1)),
      egt: Number(this.egt.toFixed(1)),
      oilTemperature: Number(this.oilTemperature.toFixed(1)),
      oilPressure: Number(this.oilPressure.toFixed(1)),
    };
  }
}

