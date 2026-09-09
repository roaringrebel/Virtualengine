import { TelemetryPacket } from '../../shared/schemas/types';

export class MockWebsite2Receiver {
  public receivedPackets: TelemetryPacket[] = [];
  public validationErrors: string[] = [];

  public ingest(rawJson: string): { success: boolean; error?: string } {
    try {
      const packet = JSON.parse(rawJson) as TelemetryPacket;

      // Validate schema
      if (!packet.header || !packet.lowRate || !packet.missionStatus) {
        this.validationErrors.push(`Malformed packet header/lowRate: ${rawJson.substring(0, 50)}`);
        return { success: false, error: 'Missing core packet sections' };
      }

      if (typeof packet.lowRate.rpm !== 'number' || typeof packet.lowRate.altitude !== 'number') {
        this.validationErrors.push(`Invalid data types in telemetry payload`);
        return { success: false, error: 'Invalid data types' };
      }

      this.receivedPackets.push(packet);
      return { success: true };
    } catch (e: any) {
      this.validationErrors.push(`JSON Parse failure: ${e.message}`);
      return { success: false, error: e.message };
    }
  }

  public getLatestState(): TelemetryPacket | null {
    return this.receivedPackets.length > 0 
      ? this.receivedPackets[this.receivedPackets.length - 1] 
      : null;
  }

  public clear(): void {
    this.receivedPackets = [];
    this.validationErrors = [];
  }
}
