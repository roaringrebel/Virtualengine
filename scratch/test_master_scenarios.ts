import { SimulationEngine } from '../src/simulation/simulationEngine';

console.log('========================================================================');
console.log('BHARAT AEROTWIN — 13 MASTER PHYSICS & UAV CONSISTENCY TESTS (TEST A - M)');
console.log('========================================================================\n');

let allPassed = true;
function assert(condition: boolean, testName: string, detail: string) {
  if (condition) {
    console.log(`[PASS] ${testName}: ${detail}`);
  } else {
    console.error(`[FAIL] ${testName}: ${detail}`);
    allPassed = false;
  }
}

// ----------------------------------------------------------------------
// TEST A — ENGINE OFF
// Expected: RPM = 0, Fuel Flow = 0, Oil Pressure = 0, UAV stationary.
// ----------------------------------------------------------------------
{
  const sim = new SimulationEngine();
  for (let i = 0; i < 20; i++) sim.update(0.1);
  const p = sim.getTelemetryPacket();

  assert(
    p.rpm === 0 && p.fuel_flow === 0 && p.oil_pressure === 0 && p.airspeed === 0 && p.ground_speed === 0,
    'TEST A — Engine OFF',
    `RPM=${p.rpm}, FuelFlow=${p.fuel_flow}, OilPressure=${p.oil_pressure}, Speed=${p.airspeed} km/h (Engine OFF Standby)`
  );
}

// ----------------------------------------------------------------------
// TEST B — START ENGINE
// Expected: RPM gradually increases, oil pressure rises, fuel flow becomes non-zero, engine reaches idle.
// ----------------------------------------------------------------------
{
  const sim = new SimulationEngine();
  sim.setEngineOn(true);
  
  for (let i = 0; i < 35; i++) sim.update(0.1);
  const p = sim.getTelemetryPacket();

  assert(
    p.rpm >= 1600 && p.fuel_flow > 2.0 && p.oil_pressure > 3.0,
    'TEST B — Start Engine Startup Sequence',
    `Spool to Idle: RPM=${p.rpm.toFixed(0)}, FuelFlow=${p.fuel_flow.toFixed(1)} L/h, OilPressure=${p.oil_pressure.toFixed(1)} bar`
  );
}

// ----------------------------------------------------------------------
// TEST C — INCREASE THROTTLE
// Expected: RPM increases, engine load increases, fuel flow increases, power increases, UAV accelerates, airspeed increases.
// ----------------------------------------------------------------------
{
  const sim = new SimulationEngine();
  sim.setEngineOn(true);
  sim.setControl('throttle', 40);
  for (let i = 0; i < 50; i++) sim.update(0.1);
  const p40 = sim.getTelemetryPacket();

  sim.setControl('throttle', 85);
  for (let i = 0; i < 80; i++) sim.update(0.1);
  const p85 = sim.getTelemetryPacket();

  assert(
    p85.rpm > p40.rpm && p85.engine_load > p40.engine_load && p85.fuel_flow > p40.fuel_flow && p85.airspeed > p40.airspeed,
    'TEST C — Increase Throttle Coupling',
    `40%->85% Throttle: RPM: ${p40.rpm.toFixed(0)}->${p85.rpm.toFixed(0)}, Load: ${p40.engine_load}%->${p85.engine_load}%, Fuel: ${p40.fuel_flow.toFixed(1)}->${p85.fuel_flow.toFixed(1)} L/h, Speed: ${p40.airspeed.toFixed(1)}->${p85.airspeed.toFixed(1)} km/h`
  );
}

// ----------------------------------------------------------------------
// TEST D — TARGET ALTITUDE (8000 ft)
// Expected: UAV climbs gradually, altitude changes continuously.
// ----------------------------------------------------------------------
{
  const sim = new SimulationEngine();
  sim.setEngineOn(true);
  sim.setControl('throttle', 80);
  sim.setControl('altitude', 2000);
  for (let i = 0; i < 30; i++) sim.update(0.1);

  sim.setControl('targetAltitude', 8000);
  for (let i = 0; i < 350; i++) sim.update(0.1); // 35 seconds of climb
  const pClimb = sim.getTelemetryPacket();

  assert(
    pClimb.altitude > 2300 && pClimb.vertical_speed > 250,
    'TEST D — Target Altitude Climb',
    `Climbing towards 8,000 ft: Initial=2,000 ft -> Current=${pClimb.altitude} ft, VSI=+${pClimb.vertical_speed} ft/min`
  );
}

// ----------------------------------------------------------------------
// TEST E — TARGET HEADING (270°)
// Expected: UAV smoothly turns toward 270°.
// ----------------------------------------------------------------------
{
  const sim = new SimulationEngine();
  sim.setEngineOn(true);
  sim.setControl('navigationMode', 'MANUAL_PILOT');
  sim.setControl('airspeed', 100);
  sim.setControl('heading', 220);
  sim.update(0.1);

  sim.setControl('targetHeading', 270);
  const headingSteps: number[] = [];
  for (let i = 0; i < 180; i++) { // 18 seconds of turning
    sim.update(0.1);
    if (i % 25 === 0) headingSteps.push(sim.getTelemetryPacket().heading);
  }
  const finalHdg = sim.getTelemetryPacket().heading;

  assert(
    headingSteps[0] < headingSteps[2] && Math.abs(finalHdg - 270) < 3.0,
    'TEST E — Target Heading Smooth Turn',
    `Turned smoothly 220° -> 270°: start=${headingSteps[0]}°, mid=${headingSteps[3]}°, final=${finalHdg}°`
  );
}

// ----------------------------------------------------------------------
// TEST F — TARGET AIRSPEED (145 km/h)
// Expected: UAV gradually approaches 145 km/h.
// ----------------------------------------------------------------------
{
  const sim = new SimulationEngine();
  sim.setEngineOn(true);
  sim.setControl('throttle', 75);
  sim.setControl('airspeed', 80);
  sim.setControl('targetAirspeed', 145);

  const speedTrace: number[] = [];
  for (let i = 0; i < 80; i++) {
    sim.update(0.1);
    if (i % 15 === 0) speedTrace.push(sim.getTelemetryPacket().airspeed);
  }
  const finalSpeed = sim.getTelemetryPacket().airspeed;

  assert(
    speedTrace[0] < speedTrace[2] && finalSpeed >= 120,
    'TEST F — Target Airspeed Acceleration',
    `Accelerated 80 -> 145 km/h: start=${speedTrace[0]} km/h, mid=${speedTrace[2]} km/h, final=${finalSpeed} km/h`
  );
}

// ----------------------------------------------------------------------
// TEST G — WAYPOINT AUTO
// Expected: UAV actually moves between geographic waypoints.
// ----------------------------------------------------------------------
{
  const sim = new SimulationEngine();
  sim.setEngineOn(true);
  sim.setControl('navigationMode', 'WAYPOINT_ROUTE');
  const startLat = sim.getTelemetryPacket().latitude;
  const startLon = sim.getTelemetryPacket().longitude;

  for (let i = 0; i < 300; i++) sim.update(0.1);
  const pWp = sim.getTelemetryPacket();
  const moved = Math.hypot(pWp.latitude - startLat, pWp.longitude - startLon);

  assert(
    moved > 0.001 && pWp.mission_progress > 0,
    'TEST G — Waypoint Autopilot Route Navigation',
    `Navigating to ${pWp.waypoint}: (${startLat.toFixed(4)}, ${startLon.toFixed(4)}) -> (${pWp.latitude.toFixed(4)}, ${pWp.longitude.toFixed(4)}), Progress=${pWp.mission_progress}%`
  );
}

// ----------------------------------------------------------------------
// TEST H — WIND VECTOR
// Expected: Heading and ground track are different, ground speed changes with wind.
// ----------------------------------------------------------------------
{
  const sim = new SimulationEngine();
  sim.setEngineOn(true);
  sim.setControl('heading', 270);
  sim.setControl('windSpeed', 35); // 35 km/h crosswind
  sim.setControl('windDirection', 180); // From South
  for (let i = 0; i < 40; i++) sim.update(0.1);
  const pWind = sim.getTelemetryPacket();

  assert(
    pWind.heading !== pWind.ground_track && pWind.ground_speed !== pWind.airspeed,
    'TEST H — Atmospheric Wind Vector Resolution',
    `Heading=${pWind.heading}° vs GroundTrack=${pWind.ground_track}°, TAS=${pWind.airspeed} km/h vs GroundSpeed=${pWind.ground_speed} km/h`
  );
}

// ----------------------------------------------------------------------
// TEST I — EXCESSIVE VIBRATION FAULT
// Expected: Vibration increases, RPM instability increases, engine condition decreases, available power decreases.
// ----------------------------------------------------------------------
{
  const sim = new SimulationEngine();
  sim.setEngineOn(true);
  for (let i = 0; i < 30; i++) sim.update(0.1);
  const normalVib = sim.getTelemetryPacket().vibration;

  sim.setFault('EXCESSIVE_VIBRATION', 'HIGH');
  for (let i = 0; i < 50; i++) sim.update(0.1);
  const pVib = sim.getTelemetryPacket();

  assert(
    pVib.vibration > normalVib * 2 && pVib.vibration > 6.0 && (pVib.engine_condition ?? 1.0) < 0.90,
    'TEST I — Excessive Vibration Fault Propagation',
    `Nominal Vib=${normalVib.toFixed(2)} mm/s -> Fault Vib=${pVib.vibration.toFixed(2)} mm/s, EngineCondition=${pVib.engine_condition}`
  );
}

// ----------------------------------------------------------------------
// TEST J — OVERHEATING FAULT
// Expected: CHT increases, oil temperature increases, engine performance decreases.
// ----------------------------------------------------------------------
{
  const sim = new SimulationEngine();
  sim.setEngineOn(true);
  for (let i = 0; i < 30; i++) sim.update(0.1);
  const normCht = sim.getTelemetryPacket().cht;

  sim.setFault('OVERHEATING', 'HIGH');
  for (let i = 0; i < 80; i++) sim.update(0.1);
  const pHot = sim.getTelemetryPacket();

  assert(
    pHot.cht > normCht + 15 && pHot.oil_temperature > 95,
    'TEST J — Overheating Thermal Rise',
    `Nominal CHT=${normCht.toFixed(1)}°C -> Overheating CHT=${pHot.cht.toFixed(1)}°C, OilTemp=${pHot.oil_temperature.toFixed(1)}°C`
  );
}

// ----------------------------------------------------------------------
// TEST K — CLEAR FAULT
// Expected: Parameters gradually return toward normal.
// ----------------------------------------------------------------------
{
  const sim = new SimulationEngine();
  sim.setEngineOn(true);
  sim.setFault('OVERHEATING', 'HIGH');
  for (let i = 0; i < 60; i++) sim.update(0.1);
  const hotCht = sim.getTelemetryPacket().cht;

  sim.clearFault();
  for (let i = 0; i < 150; i++) sim.update(0.1);
  const recoveredCht = sim.getTelemetryPacket().cht;

  assert(
    recoveredCht < hotCht && sim.getTelemetryPacket().fault === 'NORMAL',
    'TEST K — Clear Fault & Recovery',
    `Overheated CHT=${hotCht.toFixed(1)}°C -> Recovered CHT=${recoveredCht.toFixed(1)}°C, Fault=${sim.getTelemetryPacket().fault}`
  );
}

// ----------------------------------------------------------------------
// TEST L — PAUSE SIMULATION
// Expected: UAV stops moving, physics stops.
// ----------------------------------------------------------------------
{
  const sim = new SimulationEngine();
  sim.setEngineOn(true);
  for (let i = 0; i < 30; i++) sim.update(0.1);

  sim.setPause(true);
  const pausedLat = sim.getTelemetryPacket().latitude;
  const pausedLon = sim.getTelemetryPacket().longitude;

  sim.update(0.1);
  sim.update(0.1);
  const afterPause = sim.getTelemetryPacket();

  assert(
    afterPause.latitude === pausedLat && afterPause.longitude === pausedLon,
    'TEST L — Pause Simulation Lock',
    `Lat/Lon locked at (${pausedLat.toFixed(5)}, ${pausedLon.toFixed(5)})`
  );
}

// ----------------------------------------------------------------------
// TEST M — RESET SIMULATION
// Expected: UAV returns to base, engine OFF, mission resets.
// ----------------------------------------------------------------------
{
  const sim = new SimulationEngine();
  sim.setEngineOn(true);
  for (let i = 0; i < 100; i++) sim.update(0.1);

  sim.resetSimulation();
  const resetP = sim.getTelemetryPacket();

  assert(
    !resetP.engine_on && resetP.rpm === 0 && resetP.altitude === 0 && resetP.airspeed === 0 &&
    Math.abs(resetP.latitude - 16.4941) < 0.001 && Math.abs(resetP.longitude - 80.4982) < 0.001,
    'TEST M — Reset Simulation to Base',
    `EngineOn=${resetP.engine_on}, RPM=${resetP.rpm}, Alt=${resetP.altitude} ft, Pos=(${resetP.latitude}°N, ${resetP.longitude}°E)`
  );
}

console.log('\n========================================================================');
if (allPassed) {
  console.log('ALL 13 MASTER TESTS (TEST A - TEST M) PASSED PERFECTLY!');
} else {
  console.error('SOME TESTS FAILED!');
  process.exit(1);
}
console.log('========================================================================');
