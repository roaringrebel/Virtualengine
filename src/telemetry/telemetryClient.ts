import { TelemetryClientStatus, TelemetryPacket } from '../types/telemetry';

export class TelemetryClient {
  public endpoint: string = 'https://sihaimodel.vercel.app/api/telemetry';
  public isStreaming: boolean = true;
  public status: TelemetryClientStatus['status'] = 'LOCAL_SIMULATION_MODE';
  public packetsSent: number = 0;
  public packetsFailed: number = 0;
  public lastTransmissionTime: string | null = null;
  public lastHttpStatus: number | null = null;
  public lastError: string | null = null;
  public latencyMs: number = 0;
  public transmissionRateHz: number = 1;
  public simulationId: string = 'SIM-ROTAX-001';
  public sequenceNumber: number = 0;

  private timerId: number | null = null;
  private onStatusCallback: ((status: TelemetryClientStatus) => void) | null = null;
  private onPacketCallback: ((packet: TelemetryPacket) => void) | null = null;

  constructor(endpoint?: string) {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('virtualengine_telemetry_endpoint');
      if (saved) {
        this.endpoint = saved;
      } else if (endpoint) {
        this.endpoint = this.normalizeEndpoint(endpoint);
      }
    } else if (endpoint) {
      this.endpoint = this.normalizeEndpoint(endpoint);
    }
  }

  public normalizeEndpoint(input: string): string {
    let clean = input.trim();
    if (!clean) return 'http://localhost:4000/api/telemetry';

    // If input is purely a port number like "3000" or "5000"
    if (/^\d{2,5}$/.test(clean)) {
      return `http://localhost:${clean}/api/telemetry`;
    }
    // If input is ":3000" or "localhost:3000"
    if (/^:\d{2,5}$/.test(clean)) {
      return `http://localhost${clean}/api/telemetry`;
    }
    if (/^localhost:\d{2,5}/i.test(clean)) {
      return clean.includes('/api/telemetry') ? `http://${clean}` : `http://${clean}/api/telemetry`;
    }
    if (/^127\.0\.0\.1:\d{2,5}/i.test(clean)) {
      return clean.includes('/api/telemetry') ? `http://${clean}` : `http://${clean}/api/telemetry`;
    }
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = `http://${clean}`;
    }
    return clean;
  }

  public setEndpoint(urlOrPort: string): void {
    this.endpoint = this.normalizeEndpoint(urlOrPort);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('virtualengine_telemetry_endpoint', this.endpoint);
      } catch (_) {}
    }
    this.notifyStatus();
  }

  public subscribe(
    onStatus: (status: TelemetryClientStatus) => void,
    onPacket: (packet: TelemetryPacket) => void
  ): () => void {
    this.onStatusCallback = onStatus;
    this.onPacketCallback = onPacket;
    this.notifyStatus();

    return () => {
      this.onStatusCallback = null;
      this.onPacketCallback = null;
    };
  }

  public startStreaming(packetProvider: () => TelemetryPacket): void {
    if (this.timerId) clearInterval(this.timerId);
    this.isStreaming = true;
    this.status = 'CONNECTING';
    this.notifyStatus();

    const intervalMs = Math.round(1000 / this.transmissionRateHz);

    // Initial transmission
    const initialPacket = packetProvider();
    this.transmit(initialPacket);

    this.timerId = window.setInterval(async () => {
      const packet = packetProvider();
      await this.transmit(packet);
    }, intervalMs);
  }

  public stopStreaming(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.isStreaming = false;
    this.status = 'LOCAL_SIMULATION_MODE';
    this.notifyStatus();
  }

  public async transmit(packet: TelemetryPacket): Promise<boolean> {
    const t0 = performance.now();
    this.lastTransmissionTime = new Date().toLocaleTimeString('en-GB');
    this.simulationId = packet.simulation_id || this.simulationId;
    this.sequenceNumber = packet.sequence_number || this.sequenceNumber + 1;

    if (this.onPacketCallback) {
      this.onPacketCallback(packet);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(packet),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      this.latencyMs = Math.round(performance.now() - t0);
      this.lastHttpStatus = response.status;

      if (response.ok) {
        this.packetsSent++;
        this.status = 'CONNECTED';
        this.lastError = null;
        this.notifyStatus();
        return true;
      } else {
        this.packetsFailed++;
        this.status = 'LOCAL_SIMULATION_MODE';
        this.lastError = `HTTP ${response.status} (${response.statusText || 'Response Error'})`;
        this.notifyStatus();
        return false;
      }
    } catch (err: any) {
      this.packetsFailed++;
      this.status = 'LOCAL_SIMULATION_MODE';
      this.latencyMs = Math.round(performance.now() - t0);
      this.lastHttpStatus = 0;
      this.lastError = err?.name === 'AbortError' ? 'Request Timeout (2.5s)' : (err?.message || 'Network / CORS Error');
      this.notifyStatus();
      return false;
    }
  }

  private notifyStatus(): void {
    if (this.onStatusCallback) {
      this.onStatusCallback({
        endpoint: this.endpoint,
        isStreaming: this.isStreaming,
        status: this.status,
        packetsSent: this.packetsSent,
        packetsFailed: this.packetsFailed,
        lastTransmissionTime: this.lastTransmissionTime || new Date().toLocaleTimeString('en-GB'),
        lastHttpStatus: this.lastHttpStatus,
        lastError: this.lastError,
        latencyMs: this.latencyMs,
        transmissionRateHz: this.transmissionRateHz,
        simulationId: this.simulationId,
        sequenceNumber: this.sequenceNumber
      });
    }
  }
}

