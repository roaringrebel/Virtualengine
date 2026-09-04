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
  private static readonly CHT_THERMAL_CAPACITY = 3.5; // Thermal inertia seconds
  private static readonly OIL_THERMAL_CAPACITY = 6.0;

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
      this.cht += (ambientTemp - this.cht) * 0.05 * dt;
      this.egt += (ambientTemp - this.egt) * 0.15 * dt;
      this.oilTemperature += (ambientTemp - this.oilTemperature) * 0.03 * dt;
      this.oilPressure = Math.max(0, this.oilPressure - 4.0 * dt);

      return {
        cht: Number(this.cht.toFixed(1)),
        egt: Number(this.egt.toFixed(1)),
        oilTemperature: Number(this.oilTemperature.toFixed(1)),
        oilPressure: Number(this.oilPressure.toFixed(1)),
      };
    }

    const { throttle, engineLoad, airspeed } = controls;
    const throttleNorm = throttle / 100;
    const loadNorm = engineLoad / 100;
    const rpmNorm = engine.rpm / 5800;

    // 1. Fault Thermal Biases
    let faultChtBias = 0;
    let faultEgtBias = 0;
    let faultOilTempBias = 0;
    let faultOilPresBias = 0;
    let coolingEfficiency = 1.0;

    const sevMultiplier = fault.severity === 'LOW' ? 0.5 : fault.severity === 'HIGH' ? 1.5 : 1.0;

    switch (fault.activeFault) {
      case 'COOLING_PROBLEM': {
        // Ram-air cooling cowl obstruction / radiator blockage
        const progress = Math.min(1.0, fault.elapsedSeconds / 7.0);
        coolingEfficiency = Math.max(0.2, 1.0 - 0.75 * sevMultiplier * progress);
        faultChtBias = 28.0 * sevMultiplier * progress;
        faultOilTempBias = 18.0 * sevMultiplier * progress;
        break;
      }
      case 'HIGH_CHT': {
        // Lean mixture or cylinder duct failure
        const progress = Math.min(1.0, fault.elapsedSeconds / 5.0);
        faultChtBias = 32.0 * sevMultiplier * progress;
        faultEgtBias = 65.0 * sevMultiplier * progress;
        break;
      }
      case 'OVERHEATING': {
        // Dual thermal runaway
        const progress = Math.min(1.0, fault.elapsedSeconds / 6.0);
        coolingEfficiency = 0.35;
        faultChtBias = 42.0 * sevMultiplier * progress;
        faultOilTempBias = 32.0 * sevMultiplier * progress;
        faultEgtBias = 85.0 * sevMultiplier * progress;
        break;
      }
      case 'LOW_OIL_PRESSURE': {
        // Oil pump bypass valve stuck or line leak
        const progress = Math.min(1.0, fault.elapsedSeconds / 3.5);
        faultOilPresBias = -3.4 * sevMultiplier * progress;
        faultOilTempBias = 14.0 * sevMultiplier * progress; // Friction heating
        break;
      }
      default:
        break;
    }

    // 2. Cylinder Head Temperature (CHT) Differential Integration
    // Heat generated: Q_gen = K_heat * EngineLoad * RPM_factor
    // Heat dissipated: Q_cool = K_cooling * (CHT - Ambient) * CoolingAirflow
    const kHeat = 88.0;
    const qGenerated = kHeat * (0.35 + 0.45 * throttleNorm + 0.20 * loadNorm) * (0.4 + 0.6 * rpmNorm);
    const airflowFactor = (0.5 + (airspeed / 145) * 0.5) * coolingEfficiency;
    const kCooling = 0.72 * airflowFactor;
    const qCooling = kCooling * (this.cht - ambientTemp);
    
    const dCht = ((qGenerated - qCooling) / Rotax912ThermalModel.CHT_THERMAL_CAPACITY) * dt;
    this.cht = Math.max(ambientTemp, this.cht + dCht + faultChtBias * dt * 0.4);

    // 3. Exhaust Gas Temperature (EGT) Model (°C)
    // Fast thermal response to combustion flame temperature
    const baseEgt = 650.0 + (throttleNorm * 110.0) + (rpmNorm * 50.0) + ((loadNorm - 0.7) * 40.0);
    const targetEgt = Math.max(400.0, baseEgt + faultEgtBias);
    this.egt += (targetEgt - this.egt) * 0.12;

    // 4. Oil Temperature Model (°C)
    // Heated by core CHT coupling and crankcase friction, cooled by oil cooler airflow
    const oilHeatGen = 45.0 + (this.cht - ambientTemp) * 0.40 + (rpmNorm * 18.0) * loadNorm;
    const oilCooling = 0.55 * airflowFactor * (this.oilTemperature - ambientTemp);
    const dOilTemp = ((oilHeatGen - oilCooling) / Rotax912ThermalModel.OIL_THERMAL_CAPACITY) * dt;
    this.oilTemperature = Math.max(ambientTemp, this.oilTemperature + dOilTemp + faultOilTempBias * dt * 0.3);

    // 5. Oil Pressure Model (bar)
    // Oil pump is driven by crankshaft. Oil viscosity decreases as oil temperature rises (reducing pressure)
    // Rotax 912 ULS nominal oil pressure: ~5.1 bar at 5,100 RPM and 88°C
    const viscosityFactor = Math.max(0.70, 1.0 - ((this.oilTemperature - 85.0) / 100.0) * 0.30);
    const baseOilPressure = 1.2 + (rpmNorm * 4.3) * viscosityFactor;
    const targetOilPressure = Math.max(0.5, baseOilPressure + faultOilPresBias);
    this.oilPressure += (targetOilPressure - this.oilPressure) * 0.18;

    return {
      cht: Number(this.cht.toFixed(1)),
      egt: Number(this.egt.toFixed(1)),
      oilTemperature: Number(this.oilTemperature.toFixed(1)),
      oilPressure: Number(this.oilPressure.toFixed(1)),
    };
  }
}
