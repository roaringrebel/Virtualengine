import { VirtualSensors } from '../src/VirtualSensors';
import { EnginePhysicalState, FlightState } from '../../shared/schemas/types';

export function runVirtualSensorsSnrVerification(): { passed: boolean; report: string } {
  const sensors = new VirtualSensors();
  const logs: string[] = [];

  const dummyEngine: EnginePhysicalState = {
    timestampMs: 0,
    rpm: 4600,
    manifoldPressureInHg: 26.5,
    chtC: [95.0, 98.2, 94.5, 99.0],
    egtC: [740, 752, 738, 755],
    oilTempC: 92.0,
    oilPressureBar: 3.2,
    fuelFlowLitersPerHour: 16.5,
    fuelPressureBar: 3.0,
    coolantTempC: 86.0,
    mechanicalPowerKw: 58.0,
    efficiencyPct: 32.5,
    internalFrictionTorqueNm: 4.5,
    vibrationDisplacementUm: 4.2
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

  const N = 200;
  const rpmSamples: number[] = [];
  const chtSamples: number[] = [];
  const vibSamples: number[] = [];

  for (let i = 0; i < N; i++) {
    const reading = sensors.read(dummyEngine, dummyFlight, i * 50);
    rpmSamples.push(reading.rpm);
    chtSamples.push(reading.chtMaxC);
    vibSamples.push(reading.vibrationAccG);
  }

  // Calculate empirical mean, stdDev, and SNR
  const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const std = (arr: number[], m: number) => Math.sqrt(arr.reduce((a, b) => a + Math.pow(b - m, 2), 0) / arr.length);

  const meanRpm = mean(rpmSamples);
  const stdRpm = std(rpmSamples, meanRpm);
  const snrRpm = 20 * Math.log10(meanRpm / Math.max(0.001, stdRpm));

  const trueMaxCht = Math.max(...dummyEngine.chtC);
  const meanCht = mean(chtSamples);
  const stdCht = std(chtSamples, meanCht);
  const snrCht = 20 * Math.log10(meanCht / Math.max(0.001, stdCht));

  const meanVib = mean(vibSamples);
  const stdVib = std(vibSamples, meanVib);
  const snrVib = 20 * Math.log10(meanVib / Math.max(0.001, stdVib));

  logs.push('=== Mission 05 Virtual Sensors SNR Verification ===');
  logs.push(`Channel         | True Value | Mean Sensor | Noise StdDev | SNR (dB) | Threshold`);
  logs.push('--------------------------------------------------------------------------------');
  logs.push(`Engine RPM      | 4600.0     | ${meanRpm.toFixed(1).padEnd(11)} | ${stdRpm.toFixed(2).padEnd(12)} | ${snrRpm.toFixed(1).padEnd(8)} | > 30 dB`);
  logs.push(`Max CHT (C)     | ${trueMaxCht.toFixed(1).padEnd(10)} | ${meanCht.toFixed(1).padEnd(11)} | ${stdCht.toFixed(2).padEnd(12)} | ${snrCht.toFixed(1).padEnd(8)} | > 25 dB`);
  logs.push(`Vibration (G)   | 0.420      | ${meanVib.toFixed(3).padEnd(11)} | ${stdVib.toFixed(4).padEnd(12)} | ${snrVib.toFixed(1).padEnd(8)} | > 18 dB`);
  logs.push('--------------------------------------------------------------------------------');

  const passed = snrRpm > 30 && snrCht > 25 && snrVib > 18;
  logs.push(`Virtual Sensor SNR Compliance: ${passed ? 'PASSED ✅' : 'FAILED ❌'}`);

  return { passed, report: logs.join('\n') };
}

