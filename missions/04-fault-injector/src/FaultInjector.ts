import { EngineFaultType, FaultFeedbackModifier } from '../../shared/schemas/types';

export class FaultInjector {
  private activeFault: EngineFaultType = 'NONE';
  private targetSeverity: number = 0.0;
  private currentSeverity: number = 0.0;
  private elapsedFaultTimeSec: number = 0.0;

  public triggerFault(faultType: EngineFaultType, severity: number = 1.0): void {
    this.activeFault = faultType;
    this.targetSeverity = Math.min(1.0, Math.max(0.0, severity));
    if (faultType === 'NONE') {
      this.currentSeverity = 0.0;
      this.elapsedFaultTimeSec = 0.0;
    }
  }

  public clearFault(): void {
    this.activeFault = 'NONE';
    this.targetSeverity = 0.0;
    this.currentSeverity = 0.0;
    this.elapsedFaultTimeSec = 0.0;
  }

  public update(dtSec: number): FaultFeedbackModifier {
    if (this.activeFault === 'NONE') {
      return {
        activeFault: 'NONE',
        severity: 0.0,
        elapsedFaultTimeSec: 0.0,
        frictionTorqueIncreaseNm: 0.0,
        thermalDissipationFactor: 1.0,
        fuelFlowBiasFactor: 1.0,
        rpmInstabilityVariance: 0.0,
        vibrationEnergyMultiplier: 1.0
      };
    }

    this.elapsedFaultTimeSec += dtSec;
    // Gradual degradation rate
    const rampRate = 0.05; // ramps to full severity over 20s
    this.currentSeverity = Math.min(this.targetSeverity, this.currentSeverity + rampRate * dtSec);

    let frictionTorqueIncreaseNm = 0.0;
    let thermalDissipationFactor = 1.0;
    let fuelFlowBiasFactor = 1.0;
    let rpmInstabilityVariance = 0.0;
    let vibrationEnergyMultiplier = 1.0;

    switch (this.activeFault) {
      case 'BEARING_WEAR':
        // Progressive friction growth + high vibration
        const timeFactor = 1.0 + Math.log10(1.0 + this.elapsedFaultTimeSec * 0.1);
        frictionTorqueIncreaseNm = 25.0 * this.currentSeverity * timeFactor;
        rpmInstabilityVariance = 80.0 * this.currentSeverity;
        vibrationEnergyMultiplier = 1.0 + 8.5 * this.currentSeverity * timeFactor;
        break;

      case 'COOLING_LEAK':
        // Cooling decays steadily
        thermalDissipationFactor = Math.max(0.15, 1.0 - 0.82 * this.currentSeverity);
        break;

      case 'INJECTOR_CLOG':
        fuelFlowBiasFactor = Math.max(0.65, 1.0 - 0.35 * this.currentSeverity);
        rpmInstabilityVariance = 45.0 * this.currentSeverity;
        vibrationEnergyMultiplier = 1.0 + 2.0 * this.currentSeverity;
        break;

      case 'OIL_STARVATION':
        frictionTorqueIncreaseNm = 35.0 * this.currentSeverity;
        rpmInstabilityVariance = 120.0 * this.currentSeverity;
        vibrationEnergyMultiplier = 1.0 + 6.0 * this.currentSeverity;
        break;

      case 'SPARK_MISFIRE':
        fuelFlowBiasFactor = 0.85;
        rpmInstabilityVariance = 150.0 * this.currentSeverity;
        vibrationEnergyMultiplier = 1.0 + 4.5 * this.currentSeverity;
        break;

      case 'VALVE_STUCK':
        frictionTorqueIncreaseNm = 15.0 * this.currentSeverity;
        rpmInstabilityVariance = 90.0 * this.currentSeverity;
        vibrationEnergyMultiplier = 1.0 + 3.8 * this.currentSeverity;
        break;
    }

    return {
      activeFault: this.activeFault,
      severity: this.currentSeverity,
      elapsedFaultTimeSec: this.elapsedFaultTimeSec,
      frictionTorqueIncreaseNm,
      thermalDissipationFactor,
      fuelFlowBiasFactor,
      rpmInstabilityVariance,
      vibrationEnergyMultiplier
    };
  }

  public getStatus() {
    return {
      activeFault: this.activeFault,
      currentSeverity: this.currentSeverity,
      elapsedTime: this.elapsedFaultTimeSec
    };
  }
}
