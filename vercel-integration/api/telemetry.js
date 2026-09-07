/**
 * Vercel Serverless Function: /api/telemetry
 * Handles GET, POST, OPTIONS for telemetry synchronization between
 * Website 1 (Simulator) and Website 2 (Digital Twin)
 */

let latestTelemetryState = null;
let lastUpdateTime = 0;
let totalPacketsReceived = 0;

module.exports = async function handler(req, res) {
  // CORS configuration
  const allowedOrigins = [
    'http://localhost:4000',
    'http://127.0.0.1:4000',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'https://sihaimodel.vercel.app'
  ];

  const origin = req.headers.origin;
  if (origin && (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      const rawPacket = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      if (!rawPacket || typeof rawPacket !== 'object') {
        return res.status(400).json({ success: false, error: 'Invalid telemetry payload' });
      }

      const normalizedPacket = {
        timestamp: rawPacket.timestamp || new Date().toISOString(),
        simulation_id: rawPacket.simulation_id || 'SIM-DEFAULT',
        sequence_number: Number(rawPacket.sequence_number || 0),
        aircraft: rawPacket.aircraft || 'MALE_UAV',
        engine: rawPacket.engine || 'ROTAX_912_ULS',
        flight_phase: rawPacket.flight_phase || rawPacket.flightPhase || 'CRUISE',
        engine_on: rawPacket.engine_on !== undefined ? Boolean(rawPacket.engine_on) : true,

        // 9 Sensors
        rpm: Number(rawPacket.rpm ?? 0),
        cht: Number(rawPacket.cht ?? 0),
        egt: Number(rawPacket.egt ?? 0),
        oil_pressure: Number(rawPacket.oil_pressure ?? rawPacket.oilPressure ?? 0),
        oil_temperature: Number(rawPacket.oil_temperature ?? rawPacket.oil_temp ?? rawPacket.oilTemperature ?? 0),
        oil_temp: Number(rawPacket.oil_temp ?? rawPacket.oil_temperature ?? 0),
        vibration: Number(rawPacket.vibration ?? 0),
        fuel_flow: Number(rawPacket.fuel_flow ?? rawPacket.fuelFlow ?? 0),
        fuel_pressure: Number(rawPacket.fuel_pressure ?? rawPacket.fuelPressure ?? 0),
        map: Number(rawPacket.map ?? rawPacket.manifold_pressure ?? 29.92),

        // Flight Dynamics
        latitude: Number(rawPacket.latitude ?? rawPacket.lat ?? 32.5450),
        longitude: Number(rawPacket.longitude ?? rawPacket.lon ?? 77.2150),
        altitude: Number(rawPacket.altitude ?? 0),
        airspeed: Number(rawPacket.airspeed ?? 0),
        ground_speed: Number(rawPacket.ground_speed ?? rawPacket.groundSpeed ?? rawPacket.airspeed ?? 0),
        vertical_speed: Number(rawPacket.vertical_speed ?? rawPacket.verticalSpeed ?? 0),
        heading: Number(rawPacket.heading ?? 270),
        ground_track: Number(rawPacket.ground_track ?? rawPacket.groundTrack ?? rawPacket.heading ?? 270),

        // Targets & Waypoints
        target_heading: Number(rawPacket.target_heading ?? rawPacket.targetHeading ?? rawPacket.heading ?? 270),
        target_altitude: Number(rawPacket.target_altitude ?? rawPacket.targetAltitude ?? rawPacket.altitude ?? 8000),
        target_airspeed: Number(rawPacket.target_airspeed ?? rawPacket.targetAirspeed ?? rawPacket.airspeed ?? 145),
        waypoint: rawPacket.waypoint || rawPacket.currentWaypointName || 'WP1',
        waypoint_distance_km: Number(rawPacket.waypoint_distance_km ?? rawPacket.distanceToWaypointKm ?? 0),
        mission_progress: Number(rawPacket.mission_progress ?? rawPacket.missionProgressPercent ?? 0),

        // Controls & Environment
        throttle: Number(rawPacket.throttle ?? 70),
        engine_load: Number(rawPacket.engine_load ?? rawPacket.engineLoad ?? 70),
        engineLoad: Number(rawPacket.engineLoad ?? rawPacket.engine_load ?? 70),
        ambient_temperature: Number(rawPacket.ambient_temperature ?? rawPacket.ambient_temp ?? 30),
        ambient_temp: Number(rawPacket.ambient_temp ?? rawPacket.ambient_temperature ?? 30),
        wind_speed: Number(rawPacket.wind_speed ?? rawPacket.windSpeed ?? 12),
        wind_direction: Number(rawPacket.wind_direction ?? rawPacket.windDirection ?? 240),

        // Faults
        fault: String(rawPacket.fault || 'NORMAL'),
        fault_severity: Number(rawPacket.fault_severity ?? 0),
        preset: rawPacket.preset || (rawPacket.fault && rawPacket.fault !== 'NORMAL' ? String(rawPacket.fault).toLowerCase() : 'nominal'),
        afr: Number(rawPacket.afr ?? (rawPacket.fault === 'FUEL_PRESSURE_DROP' ? 17.2 : 14.7))
      };

      latestTelemetryState = normalizedPacket;
      lastUpdateTime = Date.now();
      totalPacketsReceived++;

      return res.status(200).json({
        success: true,
        message: 'Telemetry received and synchronized successfully',
        timestamp: new Date().toISOString(),
        sequence_number: normalizedPacket.sequence_number,
        simulation_id: normalizedPacket.simulation_id,
        packets_received: totalPacketsReceived
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: 'Failed to process telemetry payload',
        details: err?.message
      });
    }
  }

  if (req.method === 'GET') {
    const now = Date.now();
    const ageMs = latestTelemetryState ? now - lastUpdateTime : null;
    const isLive = ageMs !== null && ageMs < 6000;
    const isStale = ageMs !== null && ageMs >= 6000 && ageMs < 12000;

    return res.status(200).json({
      success: true,
      telemetry: latestTelemetryState,
      status: !latestTelemetryState ? 'WAITING_FOR_SIMULATOR' : isLive ? 'LIVE' : isStale ? 'STALE' : 'OFFLINE',
      age_ms: ageMs,
      timestamp: new Date().toISOString()
    });
  }

  return res.status(405).json({ success: false, error: 'Method Not Allowed' });
};
