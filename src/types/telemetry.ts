export interface TelemetryPacket {
  timestamp: string; // ISO 8601 UTC (e.g. 2026-09-04T12:30:00.000Z)
  simulation_id: string; // e.g. "SIM-ROTAX-001"
  sequence_number: number; // Monotonically increasing packet sequence

  uav_id?: string; // e.g. "UAV-BHARAT-01"
  engine_id?: string; // e.g. "ENG_001"
  aircraft: string; // "MALE_UAV"
  engine: string; // "ROTAX_912_ULS"
  flight_phase: string; // "CRUISE" | "TAKEOFF" | "CLIMB" | "DESCENT" | "LANDING" | "STANDBY" | "STARTUP"
  engine_on: boolean;

  // Rotax 912 ULS Engine Telemetry
  rpm: number; // Rotax 912 Engine RPM
  cht: number; // Cylinder Head Temp (°C)
  egt: number; // Exhaust Gas Temp (°C)
  oil_pressure: number; // Oil Pressure (bar)
  oil_temperature: number; // Oil Temp (°C)
  oil_temp?: number; // Alias for backward compatibility
  vibration: number; // Vibration RMS (g)
  vibration_rms_g?: number; // Standardized vibration in g
  vibration_peak_g?: number; // Peak vibration (g)
  vibration_p2p_g?: number; // Peak-to-Peak (g)
  vibration_crest_factor?: number; // Crest Factor
  dominant_frequency_hz?: number; // FFT Dominant Peak (Hz)
  spectral_energy?: number; // Total Spectral Energy
  harmonic_1x_energy?: number; // 1X RPM harmonic
  bearing_fault_energy?: number; // Bearing pass band
  fuel_flow: number; // Fuel Flow (L/h)
  fuel_pressure: number; // Fuel Pressure (bar)
  map: number; // Manifold Absolute Pressure (inHg)
  engine_condition?: number; // 0.0 - 1.0 internal health state
  engine_status?: string; // "OFF" | "STARTING" | "CRANKING" | "IGNITION" | "IDLE" | "RUNNING" | "FAULT" | "STOPPING"
  anomaly_flag?: boolean; // True when anomaly threshold exceeded

  // Flight Dynamics & Navigation Telemetry
  latitude: number; // °N (geodesic position)
  longitude: number; // °E (geodesic position)
  altitude: number; // Altitude (ft)
  airspeed: number; // Airspeed (km/h)
  ground_speed: number; // Ground speed (km/h)
  vertical_speed: number; // Vertical speed (ft/min)
  heading: number; // Heading (degrees 0-360)
  ground_track: number; // Ground track (degrees 0-360)

  // Autopilot Targets & Waypoints
  target_heading?: number;
  target_altitude?: number;
  target_airspeed?: number;
  waypoint?: string;
  waypoint_distance_km?: number;
  mission_progress?: number;

  // Controls & Environmental Factors
  throttle: number; // Throttle % (0-100)
  engine_load: number; // Engine Load % (0-100)
  engineLoad?: number; // Alias for backward compatibility
  ambient_temperature: number; // Ambient Temp (°C)
  ambient_temp?: number; // Alias for backward compatibility
  wind_speed: number; // Wind Speed (km/h)
  wind_direction: number; // Wind Direction (degrees from)

  // Fault Diagnostics & Digital Twin Health
  fault: string; // "NORMAL" | "EXCESSIVE_VIBRATION" | "LOW_OIL_PRESSURE" | "COOLING_PROBLEM" | etc.
  fault_severity: number | string; // Numeric 0 (normal), 0.5 (low), 0.8 (med), 1.0 (high)
  preset?: string;
  afr?: number;

  // Mission Reliability & Decision (Digital Twin Link)
  mission_reliability?: number; // 0 - 100%
  mission_risk?: string;        // "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  mission_decision?: string;    // "GO" | "CAUTION" | "NO-GO"
  soh?: number;                 // 0 - 100%
  rul_hours?: number;           // Remaining Useful Life (hours)
  terrain_elevation?: number;   // ft MSL
  agl_altitude?: number;        // ft AGL
}

export type ConnectionStatus = 'CONNECTED' | 'LOCAL_SIMULATION_MODE' | 'CONNECTING' | 'DISCONNECTED';

export interface TelemetryClientStatus {
  endpoint: string;
  isStreaming: boolean;
  status: ConnectionStatus;
  packetsSent: number;
  packetsFailed: number;
  lastTransmissionTime: string | null;
  lastHttpStatus: number | null;
  lastError: string | null;
  latencyMs: number;
  transmissionRateHz: number;
  simulationId: string;
  sequenceNumber: number;
}

