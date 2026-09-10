import { SimulationEngine } from '../src/simulation/simulationEngine';
import { ReliabilityModel } from '../src/simulation/reliabilityModel';

export function runReliabilityTests() {
  console.log('================================================================');
  console.log('       FINAL MISSION RELIABILITY VERIFICATION TEST SUITE        ');
  console.log('================================================================\n');

  let passedTests = 0;
  const totalTests = 9;

  // -------------------------------------------------------------------------
  // TEST 1 — PARKED / STANDBY STATE
  // -------------------------------------------------------------------------
  console.log('[TEST 1] PARKED STATE: Mission Not Started');
  const sim1 = new SimulationEngine();
  // Simulate 10 seconds of background ticks while engine is OFF / PARKED
  for (let i = 0; i < 100; i++) {
    sim1.update(0.1);
  }
  const state1 = sim1.state;
  const rel1 = state1.reliability;
  
  const test1Passed = (
    rel1.isParked === true &&
    state1.engineOn === false &&
    rel1.engineSOH === 99 &&
    rel1.rulHours === 240.0 &&
    rel1.anomalyScore === 0 &&
    rel1.faultRiskPercent === 0 &&
    rel1.enduranceCheck.details === 'READY' &&
    rel1.healthCheck.details === 'BASELINE' &&
    rel1.riskCheck.details === 'NOT ACTIVE' &&
    rel1.decisionReason.includes('Engine in standby')
  );
  console.log(`  - isParked: ${rel1.isParked}`);
  console.log(`  - SOH (Frozen Baseline): ${rel1.engineSOH}%`);
  console.log(`  - RUL (Frozen Baseline): ${rel1.rulHours} h`);
  console.log(`  - Anomaly: ${rel1.anomalyScore}`);
  console.log(`  - Fault Risk: ${rel1.faultRiskPercent}%`);
  console.log(`  - Decision Reason: "${rel1.decisionReason}"`);
  console.log(`  => RESULT: ${test1Passed ? 'PASSED ✅' : 'FAILED ❌'}\n`);
  if (test1Passed) passedTests++;

  // -------------------------------------------------------------------------
  // TEST 2 — HEALTHY START
  // -------------------------------------------------------------------------
  console.log('[TEST 2] HEALTHY START: Start Mission & Run Healthy Cruise');
  const sim2 = new SimulationEngine();
  sim2.setEngineOn(true);
  sim2.setControl('throttle', 75);
  // Run 60 seconds of healthy flight
  for (let i = 0; i < 600; i++) {
    sim2.update(0.1);
  }
  const state2 = sim2.state;
  const rel2 = state2.reliability;
  const test2Passed = (
    rel2.isParked === false &&
    rel2.decision === 'GO' &&
    rel2.reliabilityScore >= 90 &&
    rel2.reliabilityScore <= 99 &&
    rel2.engineSOH >= 95 &&
    rel2.healthCheck.status === 'PASS' || rel2.healthCheck.status === 'NORMAL'
  );
  console.log(`  - isParked: ${rel2.isParked}`);
  console.log(`  - Decision: ${rel2.decision}`);
  console.log(`  - Reliability Score: ${rel2.reliabilityScore}% (Expected ~90-100%)`);
  console.log(`  - Engine SOH: ${rel2.engineSOH}%`);
  console.log(`  - Health Status: ${rel2.healthCheck.status}`);
  console.log(`  => RESULT: ${test2Passed ? 'PASSED ✅' : 'FAILED ❌'}\n`);
  if (test2Passed) passedTests++;

  // -------------------------------------------------------------------------
  // TEST 3 — WARNING (Mild abnormal behavior / LOW severity fault)
  // -------------------------------------------------------------------------
  console.log('[TEST 3] WARNING: Mild abnormal behavior (LOW severity fault)');
  const sim3 = new SimulationEngine();
  sim3.setEngineOn(true);
  sim3.setControl('throttle', 75);
  for (let i = 0; i < 100; i++) sim3.update(0.1);
  
  sim3.setFault('HIGH_CHT', 'LOW');
  for (let i = 0; i < 200; i++) sim3.update(0.1);
  const rel3 = sim3.state.reliability;
  const test3Passed = (
    rel3.healthCheck.status === 'WARNING' &&
    rel3.reliabilityScore >= 70 &&
    rel3.reliabilityScore <= 89
  );
  console.log(`  - Health Status: ${rel3.healthCheck.status} (Expected: WARNING)`);
  console.log(`  - Reliability Score: ${rel3.reliabilityScore}% (Expected: 70-89%)`);
  console.log(`  - Decision: ${rel3.decision}`);
  console.log(`  => RESULT: ${test3Passed ? 'PASSED ✅' : 'FAILED ❌'}\n`);
  if (test3Passed) passedTests++;

  // -------------------------------------------------------------------------
  // TEST 4 — MEDIUM FAULT (DEGRADED Health & Moderate Reliability)
  // -------------------------------------------------------------------------
  console.log('[TEST 4] MEDIUM FAULT: Inject Medium Fault (Vibration / Power sag)');
  const sim4 = new SimulationEngine();
  sim4.setEngineOn(true);
  sim4.setControl('throttle', 75);
  for (let i = 0; i < 100; i++) sim4.update(0.1);

  sim4.setFault('EXCESSIVE_VIBRATION', 'MEDIUM');
  for (let i = 0; i < 200; i++) sim4.update(0.1);
  const rel4 = sim4.state.reliability;
  const test4Passed = (
    rel4.healthCheck.status === 'DEGRADED' &&
    rel4.anomalyScore >= 0.30 &&
    rel4.faultRiskPercent >= 40 &&
    rel4.reliabilityScore >= 45 &&
    rel4.reliabilityScore <= 75
  );
  console.log(`  - Health Status: ${rel4.healthCheck.status} (Expected: DEGRADED)`);
  console.log(`  - Anomaly Score: ${rel4.anomalyScore}`);
  console.log(`  - Fault Risk: ${rel4.faultRiskPercent}%`);
  console.log(`  - Reliability Score: ${rel4.reliabilityScore}% (Expected: 45-75%)`);
  console.log(`  - Decision: ${rel4.decision} (Expected: CAUTION)`);
  console.log(`  => RESULT: ${test4Passed ? 'PASSED ✅' : 'FAILED ❌'}\n`);
  if (test4Passed) passedTests++;

  // -------------------------------------------------------------------------
  // TEST 5 — CRITICAL FAULT (Severe Fault Injected)
  // -------------------------------------------------------------------------
  console.log('[TEST 5] CRITICAL FAULT: Inject Severe Fault (HIGH/CRITICAL Overheating)');
  const sim5 = new SimulationEngine();
  sim5.setEngineOn(true);
  sim5.setControl('throttle', 80);
  for (let i = 0; i < 100; i++) sim5.update(0.1);

  sim5.setFault('OVERHEATING', 'HIGH');
  for (let i = 0; i < 100; i++) sim5.update(0.1); // 10 seconds of critical fault
  const rel5 = sim5.state.reliability;
  const test5Passed = (
    rel5.healthCheck.status === 'CRITICAL' &&
    rel5.decision === 'NO-GO' &&
    rel5.reliabilityScore <= 40 &&
    rel5.criticalPersistenceSeconds > 0 &&
    rel5.criticalPersistenceSeconds < 30
  );
  console.log(`  - Health Status: ${rel5.healthCheck.status} (Expected: CRITICAL)`);
  console.log(`  - Decision: ${rel5.decision} (Expected: NO-GO)`);
  console.log(`  - Reliability Score: ${rel5.reliabilityScore}% (Expected: <= 40%)`);
  console.log(`  - In-Flight Critical Persistence: ${rel5.criticalPersistenceSeconds.toFixed(1)} / 30 sec`);
  console.log(`  => RESULT: ${test5Passed ? 'PASSED ✅' : 'FAILED ❌'}\n`);
  if (test5Passed) passedTests++;

  // -------------------------------------------------------------------------
  // TEST 6 — 30 SECOND PERSISTENCE -> EMERGENCY RECOVERY
  // -------------------------------------------------------------------------
  console.log('[TEST 6] 30 SECOND PERSISTENCE: Continuous Critical Fault >= 30s');
  const sim6 = new SimulationEngine();
  sim6.setEngineOn(true);
  sim6.setControl('throttle', 80);
  for (let i = 0; i < 100; i++) sim6.update(0.1);

  sim6.setFault('OVERHEATING', 'HIGH');
  // Run 32 seconds of continuous severe failure
  for (let i = 0; i < 320; i++) {
    sim6.update(0.1);
  }
  const rel6 = sim6.state.reliability;
  const test6Passed = (
    rel6.emergencyRecoveryTriggered === true &&
    rel6.decision === 'EMERGENCY RECOVERY' &&
    rel6.emergencyRecovery !== undefined &&
    rel6.emergencyRecovery.selectedELP !== null
  );
  console.log(`  - Critical Persistence Seconds: ${rel6.criticalPersistenceSeconds} / 30 sec`);
  console.log(`  - Emergency Recovery Triggered: ${rel6.emergencyRecoveryTriggered}`);
  console.log(`  - Decision: ${rel6.decision}`);
  console.log(`  - Selected ELP: ${rel6.emergencyRecovery?.selectedELP?.id} (${rel6.emergencyRecovery?.selectedELP?.name})`);
  console.log(`  => RESULT: ${test6Passed ? 'PASSED ✅' : 'FAILED ❌'}\n`);
  if (test6Passed) passedTests++;

  // -------------------------------------------------------------------------
  // TEST 7 — CLEAR FAULT BEFORE 30 SEC
  // -------------------------------------------------------------------------
  console.log('[TEST 7] CLEAR FAULT BEFORE 30 SEC: Persistence Resets');
  const sim7 = new SimulationEngine();
  sim7.setEngineOn(true);
  sim7.setControl('throttle', 80);
  for (let i = 0; i < 100; i++) sim7.update(0.1);

  // Critical fault for 15 seconds
  sim7.setFault('OVERHEATING', 'HIGH');
  for (let i = 0; i < 150; i++) sim7.update(0.1);
  const midPersist = sim7.state.reliability.criticalPersistenceSeconds;

  // Clear fault
  sim7.clearFault();
  for (let i = 0; i < 50; i++) sim7.update(0.1);
  const rel7 = sim7.state.reliability;

  const test7Passed = (
    midPersist >= 14 &&
    rel7.criticalPersistenceSeconds === 0 &&
    rel7.emergencyRecoveryTriggered === false
  );
  console.log(`  - Persistence at 15s fault: ${midPersist.toFixed(1)}s`);
  console.log(`  - Persistence after Clearing Fault: ${rel7.criticalPersistenceSeconds}s`);
  console.log(`  - Emergency Recovery Triggered: ${rel7.emergencyRecoveryTriggered}`);
  console.log(`  => RESULT: ${test7Passed ? 'PASSED ✅' : 'FAILED ❌'}\n`);
  if (test7Passed) passedTests++;

  // -------------------------------------------------------------------------
  // TEST 8 — DESTINATION REACHED & FREEZE
  // -------------------------------------------------------------------------
  console.log('[TEST 8] DESTINATION REACHED: Safe Landing & State Freeze');
  const sim8 = new SimulationEngine();
  sim8.setEngineOn(true);
  sim8.setControl('throttle', 100);
  sim8.setSpeedMultiplier(5.0);

  // Fast forward until mission completed
  for (let i = 0; i < 2000 && !sim8.state.isCompleted; i++) {
    sim8.update(0.1);
  }
  const completedState = sim8.state;
  const finalScore = completedState.reliability.reliabilityScore;
  const finalSoh = completedState.reliability.engineSOH;
  const finalRul = completedState.reliability.rulHours;

  // Run another 100 ticks after completion
  for (let i = 0; i < 100; i++) {
    sim8.update(0.1);
  }
  const afterTicksState = sim8.state;

  const test8Passed = (
    completedState.isCompleted === true &&
    afterTicksState.reliability.reliabilityScore === finalScore &&
    afterTicksState.reliability.engineSOH === finalSoh &&
    afterTicksState.reliability.rulHours === finalRul
  );
  console.log(`  - Mission Completed: ${completedState.isCompleted}`);
  console.log(`  - Flight Phase: ${afterTicksState.flightPhase}`);
  console.log(`  - Final Frozen Reliability: ${afterTicksState.reliability.reliabilityScore}%`);
  console.log(`  - Final Frozen SOH: ${afterTicksState.reliability.engineSOH}%`);
  console.log(`  - Final Frozen RUL: ${afterTicksState.reliability.rulHours} h`);
  console.log(`  => RESULT: ${test8Passed ? 'PASSED ✅' : 'FAILED ❌'}\n`);
  if (test8Passed) passedTests++;

  // -------------------------------------------------------------------------
  // TEST 9 — EMERGENCY ELP RECOVERY & FREEZE
  // -------------------------------------------------------------------------
  console.log('[TEST 9] EMERGENCY ELP RECOVERY: Complete Divert, Landing & Freeze');
  const sim9 = new SimulationEngine();
  sim9.setEngineOn(true);
  sim9.setControl('throttle', 80);
  for (let i = 0; i < 100; i++) sim9.update(0.1);

  // Inject critical fault to trigger emergency recovery
  sim9.setFault('LOW_OIL_PRESSURE', 'CRITICAL');
  sim9.setSpeedMultiplier(5.0);

  for (let i = 0; i < 3000 && sim9.state.flightPhase !== 'RECOVERED'; i++) {
    sim9.update(0.1);
  }
  const recState = sim9.state;
  const test9Passed = (
    recState.flightPhase === 'RECOVERED' &&
    recState.isCompleted === true &&
    recState.reliability.emergencyRecovery?.selectedELP !== null
  );
  console.log(`  - Flight Phase: ${recState.flightPhase}`);
  console.log(`  - Mission Completed/Recovered: ${recState.isCompleted}`);
  console.log(`  - Recovered at ELP: ${recState.reliability.emergencyRecovery?.selectedELP?.id}`);
  console.log(`  => RESULT: ${test9Passed ? 'PASSED ✅' : 'FAILED ❌'}\n`);
  if (test9Passed) passedTests++;

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('================================================================');
  console.log(`  RELIABILITY VALIDATION SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('================================================================');

  if (passedTests === totalTests) {
    console.log('ALL 9 RELIABILITY SCENARIOS VALIDATED SUCCESSFULLY ✅');
  } else {
    console.error('SOME TESTS FAILED ❌');
    process.exit(1);
  }
}

runReliabilityTests();
