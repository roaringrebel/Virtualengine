export type FlightPhase = 'STANDBY' | 'STARTUP' | 'TAKEOFF' | 'CLIMB' | 'CRUISE' | 'DESCENT' | 'LANDING';

export type EngineStatus = 'OFF' | 'STARTING' | 'NOMINAL' | 'WARNING' | 'CRITICAL';

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
  throttle: number;         // 0 - 100%
  altitude: number;         // ft (0 - 25,000)
  airspeed: number;         // km/h (0 - 250)
  heading: number;          // deg (0 - 360)
  ambientTemp: number;      // °C (-30 - +50)
  engineLoad: number;       // % (0 - 100)
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

export interface SimulationState {
  isRunning: boolean;
  engineOn: boolean;
  simTimeSeconds: number;
  speedMultiplier: number;
  sensorNoiseEnabled: boolean;
  flightPhase: FlightPhase;
  controls: FlightControlsState;
  atmosphere: AtmosphericState;
  engine: Rotax912State;
  thermal: ThermalState;
  sensors: SensorSuiteState;
  fault: FaultState;
}
