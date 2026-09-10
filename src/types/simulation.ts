import { ELPCandidate, EmergencyRecoveryState } from './mission';

export type FlightPhase = 
  | 'PARKED'
  | 'STANDBY' 
  | 'STARTUP' 
  | 'TAKEOFF' 
  | 'CLIMB' 
  | 'CRUISE' 
  | 'DESCENT' 
  | 'APPROACH'
  | 'LANDING' 
  | 'LANDED'
  | 'COMPLETED'
  | 'EMERGENCY_DIVERT'
  | 'RECOVERY_APPROACH'
  | 'RECOVERED';

export type EngineStatus = 'OFF' | 'STARTING' | 'CRANKING' | 'IGNITION' | 'IDLE' | 'RUNNING' | 'FAULT' | 'STOPPING';

export type NavigationMode = 'MANUAL_PILOT' | 'WAYPOINT_ROUTE';

export type FaultType = 
  | 'NORMAL'
  | 'LOW_OIL_PRESSURE'
  | 'HIGH_CHT'
  | 'OVERHEATING'
  | 'EXCESSIVE_VIBRATION'
  | 'RPM_INSTABILITY'
  | 'FUEL_PRESSURE_DROP'
  | 'COOLING_PROBLEM'
  | 'BEARING_FAULT'
  | 'MECHANICAL_FAULT';

export type FaultSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface FlightControlsState {
  throttle: number;         // 0 - 100% (target commanded throttle)
  targetAltitude: number;   // ft (0 - 20,000)
  targetAirspeed: number;   // km/h (0 - 220)
  targetHeading: number;    // deg (0 - 360)
  ambientTemp: number;      // °C (-30 - +50)
  engineLoad: number;       // % (0 - 100)
  navigationMode: NavigationMode;
  windSpeed: number;        // km/h (0 - 80)
  windDirection: number;    // deg (0 - 360)
  latitude?: number;        // reference / starting coordinate
  longitude?: number;       // reference / starting coordinate
  heading?: number;         // backward compatibility alias
  altitude?: number;        // backward compatibility alias
  airspeed?: number;        // backward compatibility alias
}

export interface FlightState {
  latitude: number;         // °N
  longitude: number;        // °E
  altitude: number;         // ft
  heading: number;          // deg (0 - 360)
  airspeed: number;         // km/h (true airspeed)
  groundSpeed: number;      // km/h (speed over ground)
  verticalSpeed: number;    // ft/min (climb/descent rate)
  groundTrack: number;      // deg (actual direction of motion over ground)
  targetHeading: number;    // deg
  targetAltitude: number;   // ft
  targetAirspeed: number;   // km/h
  throttle: number;         // % (actual effective throttle)
  engineLoad: number;       // %
  flightPhase: FlightPhase;
  windSpeed: number;        // km/h
  windDirection: number;    // deg (direction wind blows FROM)
  currentWaypointIndex: number;
  currentWaypointName: string;
  distanceToWaypointKm: number;
  bearingToWaypointDeg: number;
  missionProgressPercent: number;
  turnRateDegPerSec: number;
  bankAngleDeg: number;
  isCompleted?: boolean;
}

export interface AtmosphericState {
  pressure: number;         // hPa
  pressureInHg: number;     // inHg
  temperatureKelvin: number;// K
  temperatureCelsius: number;// °C
  density: number;          // kg/m^3
  densityRatio: number;     // rho / rho0
}

export interface VibrationMetrics {
  rmsG: number;             // Root Mean Square acceleration (g)
  peakG: number;            // Peak absolute acceleration (g)
  peakToPeakG: number;      // Peak-to-Peak acceleration (g)
  crestFactor: number;      // Peak / RMS ratio
  kurtosis: number;         // 4th standardized statistical moment
  variance: number;         // Signal variance (g^2)
  dominantFreqHz: number;   // Dominant FFT frequency peak (Hz)
  freqAmplitudeG: number;   // Peak frequency spectral amplitude (g)
  spectralEnergy: number;   // Total sum of spectral bin powers
  harmonic1XEnergy: number; // 1X Shaft frequency energy (RPM/60)
  harmonic2XEnergy: number; // 2X Cylinder firing frequency energy
  harmonic3XEnergy: number; // 3X Harmonic energy
  bearingFaultEnergy: number;// High-frequency bearing defect energy
  accelXG: number;          // Current instantaneous X acceleration (g)
  accelYG: number;          // Current instantaneous Y acceleration (g)
  accelZG: number;          // Current instantaneous Z acceleration (g)
  resultantG: number;       // Current resultant sqrt(x^2 + y^2 + z^2)
}

export interface SimulationHistoryPoint {
  timeMs: number;
  simTimeSec: number;
  rpm: number;
  cht: number;
  egt: number;
  oilPressure: number;
  oilTemperature: number;
  fuelFlow: number;
  fuelPressure: number;
  manifoldPressure: number;
  engineLoad: number;
  vibrationRmsG: number;
  vibrationPeakG: number;
  dominantFreqHz: number;
  airspeed: number;
  altitude: number;
}

export interface Rotax912State {
  engineOn: boolean;
  rpm: number;
  targetRpm: number;
  torque: number;           // Nm
  powerHp: number;          // hp
  powerKw: number;          // kW
  manifoldPressure: number; // inHg (MAP)
  fuelFlow: number;         // L/h
  fuelPressure: number;     // bar
  vibration: number;        // Vibration RMS (g)
  vibrationMetrics: VibrationMetrics;
  status: EngineStatus;
  efficiencyLossRatio: number; // 0.0 - 0.5 power degradation from faults
  engineCondition: number;     // 0.0 - 1.0 (1.0 = pristine nominal condition)
}

export interface ThermalState {
  cht: number;              // Cylinder Head Temp °C
  egt: number;              // Exhaust Gas Temp °C
  oilTemperature: number;   // Oil Temp °C
  oilPressure: number;      // Oil Pressure bar
}

export interface VirtualSensorReading {
  value: number;
  unit: string;
  status: 'normal' | 'warning' | 'critical';
  trend: 'up' | 'down' | 'flat';
  min: number;
  max: number;
  nominalRange: [number, number];
  warnRange: [number, number];
}

export interface SensorSuiteState {
  rpm: VirtualSensorReading;
  cht: VirtualSensorReading;
  egt: VirtualSensorReading;
  oilPressure: VirtualSensorReading;
  oilTemperature: VirtualSensorReading;
  vibration: VirtualSensorReading;
  fuelFlow: VirtualSensorReading;
  fuelPressure: VirtualSensorReading;
  map: VirtualSensorReading;
  engineLoad: VirtualSensorReading;
}

export interface FaultState {
  activeFault: FaultType;
  severity: FaultSeverity;
  elapsedSeconds: number;
  description: string;
  propagationPath: string[];
}

export type MissionRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type MissionDecision = 'GO' | 'CAUTION' | 'NO-GO' | 'EMERGENCY RECOVERY';

export interface EnduranceCheckResult {
  status: 'PASS' | 'MARGINAL' | 'FAIL';
  requiredHours: number;
  rulHours: number;
  marginHours: number;
  details: string;
}

export interface HealthCheckResult {
  status: 'NORMAL' | 'PASS' | 'WARNING' | 'DEGRADED' | 'FAIL' | 'CRITICAL';
  faultName: string;
  faultSeverity: string;
  details: string;
}

export interface RiskCheckResult {
  status: 'PASS' | 'ELEVATED' | 'FAIL';
  riskScorePercent: number;
  details: string;
}

export interface MissionReliabilityState {
  reliabilityScore: number;         // 0 - 100%
  riskLevel: MissionRisk;           // LOW | MEDIUM | HIGH | CRITICAL
  decision: MissionDecision;         // GO | CAUTION | NO-GO | EMERGENCY RECOVERY
  decisionReason: string;           // Clear engineering reasoning

  // Authoritative Mission & Endurance Parameters (ONE Truth)
  totalMissionDistanceKm: number;   // Total route distance (km)
  estimatedFlightTimeMinutes: number; // e.g. 9 min
  missionDemandHours: number;       // e.g. 0.15 h (estimatedFlightTimeMinutes / 60)
  rulHours: number;                 // Prognostic Remaining Useful Life (hours)
  rulMarginHours: number;           // Exact: rulHours - missionDemandHours (hours, e.g. +3.55 h)
  missionMarginHours: number;       // Alias for backward compatibility

  // Specific Check Sub-Results (for UI & Explainability)
  enduranceCheck: EnduranceCheckResult;
  healthCheck: HealthCheckResult;
  riskCheck: RiskCheckResult;

  // In-Flight Critical Persistence Tracker
  criticalPersistenceSeconds: number;     // e.g. 18 / 30 sec
  criticalPersistenceMaxSeconds: number;  // 30
  emergencyRecoveryTriggered: boolean;   // true if continuous critical condition >= 30s while airborne

  // Diagnostic Health Metrics
  engineSOH: number;                // 0 - 100%
  faultRiskPercent: number;         // 0 - 100%
  anomalyScore: number;             // 0.0 - 1.0

  // Route & Navigation Progress
  missionProgressPercent: number;   // 0 - 100%
  distanceRemainingKm: number;      // km
  timeRemainingSeconds: number;     // seconds
  timeRemainingFormatted: string;   // mm:ss
  missionTimeFormatted: string;     // mm:ss
  terrainElevationFt: number;       // ft MSL
  aglAltitudeFt: number;            // ft AGL (Altitude - Terrain)
  routeDeviationKm: number;         // cross-track deviation (km)
  isCompleted?: boolean;
  isParked?: boolean;
  missionStatus?: 'STANDBY' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED';
  emergencyRecovery?: EmergencyRecoveryState;
}

export interface SimulationState {
  isRunning: boolean;
  isPaused: boolean;
  isCompleted: boolean;
  missionStatus: 'STANDBY' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED';
  engineOn: boolean;
  simTimeSeconds: number;
  speedMultiplier: number;
  sensorNoiseEnabled: boolean;
  flightPhase: FlightPhase;
  flight: FlightState;
  controls: FlightControlsState;
  atmosphere: AtmosphericState;
  engine: Rotax912State;
  thermal: ThermalState;
  sensors: SensorSuiteState;
  fault: FaultState;
  reliability: MissionReliabilityState;
  history: SimulationHistoryPoint[];
  liveWaveform: number[];
}

