import { EnginePhysics } from '../src/EnginePhysics';
import { FlightState, FaultFeedbackModifier } from '../../shared/schemas/types';

export function runEnginePhysicsBoundsVerification(): { passed: boolean; report: string } {
  const engine = new EnginePhysics();
  const logs: string[] = [];

  const nominalFault: FaultFeedbackModifier = {
    activeFault: 'NONE',
    severity: 0,
    elapsedFaultTimeSec: 0,
    frictionTorqueIncreaseNm: 0,
    thermalDissipationFactor: 1.0,
    fuelFlowBiasFactor: 1.0,
    rpmInstabilityVariance: 0,
    vibrationEnergyMultiplier: 1.0
  };

  const dummyFlightState: FlightState = {
    timestampMs: 0,
    latitude: 13.08,
    longitude: 80.27,
    altitudeM: 1500,
    indicatedAirspeedKts: 105,
    trueAirspeedKts: 112,
    groundSpeedKts: 112,
    verticalSpeedFpm: 0,
    headingDeg: 45,
    pitchDeg: 2,
    rollDeg: 0,
    yawDeg: 45,
    angleOfAttackDeg: 3,
    gForce: 1.0,
    ambientTempC: 15,
    ambientPressureHpa: 850,
    airDensityKgM3: 1.05
  };

  logs.push('=== Mission 03 Engine Physics Bounds Verification ===');
  logs.push('Throttle | RPM  | Max CHT (C) | Max EGT (C) | Oil Press (Bar) | Power (kW)');
  logs.push('-------------------------------------------------------------------------');

  let allBoundsPassed = true;
  const throttleLevels = [0.0, 0.25, 0.50, 0.72, 0.95, 1.0];

  for (const th of throttleLevels) {
    // Run 50 steps to reach steady state
    let state = engine.update(th, dummyFlightState, nominalFault, 1.0);
    for (let s = 0; s < 50; s++) {
      state = engine.update(th, dummyFlightState, nominalFault, 0.5);
    }

    const maxCht = Math.max(...state.chtC);
    const maxEgt = Math.max(...state.egtC);

    const rpmOk = state.rpm >= 0 && state.rpm <= 5850;
    const chtOk = maxCht >= 20 && maxCht <= 150;
    const egtOk = maxEgt >= 200 && maxEgt <= 950;
    const oilOk = state.oilPressureBar >= 0.5 && state.oilPressureBar <= 5.5;

    if (!rpmOk || !chtOk || !egtOk || !oilOk) {
      allBoundsPassed = false;
    }

    logs.push(
      `${th.toFixed(2).padEnd(8)} | ${state.rpm.toFixed(0).padEnd(4)} | ${maxCht.toFixed(1).padEnd(11)} | ${maxEgt.toFixed(1).padEnd(11)} | ${state.oilPressureBar.toFixed(2).padEnd(15)} | ${state.mechanicalPowerKw.toFixed(1)}`
    );
  }

  logs.push('-------------------------------------------------------------------------');
  logs.push(`Physical Boundary Invariants: ${allBoundsPassed ? 'PASSED ✅' : 'FAILED ❌'}`);

  return { passed: allBoundsPassed, report: logs.join('\n') };
}

