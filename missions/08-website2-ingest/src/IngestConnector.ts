import { TelemetryPacket } from '../../shared/schemas/types';
import { MockWebsite2Receiver } from './mockReceiver';

export class IngestConnector {
  private receiver: MockWebsite2Receiver;
  private transmissionCount: number = 0;
  private failedCount: number = 0;

  constructor(receiver?: MockWebsite2Receiver) {
    this.receiver = receiver || new MockWebsite2Receiver();
  }

  public transmit(packet: TelemetryPacket): boolean {
    this.transmissionCount++;
    const serialized = JSON.stringify(packet);
    const res = this.receiver.ingest(serialized);
    if (!res.success) {
      this.failedCount++;
      return false;
    }
    return true;
  }

  public getStats() {
    return {
      totalTransmitted: this.transmissionCount,
      failed: this.failedCount,
      received: this.receiver.receivedPackets.length,
      errors: this.receiver.validationErrors
    };
  }
}
