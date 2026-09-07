export type FlightPhase = 'STANDBY' | 'STARTUP' | 'TAKEOFF' | 'CLIMB' | 'CRUISE' | 'DESCENT' | 'LANDING';

export type EngineStatus = 'OFF' | 'STARTING' | 'IDLE' | 'RUNNING' | 'FAULT' | 'STOPPING';

export type NavigationMode = 'MANUAL_PILOT' | 'WAYPOINT_ROUTE';

export type FaultType = 
  | 'NORMAL'
  | 'LOW_OIL_PRESSURE'
  | 'HIGH_CHT'
  | 'OVERHEATING'
  | 'EXCESSIVE_VIBRATION'
  | 'RPM_INSTABILITY'
  | 'FUEL_PRESSURE_DROP'
  | 'COOLING_PROBLEM';

export type FaultSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

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
}

export interface AtmosphericState {
  pressure: number;         // hPa
  pressureInHg: number;     // inHg
  temperatureKelvin: number;// K
  temperatureCelsius: number;// °C
  density: number;          // kg/m^3
  densityRatio: number;     // rho / rho0
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
  vibration: number;        // mm/s RMS
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
}

export interface FaultState {
  activeFault: FaultType;
  severity: FaultSeverity;
  elapsedSeconds: number;
  description: string;
  propagationPath: string[];
}

export type MissionRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type MissionDecision = 'GO' | 'CAUTION' | 'NO-GO';

export interface MissionReliabilityState {
  reliabilityScore: number;         // 0 - 100%
  riskLevel: MissionRisk;           // LOW | MEDIUM | HIGH | CRITICAL
  decision: MissionDecision;         // GO | CAUTION | NO-GO
  decisionReason: string;
  engineSOH: number;                // 0 - 100%
  rulHours: number;                 // Remaining Useful Life in hours
  faultRiskPercent: number;         // 0 - 100%
  missionMarginHours: number;       // RUL - remaining mission time (hours)
  anomalyScore: number;             // 0.0 - 1.0
  missionProgressPercent: number;   // 0 - 100%
  distanceRemainingKm: number;      // km
  timeRemainingSeconds: number;     // seconds
  timeRemainingFormatted: string;   // mm:ss
  missionTimeFormatted: string;     // mm:ss
  terrainElevationFt: number;       // ft MSL
  aglAltitudeFt: number;            // ft AGL (Altitude - Terrain)
  routeDeviationKm: number;         // cross-track deviation (km)
}

export interface SimulationState {
  isRunning: boolean;
  isPaused: boolean;
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
}

