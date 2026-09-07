import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Shared in-memory cache for the serverless container instance.
 * For multi-region persistent shared state across all serverless cold-starts,
 * you can optionally set UPSTASH_REDIS_REST_URL / KV_REST_API_URL or SUPABASE_URL in Vercel env vars.
 */
let latestTelemetryState: any = null;
let lastUpdateTime = 0;
let totalPacketsReceived = 0;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Configure CORS
  const allowedOrigins = [
    'http://localhost:4000',
    'http://127.0.0.1:4000',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'https://sihaimodel.vercel.app'
  ];

  const origin = req.headers.origin as string;
  if (origin && (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 2. Handle POST /api/telemetry (Website 1 -> Website 2 API)
  if (req.method === 'POST') {
    try {
      const packet = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      if (!packet || typeof packet !== 'object') {
        return res.status(400).json({ success: false, error: 'Invalid telemetry payload' });
      }

      // Store in memory
      latestTelemetryState = packet;
      lastUpdateTime = Date.now();
      totalPacketsReceived++;

      // Optional: If KV / Upstash Redis or Supabase is present in environment, persist asynchronously
      if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
        try {
          fetch(`${process.env.KV_REST_API_URL}/set/latest_telemetry`, {
            headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
            method: 'POST',
            body: JSON.stringify(packet)
          }).catch(() => {});
        } catch (_) {}
      }

      return res.status(200).json({
        success: true,
        message: 'Telemetry received successfully',
        timestamp: new Date().toISOString(),
        sequence_number: packet.sequence_number,
        simulation_id: packet.simulation_id,
        packets_received: totalPacketsReceived
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: 'Failed to process telemetry payload',
        details: err?.message
      });
    }
  }

  // 3. Handle GET /api/telemetry (Website 2 Dashboard Poller)
  if (req.method === 'GET') {
    // Check staleness (if no packet received in > 10 seconds)
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
}
