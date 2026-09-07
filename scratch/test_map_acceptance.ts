import { SimulationEngine, MISSION_WAYPOINTS } from '../src/simulation/simulationEngine';

console.log('========================================================================');
console.log('BHARAT AEROTWIN — MAP & FLIGHT DYNAMICS ACCEPTANCE VERIFICATION');
console.log('========================================================================\n');

let allPassed = true;
function check(condition: boolean, testId: string, desc: string) {
  if (condition) {
    console.log(`[PASS] ${testId}: ${desc}`);
  } else {
    console.error(`[FAIL] ${testId}: ${desc}`);
    allPassed = false;
  }
}

// 1. OpenStreetMap & Coordinates Initial Check
{
  const sim = new SimulationEngine();
  const initP = sim.getTelemetryPacket();
  check(
    initP.latitude === 32.5450 && initP.longitude === 77.2150,
    'CRITERIA 1',
    `Initial coords center at Base: (${initP.latitude}°N, ${initP.longitude}°E)`
  );
}

// 2. Waypoint Route Validity
{
  check(
    MISSION_WAYPOINTS.length === 6 &&
    MISSION_WAYPOINTS[0].name.includes('HOME') &&
    MISSION_WAYPOINTS[1].name.includes('WP1') &&
    MISSION_WAYPOINTS[2].name.includes('WP2') &&
    MISSION_WAYPOINTS[3].name.includes('WP3') &&
    MISSION_WAYPOINTS[4].name.includes('WP4'),
    'CRITERIA 2',
    `Waypoints form full 6-node closed tactical route: ${MISSION_WAYPOINTS.map(w => w.name.split('—')[0].trim()).join(' -> ')}`
  );
}

// 3. Movement Chain: Engine -> RPM -> Thrust -> Ground Speed -> Lat/Lon
{
  const sim = new SimulationEngine();
  sim.setEngineOn(true);
  sim.setControl('throttle', 85);
  sim.setControl('heading', 90); // Flying East

  const startLon = sim.getTelemetryPacket().longitude;
  for (let i = 0; i < 60; i++) sim.update(0.1); // 6 seconds of flight
  const midP = sim.getTelemetryPacket();

  check(
    midP.rpm > 4000 && midP.airspeed > 50 && midP.longitude > startLon,
    'CRITERIA 3',
    `Physics propagation: RPM=${midP.rpm.toFixed(0)}, Airspeed=${midP.airspeed} km/h, East Lon moved ${startLon.toFixed(5)} -> ${midP.longitude.toFixed(5)}`
  );
}

// 4. Heading & Wind Vector Affecting Ground Track
{
  const sim = new SimulationEngine();
  sim.setEngineOn(true);
  sim.setControl('throttle', 75);
  sim.setControl('heading', 0); // North
  sim.setControl('windSpeed', 30); // 30 km/h
  sim.setControl('windDirection', 270); // Wind blowing from West (towards East)

  for (let i = 0; i < 40; i++) sim.update(0.1);
  const windP = sim.getTelemetryPacket();

  check(
    windP.ground_track !== windP.heading && windP.ground_track > 0,
    'CRITERIA 4',
    `Wind vector drift: Heading=${windP.heading}°, Ground Track=${windP.ground_track}°, WindSpeed=${windP.wind_speed} km/h`
  );
}

// 5. Waypoint Autopilot Following
{
  const sim = new SimulationEngine();
  sim.setEngineOn(true);
  sim.setControl('throttle', 80);
  sim.setControl('navigationMode', 'WAYPOINT_ROUTE');

  // Let aircraft fly along the route
  for (let i = 0; i < 150; i++) sim.update(0.1);
  const pRoute = sim.getTelemetryPacket();

  check(
    pRoute.waypoint_distance_km !== 0 && pRoute.mission_progress > 0,
    'CRITERIA 5',
    `Waypoint Autopilot active: Current WP=${pRoute.waypoint}, Dist=${pRoute.waypoint_distance_km} km, Progress=${pRoute.mission_progress}%`
  );
}

// 6. Telemetry Consistency
{
  const sim = new SimulationEngine();
  sim.setEngineOn(true);
  sim.setControl('throttle', 70);
  for (let i = 0; i < 20; i++) sim.update(0.1);

  const state = sim.state;
  const packet = sim.getTelemetryPacket();

  check(
    state.flight.latitude === packet.latitude &&
    state.flight.longitude === packet.longitude &&
    state.flight.heading === packet.heading &&
    state.flight.altitude === packet.altitude,
    'CRITERIA 6',
    `Telemetry matches simulation state: Lat=${packet.latitude}, Lon=${packet.longitude}, Alt=${packet.altitude}ft, Hdg=${packet.heading}°`
  );
}

// 7. Pause & Reset
{
  const sim = new SimulationEngine();
  sim.setEngineOn(true);
  for (let i = 0; i < 50; i++) sim.update(0.1);
  sim.setPause(true);
  const pausedPos = { lat: sim.getTelemetryPacket().latitude, lon: sim.getTelemetryPacket().longitude };
  sim.update(0.1);
  const afterPause = { lat: sim.getTelemetryPacket().latitude, lon: sim.getTelemetryPacket().longitude };

  sim.resetSimulation();
  const resetP = sim.getTelemetryPacket();

  check(
    pausedPos.lat === afterPause.lat &&
    pausedPos.lon === afterPause.lon &&
    resetP.latitude === 32.5450 &&
    resetP.longitude === 77.2150 &&
    !resetP.engine_on,
    'CRITERIA 7',
    `Pause locks position (${pausedPos.lat}, ${pausedPos.lon}), Reset returns cleanly to Base (32.5450°N, 77.2150°E, Engine OFF)`
  );
}

console.log('\n========================================================================');
if (allPassed) {
  console.log('ALL MAP & FLIGHT DYNAMICS ACCEPTANCE TESTS PASSED!');
} else {
  console.error('FAILED ONE OR MORE ACCEPTANCE TESTS!');
  process.exit(1);
}
console.log('========================================================================');
