import { SimulationEngine } from '../src/simulation/simulationEngine';

console.log('====================================================');
console.log('BHARAT AEROTWIN — 10 FLIGHT & ENGINE VERIFICATION TESTS');
console.log('====================================================\n');

let allPassed = true;
function assert(condition: boolean, testName: string, detail: string) {
  if (condition) {
    console.log(`[PASS] ${testName}: ${detail}`);
  } else {
    console.error(`[FAIL] ${testName}: ${detail}`);
    allPassed = false;
  }
}

// ----------------------------------------------------
// TEST 1: Continuous Kinematic Geodesic Movement
// ----------------------------------------------------
{
  const sim = new SimulationEngine();
  sim.setEngineOn(true);
  const initialLat = sim.getTelemetryPacket().latitude;
  const initialLon = sim.getTelemetryPacket().longitude;

  // Run 10 seconds of physics integration (dt = 0.1s x 100 steps)
  for (let i = 0; i < 100; i++) {
    sim.update(0.1);
  }
  const currentPacket = sim.getTelemetryPacket();
  const movedDistance = Math.hypot(currentPacket.latitude - initialLat, currentPacket.longitude - initialLon);
  assert(
    movedDistance > 0.001 && currentPacket.airspeed > 50,
    'TEST 1 - UAV Geodesic Motion',
    `UAV moved from (${initialLat.toFixed(4)}, ${initialLon.toFixed(4)}) to (${currentPacket.latitude.toFixed(4)}, ${currentPacket.longitude.toFixed(4)}) at ${currentPacket.ground_speed.toFixed(1)} km/h`
  );
}

// ----------------------------------------------------
// TEST 2: Smooth Inertial Turn from 223 deg to 270 deg
// ----------------------------------------------------
{
  const sim = new SimulationEngine();
  sim.setEngineOn(true);
  sim.setControl('navigationMode', 'MANUAL_PILOT');
  sim.setControl('airspeed', 100);
  sim.setControl('heading', 223);
  sim.update(0.1);
  
  // Command target heading 270 deg
  sim.setControl('targetHeading', 270);
  
  const headingTrace: number[] = [];
  for (let i = 0; i < 160; i++) { // 16 seconds of gradual turning at ~3-4 deg/s
    sim.update(0.1);
    if (i % 20 === 0) headingTrace.push(Number(sim.getTelemetryPacket().heading.toFixed(1)));
  }
  
  const finalHeading = sim.getTelemetryPacket().heading;
  const turningSmoothly = headingTrace[0] < headingTrace[2] && headingTrace[2] < headingTrace[4];
  const reachedClose = Math.abs(finalHeading - 270) < 3.0;

  assert(
    turningSmoothly && reachedClose,
    'TEST 2 - Smooth Inertial Heading Turn',
    `Turned smoothly 223° -> 270°: start=${headingTrace[0]}°, mid=${headingTrace[3]}°, final=${finalHeading.toFixed(1)}°`
  );
}

// ----------------------------------------------------
// TEST 3: Throttle Increase 50% -> 80%
// ----------------------------------------------------
{
  const sim = new SimulationEngine();
  sim.setEngineOn(true);
  sim.setControl('throttle', 50);
  for (let i = 0; i < 50; i++) sim.update(0.1);

  const p50 = sim.getTelemetryPacket();

  sim.setControl('throttle', 80);
  for (let i = 0; i < 80; i++) sim.update(0.1);

  const p80 = sim.getTelemetryPacket();

  const rpmIncreased = p80.rpm > p50.rpm;
  const loadIncreased = p80.engine_load > p50.engine_load;
  const fuelIncreased = p80.fuel_flow > p50.fuel_flow;
  const speedIncreased = p80.airspeed >= p50.airspeed;

  assert(
    rpmIncreased && loadIncreased && fuelIncreased && speedIncreased,
    'TEST 3 - Throttle Engine & Airspeed Response',
    `50%->80% Throttle: RPM: ${p50.rpm.toFixed(0)}->${p80.rpm.toFixed(0)}, Load: ${p50.engine_load.toFixed(1)}%->${p80.engine_load.toFixed(1)}%, Fuel: ${p50.fuel_flow.toFixed(1)}->${p80.fuel_flow.toFixed(1)} L/h, Airspeed: ${p50.airspeed.toFixed(1)}->${p80.airspeed.toFixed(1)} km/h`
  );
}

// ----------------------------------------------------
// TEST 4: Altitude Target Change 8000 ft -> 12000 ft
// ----------------------------------------------------
{
  const sim = new SimulationEngine();
  sim.setEngineOn(true);
  sim.setControl('navigationMode', 'MANUAL_PILOT');
  sim.setControl('altitude', 8000);
  sim.setControl('throttle', 90);
  sim.setControl('airspeed', 140);
  for (let i = 0; i < 30; i++) sim.update(0.1);
  const initialAlt = sim.getTelemetryPacket().altitude;

  sim.setControl('targetAltitude', 12000);
  
  let positiveClimbSeen = false;
  for (let i = 0; i < 300; i++) { // 30 seconds of climb
    sim.update(0.1);
    if (sim.getTelemetryPacket().vertical_speed > 300) {
      positiveClimbSeen = true;
    }
  }
  const climbingAlt = sim.getTelemetryPacket().altitude;

  assert(
    positiveClimbSeen && climbingAlt > initialAlt + 200,
    'TEST 4 - Smooth Vertical Climbing Motion',
    `Target 12000 ft: Initial=${initialAlt.toFixed(0)} ft, Climbing altitude=${climbingAlt.toFixed(0)} ft, VSI=${sim.getTelemetryPacket().vertical_speed.toFixed(0)} ft/min`
  );
}

// ----------------------------------------------------
// TEST 5: Waypoint Autopilot Navigation
// ----------------------------------------------------
{
  const sim = new SimulationEngine();
  sim.setEngineOn(true);
  sim.setControl('navigationMode', 'WAYPOINT_ROUTE');

  for (let i = 0; i < 200; i++) {
    sim.update(0.1);
  }
  const progress = sim.state.flight.missionProgressPercent;

  assert(
    progress > 0.02,
    'TEST 5 - Waypoint Autopilot Navigation',
    `Autopilot steered towards WP, mission progress: ${progress.toFixed(1)}%, current WP: ${sim.state.flight.currentWaypointName}`
  );
}

// ----------------------------------------------------
// TEST 6: Fault Injection - Excessive Vibration
// ----------------------------------------------------
{
  const sim = new SimulationEngine();
  sim.setEngineOn(true);
  for (let i = 0; i < 40; i++) sim.update(0.1);
  const normVib = sim.getTelemetryPacket().vibration;

  sim.setFault('EXCESSIVE_VIBRATION', 'HIGH');
  for (let i = 0; i < 50; i++) sim.update(0.1);
  const faultPacket = sim.getTelemetryPacket();

  assert(
    faultPacket.vibration > normVib * 2 && faultPacket.fault === 'EXCESSIVE_VIBRATION',
    'TEST 6 - Excessive Vibration Fault Effect',
    `Normal Vib: ${normVib.toFixed(2)} mm/s -> Fault Vib: ${faultPacket.vibration.toFixed(2)} mm/s, Fault string: ${faultPacket.fault}`
  );
}

// ----------------------------------------------------
// TEST 7: Fault Injection - Overheating / High CHT
// ----------------------------------------------------
{
  const sim = new SimulationEngine();
  sim.setEngineOn(true);
  for (let i = 0; i < 40; i++) sim.update(0.1);
  const normCHT = sim.getTelemetryPacket().cht;

  sim.setFault('OVERHEATING', 'HIGH');
  for (let i = 0; i < 80; i++) sim.update(0.1);
  const hotPacket = sim.getTelemetryPacket();

  assert(
    hotPacket.cht > normCHT + 15 && hotPacket.oil_temperature > 95,
    'TEST 7 - Overheating Thermal Dynamics',
    `Normal CHT: ${normCHT.toFixed(1)}°C -> Overheating CHT: ${hotPacket.cht.toFixed(1)}°C, Oil Temp: ${hotPacket.oil_temperature.toFixed(1)}°C`
  );
}

// ----------------------------------------------------
// TEST 8: Fault Injection - Low Oil Pressure
// ----------------------------------------------------
{
  const sim = new SimulationEngine();
  sim.setEngineOn(true);
  for (let i = 0; i < 40; i++) sim.update(0.1);
  const normOilP = sim.getTelemetryPacket().oil_pressure;

  sim.setFault('LOW_OIL_PRESSURE', 'HIGH');
  for (let i = 0; i < 50; i++) sim.update(0.1);
  const lowOilPPacket = sim.getTelemetryPacket();

  assert(
    lowOilPPacket.oil_pressure < 2.5 && lowOilPPacket.oil_pressure < normOilP,
    'TEST 8 - Low Oil Pressure Fault Effect',
    `Normal Oil Pressure: ${normOilP.toFixed(2)} bar -> Fault Oil Pressure: ${lowOilPPacket.oil_pressure.toFixed(2)} bar`
  );
}

// ----------------------------------------------------
// TEST 9: Pause / Stop Simulation
// ----------------------------------------------------
{
  const sim = new SimulationEngine();
  sim.setEngineOn(true);
  for (let i = 0; i < 20; i++) sim.update(0.1);

  sim.setPause(true);
  const pausedLat = sim.getTelemetryPacket().latitude;
  const pausedLon = sim.getTelemetryPacket().longitude;

  // Attempt update while paused
  sim.update(0.1);
  sim.update(0.1);

  const afterUpdatePacket = sim.getTelemetryPacket();
  assert(
    afterUpdatePacket.latitude === pausedLat && afterUpdatePacket.longitude === pausedLon,
    'TEST 9 - Pause Simulation Lock',
    `Simulation paused: Lat/Lon remained fixed at (${pausedLat.toFixed(5)}, ${pausedLon.toFixed(5)})`
  );
}

// ----------------------------------------------------
// TEST 10: Reset Simulation
// ----------------------------------------------------
{
  const sim = new SimulationEngine();
  sim.setEngineOn(true);
  for (let i = 0; i < 100; i++) sim.update(0.1);

  sim.resetSimulation();
  const resetPacket = sim.getTelemetryPacket();

  assert(
    Math.abs(resetPacket.latitude - 16.4941) < 0.001 && Math.abs(resetPacket.longitude - 80.4982) < 0.001,
    'TEST 10 - Reset Simulation Coordinates',
    `Reset restored base position: (${resetPacket.latitude.toFixed(4)}°N, ${resetPacket.longitude.toFixed(4)}°E)`
  );
}

console.log('\n====================================================');
if (allPassed) {
  console.log('ALL 10 TESTS PASSED PERFECTLY!');
} else {
  console.error('SOME TESTS FAILED!');
  process.exit(1);
}
console.log('====================================================');
