/**
 * pipeline_validation.js
 *
 * End-to-end validation for the Bharat AeroTwin simulation pipeline.
 * Confirms:
 *   1. Throttle changes propagate through the full chain in one tick's worth
 *      of ticks (RPM -> Fuel Flow -> CHT/EGT -> Telemetry -> Deviation -> AI -> Mission Risk).
 *   2. Fault injection cascades to a mission decision change and, if sustained,
 *      recovery/diversion.
 *   3. The 30-second persistence window counts SIMULATED time (respecting
 *      timeScale), not wall-clock time.
 *   4. No field in simulationState is "stale".
 */

import { createInitialState, runPipelineTick, SimulationPipeline } from '../js/simulationPipeline.js';

const RESULTS = { pass: [], fail: [] };

function check(name, condition, detail) {
  if (condition) {
    RESULTS.pass.push(name);
  } else {
    RESULTS.fail.push({ name, detail });
  }
}

function deepGet(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}

// ---------------------------------------------------------------------------
// TEST 1: Throttle propagation
// ---------------------------------------------------------------------------
function testThrottlePropagation() {
  const pipeline = new SimulationPipeline();
  pipeline.state = createInitialState();

  // Baseline: run a few ticks at low throttle to reach steady state
  for (let i = 0; i < 50; i++) {
    runPipelineTick(pipeline, { throttle: 0.3 });
  }
  const state = pipeline.state;
  const baseline = {
    rpm: deepGet(state, 'engineModel.rpm'),
    fuelFlow: deepGet(state, 'sensors.fuelFlow.value'),
    cht: deepGet(state, 'sensors.cht.value'),
    egt: deepGet(state, 'sensors.egt.value'),
    deviation: deepGet(state, 'deviations.rpm'),
    aiOutput: deepGet(state, 'aiOutputs.faultDetected'),
    missionRisk: deepGet(state, 'missionReliability.score'),
  };

  // Step throttle up sharply, run enough ticks for the cascade to settle
  for (let i = 0; i < 50; i++) {
    runPipelineTick(pipeline, { throttle: 0.9 });
  }
  const stateStepped = pipeline.state;
  const stepped = {
    rpm: deepGet(stateStepped, 'engineModel.rpm'),
    fuelFlow: deepGet(stateStepped, 'sensors.fuelFlow.value'),
    cht: deepGet(stateStepped, 'sensors.cht.value'),
    egt: deepGet(stateStepped, 'sensors.egt.value'),
    deviation: deepGet(stateStepped, 'deviations.rpm'),
    aiOutput: deepGet(stateStepped, 'aiOutputs.faultDetected'),
    missionRisk: deepGet(stateStepped, 'missionReliability.score'),
  };

  check('throttle -> RPM increases', stepped.rpm > baseline.rpm,
    `baseline=${baseline.rpm} stepped=${stepped.rpm}`);
  check('RPM -> fuel flow increases', stepped.fuelFlow > baseline.fuelFlow,
    `baseline=${baseline.fuelFlow} stepped=${stepped.fuelFlow}`);
  check('fuel flow -> CHT/EGT respond', stepped.cht !== baseline.cht || stepped.egt !== baseline.egt,
    `cht ${baseline.cht}->${stepped.cht}, egt ${baseline.egt}->${stepped.egt}`);
  check('telemetry -> deviation recalculated', stepped.deviation !== baseline.deviation,
    `baseline=${baseline.deviation} stepped=${stepped.deviation}`);
  check('deviation -> AI output responds', JSON.stringify(stepped.aiOutput) !== JSON.stringify(baseline.aiOutput),
    `baseline=${JSON.stringify(baseline.aiOutput)} stepped=${JSON.stringify(stepped.aiOutput)}`);
  check('AI output -> mission risk updates', stepped.missionRisk !== baseline.missionRisk,
    `baseline=${baseline.missionRisk} stepped=${stepped.missionRisk}`);
}

// ---------------------------------------------------------------------------
// TEST 2: Fault cascade to mission decision
// ---------------------------------------------------------------------------
function testFaultCascade() {
  const pipeline = new SimulationPipeline();
  pipeline.state = createInitialState();

  for (let i = 0; i < 30; i++) {
    runPipelineTick(pipeline, { throttle: 0.6, faultMode: 'normal' });
  }
  const decisionBefore = deepGet(pipeline.state, 'missionDecision.status');

  // Inject a severe fault and run long enough to exceed the 30s persistence window
  // 30s / 0.0166s per tick = ~1806 ticks.
  for (let i = 0; i < 2000; i++) {
    runPipelineTick(pipeline, { throttle: 0.6, faultMode: 'excessive_vibration' });
  }
  const decisionAfter = deepGet(pipeline.state, 'missionDecision.status');
  const recoveryTriggered = deepGet(pipeline.state, 'recovery.status') === 'DIVERT';

  check('fault injection changes mission decision', decisionAfter !== decisionBefore,
    `before=${decisionBefore} after=${decisionAfter}`);
  check('sustained critical fault triggers recovery', recoveryTriggered === true,
    `recovery.status=${recoveryTriggered}`);
}

// ---------------------------------------------------------------------------
// TEST 3: Persistence window uses SIMULATED time, not wall-clock
// ---------------------------------------------------------------------------
function testPersistenceUsesSimTime() {
  const pipeline = new SimulationPipeline();
  pipeline.state = createInitialState();

  const timeScale = 10;
  const wallSecondsToRun = 3.5;
  const tickHz = 60;
  const ticksToRun = Math.round(wallSecondsToRun * tickHz);

  for (let i = 0; i < ticksToRun; i++) {
    runPipelineTick(pipeline, { throttle: 0.6, faultMode: 'overheating', timeScale });
  }

  const simSecondsElapsed = pipeline.state.engineModel.simTime;
  const recoveryTriggered = pipeline.state.recovery.status === 'DIVERT';

  check('sim clock advances faster than wall clock under timeScale',
    simSecondsElapsed >= wallSecondsToRun * timeScale * 0.8,
    `simSeconds=${simSecondsElapsed}, expected >= ~${wallSecondsToRun * timeScale}`);

  check('30s persistence triggers under accelerated demo time',
    recoveryTriggered === true,
    `recovery.status=${recoveryTriggered} after ${simSecondsElapsed} sim-seconds`);
}

// ---------------------------------------------------------------------------
// TEST 4: No stale/frozen fields between differing inputs
// ---------------------------------------------------------------------------
function testNoStaleFields(paths) {
  const pipelineA = new SimulationPipeline();
  pipelineA.state = createInitialState();
  for (let i = 0; i < 30; i++) runPipelineTick(pipelineA, { throttle: 0.2 });

  const pipelineB = new SimulationPipeline();
  pipelineB.state = createInitialState();
  for (let i = 0; i < 30; i++) runPipelineTick(pipelineB, { throttle: 0.95 });

  for (const path of paths) {
    const a = deepGet(pipelineA.state, path);
    const b = deepGet(pipelineB.state, path);

    const valA = (typeof a === 'object' && a !== null) ? a.value : a;
    const valB = (typeof b === 'object' && b !== null) ? b.value : b;

    check(`field not stale: ${path}`, JSON.stringify(valA) !== JSON.stringify(valB),
      `low-throttle=${JSON.stringify(valA)} high-throttle=${JSON.stringify(valB)}`);
  }
}

// ---------------------------------------------------------------------------
// Run all tests
// ---------------------------------------------------------------------------
testThrottlePropagation();
testFaultCascade();
testPersistenceUsesSimTime();
testNoStaleFields([
  'engineModel.rpm',
  'engineModel.torque',
  'sensors.fuelFlow',
  'sensors.cht',
  'sensors.egt',
  'sensors.oilPressure',
  'sensors.vibration',
  'digitalTwin.expectedState.rpm',
  'deviations.rpm',
  'aiOutputs.soh',
  'aiOutputs.rul',
  'missionReliability.score',
]);

console.log(`\n✅ PASS: ${RESULTS.pass.length}`);
console.log(`❌ FAIL: ${RESULTS.fail.length}`);
if (RESULTS.fail.length > 0) {
  console.log('\nFailures:');
  for (const f of RESULTS.fail) {
    console.log(`  - ${f.name}\n      ${f.detail}`);
  }
  process.exitCode = 1;
}
