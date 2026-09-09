import { MissionManager } from '../../01-mission-manager/src/MissionManager';
import { FlightDynamics } from '../../02-flight-model/src/FlightDynamics';
import { EnginePhysics } from '../../03-engine-physics/src/EnginePhysics';
import { FaultInjector } from '../../04-fault-injector/src/FaultInjector';
import { VirtualSensors } from '../../05-virtual-sensors/src/VirtualSensors';
import { LowRateProcessor } from '../../06-signal-processing/low-rate/LowRateProcessor';
import { HighRateVibrationProcessor } from '../../06-signal-processing/high-rate/HighRateVibrationProcessor';
import { TelemetryClient } from '../../07-telemetry-api/src/TelemetryClient';
import { MockWebsite2Receiver } from '../src/mockReceiver';
import { IngestConnector } from '../src/IngestConnector';
import { Waypoint } from '../../../shared/schemas/types';

export function runReplayHarnessVerification(): { passed: boolean; report: string } {
  const logs: string[] = [];

  const testWaypoints: Waypoint[] = [
    { id: 'WP0', name: 'Start', lat: 13.0827, lng: 80.2707, altMeters: 0, speedKts: 0, phase: 'TAKEOFF' },
    { id: 'WP1', name: 'Climb', lat: 13.1000, lng: 80.3000, altMeters: 800, speedKts: 85, phase: 'CLIMB' },
    { id: 'WP2', name: 'Cruise', lat: 13.1500, lng: 80.3500, altMeters: 1500, speedKts: 110, phase: 'CRUISE' },
    { id: 'WP3', name: 'Descent', lat: 13.2000, lng: 80.4000, altMeters: 500, speedKts: 85, phase: 'DESCENT' },
    { id: 'WP4', name: 'Landing', lat: 13.2300, lng: 80.4400, altMeters: 0, speedKts: 0, phase: 'LANDING' }
  ];

  const missionMgr = new MissionManager('REPLAY-TEST', testWaypoints);
  const flightDynamics = new FlightDynamics(testWaypoints[0].lat, testWaypoints[0].lng, 0);
  const enginePhysics = new EnginePhysics();
  const faultInjector = new FaultInjector();
  const virtualSensors = new VirtualSensors();
  const lowRateProc = new LowRateProcessor();
  const highRateProc = new HighRateVibrationProcessor();
  const telemetryClient = new TelemetryClient('BHARAT-REPLAY-01');

  const receiver = new MockWebsite2Receiver();
  const connector = new IngestConnector(receiver);

  logs.push('=== Mission 08 Website 2 Telemetry Replay Ingestion Test ===');
  logs.push('Replaying 120-second simulated UAV flight mission with end-to-end streaming...\n');

  let timestamp = 0;
  const dt = 1.0;
  let transmittedPackets = 0;

  for (let t = 0; t < 120; t++) {
    timestamp += 1000;

    // 01: Mission Manager
    const curPos = flightDynamics.getPosition();
    const cmd = missionMgr.update(curPos, dt, timestamp);

    // 02: Flight Model
    const flightState = flightDynamics.update(cmd, dt);

    // 04: Fault Injector Feedback Edge
    const faultFeedback = faultInjector.update(dt);

    // 03: Engine Physics (with feedback edge)
    const engineState = enginePhysics.update(cmd.commandedThrottle, flightState, faultFeedback, dt);

    // 05: Virtual Sensors
    const sensorReadings = virtualSensors.read(engineState, flightState, timestamp);

    // 06: Signal Processing Subagents
    const lowRateData = lowRateProc.process(engineState, flightState, cmd.currentPhase, timestamp);
    const rawVibBuffer = highRateProc.generateSyntheticBuffer(engineState.rpm, faultFeedback.vibrationEnergyMultiplier);
    const vibData = highRateProc.processWindow(rawVibBuffer, engineState.rpm, timestamp);

    // 07: Telemetry API Framing
    const packet = telemetryClient.assemblePacket(lowRateData, cmd, vibData);

    // 08: Website 2 Ingestion
    connector.transmit(packet);
    transmittedPackets++;

    if (t % 25 === 0 || cmd.isCompleted) {
      logs.push(`[t=${t}s] Phase: ${cmd.currentPhase.padEnd(8)} | Alt: ${flightState.altitudeM.toFixed(0)}m | Speed: ${flightState.indicatedAirspeedKts.toFixed(0)}kts | RPM: ${engineState.rpm.toFixed(0)} | Pkt: #${packet.header.packetId}`);
    }

    if (cmd.isCompleted) break;
  }

  const stats = connector.getStats();
  logs.push(`\n-----------------------------------------------------------------`);
  logs.push(`Total Packets Transmitted: ${stats.totalTransmitted}`);
  logs.push(`Total Packets Received:    ${stats.received}`);
  logs.push(`Failed Transmissions:      ${stats.failed}`);
  logs.push(`Validation Errors:         ${stats.errors.length}`);

  const latest = receiver.getLatestState();
  if (latest) {
    logs.push(`Final Synced Twin Phase:   ${latest.missionStatus.phase}`);
    logs.push(`Final Synced Twin Alt:     ${latest.lowRate.altitude.toFixed(1)} m`);
  }

  const passed = stats.totalTransmitted > 0 && stats.failed === 0 && stats.errors.length === 0 && stats.received === stats.totalTransmitted;
  logs.push(`\nReplay Harness Verification: ${passed ? 'PASSED ✅' : 'FAILED ❌'}`);

  return { passed, report: logs.join('\n') };
}

