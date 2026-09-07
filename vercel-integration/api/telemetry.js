/**
 * Vercel Serverless Function: /api/telemetry
 * Handles GET, POST, OPTIONS for telemetry synchronization
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      const packet = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      if (!packet || typeof packet !== 'object') {
        return res.status(400).json({ success: false, error: 'Invalid telemetry payload' });
      }

      latestTelemetryState = packet;
      lastUpdateTime = Date.now();
      totalPacketsReceived++;

      return res.status(200).json({
        success: true,
        message: 'Telemetry received successfully',
        timestamp: new Date().toISOString(),
        sequence_number: packet.sequence_number,
        simulation_id: packet.simulation_id,
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
