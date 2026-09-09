import * as crypto from 'crypto';
import { TelemetryPacket, LowRateTelemetryStream, HighRateVibrationPacket, MissionCommand } from '../../shared/schemas/types';

export class TelemetryClient {
  private vehicleId: string;
  private packetCounter: number = 0;

  constructor(vehicleId: string = 'BHARAT-TWIN-01') {
    this.vehicleId = vehicleId;
  }

  public assemblePacket(
    lowRate: LowRateTelemetryStream,
    missionCmd: MissionCommand,
    highRateVibration?: HighRateVibrationPacket
  ): TelemetryPacket {
    this.packetCounter++;

    const timestampUtc = new Date().toISOString();
    const payloadToHash = JSON.stringify({ lowRate, highRateVibration });
    const checksum = crypto.createHash('sha256').update(payloadToHash).digest('hex').substring(0, 16);

    return {
      header: {
        protocolVersion: 'v2.1-Antigravity',
        vehicleId: this.vehicleId,
        packetId: this.packetCounter,
        timestampUtc,
        checksum
      },
      lowRate,
      highRateVibration,
      missionStatus: {
        phase: missionCmd.currentPhase,
        progressPct: missionCmd.missionProgressPct,
        activeWaypoint: `WP-${missionCmd.activeWaypointIndex}`,
        distanceRemainingKm: missionCmd.distanceToTargetKm
      }
    };
  }

  public serialize(packet: TelemetryPacket): string {
    return JSON.stringify(packet);
  }

  public verifyChecksum(packet: TelemetryPacket): boolean {
    const payloadToHash = JSON.stringify({ 
      lowRate: packet.lowRate, 
      highRateVibration: packet.highRateVibration 
    });
    const expected = crypto.createHash('sha256').update(payloadToHash).digest('hex').substring(0, 16);
    return packet.header.checksum === expected;
  }
}
