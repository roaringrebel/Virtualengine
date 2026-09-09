import { runMissionFsmVerification } from '../missions/01-mission-manager/verify/verify_mission_fsm';
import { runTrajectoryVerification } from '../missions/02-flight-model/verify/verify_trajectory';
import { runEnginePhysicsBoundsVerification } from '../missions/03-engine-physics/verify/verify_physics_bounds';
import { runFaultFeedbackVerification } from '../missions/04-fault-injector/verify/verify_fault_feedback';
import { runVirtualSensorsSnrVerification } from '../missions/05-virtual-sensors/verify/verify_snr';
import { runDualRateSignalProcessingVerification } from '../missions/06-signal-processing/verify/verify_dual_rate';
import { runTelemetrySchemaVerification } from '../missions/07-telemetry-api/verify/verify_telemetry_schema';
import { runReplayHarnessVerification } from '../missions/08-website2-ingest/verify/verify_replay_harness';

export function runAllMissions(): { allPassed: boolean; summary: string } {
  const results: { name: string; passed: boolean; report: string }[] = [];

  console.log('================================================================');
  console.log('  BHARAT-AEROTWIN: GOOGLE ANTIGRAVITY ALL-MISSION TEST SUITE   ');
  console.log('================================================================\n');

  // Mission 01
  const m01 = runMissionFsmVerification();
  results.push({ name: 'Mission 01: Mission Manager FSM', passed: m01.passed, report: m01.report });

  // Mission 02
  const m02 = runTrajectoryVerification();
  results.push({ name: 'Mission 02: Flight Model Trajectory', passed: m02.passed, report: m02.report });

  // Mission 03
  const m03 = runEnginePhysicsBoundsVerification();
  results.push({ name: 'Mission 03: Engine Physics Bounds', passed: m03.passed, report: m03.report });

  // Mission 04
  const m04 = runFaultFeedbackVerification();
  results.push({ name: 'Mission 04: Fault Injector Feedback Edge', passed: m04.passed, report: m04.report });

  // Mission 05
  const m05 = runVirtualSensorsSnrVerification();
  results.push({ name: 'Mission 05: Virtual Sensors SNR', passed: m05.passed, report: m05.report });

  // Mission 06
  const m06 = runDualRateSignalProcessingVerification();
  results.push({ name: 'Mission 06: Dual-Rate Signal Processing', passed: m06.passed, report: m06.report });

  // Mission 07
  const m07 = runTelemetrySchemaVerification();
  results.push({ name: 'Mission 07: Telemetry API Framing', passed: m07.passed, report: m07.report });

  // Mission 08
  const m08 = runReplayHarnessVerification();
  results.push({ name: 'Mission 08: Website 2 Ingest Replay', passed: m08.passed, report: m08.report });

  results.forEach(r => {
    console.log(`\n----------------------------------------------------------------`);
    console.log(r.report);
  });

  const allPassed = results.every(r => r.passed);

  const summaryLines: string[] = [];
  summaryLines.push('\n================================================================');
  summaryLines.push('                  MISSION VERIFICATION SUMMARY                  ');
  summaryLines.push('================================================================');
  
  results.forEach((r, idx) => {
    const status = r.passed ? 'PASSED ✅' : 'FAILED ❌';
    summaryLines.push(`[Mission 0${idx + 1}] ${r.name.padEnd(45)} : ${status}`);
  });

  summaryLines.push('================================================================');
  summaryLines.push(`OVERALL RESULT: ${allPassed ? 'ALL 8 MISSIONS PASSED ✅' : 'SOME MISSIONS FAILED ❌'}`);
  summaryLines.push('================================================================');

  const summary = summaryLines.join('\n');
  return { allPassed, summary };
}

const { allPassed, summary } = runAllMissions();
console.log(summary);
if (!allPassed) {
  process.exit(1);
}
