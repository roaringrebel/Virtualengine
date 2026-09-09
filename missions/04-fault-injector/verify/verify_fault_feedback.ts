import { FaultInjector } from '../src/FaultInjector';
import { EnginePhysics } from '../../03-engine-physics/src/EnginePhysics';
import { FlightState } from '../../shared/schemas/types';

export function runFaultFeedbackVerification(): { passed: boolean; report: string } {
  const faultInjector = new FaultInjector();
  const engine = new EnginePhysics();
  const logs: string[] = [];

  const dummyFlightState: FlightState = {
    timestampMs: 0,
    latitude: 13.13,
    longitude: 80.32,
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

  logs.push('=== Mission 04 Fault Injector Dynamic Feedback Verification ===');
  logs.push('Testing Bearing Wear Fault Dynamic Evolution over 60 seconds:');
  logs.push('Time (s) | Fault Mode   | Severity | Friction (Nm) | RPM  | Vib (um) | Max CHT (C)');
  logs.push('--------------------------------------------------------------------------------');

  // Warm up engine to steady state cruise first
  let warmupFeedback = faultInjector.update(0.1);
  for (let w = 0; w < 30; w++) {
    engine.update(0.72, dummyFlightState, warmupFeedback, 0.5);
  }

  const baselineState = engine.update(0.72, dummyFlightState, warmupFeedback, 0.5);
  const initialRpm = baselineState.rpm;
  const initialVib = baselineState.vibrationDisplacementUm;
  const initialFriction = baselineState.internalFrictionTorqueNm;

  faultInjector.triggerFault('BEARING_WEAR', 1.0);

  const timeSnapshots = [0, 10, 20, 30, 45, 60];
  let finalRpm = 0;
  let finalVib = 0;
  let finalFriction = 0;

  for (let t = 0; t <= 60; t++) {
    const feedback = faultInjector.update(1.0);
    const engineState = engine.update(0.72, dummyFlightState, feedback, 1.0);

    if (t === 60) {
      finalRpm = engineState.rpm;
      finalVib = engineState.vibrationDisplacementUm;
      finalFriction = engineState.internalFrictionTorqueNm;
    }

    if (timeSnapshots.includes(t)) {
      logs.push(
        `${t.toString().padEnd(8)} | ${feedback.activeFault.padEnd(12)} | ${feedback.severity.toFixed(2).padEnd(8)} | ${engineState.internalFrictionTorqueNm.toFixed(1).padEnd(13)} | ${engineState.rpm.toFixed(0).padEnd(4)} | ${engineState.vibrationDisplacementUm.toFixed(2).padEnd(8)} | ${Math.max(...engineState.chtC).toFixed(1)}`
      );
    }
  }

  logs.push('--------------------------------------------------------------------------------');

  const frictionGrew = finalFriction > initialFriction * 2.0;
  const vibGrew = finalVib > initialVib * 3.0;
  const rpmDegraded = finalRpm < initialRpm;

  const passed = frictionGrew && vibGrew && rpmDegraded;

  logs.push(`Dynamic Friction Evolution Check: ${frictionGrew ? 'PASSED ✅' : 'FAILED ❌'}`);
  logs.push(`Vibration Amplification Check: ${vibGrew ? 'PASSED ✅' : 'FAILED ❌'}`);
  logs.push(`Progressive RPM Degradation Check: ${rpmDegraded ? 'PASSED ✅' : 'FAILED ❌'}`);
  logs.push(`Overall Feedback Edge Verification: ${passed ? 'PASSED ✅' : 'FAILED ❌'}`);

  return { passed, report: logs.join('\n') };
}

