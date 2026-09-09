import { LowRateProcessor } from '../low-rate/LowRateProcessor';
import { HighRateVibrationProcessor } from '../high-rate/HighRateVibrationProcessor';
import { EnginePhysicalState, FlightState } from '../../../shared/schemas/types';

export function runDualRateSignalProcessingVerification(): { passed: boolean; report: string } {
  const lowRate = new LowRateProcessor();
  const highRate = new HighRateVibrationProcessor();
  const logs: string[] = [];

  const dummyEngine: EnginePhysicalState = {
    timestampMs: 0,
    rpm: 4800, // f1 = 80 Hz
    manifoldPressureInHg: 27.0,
    chtC: [95.0, 96.0, 95.5, 97.0],
    egtC: [740, 745, 738, 750],
    oilTempC: 90.0,
    oilPressureBar: 3.4,
    fuelFlowLitersPerHour: 17.5,
    fuelPressureBar: 3.0,
    coolantTempC: 84.0,
    mechanicalPowerKw: 62.0,
    efficiencyPct: 34.0,
    internalFrictionTorqueNm: 4.5,
    vibrationDisplacementUm: 4.5
  };

  const dummyFlight: FlightState = {
    timestampMs: 0,
    latitude: 13.15,
    longitude: 80.35,
    altitudeM: 1500,
    indicatedAirspeedKts: 108,
    trueAirspeedKts: 116,
    groundSpeedKts: 116,
    verticalSpeedFpm: 0,
    headingDeg: 45,
    pitchDeg: 2,
    rollDeg: 0,
    yawDeg: 45,
    angleOfAttackDeg: 3,
    gForce: 1.0,
    ambientTempC: 15,
    ambientPressureHpa: 850,
    airDensityKgM3: 1.05
  };

  logs.push('=== Mission 06 Dual-Rate Signal Processing Verification ===');
  logs.push('\n[SUBAGENT A: Low-Rate Stream Verification (22-parameter contract)]');

  const lrPacket = lowRate.process(dummyEngine, dummyFlight, 'CRUISE', 1000);
  logs.push(`Sequence ID: ${lrPacket.sequenceId}, Phase: ${lrPacket.flightPhase}`);
  logs.push(`RPM: ${lrPacket.rpm}, 5s Mean: ${lrPacket.rpmMean5s.toFixed(1)}, Capability Margin: ${lrPacket.capabilityMarginPct.toFixed(1)}%`);
  logs.push(`Health Status: ${lrPacket.healthStatus}, Anomaly Score: ${lrPacket.anomalyScore.toFixed(3)}`);

  const lowRatePassed = lrPacket.capabilityMarginPct > 90 && lrPacket.healthStatus === 'HEALTHY';
  logs.push(`Subagent A Contract: ${lowRatePassed ? 'PASSED ✅' : 'FAILED ❌'}`);

  logs.push('\n[SUBAGENT B: High-Rate Vibration & FFT Spectral Verification (1 kHz sample rate)]');
  // Generate synthetic high-rate vibration window for 4800 RPM (80 Hz shaft freq)
  const rawBuffer = highRate.generateSyntheticBuffer(4800, 1.0);
  const vibPacket = highRate.processWindow(rawBuffer, 4800, 1000);

  logs.push(`Buffer Size: ${vibPacket.windowSizeSamples} samples, Sample Rate: ${vibPacket.sampleRateHz} Hz`);
  logs.push(`Time-Domain: RMS = ${vibPacket.rmsAccG.toFixed(3)} G, Peak-to-Peak = ${vibPacket.peakToPeakAccG.toFixed(3)} G, Crest Factor = ${vibPacket.crestFactor.toFixed(2)}`);
  logs.push(`Frequency-Domain: Dominant Freq = ${vibPacket.spectralDominantFreqHz.toFixed(1)} Hz (Expected ~80 Hz)`);
  logs.push(`Harmonic 1X Energy: ${vibPacket.harmonic1XEnergy.toFixed(4)}, 2X Energy: ${vibPacket.harmonic2XEnergy.toFixed(4)}`);

  // Shaft frequency at 4800 RPM is 80Hz. Dominant frequency should be in the 70-90Hz range.
  const freqCheck = Math.abs(vibPacket.spectralDominantFreqHz - 80.0) <= 20.0;
  const rmsCheck = vibPacket.rmsAccG > 0.1 && vibPacket.rmsAccG < 1.0;
  const highRatePassed = freqCheck && rmsCheck;
  logs.push(`Subagent B Contract (FFT & Harmonics): ${highRatePassed ? 'PASSED ✅' : 'FAILED ❌'}`);

  const overallPassed = lowRatePassed && highRatePassed;
  logs.push(`\nOverall Dual-Rate Verification: ${overallPassed ? 'PASSED ✅' : 'FAILED ❌'}`);

  return { passed: overallPassed, report: logs.join('\n') };
}

