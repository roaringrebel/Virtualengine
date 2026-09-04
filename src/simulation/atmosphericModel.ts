import { AtmosphericState } from '../types/simulation';

/**
 * Standard International Atmosphere (ISA) Model
 * Calculates temperature, atmospheric pressure, and air density vs altitude.
 * Equation: rho = P / (R * T)
 */
export function calculateAtmosphere(altitudeFt: number, seaLevelTempCelsius: number = 30): AtmosphericState {
  // Constants
  const R = 287.058; // Specific gas constant for dry air (J/(kg·K))
  const P0 = 1013.25; // Sea level standard pressure (hPa)
  const T0_K = 288.15; // Sea level standard temperature (15°C in Kelvin)
  const actualSeaLevelTempK = seaLevelTempCelsius + 273.15;

  // Temperature lapse rate: -1.98°C per 1,000 ft
  const lapseRateKPerFt = 0.00198;
  const tempK = Math.max(216.65, actualSeaLevelTempK - altitudeFt * lapseRateKPerFt);
  const tempC = tempK - 273.15;

  // Barometric formula for troposphere (up to ~36,000 ft)
  // P = P0 * (1 - 2.25577e-5 * h)^5.25588
  const clampedAltitude = Math.max(0, Math.min(30000, altitudeFt));
  const pressureRatio = Math.pow(1 - 2.25577e-5 * clampedAltitude, 5.25588);
  const pressureHpa = Math.max(200, P0 * pressureRatio);
  const pressureInHg = pressureHpa * 0.02953;

  // Air density: rho = P / (R * T) where P is in Pascals (1 hPa = 100 Pa)
  const pressurePascals = pressureHpa * 100;
  const density = pressurePascals / (R * tempK);
  
  // Sea level standard density = 1.225 kg/m^3
  const standardDensity = 1.225;
  const densityRatio = density / standardDensity;

  return {
    pressure: pressureHpa,
    pressureInHg: Number(pressureInHg.toFixed(2)),
    temperatureKelvin: tempK,
    temperatureCelsius: Number(tempC.toFixed(1)),
    density: Number(density.toFixed(4)),
    densityRatio: Number(densityRatio.toFixed(3)),
  };
}
