import { FlightState, EnginePhysicalState, FaultFeedbackModifier } from '../../shared/schemas/types';

export class EnginePhysics {
  private currentRpm: number = 1400;
  private manifoldPressureInHg: number = 29.92;
  private chtC: [number, number, number, number] = [85, 87, 86, 88];
  private egtC: [number, number, number, number] = [720, 725, 718, 730];
  private oilTempC: number = 85.0;
  private oilPressureBar: number = 3.2;
  private coolantTempC: number = 82.0;
  private fuelFlowLph: number = 14.5;
  private internalFrictionTorqueNm: number = 4.5;

  public update(
    commandedThrottle: number,
    flightState: FlightState,
    faultFeedback: FaultFeedbackModifier,
    dtSec: number
  ): EnginePhysicalState {
    const isEngineOff = commandedThrottle <= 0 && flightState.indicatedAirspeedKts <= 5;

    if (isEngineOff) {
      this.currentRpm = Math.max(0, this.currentRpm - 400 * dtSec);
      this.oilPressureBar = Math.max(0, this.oilPressureBar - 1.0 * dtSec);
      this.fuelFlowLph = Math.max(0, this.fuelFlowLph - 5.0 * dtSec);
      // Cool down toward ambient
      for (let i = 0; i < 4; i++) {
        this.chtC[i] += (flightState.ambientTempC - this.chtC[i]) * 0.05 * dtSec;
        this.egtC[i] += (flightState.ambientTempC - this.egtC[i]) * 0.15 * dtSec;
      }
      this.oilTempC += (flightState.ambientTempC - this.oilTempC) * 0.02 * dtSec;
      this.coolantTempC += (flightState.ambientTempC - this.coolantTempC) * 0.03 * dtSec;
    } else {
      // 1. Target RPM calculation based on throttle + altitude density reduction
      const maxRpm = 5800;
      const idleRpm = 1400;
      const densityRatio = flightState.airDensityKgM3 / 1.225;
      const nominalTargetRpm = idleRpm + (maxRpm - idleRpm) * Math.pow(commandedThrottle, 0.85) * Math.sqrt(densityRatio);

      // Apply dynamic fault feedback on friction torque and RPM instability
      const totalFrictionTorque = 4.5 + faultFeedback.frictionTorqueIncreaseNm;
      this.internalFrictionTorqueNm = totalFrictionTorque;
      
      const torqueRpmLoss = (faultFeedback.frictionTorqueIncreaseNm / 30.0) * 800;
      const targetRpm = Math.max(idleRpm, nominalTargetRpm - torqueRpmLoss);

      // RPM inertial response + fault instability jitter
      const rpmRate = 600; // RPM/sec
      const rpmError = targetRpm - this.currentRpm;
      const rpmStep = Math.sign(rpmError) * Math.min(Math.abs(rpmError), rpmRate * dtSec);
      const rpmJitter = (Math.random() - 0.5) * faultFeedback.rpmInstabilityVariance;
      this.currentRpm = Math.min(5800, Math.max(0, this.currentRpm + rpmStep + rpmJitter));

      // 2. Fuel flow & Manifold Pressure
      const baseFuelFlow = 3.5 + (this.currentRpm / 5800) * 23.5 * Math.pow(commandedThrottle, 1.1);
      this.fuelFlowLph = baseFuelFlow * faultFeedback.fuelFlowBiasFactor;
      this.manifoldPressureInHg = 12.0 + (this.currentRpm / 5800) * 17.5 * commandedThrottle * densityRatio;

      // 3. Thermal Dynamics with Fault Feedback Dissipation Factor
      const ramAirCooling = 1.0 + (flightState.indicatedAirspeedKts / 100.0) * 0.8;
      const coolingFactor = Math.max(0.1, faultFeedback.thermalDissipationFactor * ramAirCooling);

      const heatGenerationKw = (this.fuelFlowLph * 9.5) * 0.28; // heat rejection into heads
      const targetCht = 55.0 + (heatGenerationKw / coolingFactor) * 1.5;

      for (let i = 0; i < 4; i++) {
        // Individual cylinder thermal gradient + friction heat
        const cylOffset = (i === 1 || i === 3 ? 3.5 : 0.0); // rear cylinders run hotter
        const cylTargetCht = targetCht + cylOffset + (faultFeedback.frictionTorqueIncreaseNm * 0.4);
        this.chtC[i] += (cylTargetCht - this.chtC[i]) * 0.08 * dtSec;
        this.chtC[i] = Math.min(160, Math.max(20, this.chtC[i]));
      }

      // Exhaust Gas Temperatures (EGT)
      const targetEgt = 550.0 + (this.fuelFlowLph / 27.0) * 310.0;
      for (let i = 0; i < 4; i++) {
        const cylEgtTarget = targetEgt + ((i % 2 === 0) ? -10 : 15);
        this.egtC[i] += (cylEgtTarget - this.egtC[i]) * 0.25 * dtSec;
        this.egtC[i] = Math.min(950, Math.max(200, this.egtC[i]));
      }

      // Coolant & Oil Thermal Dynamics
      const targetCoolant = 50.0 + (targetCht * 0.5) / Math.max(0.2, faultFeedback.thermalDissipationFactor);
      this.coolantTempC += (targetCoolant - this.coolantTempC) * 0.04 * dtSec;

      const targetOilTemp = 55.0 + (targetCht * 0.45) + (totalFrictionTorque * 0.8);
      this.oilTempC += (targetOilTemp - this.oilTempC) * 0.03 * dtSec;

      // Oil Pressure (inversely proportional to oil temp, proportional to RPM)
      const baseOilPress = 1.8 + (this.currentRpm / 5800) * 2.4;
      const tempViscosityLoss = Math.max(0, (this.oilTempC - 90) * 0.015);
      this.oilPressureBar = Math.max(0.5, Math.min(5.5, baseOilPress - tempViscosityLoss));
    }

    const mechanicalPowerKw = (this.currentRpm / 5800) * 73.5 * commandedThrottle;
    const efficiencyPct = mechanicalPowerKw > 0 ? (mechanicalPowerKw / (this.fuelFlowLph * 9.5)) * 100 : 0;
    const vibrationUm = (this.currentRpm / 1000) * 2.2 * faultFeedback.vibrationEnergyMultiplier;

    return {
      timestampMs: flightState.timestampMs,
      rpm: this.currentRpm,
      manifoldPressureInHg: this.manifoldPressureInHg,
      chtC: [this.chtC[0], this.chtC[1], this.chtC[2], this.chtC[3]],
      egtC: [this.egtC[0], this.egtC[1], this.egtC[2], this.egtC[3]],
      oilTempC: this.oilTempC,
      oilPressureBar: this.oilPressureBar,
      fuelFlowLitersPerHour: this.fuelFlowLph,
      fuelPressureBar: 3.0,
      coolantTempC: this.coolantTempC,
      mechanicalPowerKw,
      efficiencyPct: Math.min(38, Math.max(0, efficiencyPct)),
      internalFrictionTorqueNm: this.internalFrictionTorqueNm,
      vibrationDisplacementUm: vibrationUm
    };
  }
}
