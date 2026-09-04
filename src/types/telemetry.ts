export interface TelemetryPacket {
  timestamp: string;
  aircraft: string;
  engine: string;
  flight_phase: string;
  engine_on: boolean;
  rpm: number;
  cht: number;
  egt: number;
  oil_pressure: number;
  oil_temperature: number;
  vibration: number;
  fuel_flow: number;
  fuel_pressure: number;
  map: number;
  altitude: number;
  airspeed: number;
  heading: number;
  throttle: number;
  engine_load: number;
  ambient_temp: number;
  fault: string;
  fault_severity?: string;
}

export type ConnectionStatus = 'CONNECTED' | 'LOCAL_SIMULATION_MODE' | 'CONNECTING' | 'DISCONNECTED';

export interface TelemetryClientStatus {
  endpoint: string;
  isStreaming: boolean;
  status: ConnectionStatus;
  packetsSent: number;
  packetsFailed: number;
  lastTransmissionTime: string | null;
  latencyMs: number;
  transmissionRateHz: number;
}
