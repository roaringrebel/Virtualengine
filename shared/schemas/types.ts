/**
 * Bharat-AeroTwin: Shared Inter-Module Payload Schemas
 * Standardized contracts for Antigravity Mission Topology
 */

export type FlightPhase = 'PRE_FLIGHT' | 'TAKEOFF' | 'CLIMB' | 'CRUISE' | 'DESCENT' | 'APPROACH' | 'LANDING' | 'EMERGENCY' | 'COMPLETED';

export type EngineFaultType = 
  | 'NONE'
  | 'BEARING_WEAR'
  | 'COOLING_LEAK'
  | 'INJECTOR_CLOG'
  | 'OIL_STARVATION'
  | 'SPARK_MISFIRE'
  | 'VALVE_STUCK';

export interface GeoCoordinate {
  lat: number;
  lng: number;
  altMeters: number;
}

export interface Waypoint extends GeoCoordinate {
  id: string;
  name: string;
  speedKts: number;
  phase: FlightPhase;
}

// 01: Mission Manager Command
export interface MissionCommand {
  timestampMs: number;
  missionId: string;
  currentPhase: FlightPhase;
  activeWaypointIndex: number;
  targetAltitudeM: number;
  targetSpeedKts: number;
  targetHeadingDeg: number;
  commandedThrottle: number; // 0.0 to 1.0
  distanceToTargetKm: number;
  missionProgressPct: number;
  isCompleted: boolean;
}

// 02: Flight Dynamics True State
export interface FlightState {
  timestampMs: number;
  latitude: number;
  longitude: number;
  altitudeM: number;
  indicatedAirspeedKts: number;
  trueAirspeedKts: number;
  groundSpeedKts: number;
  verticalSpeedFpm: number;
  headingDeg: number;
  pitchDeg: number;
  rollDeg: number;
  yawDeg: number;
  angleOfAttackDeg: number;
  gForce: number;
  ambientTempC: number;
  ambientPressureHpa: number;
  airDensityKgM3: number;
}

// 03 & 04: Engine Physical True State (with Fault Feedback)
export interface EnginePhysicalState {
  timestampMs: number;
  rpm: number;
  manifoldPressureInHg: number;
  chtC: [number, number, number, number]; // 4 cylinders
  egtC: [number, number, number, number]; // 4 cylinders
  oilTempC: number;
  oilPressureBar: number;
  fuelFlowLitersPerHour: number;
  fuelPressureBar: number;
  coolantTempC: number;
  mechanicalPowerKw: number;
  efficiencyPct: number;
  internalFrictionTorqueNm: number;
  vibrationDisplacementUm: number;
}

// 04: Dynamic Fault Feedback Modifier
export interface FaultFeedbackModifier {
  activeFault: EngineFaultType;
  severity: number; // 0.0 (nominal) to 1.0 (critical)
  elapsedFaultTimeSec: number;
  frictionTorqueIncreaseNm: number;
  thermalDissipationFactor: number; // multiplier on cooling (e.g. 0.4 on leak)
  fuelFlowBiasFactor: number;
  rpmInstabilityVariance: number;
  vibrationEnergyMultiplier: number;
}

// 05: Raw Virtual Sensor Output (with noise & quantization)
export interface VirtualSensorReadings {
  timestampMs: number;
  rpm: number;
  chtMaxC: number;
  egtMaxC: number;
  oilTempC: number;
  oilPressureBar: number;
  fuelFlowLph: number;
  coolantTempC: number;
  airspeedKts: number;
  altitudeM: number;
  headingDeg: number;
  vibrationAccG: number;
  snrDb: number;
}

// 06: Signal Processing Subagent A: Low-Rate 22-Parameter Stream (10-50Hz)
export interface LowRateTelemetryStream {
  timestampMs: number;
  sequenceId: number;
  flightPhase: FlightPhase;
  // 22 standard aviation & propulsion parameters
  rpm: number;
  rpmMean5s: number;
  manifoldPressure: number;
  cht1: number;
  cht2: number;
  cht3: number;
  cht4: number;
  chtMax: number;
  egt1: number;
  egt2: number;
  egt3: number;
  egt4: number;
  egtMax: number;
  oilTemp: number;
  oilPressure: number;
  fuelFlow: number;
  fuelPressure: number;
  coolantTemp: number;
  airspeed: number;
  altitude: number;
  heading: number;
  gForce: number;
  // Health & Margin indicators
  capabilityMarginPct: number;
  anomalyScore: number;
  healthStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL';
}

// 06: Signal Processing Subagent B: High-Rate Vibration Stream (500Hz-1kHz)
export interface HighRateVibrationPacket {
  timestampMs: number;
  sampleRateHz: number;
  windowSizeSamples: number;
  // Time-domain features
  rmsAccG: number;
  peakToPeakAccG: number;
  crestFactor: number;
  kurtosis: number;
  // Frequency-domain spectral energy bands
  harmonic1XEnergy: number; // Shaft rotational frequency
  harmonic2XEnergy: number; // Blade/Cylinder pass frequency
  bearingFaultBandEnergy: number; // High frequency defect resonance
  spectralDominantFreqHz: number;
  fftSpectrumBins: number[]; // e.g. 32 or 64 frequency power bins
}

// 07 & 08: Telemetry Transmission Packet
export interface TelemetryPacket {
  header: {
    protocolVersion: string;
    vehicleId: string;
    packetId: number;
    timestampUtc: string;
    checksum: string;
  };
  lowRate: LowRateTelemetryStream;
  highRateVibration?: HighRateVibrationPacket;
  missionStatus: {
    phase: FlightPhase;
    progressPct: number;
    activeWaypoint: string;
    distanceRemainingKm: number;
  };
}
