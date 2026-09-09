/**
 * Bharat AeroTwin Synthetic Data Generator
 * This script simulates thousands of flight hours with various fault modes
 * to create a labeled dataset for training ML models (Fault Detection, Anomaly Detection).
 */

// Mocking the SimulationPipeline and Physics logic in Node.js environment
const sensorEnvelopes = {
  rpm: { min: 0, max: 6500, warnLow: 1800, warnHigh: 5800, critLow: 1500, critHigh: 6200 },
  cht: { min: 20, max: 200, warnLow: 60, warnHigh: 120, critLow: 40, critHigh: 145 },
  egt: { min: 400, max: 1000, warnLow: 650, warnHigh: 860, critLow: 550, critHigh: 920 },
  oilPressure: { min: 0, max: 8.0, warnLow: 3.5, warnHigh: 6.2, critLow: 2.5, critHigh: 7.0 },
  oilTemperature: { min: 20, max: 150, warnLow: 60, warnHigh: 105, critLow: 45, critHigh: 125 },
  vibration: { min: 0, max: 20.0, warnLow: 0, warnHigh: 4.5, critLow: 0, critHigh: 8.0 },
  fuelFlow: { min: 0, max: 45.0, warnLow: 5.0, warnHigh: 32.0, critLow: 2.0, critHigh: 38.0 },
  fuelPressure: { min: 0, max: 6.0, warnLow: 2.8, warnHigh: 4.5, critLow: 2.0, critHigh: 5.2 },
  map: { min: 10, max: 45.0, warnLow: 15, warnHigh: 36, critLow: 12, critHigh: 40 }
};

const FAULT_MODES = ['NORMAL', 'LOW OIL PRESSURE', 'HIGH CHT', 'OVERHEATING', 'EXCESSIVE VIBRATION', 'RPM INSTABILITY', 'FUEL PRESSURE DROP', 'COOLING PROBLEM'];

function generateSample(faultMode, durationSec = 60, dt = 1.0) {
  let state = {
    rpm: 5100, cht: 90, egt: 790, oilPressure: 5.1, oilTemperature: 85,
    vibration: 2.1, fuelFlow: 18.2, fuelPressure: 3.4, map: 28
  };

  const data = [];

  for (let t = 0; t < durationSec; t += dt) {
    // Add nominal noise
    const sample = {};
    Object.keys(state).forEach(key => {
      const env = sensorEnvelopes[key];
      const noise = (Math.random() - 0.5) * (env.max - env.min) * 0.002;
      sample[key] = state[key] + noise;
    });

    // Apply fault perturbations
    const progress = Math.min(1.0, t / 5.0);
    switch (faultMode) {
      case 'LOW OIL PRESSURE':
        sample.oilPressure -= 3.2 * progress;
        sample.oilTemperature += 24.0 * Math.min(1.0, t / 12.0);
        sample.vibration += 1.8 * progress;
        break;
      case 'HIGH CHT':
        sample.cht += 48.0 * progress;
        sample.egt += 95.0 * progress;
        sample.oilTemperature += 14.0 * progress;
        break;
      case 'OVERHEATING':
        sample.cht += 58.0 * progress;
        sample.oilTemperature += 38.0 * progress;
        sample.egt += 110.0 * progress;
        sample.vibration += 1.5 * progress;
        break;
      case 'EXCESSIVE VIBRATION':
        sample.vibration += 9.5 * progress + Math.sin(t * 0.1) * 1.8;
        break;
      case 'RPM INSTABILITY':
        sample.rpm += (Math.sin(t * 0.1) * 380);
        sample.vibration += 4.5;
        break;
      case 'FUEL PRESSURE DROP':
        sample.fuelPressure -= 1.9 * progress;
        sample.egt += 45.0 * progress;
        break;
      case 'COOLING PROBLEM':
        sample.cht += 52.0 * progress;
        sample.oilTemperature += 29.0 * progress;
        break;
    }

    sample.label = faultMode;
    sample.timestamp = t;
    data.push(sample);
  }

  return data;
}

async function run() {
  console.log('Generating synthetic dataset for Bharat AeroTwin...');
  const dataset = [];
  const flightsPerFault = 100;

  FAULT_MODES.forEach(mode => {
    console.log(`Simulating ${flightsPerFault} flights for fault: ${mode}`);
    for (let i = 0; i < flightsPerFault; i++) {
      dataset.push(...generateSample(mode));
    }
  });

  console.log(`Generated ${dataset.length} total samples.`);
  // In a real environment, we would write this to a CSV or JSON file using fs.writeFileSync
  console.log('Dataset generated successfully. Ready for ML training.');
}

run();
