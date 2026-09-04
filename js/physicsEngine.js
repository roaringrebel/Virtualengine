/**
 * Aero-Piston Engine & UAV Flight Mathematical Physics Engine
 * High-fidelity mathematical simulation of a tactical UAV piston engine (Rotax/Lycoming type)
 * Calculates thermodynamics, fluid dynamics, aerodynamics, and structural harmonics.
 */

export class AeroEnginePhysics {
  constructor() {
    // Flight control inputs
    this.controls = {
      throttle: 70,          // 0 to 100%
      altitude: 8000,        // 0 to 25000 ft
      airspeed: 145,         // 0 to 250 kts
      heading: 270,          // 0 to 360 deg
      ambientTemp: 15,       // -30 to +50 °C
      engineLoad: 50,        // 0 to 100%
      flightPhase: 'CRUISE'  // STARTUP, TAKEOFF, CLIMB, CRUISE, DESCENT, LANDING
    };

    // Active Fault
    this.activeFault = 'NORMAL';
    this.faultIntensity = 1.0; // 0 to 1.0
    this.faultElapsedTime = 0; // seconds since fault active

    // Continuous dynamic state (with thermal and mechanical inertia)
    this.state = {
      rpm: 5100,
      cht: 90.0,             // Cylinder Head Temp (°C)
      egt: 790.0,            // Exhaust Gas Temp (°C)
      oilPressure: 5.1,      // bar
      oilTemperature: 85.0,  // °C
      vibration: 2.1,        // mm/s RMS
      fuelFlow: 18.2,        // L/h
      fuelPressure: 3.4,     // bar
      map: 28.0,             // inHg Manifold Absolute Pressure
      
      // Attitude for 3D Visualizer
      pitch: 0,              // degrees (-30 to +30)
      roll: 0,               // degrees (-60 to +60)
      yaw: 270,              // degrees (0 to 360)
      
      // Internal thermal reservoirs
      engineCoreThermalMass: 90.0,
      oilThermalMass: 85.0,
      exhaustThermalMass: 790.0,
      
      // Elapsed simulation time
      simTime: 0
    };

    // Sensor Threshold Envelopes for Normal / Warning / Critical
    this.sensorEnvelopes = {
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
  }

  setFault(faultName) {
    this.activeFault = faultName;
    this.faultElapsedTime = 0;
  }

  setControl(key, value) {
    if (this.controls[key] !== undefined) {
      this.controls[key] = value;
      // Auto adjust flight phase attitude if needed
      if (key === 'flightPhase') {
        this.applyFlightPhasePresets(value);
      }
    }
  }

  applyFlightPhasePresets(phase) {
    switch (phase) {
      case 'STARTUP':
        this.controls.throttle = 15;
        this.controls.altitude = 0;
        this.controls.airspeed = 0;
        this.controls.engineLoad = 20;
        break;
      case 'TAKEOFF':
        this.controls.throttle = 100;
        this.controls.altitude = 500;
        this.controls.airspeed = 95;
        this.controls.engineLoad = 85;
        break;
      case 'CLIMB':
        this.controls.throttle = 85;
        this.controls.altitude = 4500;
        this.controls.airspeed = 120;
        this.controls.engineLoad = 75;
        break;
      case 'CRUISE':
        this.controls.throttle = 70;
        this.controls.altitude = 8000;
        this.controls.airspeed = 145;
        this.controls.engineLoad = 50;
        break;
      case 'DESCENT':
        this.controls.throttle = 35;
        this.controls.altitude = 3000;
        this.controls.airspeed = 130;
        this.controls.engineLoad = 30;
        break;
      case 'LANDING':
        this.controls.throttle = 20;
        this.controls.altitude = 100;
        this.controls.airspeed = 65;
        this.controls.engineLoad = 25;
        break;
    }
  }

  /**
   * Main Physics Update Loop called at 60Hz (dt in seconds)
   */
  update(dt = 0.0166) {
    this.state.simTime += dt;
    this.faultElapsedTime += dt;

    const { throttle, altitude, airspeed, heading, ambientTemp, engineLoad, flightPhase } = this.controls;
    const t = this.state.simTime;

    // 1. Atmospheric calculations (ISA Standard Atmosphere model)
    // Sea level standard: 29.92 inHg, 15°C, lapse rate 1.98°C / 1000 ft
    const tempLapse = ambientTemp - (altitude / 1000) * 1.98;
    const ambientPressureRatio = Math.pow(1 - 2.25577e-5 * altitude, 5.25588);
    const ambientPressureInHg = Math.max(8.0, 29.92 * ambientPressureRatio);
    const airDensityRatio = ambientPressureRatio * (288.15 / (tempLapse + 273.15));

    // 2. Manifold Absolute Pressure (MAP)
    // Turbocharged aero-piston engine maintains boost across altitude
    const baseMap = 14.0 + (throttle / 100) * 20.0;
    const ramAir = (airspeed / 145) * 0.0;
    let targetMAP = baseMap + ramAir * (throttle / 100);
    
    // 3. Engine Target RPM
    // Idle ~1900, Cruise 70% ~5100, Max ~6000
    const throttleRatio = throttle / 100;
    const loadFactor = 1.0 - ((engineLoad - 50) / 100) * 0.08;
    const altitudePowerLoss = Math.max(0.88, Math.min(1.0, 0.95 + 0.05 * airDensityRatio));
    
    let targetRPM = 1900 + throttleRatio * 4700 * loadFactor * altitudePowerLoss;
    
    if (flightPhase === 'STARTUP' && throttle < 20) {
      targetRPM = 1950;
    }

    // 4. Fault Specific Modifications
    let faultChtBias = 0;
    let faultEgtBias = 0;
    let faultOilPresBias = 0;
    let faultOilTempBias = 0;
    let faultVibrationBias = 0;
    let faultFuelFlowBias = 0;
    let faultFuelPresBias = 0;
    let faultRpmInstability = 0;

    switch (this.activeFault) {
      case 'LOW OIL PRESSURE': {
        // Oil pressure drops drastically; oil temp rises gradually due to friction
        const progress = Math.min(1.0, this.faultElapsedTime / 4.0);
        faultOilPresBias = -3.2 * progress;
        faultOilTempBias = +24.0 * Math.min(1.0, this.faultElapsedTime / 12.0);
        faultVibrationBias = +1.8 * progress;
        break;
      }
      case 'HIGH CHT': {
        // Cylinder Head Temperature surges due to baffling or lean mixture
        const progress = Math.min(1.0, this.faultElapsedTime / 5.0);
        faultChtBias = +48.0 * progress;
        faultEgtBias = +95.0 * progress;
        faultOilTempBias = +14.0 * progress;
        break;
      }
      case 'OVERHEATING': {
        // Generalized thermal runaway
        const progress = Math.min(1.0, this.faultElapsedTime / 6.0);
        faultChtBias = +58.0 * progress;
        faultOilTempBias = +38.0 * progress;
        faultEgtBias = +110.0 * progress;
        faultVibrationBias = +1.5 * progress;
        targetRPM *= (1.0 - 0.08 * progress); // Power sag
        break;
      }
      case 'EXCESSIVE VIBRATION': {
        // High harmonic mechanical imbalance / prop blade nick / mount fatigue
        const progress = Math.min(1.0, this.faultElapsedTime / 3.0);
        faultVibrationBias = +9.5 * progress + Math.sin(t * 18.0) * 1.8 + Math.cos(t * 31.0) * 1.2;
        faultRpmInstability = (Math.sin(t * 12.0) + Math.cos(t * 7.5)) * 95 * progress;
        faultOilTempBias = +12.0 * Math.min(1.0, this.faultElapsedTime / 15.0);
        break;
      }
      case 'RPM INSTABILITY': {
        // Hunting governor / ignition coil misfire
        const huntingCycle = Math.sin(t * 3.8) * 380 + Math.cos(t * 1.7) * 220;
        faultRpmInstability = huntingCycle;
        faultVibrationBias = +4.5 + Math.abs(huntingCycle) / 100.0;
        faultFuelFlowBias = (huntingCycle / 400.0) * 2.8;
        break;
      }
      case 'FUEL PRESSURE DROP': {
        // Fuel pump failure / filter clog
        const progress = Math.min(1.0, this.faultElapsedTime / 4.0);
        faultFuelPresBias = -1.9 * progress;
        // Causes lean mixture (EGT up initially, then RPM drops/stumbles)
        faultEgtBias = +45.0 * progress;
        faultRpmInstability = (Math.sin(t * 9.0) + Math.random() - 0.5) * 180 * progress;
        targetRPM *= (1.0 - 0.15 * progress);
        faultVibrationBias = +2.4 * progress;
        break;
      }
      case 'COOLING PROBLEM': {
        // Ram-air duct blockage / cowl flap failure
        const progress = Math.min(1.0, this.faultElapsedTime / 8.0);
        faultChtBias = +52.0 * progress;
        faultOilTempBias = +29.0 * progress;
        break;
      }
      case 'NORMAL':
      default:
        // Nominal
        break;
    }

    // 5. RPM Inertia Integration (Mechanical Spool lag)
    const rpmJitter = (Math.sin(t * 23.4) * 4.0 + Math.cos(t * 41.2) * 3.0 + (Math.random() - 0.5) * 3.0);
    const finalTargetRPM = Math.max(0, targetRPM + faultRpmInstability + rpmJitter);
    // Exponential smoothing for rotational inertia
    const rpmTau = 0.8; // seconds time constant
    const rpmAlpha = 1.0 - Math.exp(-dt / rpmTau);
    this.state.rpm += (finalTargetRPM - this.state.rpm) * rpmAlpha;

    // 6. MAP Dynamic Smoothing
    const mapJitter = Math.sin(t * 14.5) * 0.08;
    const finalTargetMAP = Math.max(10.0, targetMAP + mapJitter);
    this.state.map += (finalTargetMAP - this.state.map) * 0.1;

    // 7. CHT Thermodynamics (Combustion heat vs ram-air convection cooling)
    const rpmRatio = this.state.rpm / 5100.0;
    const combustionHeat = 55.0 + throttleRatio * 50.0 + rpmRatio * 20.0 + ((engineLoad - 50) / 100) * 15.0;
    const coolingEffectiveness = (this.activeFault === 'COOLING PROBLEM' ? 0.35 : 1.0);
    const ramCooling = (airspeed / 145.0) * 20.0 * coolingEffectiveness;
    const ambientEffect = (ambientTemp - 15) * 0.25;
    
    const targetCHT = Math.max(40.0, combustionHeat - ramCooling + ambientEffect + faultChtBias);
    // Thermal mass damping
    const chtTau = 4.0; // 4 second thermal inertia
    const chtAlpha = 1.0 - Math.exp(-dt / chtTau);
    this.state.cht += (targetCHT - this.state.cht) * chtAlpha;

    // 8. EGT Thermodynamics (Combustion flame temperature)
    const baseEGT = 620.0 + (throttleRatio * 170.0) + (rpmRatio * 51.0) + ((engineLoad - 50) / 100.0) * 20.0;
    const egtJitter = (Math.sin(t * 8.3) * 2.0 + (Math.random() - 0.5) * 1.5);
    const targetEGT = Math.max(450.0, baseEGT + faultEgtBias + egtJitter);
    this.state.egt += (targetEGT - this.state.egt) * 0.08;

    // 9. Oil Temperature (Lubrication loop heated by core, cooled by airflow)
    const targetOilTemp = 67.0 + (this.state.cht - 90.0) * 0.35 + (rpmRatio * 18.0) + ((engineLoad - 50) / 100) * 10.0 + (ambientEffect * 0.2) + faultOilTempBias;
    const oilTempTau = 6.5; // slow thermal mass
    const oilTempAlpha = 1.0 - Math.exp(-dt / oilTempTau);
    this.state.oilTemperature += (targetOilTemp - this.state.oilTemperature) * oilTempAlpha;

    // 10. Oil Pressure (Gear pump driven by crankshaft, viscosity drops with hot oil)
    const viscosityFactor = Math.max(0.75, 1.0 - ((this.state.oilTemperature - 85.0) / 100.0) * 0.35);
    const baseOilPres = 1.5 + (rpmRatio * 3.6) * viscosityFactor;
    const targetOilPres = Math.max(0.6, baseOilPres + faultOilPresBias + (Math.sin(t * 11.2) * 0.03));
    this.state.oilPressure += (targetOilPres - this.state.oilPressure) * 0.12;

    // 11. Engine Vibration RMS (Harmonic engine orders 1x, 2x, 4x + structural noise)
    const baseVibration = 0.8 + (rpmRatio * 1.0) + (throttleRatio * 0.43);
    const harmonicNoise = Math.abs(Math.sin(t * 15.0)) * 0.1 + (Math.random() - 0.5) * 0.05;
    const targetVibration = Math.max(0.5, baseVibration + harmonicNoise + faultVibrationBias);
    this.state.vibration += (targetVibration - this.state.vibration) * 0.15;

    // 12. Fuel Flow (L/h)
    const baseFuelFlow = 4.0 + throttleRatio * 16.0 + (rpmRatio * 3.0) + ((engineLoad - 50) / 100) * 2.0;
    const targetFuelFlow = Math.max(1.5, (baseFuelFlow + faultFuelFlowBias) + (Math.sin(t * 7.2) * 0.08));
    this.state.fuelFlow += (targetFuelFlow - this.state.fuelFlow) * 0.1;

    // 13. Fuel Pressure (bar)
    const baseFuelPres = 3.4 + (rpmRatio * 0.1) - ((this.state.fuelFlow - 18.2) / 30.0) * 0.1 - 0.1;
    const targetFuelPres = Math.max(0.5, baseFuelPres + faultFuelPresBias + (Math.sin(t * 9.1) * 0.02));
    this.state.fuelPressure += (targetFuelPres - this.state.fuelPressure) * 0.1;

    // 14. Attitude calculations for 3D Visualizer
    // Pitch based on climb/descent rate and throttle
    let targetPitch = 0;
    if (flightPhase === 'CLIMB' || flightPhase === 'TAKEOFF') targetPitch = 8.5;
    else if (flightPhase === 'DESCENT' || flightPhase === 'LANDING') targetPitch = -4.5;
    else targetPitch = (throttle - 50) * 0.08;

    // Bank angle (Roll) responds smoothly to heading change rate or subtle turbulence
    const rollOscillation = Math.sin(t * 0.6) * 1.5;
    this.state.pitch += (targetPitch - this.state.pitch) * 0.05;
    this.state.roll += (rollOscillation - this.state.roll) * 0.05;
    this.state.yaw = heading;
  }

  /**
   * Generates formatted Telemetry JSON packet matching external interface contract
   */
  getTelemetryPacket() {
    return {
      timestamp: new Date().toISOString(),
      rpm: Math.round(this.state.rpm),
      cht: Number(this.state.cht.toFixed(1)),
      egt: Number(this.state.egt.toFixed(1)),
      oil_pressure: Number(this.state.oilPressure.toFixed(1)),
      oil_temperature: Number(this.state.oilTemperature.toFixed(1)),
      vibration: Number(this.state.vibration.toFixed(1)),
      fuel_flow: Number(this.state.fuelFlow.toFixed(1)),
      fuel_pressure: Number(this.state.fuelPressure.toFixed(1)),
      map: Number(this.state.map.toFixed(1)),
      altitude: Math.round(this.controls.altitude),
      airspeed: Math.round(this.controls.airspeed),
      throttle: Math.round(this.controls.throttle),
      fault: this.activeFault
    };
  }

  /**
   * Assess status level for a given sensor parameter: 'normal', 'warning', 'critical'
   */
  getSensorStatus(key, value) {
    const env = this.sensorEnvelopes[key];
    if (!env) return 'normal';
    if (value <= env.critLow || value >= env.critHigh) return 'critical';
    if (value <= env.warnLow || value >= env.warnHigh) return 'warning';
    return 'normal';
  }
}
