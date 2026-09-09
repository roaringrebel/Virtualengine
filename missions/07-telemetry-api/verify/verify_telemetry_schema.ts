import { TelemetryClient } from '../src/TelemetryClient';
import { LowRateTelemetryStream, HighRateVibrationPacket, MissionCommand } from '../../shared/schemas/types';

export function runTelemetrySchemaVerification(): { passed: boolean; report: string } {
  const client = new TelemetryClient('TEST-UAV-77');
  const logs: string[] = [];

  const dummyLowRate: LowRateTelemetryStream = {
    timestampMs: 1000,
    sequenceId: 1,
    flightPhase: 'CRUISE',
    rpm: 4600,
    rpmMean5s: 4595,
    manifoldPressure: 26.5,
    cht1: 94.0,
    cht2: 96.5,
    cht3: 94.8,
    cht4: 97.2,
    chtMax: 97.2,
    egt1: 740,
    egt2: 748,
    egt3: 739,
    egt4: 752,
    egtMax: 752,
    oilTemp: 91.0,
    oilPressure: 3.25,
    fuelFlow: 16.5,
    fuelPressure: 3.0,
    coolantTemp: 84.5,
    airspeed: 108.0,
    altitude: 1500.0,
    heading: 45.0,
    gForce: 1.0,
    capabilityMarginPct: 96.5,
    anomalyScore: 0.035,
    healthStatus: 'HEALTHY'
  };

  const dummyVib: HighRateVibrationPacket = {
    timestampMs: 1000,
    sampleRateHz: 1000,
    windowSizeSamples: 256,
    rmsAccG: 0.425,
    peakToPeakAccG: 1.65,
    crestFactor: 2.8,
    kurtosis: 3.1,
    harmonic1XEnergy: 0.28,
    harmonic2XEnergy: 0.09,
    bearingFaultBandEnergy: 0.04,
    spectralDominantFreqHz: 76.6,
    fftSpectrumBins: [0.1, 0.2, 0.3]
  };

  const dummyCmd: MissionCommand = {
    timestampMs: 1000,
    missionId: 'TEST-MISSION',
    currentPhase: 'CRUISE',
    activeWaypointIndex: 2,
    targetAltitudeM: 1500,
    targetSpeedKts: 108,
    targetHeadingDeg: 45,
    commandedThrottle: 0.72,
    distanceToTargetKm: 12.5,
    missionProgressPct: 45.0,
    isCompleted: false
  };

  logs.push('=== Mission 07 Telemetry API Schema & Checksum Verification ===');

  const packet = client.assemblePacket(dummyLowRate, dummyCmd, dummyVib);
  const serialized = client.serialize(packet);
  const checksumValid = client.verifyChecksum(packet);

  logs.push(`Vehicle ID: ${packet.header.vehicleId}`);
  logs.push(`Packet ID: ${packet.header.packetId}, Timestamp: ${packet.header.timestampUtc}`);
  logs.push(`Checksum: ${packet.header.checksum} (Verified: ${checksumValid ? 'VALID' : 'INVALID'})`);
  logs.push(`Serialized JSON Payload Size: ${serialized.length} bytes`);
  logs.push(`Phase: ${packet.missionStatus.phase}, Progress: ${packet.missionStatus.progressPct}%`);

  const passed = checksumValid && serialized.length > 200 && packet.header.vehicleId === 'TEST-UAV-77';
  logs.push(`\nSchema Compliance & Checksum Result: ${passed ? 'PASSED ✅' : 'FAILED ❌'}`);

  return { passed, report: logs.join('\n') };
}

