/**
 * Aero-Piston Engine & UAV Flight Mathematical Physics Engine
 * High-fidelity mathematical simulation of a tactical UAV piston engine (Rotax/Lycoming type)
 * Calculates thermodynamics, fluid dynamics, aerodynamics, and structural harmonics.
 */

export const sensorEnvelopes = {
  rpm: { min: 0, max: 6500, warnLow: 1800, warnHigh: 5800, critLow: 1500, critHigh: 6200, unit: 'RPM', name: 'Engine RPM' },
  cht: { min: 20, max: 200, warnLow: 60, warnHigh: 120, critLow: 40, critHigh: 145, unit: '°C', name: 'Cylinder Head Temp' },
  egt: { min: 400, max: 1000, warnLow: 650, warnHigh: 860, critLow: 550, critHigh: 920, unit: '°C', name: 'Exhaust Gas Temp' },
  oilPressure: { min: 0, max: 8.0, warnLow: 3.5, warnHigh: 6.2, critLow: 2.5, critHigh: 7.0, unit: 'bar', name: 'Oil Pressure' },
  oilTemperature: { min: 20, max: 150, warnLow: 60, warnHigh: 105, critLow: 45, critHigh: 125, unit: '°C', name: 'Oil Temperature' },
  vibration: { min: 0, max: 20.0, warnLow: 0, warnHigh: 4.5, critLow: 0, critHigh: 8.0, unit: 'mm/s', name: 'Engine Vibration' },
  fuelFlow: { min: 0, max: 45.0, warnLow: 5.0, warnHigh: 32.0, critLow: 2.0, critHigh: 38.0, unit: 'L/h', name: 'Fuel Flow' },
  fuelPressure: { min: 0, max: 6.0, warnLow: 2.8, warnHigh: 4.5, critLow: 2.0, critHigh: 5.2, unit: 'bar', name: 'Fuel Pressure' },
  map: { min: 10, max: 45.0, warnLow: 15, warnHigh: 36, critLow: 12, critHigh: 40, unit: 'inHg', name: 'Manifold Pressure' }
};

export function applyFlightPhasePresets(phase, controls) {
  switch (phase) {
    case 'STARTUP':
      controls.throttle = 15;
      controls.altitude = 0;
      controls.airspeed = 0;
      controls.engineLoad = 20;
      break;
    case 'TAKEOFF':
      controls.throttle = 100;
      controls.altitude = 500;
      controls.airspeed = 95;
      controls.engineLoad = 85;
      break;
    case 'CLIMB':
      controls.throttle = 85;
      controls.altitude = 4500;
      controls.airspeed = 120;
      controls.engineLoad = 75;
      break;
    case 'CRUISE':
      controls.throttle = 70;
      controls.altitude = 8000;
      controls.airspeed = 145;
      controls.engineLoad = 50;
      break;
    case 'DESCENT':
      controls.throttle = 35;
      controls.altitude = 3000;
      controls.airspeed = 130;
      controls.engineLoad = 30;
      break;
    case 'LANDING':
      controls.throttle = 20;
      controls.altitude = 100;
      controls.airspeed = 65;
      controls.engineLoad = 25;
      break;
  }
  return controls;
}

/**
 * Stage 2: Flight Model
 * Updates UAV dynamics based on controls and mission state.
 */
export function updateFlightModel(state, controls, dt) {
  const { throttle } = controls;

  // Pitch calculation
  let targetPitch = 0;
  if (controls.phase === 'CLIMB' || controls.phase === 'TAKEOFF') targetPitch = 8.5;
  else if (controls.phase === 'DESCENT' || controls.phase === 'LANDING') targetPitch = -4.5;
  else targetPitch = (throttle - 50) * 0.08;

  const pitchAlpha = 0.05;
  const newPitch = state.flightModel.pitch + (targetPitch - state.flightModel.pitch) * pitchAlpha;

  // Roll/Yaw for 3D Visualizer
  const t = state.engineModel.simTime || 0;
  const rollOscillation = Math.sin(t * 0.6) * 1.5;
  const newRoll = state.flightModel.roll + (rollOscillation - state.flightModel.roll) * 0.05;
  const newYaw = controls.heading;

  return {
    ...state.flightModel,
    pitch: newPitch,
    roll: newRoll,
    yaw: newYaw
  };
}

/**
 * Stage 3: Reduced-order Rotax 912 ULS physics model
 * Produces RPM, torque, power, fuel consumption, heat, etc.
 */
export function updateEngineModel(state, controls, dt) {
  const t = state.engineModel.simTime || 0;
  const { throttle, altitude, airspeed, ambientTemp, engineLoad } = controls;

  // 1. Atmospheric calculations
  const tempLapse = ambientTemp - (altitude / 1000) * 1.98;
  const ambientPressureRatio = Math.pow(1 - 2.25577e-5 * altitude, 5.25588);
  const ambientPressureInHg = Math.max(8.0, 29.92 * ambientPressureRatio);
  const airDensityRatio = ambientPressureRatio * (288.15 / (tempLapse + 273.15));

  // 2. MAP
  const baseMap = 14.0 + (throttle / 100) * 20.0;
  const ramAir = (airspeed / 145) * 0.0;
  const targetMAP = baseMap + ramAir * (throttle / 100);

  const mapJitter = Math.sin(t * 14.5) * 0.08;
  const finalTargetMAP = Math.max(10.0, targetMAP + mapJitter);
  const newMap = state.engineModel.map + (finalTargetMAP - state.engineModel.map) * 0.1;

  // 3. RPM
  const throttleRatio = throttle / 100;
  const loadFactor = 1.0 - ((engineLoad - 50) / 100) * 0.08;
  const altitudePowerLoss = Math.max(0.88, Math.min(1.0, 0.95 + 0.05 * airDensityRatio));

  let targetRPM = 1900 + throttleRatio * 4700 * loadFactor * altitudePowerLoss;
  if (controls.phase === 'STARTUP' && throttle < 20) {
    targetRPM = 1950;
  }

  const rpmJitter = (Math.sin(t * 23.4) * 4.0 + Math.cos(t * 41.2) * 3.0 + (Math.random() - 0.5) * 3.0);
  const finalTargetRPM = Math.max(0, targetRPM + rpmJitter);
  const rpmTau = 0.8;
  const rpmAlpha = 1.0 - Math.exp(-dt / rpmTau);
  const newRpm = state.engineModel.rpm + (finalTargetRPM - state.engineModel.rpm) * rpmAlpha;

  // 4. Power & Torque (Simplified)
  const targetPower = (newRpm / 5800) * 100 * throttleRatio;
  const newPower = (state.engineModel.power || 0) + (targetPower - (state.engineModel.power || 0)) * 0.1;
  const newTorque = (newPower * 1000) / (newRpm * 2 * Math.PI / 60) || 0;

  // 5. CHT
  const rpmRatio = newRpm / 5100.0;
  const combustionHeat = 55.0 + throttleRatio * 50.0 + rpmRatio * 20.0 + ((engineLoad - 50) / 100) * 15.0;
  const ramCooling = (airspeed / 145.0) * 20.0; // Nominal cooling
  const ambientEffect = (ambientTemp - 15) * 0.25;

  const targetCHT = Math.max(40.0, combustionHeat - ramCooling + ambientEffect);
  const chtTau = 4.0;
  const chtAlpha = 1.0 - Math.exp(-dt / chtTau);
  const newCht = state.engineModel.cht + (targetCHT - state.engineModel.cht) * chtAlpha;

  // 6. EGT
  const baseEGT = 620.0 + (throttleRatio * 170.0) + (rpmRatio * 51.0) + ((engineLoad - 50) / 100) * 20.0;
  const egtJitter = (Math.sin(t * 8.3) * 2.0 + (Math.random() - 0.5) * 1.5);
  const targetEGT = Math.max(450.0, baseEGT + egtJitter);
  const newEgt = state.engineModel.egt + (targetEGT - state.engineModel.egt) * 0.08;

  // 7. Oil Temp
  const targetOilTemp = 67.0 + (newCht - 90.0) * 0.35 + (rpmRatio * 18.0) + ((engineLoad - 50) / 100) * 10.0 + (ambientEffect * 0.2);
  const oilTempTau = 6.5;
  const oilTempAlpha = 1.0 - Math.exp(-dt / oilTempTau);
  const newOilTemp = state.engineModel.oilTemperature + (targetOilTemp - state.engineModel.oilTemperature) * oilTempAlpha;

  // 8. Oil Pressure
  const viscosityFactor = Math.max(0.75, 1.0 - ((newOilTemp - 85.0) / 100.0) * 0.35);
  const baseOilPres = 1.5 + (rpmRatio * 3.6) * viscosityFactor;
  const targetOilPres = Math.max(0.6, baseOilPres + (Math.sin(t * 11.2) * 0.03));
  const newOilPres = state.engineModel.oilPressure + (targetOilPres - state.engineModel.oilPressure) * 0.12;

  // 9. Vibration
  const baseVibration = 0.8 + (rpmRatio * 1.0) + (throttleRatio * 0.43);
  const harmonicNoise = Math.abs(Math.sin(t * 15.0)) * 0.1 + (Math.random() - 0.5) * 0.05;
  const targetVibration = Math.max(0.5, baseVibration + harmonicNoise);
  const newVibration = state.engineModel.vibration + (targetVibration - state.engineModel.vibration) * 0.15;

  // 10. Fuel Flow
  const baseFuelFlow = 4.0 + throttleRatio * 16.0 + (rpmRatio * 3.0) + ((engineLoad - 50) / 100) * 2.0;
  const targetFuelFlow = Math.max(1.5, baseFuelFlow + (Math.sin(t * 7.2) * 0.08));
  const newFuelFlow = state.engineModel.fuelFlow + (targetFuelFlow - state.engineModel.fuelFlow) * 0.1;

  // 11. Fuel Pressure
  const baseFuelPres = 3.4 + (rpmRatio * 0.1) - ((newFuelFlow - 18.2) / 30.0) * 0.1 - 0.1;
  const targetFuelPres = Math.max(0.5, baseFuelPres + (Math.sin(t * 9.1) * 0.02));
  const newFuelPres = state.engineModel.fuelPressure + (targetFuelPres - state.engineModel.fuelPressure) * 0.1;

  return {
    ...state.engineModel,
    simTime: t + dt,
    rpm: newRpm,
    cht: newCht,
    egt: newEgt,
    oilPressure: newOilPres,
    oilTemperature: newOilTemp,
    vibration: newVibration,
    fuelFlow: newFuelFlow,
    fuelPressure: newFuelPres,
    map: newMap,
    power: newPower,
    torque: newTorque
  };
}

/**
 * Stage 4: Virtual Sensors
 * Derives readings from physics with configurable noise.
 */
export function updateVirtualSensors(state, dt) {
  const noiseLevel = 0.002; // configurable noise
  const engine = state.engineModel;

  const applyNoise = (val, range) => {
    const noise = (Math.random() - 0.5) * range * noiseLevel;
    return val + noise;
  };

  return {
    rpm: { value: applyNoise(engine.rpm, 100), noise: noiseLevel },
    cht: { value: applyNoise(engine.cht, 5), noise: noiseLevel },
    egt: { value: applyNoise(engine.egt, 10), noise: noiseLevel },
    oilPressure: { value: applyNoise(engine.oilPressure, 0.1), noise: noiseLevel },
    oilTemperature: { value: applyNoise(engine.oilTemperature, 2), noise: noiseLevel },
    fuelFlow: { value: applyNoise(engine.fuelFlow, 0.5), noise: noiseLevel },
    fuelPressure: { value: applyNoise(engine.fuelPressure, 0.05), noise: noiseLevel },
    map: { value: applyNoise(engine.map, 0.2), noise: noiseLevel },
    vibration: { value: applyNoise(engine.vibration, 0.1), noise: noiseLevel }
  };
}

export function getSensorStatus(key, value) {
  const env = sensorEnvelopes[key];
  if (!env) return 'normal';
  if (value <= env.critLow || value >= env.critHigh) return 'critical';
  if (value <= env.warnLow || value >= env.warnHigh) return 'warning';
  return 'normal';
}
