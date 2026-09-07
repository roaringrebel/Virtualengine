export interface TelemetryPacket {
  timestamp: string; // ISO 8601 UTC (e.g. 2026-09-04T12:30:00.000Z)
  simulation_id: string; // e.g. "SIM-ROTAX-001"
  sequence_number: number; // Monotonically increasing packet sequence

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
  vibration: number; // Vibration RMS (mm/s)
  fuel_flow: number; // Fuel Flow (L/h)
  fuel_pressure: number; // Fuel Pressure (bar)
  map: number; // Manifold Absolute Pressure (inHg)
  engine_condition?: number; // 0.0 - 1.0 internal health state
  engine_status?: string; // "OFF" | "STARTING" | "IDLE" | "RUNNING" | "FAULT" | "STOPPING"

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

  // Fault Diagnostics
  fault: string; // "NORMAL" | "EXCESSIVE_VIBRATION" | "LOW_OIL_PRESSURE" | "COOLING_PROBLEM" | etc.
  fault_severity: number | string; // Numeric 0 (normal), 0.5 (low), 0.8 (med), 1.0 (high)
  preset?: string;
  afr?: number;
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

