/**
 * Centralized Simulation Configuration Parameters
 * Defines physical constants, aerodynamic properties, Rotax 912 ULS engine ratings,
 * atmospheric constants, sensor bounds, and fault calibration coefficients.
 */

export interface SimulationConfig {
  // UAV Airframe Characteristics (Medium Altitude Long Endurance Class)
  aircraftMassKg: number;
  referenceAreaM2: number;
  zeroLiftDragCoeff: number;
  inducedDragFactor: number;
  propulsiveEfficiency: number;
  propellerDiameterM: number;

  // Reduced-Order Rotax 912 ULS Engine Parameters
  engineIdleRpm: number;
  engineMaxContinuousRpm: number;
  engineMaxTakeoffRpm: number;
  engineMaxPowerHp: number;
  engineDisplacementCc: number;
  engineCylinders: number;
  engineCompressionRatio: number;

  // Flight Kinematics & Envelope Limits
  maxTurnRateDegPerSec: number;
  maxClimbRateFpm: number;
  maxDescentRateFpm: number;
  minFlightAirspeedKmh: number;
  maxFlightAirspeedKmh: number;
  waypointArrivalRadiusKm: number;

  // Thermodynamics & Heat Balance
  thermalCapacityCht: number;
  coolingCoeffAirflow: number;
  thermalCapacityOil: number;
  ambientReferenceTempC: number;

  // Standard Atmospheric Constants (ISA)
  seaLevelPressureInHg: number;
  seaLevelPressureHpa: number;
  seaLevelAirDensityKgM3: number;
  gasConstantAir: number; // J/(kg·K)
  tempLapseRatePerM: number; // K/m

  // Default Environment
  defaultWindSpeedKmh: number;
  defaultWindDirectionDeg: number;
  defaultAmbientTempC: number;

  // Sensor Ranges & Tolerances
  sensorLimits: {
    rpm: { min: 0; max: 6200; yellowMin: 1400; greenMin: 1800; greenMax: 5500; yellowMax: 5800 };
    cht: { min: 20; max: 180; greenMin: 75; greenMax: 135; yellowMax: 150 };
    egt: { min: 20; max: 950; greenMin: 650; greenMax: 850; yellowMax: 880 };
    oilPressure: { min: 0; max: 8.0; yellowMin: 1.5; greenMin: 2.0; greenMax: 5.0; yellowMax: 6.5 };
    oilTemp: { min: 20; max: 160; yellowMin: 50; greenMin: 90; greenMax: 110; yellowMax: 130 };
    vibration: { min: 0; max: 15.0; greenMax: 3.5; yellowMax: 6.0 };
    fuelFlow: { min: 0; max: 35.0; greenMin: 5.0; greenMax: 26.0; yellowMax: 30.0 };
    fuelPressure: { min: 0; max: 6.0; yellowMin: 1.8; greenMin: 2.5; greenMax: 4.5; yellowMax: 5.2 };
    map: { min: 10; max: 35.0; greenMin: 15.0; greenMax: 29.5; yellowMax: 32.0 };
  };

  // Fault Severity Scale Multipliers
  faultMultipliers: {
    LOW: number;
    MEDIUM: number;
    HIGH: number;
  };
}

export const SIMULATION_CONFIG: SimulationConfig = {
  // UAV Airframe Parameters
  aircraftMassKg: 520.0,
  referenceAreaM2: 8.5,
  zeroLiftDragCoeff: 0.028,
  inducedDragFactor: 0.045,
  propulsiveEfficiency: 0.82,
  propellerDiameterM: 1.70,

  // Rotax 912 ULS Engine Specifications
  engineIdleRpm: 1400,
  engineMaxContinuousRpm: 5500,
  engineMaxTakeoffRpm: 5800,
  engineMaxPowerHp: 100.0,
  engineDisplacementCc: 1352,
  engineCylinders: 4,
  engineCompressionRatio: 10.5,

  // Flight Kinematics
  maxTurnRateDegPerSec: 4.0,
  maxClimbRateFpm: 1200.0,
  maxDescentRateFpm: 900.0,
  minFlightAirspeedKmh: 70.0,
  maxFlightAirspeedKmh: 215.0,
  waypointArrivalRadiusKm: 0.45,

  // Thermal Dynamics
  thermalCapacityCht: 38.0,
  coolingCoeffAirflow: 0.42,
  thermalCapacityOil: 52.0,
  ambientReferenceTempC: 30.0,

  // ISA Atmosphere
  seaLevelPressureInHg: 29.92,
  seaLevelPressureHpa: 1013.25,
  seaLevelAirDensityKgM3: 1.225,
  gasConstantAir: 287.05,
  tempLapseRatePerM: 0.0065,

  // Defaults
  defaultWindSpeedKmh: 12.0,
  defaultWindDirectionDeg: 240.0,
  defaultAmbientTempC: 30.0,

  // Sensor Thresholds
  sensorLimits: {
    rpm: { min: 0, max: 6200, yellowMin: 1400, greenMin: 1800, greenMax: 5500, yellowMax: 5800 },
    cht: { min: 20, max: 180, greenMin: 75, greenMax: 135, yellowMax: 150 },
    egt: { min: 20, max: 950, greenMin: 650, greenMax: 850, yellowMax: 880 },
    oilPressure: { min: 0, max: 8.0, yellowMin: 1.5, greenMin: 2.0, greenMax: 5.0, yellowMax: 6.5 },
    oilTemp: { min: 20, max: 160, yellowMin: 50, greenMin: 90, greenMax: 110, yellowMax: 130 },
    vibration: { min: 0, max: 15.0, greenMax: 3.5, yellowMax: 6.0 },
    fuelFlow: { min: 0, max: 35.0, greenMin: 5.0, greenMax: 26.0, yellowMax: 30.0 },
    fuelPressure: { min: 0, max: 6.0, yellowMin: 1.8, greenMin: 2.5, greenMax: 4.5, yellowMax: 5.2 },
    map: { min: 10, max: 35.0, greenMin: 15.0, greenMax: 29.5, yellowMax: 32.0 },
  },

  // Fault Severity Scaling
  faultMultipliers: {
    LOW: 0.5,
    MEDIUM: 1.0,
    HIGH: 1.6,
  }
};
