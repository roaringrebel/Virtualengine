import { SimulationEngine } from '../src/simulation/simulationEngine';

console.log('========================================================================');
console.log('BHARAT AEROTWIN — MISSION RELIABILITY & DECISION VALIDATION');
console.log('========================================================================\n');

let allPassed = true;
function verify(condition: boolean, testId: string, desc: string) {
  if (condition) {
    console.log(`[PASS] ${testId}: ${desc}`);
  } else {
    console.error(`[FAIL] ${testId}: ${desc}`);
    allPassed = false;
  }
}

// 1. Initial / Nominal State -> Decision: GO
{
  const sim = new SimulationEngine();
  sim.setEngineOn(true);
  sim.setControl('throttle', 70);
  for (let i = 0; i < 40; i++) sim.update(0.1);

  const rel = sim.state.reliability;
  verify(
    rel.decision === 'GO' && rel.riskLevel === 'LOW' && rel.reliabilityScore >= 80 && rel.engineSOH >= 85,
    'TEST 1 — Nominal Cruise Reliability',
    `Reliability=${rel.reliabilityScore}%, SOH=${rel.engineSOH}%, RUL=${rel.rulHours}h, Risk=${rel.riskLevel}, Decision=${rel.decision}`
  );
}

// 2. Moderate Fault (Excessive Vibration) -> Decision: CAUTION
{
  const sim = new SimulationEngine();
  sim.setEngineOn(true);
  sim.setControl('throttle', 75);
  for (let i = 0; i < 30; i++) sim.update(0.1);

  sim.setFault('EXCESSIVE_VIBRATION', 'MEDIUM');
  for (let i = 0; i < 50; i++) sim.update(0.1);

  const rel = sim.state.reliability;
  verify(
    rel.decision === 'CAUTION' && rel.reliabilityScore < 80 && (rel.riskLevel === 'MEDIUM' || rel.riskLevel === 'HIGH'),
    'TEST 2 — Excessive Vibration Anomaly',
    `Vibration fault active: Reliability=${rel.reliabilityScore}%, SOH=${rel.engineSOH}%, FaultRisk=${rel.faultRiskPercent}%, Decision=${rel.decision} (${rel.decisionReason.substring(0, 45)}...)`
  );
}

// 3. Severe Overheating / Degradation -> Decision: NO-GO
{
  const sim = new SimulationEngine();
  sim.setEngineOn(true);
  sim.setControl('throttle', 85);
  for (let i = 0; i < 30; i++) sim.update(0.1);

  sim.setFault('OVERHEATING', 'HIGH');
  for (let i = 0; i < 80; i++) sim.update(0.1);

  const rel = sim.state.reliability;
  verify(
    rel.decision === 'NO-GO' && rel.riskLevel === 'CRITICAL' && rel.reliabilityScore < 60,
    'TEST 3 — Severe Thermal Anomaly & Mission NO-GO',
    `Overheating active: Reliability=${rel.reliabilityScore}%, SOH=${rel.engineSOH}%, RUL=${rel.rulHours}h, Risk=${rel.riskLevel}, Decision=${rel.decision}`
  );
}

// 4. Fault Clear & Recovery -> Decision Returns to GO
{
  const sim = new SimulationEngine();
  sim.setEngineOn(true);
  sim.setFault('OVERHEATING', 'HIGH');
  for (let i = 0; i < 60; i++) sim.update(0.1);

  sim.clearFault();
  for (let i = 0; i < 150; i++) sim.update(0.1);

  const rel = sim.state.reliability;
  verify(
    rel.decision === 'GO' && rel.reliabilityScore >= 80,
    'TEST 4 — Fault Recovery & Return to GO',
    `Thermodynamics cooled: Reliability=${rel.reliabilityScore}%, SOH=${rel.engineSOH}%, FaultRisk=${rel.faultRiskPercent}%, Decision=${rel.decision}`
  );
}

// 5. Terrain Elevation & AGL Height
{
  const sim = new SimulationEngine();
  sim.setEngineOn(true);
  sim.setControl('altitude', 8000);
  for (let i = 0; i < 20; i++) sim.update(0.1);

  const rel = sim.state.reliability;
  verify(
    rel.terrainElevationFt >= 0 && rel.aglAltitudeFt > 0,
    'TEST 5 — Simulated Terrain Elevation & AGL Height',
    `Alt(MSL)=${(rel.terrainElevationFt + sim.state.flight.altitude)}ft, Terrain=${rel.terrainElevationFt}ft, AGL=${rel.aglAltitudeFt}ft`
  );
}

// 6. Route Deviation
{
  const sim = new SimulationEngine();
  sim.setEngineOn(true);
  for (let i = 0; i < 20; i++) sim.update(0.1);

  const rel = sim.state.reliability;
  verify(
    rel.routeDeviationKm >= 0 && rel.routeDeviationKm < 15.0,
    'TEST 6 — Route Cross-Track Deviation',
    `Route Deviation=${rel.routeDeviationKm} km`
  );
}

console.log('\n========================================================================');
if (allPassed) {
  console.log('ALL MISSION RELIABILITY & DECISION TESTS PASSED!');
} else {
  console.error('ONE OR MORE TESTS FAILED!');
  process.exit(1);
}
console.log('========================================================================');
