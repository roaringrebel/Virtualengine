import { TelemetryClientStatus, TelemetryPacket } from '../types/telemetry';

export class TelemetryClient {
  public endpoint: string = 'http://localhost:8000/api/telemetry';
  public isStreaming: boolean = true;
  public status: TelemetryClientStatus['status'] = 'LOCAL_SIMULATION_MODE';
  public packetsSent: number = 1248;
  public packetsFailed: number = 0;
  public lastTransmissionTime: string | null = null;
  public latencyMs: number = 14;
  public transmissionRateHz: number = 1;

  private timerId: number | null = null;
  private onStatusCallback: ((status: TelemetryClientStatus) => void) | null = null;
  private onPacketCallback: ((packet: TelemetryPacket) => void) | null = null;

  constructor(endpoint?: string) {
    if (endpoint) this.endpoint = endpoint;
  }

  public setEndpoint(url: string): void {
    this.endpoint = url.trim();
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

    // Transmit immediately
    this.transmit(packetProvider());

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

    if (this.onPacketCallback) {
      this.onPacketCallback(packet);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

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

      if (response.ok) {
        this.packetsSent++;
        this.status = 'CONNECTED';
        this.notifyStatus();
        return true;
      } else {
        this.packetsFailed++;
        this.status = 'LOCAL_SIMULATION_MODE';
        this.notifyStatus();
        return false;
      }
    } catch {
      // Offline fallback
      this.packetsFailed++;
      this.status = 'LOCAL_SIMULATION_MODE';
      this.latencyMs = Math.round(performance.now() - t0);
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
        latencyMs: this.latencyMs,
        transmissionRateHz: this.transmissionRateHz
      });
    }
  }
}
