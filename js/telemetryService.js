/**
 * Real-Time Telemetry API Streaming Service
 * Dispatches simulated sensor payloads to external Digital Twin REST endpoint.
 * Gracefully handles offline fallback to "LOCAL SIMULATION MODE".
 */

export class TelemetryService {
  constructor(options = {}) {
    this.endpointUrl = options.endpointUrl || 'http://localhost:8000/api/telemetry';
    this.intervalMs = options.intervalMs || 1000; // 1Hz default
    this.isStreaming = false;
    this.connectionStatus = 'IDLE'; // 'CONNECTED', 'LOCAL SIMULATION MODE', 'STREAMING_OFF', 'CONNECTING'
    this.packetsSent = 0;
    this.packetsFailed = 0;
    this.lastPacketTime = null;
    this.lastLatencyMs = 0;
    this.timerId = null;
    this.latestPacket = null;
    this.history = []; // last 20 packets for UI log
    this.onStatusChange = options.onStatusChange || null;
    this.onPacketSent = options.onPacketSent || null;
  }

  setEndpoint(url) {
    this.endpointUrl = url.trim();
  }

  setInterval(ms) {
    this.intervalMs = Math.max(200, ms);
    if (this.isStreaming) {
      this.stop();
      this.start();
    }
  }

  start(packetProvider) {
    if (this.isStreaming) return;
    this.isStreaming = true;
    this.connectionStatus = 'CONNECTING';
    this._notifyStatus();

    this.timerId = setInterval(async () => {
      if (packetProvider) {
        const packet = packetProvider();
        await this.transmit(packet);
      }
    }, this.intervalMs);

    // Immediate first transmission
    if (packetProvider) {
      const packet = packetProvider();
      this.transmit(packet);
    }
  }

  stop() {
    this.isStreaming = false;
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.connectionStatus = 'LOCAL SIMULATION MODE';
    this._notifyStatus();
  }

  async transmit(packet) {
    this.latestPacket = packet;
    this.lastPacketTime = new Date();

    const tStart = performance.now();
    let isSuccess = false;

    try {
      // Abort controller with 2.5s timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const response = await fetch(this.endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(packet),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      this.lastLatencyMs = Math.round(performance.now() - tStart);

      if (response.ok) {
        this.packetsSent++;
        this.connectionStatus = 'CONNECTED';
        isSuccess = true;
      } else {
        this.packetsFailed++;
        this.connectionStatus = 'LOCAL SIMULATION MODE';
      }
    } catch (err) {
      // Network error, endpoint offline, or CORS restriction -> Local simulation fallback
      this.packetsFailed++;
      this.connectionStatus = 'LOCAL SIMULATION MODE';
      this.lastLatencyMs = Math.round(performance.now() - tStart);
    }

    // Save in packet history buffer
    this.history.unshift({
      timestamp: packet.timestamp,
      packet: packet,
      status: this.connectionStatus,
      latency: this.lastLatencyMs,
      success: isSuccess
    });
    if (this.history.length > 25) this.history.pop();

    this._notifyStatus();
    if (this.onPacketSent) {
      this.onPacketSent(packet, this.connectionStatus, this.lastLatencyMs);
    }
  }

  _notifyStatus() {
    if (this.onStatusChange) {
      this.onStatusChange({
        status: this.connectionStatus,
        isStreaming: this.isStreaming,
        packetsSent: this.packetsSent,
        packetsFailed: this.packetsFailed,
        lastPacketTime: this.lastPacketTime,
        latency: this.lastLatencyMs,
        endpoint: this.endpointUrl
      });
    }
  }
}
