import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function telemetryApiPlugin(): Plugin {
  let latestTelemetry: any = null;
  let receivedCount = 0;

  return {
    name: 'telemetry-api-middleware',
    configureServer(server) {
      server.middlewares.use('/api/telemetry', (req, res, next) => {
        // Enable CORS for cross-origin requests
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              latestTelemetry = JSON.parse(body);
              receivedCount++;
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                success: true,
                message: 'Telemetry received successfully',
                timestamp: new Date().toISOString(),
                sequence_number: latestTelemetry.sequence_number,
                simulation_id: latestTelemetry.simulation_id,
                packets_received: receivedCount
              }));
            } catch (err: any) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: 'Invalid JSON payload' }));
            }
          });
          return;
        }

        if (req.method === 'GET') {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: true,
            telemetry: latestTelemetry,
            timestamp: new Date().toISOString(),
            status: latestTelemetry ? 'LIVE' : 'WAITING_FOR_SIMULATOR'
          }));
          return;
        }

        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), telemetryApiPlugin()],
  server: {
    port: 4000,
    host: true
  }
});

