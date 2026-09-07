import { calculateAtmosphere } from './atmosphericModel';
import { Rotax912EngineModel } from './rotax912Model';
import { Rotax912ThermalModel } from './thermalModel';
import { SensorSuiteModel } from './sensorModel';
import { createInitialFaultState, FAULT_DEFINITIONS } from './faultModel';
import { FlightDynamicsModel, MISSION_WAYPOINTS } from './flightDynamicsModel';
import { FaultSeverity, FaultType, FlightControlsState, FlightPhase, FlightState, SimulationState } from '../types/simulation';
import { TelemetryPacket } from '../types/telemetry';
import { UAVPosition } from '../types/mission';

export { MISSION_WAYPOINTS };

/**
 * Central Simulation Engine
 * Single source of truth unifying the physics-inspired flight dynamics model,
 * Reduced-Order Rotax 912 ULS engine model, thermodynamics, sensor suite,
 * and unified real-time telemetry generation.
 */
export class SimulationEngine {
  private flightModel = new FlightDynamicsModel();
  private engineModel = new Rotax912EngineModel();
  private thermalModel = new Rotax912ThermalModel();
  private sensorModel = new SensorSuiteModel();

  public state: SimulationState;
  public uavPosition: UAVPosition;

  // Synchronization Metadata
  public simulationId: string = `SIM-${Date.now().toString(36).toUpperCase()}`;
  public sequenceNumber: number = 0;

  constructor() {
    const initialControls: FlightControlsState = {
      throttle: 70,
      targetAltitude: 8000,
      targetAirspeed: 145,
      targetHeading: 270,
      ambientTemp: 30,
      engineLoad: 70,
      navigationMode: 'MANUAL_PILOT',
      windSpeed: 12,
      windDirection: 240,
      latitude: 32.5450,
      longitude: 77.2150,
      heading: 270,
      altitude: 8000,
      airspeed: 145
    };

    const initialFlight: FlightState = {
      latitude: 32.5450,
      longitude: 77.2150,
      altitude: 0,
      heading: 270,
      airspeed: 0,
      groundSpeed: 0,
      verticalSpeed: 0,
      groundTrack: 270,
      targetHeading: 270,
      targetAltitude: 8000,
      targetAirspeed: 145,
      throttle: 70,
      engineLoad: 70,
      flightPhase: 'STANDBY',
      windSpeed: 12,
      windDirection: 240,
      currentWaypointIndex: 0,
      currentWaypointName: MISSION_WAYPOINTS[0].name,
      distanceToWaypointKm: 0,
      bearingToWaypointDeg: 270,
      missionProgressPercent: 0,
      turnRateDegPerSec: 0,
      bankAngleDeg: 0,
    };

    const initialAtmosphere = calculateAtmosphere(0, initialControls.ambientTemp);
    const initialFault = createInitialFaultState();

    // Default to Engine OFF / STANDBY on initial load
    const initialEngine = this.engineModel.update(0.1, false, initialControls, initialAtmosphere, initialFault, 0);
    this.thermalModel.cht = initialControls.ambientTemp;
    this.thermalModel.egt = initialControls.ambientTemp;
    this.thermalModel.oilTemperature = initialControls.ambientTemp;
    this.thermalModel.oilPressure = 0;
    const initialThermal = this.thermalModel.update(0.1, initialEngine, initialControls, initialAtmosphere, initialFault);
    const initialSensors = this.sensorModel.processReadings(initialEngine, initialThermal, true, 0);

    this.state = {
      isRunning: true,
      isPaused: false,
      engineOn: false, // Engine OFF initially
      simTimeSeconds: 0,
      speedMultiplier: 1.0,
      sensorNoiseEnabled: true,
      flightPhase: 'STANDBY',
      flight: initialFlight,
      controls: initialControls,
      atmosphere: initialAtmosphere,
      engine: initialEngine,
      thermal: initialThermal,
      sensors: initialSensors,
      fault: initialFault,
    };

    this.uavPosition = {
      lat: initialFlight.latitude,
      lon: initialFlight.longitude,
      altitude: 0,
      airspeed: 0,
      heading: initialFlight.heading,
      currentWaypointIndex: 0,
      distanceToNextKm: 0,
      missionProgressPercent: 0,
    };
  }

  public setEngineOn(isOn: boolean): void {
    this.state.engineOn = isOn;
    if (!isOn) {
      this.state.flightPhase = 'STANDBY';
      this.state.flight.flightPhase = 'STANDBY';
    } else {
      if (this.state.controls.throttle > 50) {
        this.state.flightPhase = 'CRUISE';
        this.state.flight.flightPhase = 'CRUISE';
      } else {
        this.state.flightPhase = 'STARTUP';
        this.state.flight.flightPhase = 'STARTUP';
      }
    }
  }

  public setPause(paused: boolean): void {
    this.state.isPaused = paused;
  }

  public setSpeedMultiplier(multiplier: number): void {
    this.state.speedMultiplier = Math.max(0.5, Math.min(5.0, multiplier));
  }

  public setControl<K extends keyof FlightControlsState>(key: K, value: FlightControlsState[K]): void {
    this.state.controls[key] = value;

    if (key === 'throttle') {
      this.flightModel.throttle = value as number;
    } else if (key === 'targetHeading' || key === 'heading') {
      this.flightModel.targetHeading = value as number;
      this.state.controls.targetHeading = value as number;
      this.state.controls.heading = value as number;
    } else if (key === 'targetAltitude' || key === 'altitude') {
      this.flightModel.targetAltitude = value as number;
      this.state.controls.targetAltitude = value as number;
      this.state.controls.altitude = value as number;
    } else if (key === 'targetAirspeed' || key === 'airspeed') {
      this.flightModel.targetAirspeed = value as number;
      this.state.controls.targetAirspeed = value as number;
      this.state.controls.airspeed = value as number;
    } else if (key === 'navigationMode') {
      this.flightModel.navigationMode = value as any;
    } else if (key === 'windSpeed') {
      this.flightModel.windSpeed = value as number;
    } else if (key === 'windDirection') {
      this.flightModel.windDirection = value as number;
    } else if (key === 'engineLoad') {
      this.flightModel.engineLoad = value as number;
    }
  }

  public setFault(faultType: FaultType, severity: FaultSeverity = 'MEDIUM'): void {
    const def = FAULT_DEFINITIONS[faultType];
    this.state.fault = {
      activeFault: faultType,
      severity,
      elapsedSeconds: 0,
      description: def.description,
      propagationPath: def.propagation
    };
  }

  public clearFault(): void {
    this.setFault('NORMAL');
  }

  public resetSimulation(): void {
    this.simulationId = `SIM-${Date.now().toString(36).toUpperCase()}`;
    this.sequenceNumber = 0;

    this.setEngineOn(false);
    this.state.isPaused = false;
    this.state.simTimeSeconds = 0;

    this.flightModel.resetToInitialState();

    this.state.controls = {
      throttle: 70,
      targetAltitude: 8000,
      targetAirspeed: 145,
      targetHeading: 270,
      ambientTemp: 30,
      engineLoad: 70,
      navigationMode: 'MANUAL_PILOT',
      windSpeed: 12,
      windDirection: 240,
      latitude: 32.5450,
      longitude: 77.2150,
      heading: 270,
      altitude: 8000,
      airspeed: 145
    };

    this.clearFault();

    this.uavPosition = {
      lat: 32.5450,
      lon: 77.2150,
      altitude: 0,
      airspeed: 0,
      heading: 270,
      currentWaypointIndex: 0,
      distanceToNextKm: 0,
      missionProgressPercent: 0,
    };
  }

  /**
   * Main Physics Tick (30Hz - 60Hz)
   */
  public update(dtSeconds: number): void {
    if (this.state.isPaused) return;

    const effectiveDt = dtSeconds * this.state.speedMultiplier;
    this.state.simTimeSeconds += effectiveDt;
    this.state.fault.elapsedSeconds += effectiveDt;

    // 1. Atmosphere Physics Calculation
    this.state.atmosphere = calculateAtmosphere(
      this.state.engineOn ? this.flightModel.altitude : 0,
      this.state.controls.ambientTemp
    );

    // 2. Rotax 912 Engine Physics
    // Pass current flight airspeed & altitude for accurate cooling & density derating
    const engineControlsInput: FlightControlsState = {
      ...this.state.controls,
      airspeed: this.flightModel.airspeed,
      altitude: this.flightModel.altitude,
      throttle: this.flightModel.throttle,
      engineLoad: this.state.controls.engineLoad
    };

    this.state.engine = this.engineModel.update(
      effectiveDt,
      this.state.engineOn,
      engineControlsInput,
      this.state.atmosphere,
      this.state.fault,
      this.state.simTimeSeconds
    );

    // 3. Thermodynamics & Oil/Coolant Fluid Mechanics
    this.state.thermal = this.thermalModel.update(
      effectiveDt,
      this.state.engine,
      engineControlsInput,
      this.state.atmosphere,
      this.state.fault
    );

    // 4. Virtual Sensors Processing with Noise & Bounds
    this.state.sensors = this.sensorModel.processReadings(
      this.state.engine,
      this.state.thermal,
      this.state.sensorNoiseEnabled,
      this.state.simTimeSeconds
    );

    // 5. Central Flight Dynamics & Geodesic Navigation Engine
    this.state.flight = this.flightModel.update(
      effectiveDt,
      this.state.engineOn,
      this.state.engine.powerHp,
      this.state.simTimeSeconds
    );

    this.state.flightPhase = this.state.flight.flightPhase;

    // 6. Synchronize UAV Position for Map & UI
    this.uavPosition = {
      lat: this.state.flight.latitude,
      lon: this.state.flight.longitude,
      altitude: this.state.flight.altitude,
      airspeed: this.state.flight.airspeed,
      heading: this.state.flight.heading,
      currentWaypointIndex: this.state.flight.currentWaypointIndex,
      distanceToNextKm: this.state.flight.distanceToWaypointKm,
      missionProgressPercent: this.state.flight.missionProgressPercent,
    };

    // Keep controls in sync for UI readouts
    this.state.controls.latitude = this.state.flight.latitude;
    this.state.controls.longitude = this.state.flight.longitude;
    this.state.controls.heading = this.state.flight.heading;
    this.state.controls.altitude = this.state.flight.altitude;
    this.state.controls.airspeed = this.state.flight.airspeed;
  }

  /**
   * Generates Unified Telemetry JSON packet matching external interface contract
   */
  public getTelemetryPacket(): TelemetryPacket {
    this.sequenceNumber++;

    let numericSeverity = 0;
    if (this.state.fault.activeFault !== 'NORMAL') {
      numericSeverity = this.state.fault.severity === 'LOW' ? 0.5 : this.state.fault.severity === 'HIGH' ? 1.0 : 0.8;
    }

    const activeFaultLower = this.state.fault.activeFault.toLowerCase();

    return {
      timestamp: new Date().toISOString(),
      simulation_id: this.simulationId,
      sequence_number: this.sequenceNumber,
      aircraft: 'MALE_UAV',
      engine: 'ROTAX_912_ULS',
      flight_phase: this.state.flightPhase,
      engine_on: this.state.engineOn,

      // Rotax 912 Sensors
      rpm: this.state.sensors.rpm.value,
      cht: Number(this.state.thermal.cht.toFixed(2)),
      egt: Number(this.state.thermal.egt.toFixed(1)),
      oil_pressure: Number(this.state.thermal.oilPressure.toFixed(2)),
      oil_temperature: Number(this.state.thermal.oilTemperature.toFixed(2)),
      oil_temp: Number(this.state.thermal.oilTemperature.toFixed(2)),
      vibration: Number(this.state.engine.vibration.toFixed(2)),
      fuel_flow: Number(this.state.engine.fuelFlow.toFixed(2)),
      fuel_pressure: Number(this.state.engine.fuelPressure.toFixed(2)),
      map: Number(this.state.engine.manifoldPressure.toFixed(2)),

      // Flight Dynamics & Navigation
      latitude: this.state.flight.latitude,
      longitude: this.state.flight.longitude,
      altitude: this.state.flight.altitude,
      airspeed: this.state.flight.airspeed,
      ground_speed: this.state.flight.groundSpeed,
      vertical_speed: this.state.flight.verticalSpeed,
      heading: this.state.flight.heading,
      ground_track: this.state.flight.groundTrack,

      // Autopilot & Waypoints
      target_heading: this.state.flight.targetHeading,
      target_altitude: this.state.flight.targetAltitude,
      target_airspeed: this.state.flight.targetAirspeed,
      waypoint: this.state.flight.currentWaypointName,
      waypoint_distance_km: this.state.flight.distanceToWaypointKm,
      mission_progress: this.state.flight.missionProgressPercent,

      // Controls & Environment
      throttle: this.state.flight.throttle,
      engine_load: Math.round(this.state.engineOn ? this.state.controls.engineLoad : 0),
      engineLoad: Math.round(this.state.engineOn ? this.state.controls.engineLoad : 0),
      ambient_temperature: Number(this.state.controls.ambientTemp.toFixed(1)),
      ambient_temp: Number(this.state.controls.ambientTemp.toFixed(1)),
      wind_speed: this.state.flight.windSpeed,
      wind_direction: this.state.flight.windDirection,

      // Fault Diagnostics
      fault: this.state.fault.activeFault,
      fault_severity: numericSeverity,
      preset: activeFaultLower === 'normal' ? 'nominal' : activeFaultLower,
      afr: this.state.fault.activeFault === 'FUEL_PRESSURE_DROP' ? 17.2 : 14.7
    };
  }
}
