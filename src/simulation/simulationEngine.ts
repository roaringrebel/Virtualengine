import { calculateAtmosphere } from './atmosphericModel';
import { Rotax912EngineModel } from './rotax912Model';
import { Rotax912ThermalModel } from './thermalModel';
import { SensorSuiteModel } from './sensorModel';
import { createInitialFaultState, FAULT_DEFINITIONS } from './faultModel';
import { FaultSeverity, FaultType, FlightControlsState, FlightPhase, SimulationState } from '../types/simulation';
import { TelemetryPacket } from '../types/telemetry';
import { UAVPosition, Waypoint } from '../types/mission';

export const MISSION_WAYPOINTS: Waypoint[] = [
  { id: 'wp1', name: 'WP1 — TAKEOFF / AIRBASE', lat: 32.5280, lon: 77.1850, altitudeFt: 500, targetAirspeedKmh: 95, type: 'TAKEOFF', description: 'Runway departure and initial climb' },
  { id: 'wp2', name: 'WP2 — RIVER CORRIDOR', lat: 32.5420, lon: 77.2050, altitudeFt: 4500, targetAirspeedKmh: 130, type: 'CLIMB', description: 'Climb along the central river valley' },
  { id: 'wp3', name: 'WP3 — URBAN CENTER', lat: 32.5650, lon: 77.2280, altitudeFt: 8000, targetAirspeedKmh: 145, type: 'SURVEILLANCE', description: 'Active tactical surveillance over city blocks' },
  { id: 'wp4', name: 'WP4 — NORTH EAST HILLS', lat: 32.5780, lon: 77.2550, altitudeFt: 8000, targetAirspeedKmh: 145, type: 'SURVEILLANCE', description: 'Highland perimeter patrol' },
  { id: 'wp5', name: 'WP5 — RECOVERY VECTOR', lat: 32.5480, lon: 77.2420, altitudeFt: 3500, targetAirspeedKmh: 120, type: 'RETURN', description: 'Descent to approach corridor' },
  { id: 'base', name: 'BASE — RUNWAY', lat: 32.5280, lon: 77.1850, altitudeFt: 0, targetAirspeedKmh: 0, type: 'BASE', description: 'Home airbase runway' },
];

export class SimulationEngine {
  private engineModel = new Rotax912EngineModel();
  private thermalModel = new Rotax912ThermalModel();
  private sensorModel = new SensorSuiteModel();

  public state: SimulationState;
  public uavPosition: UAVPosition;
  private waypoints = MISSION_WAYPOINTS;
  private currentWpIndex = 0;

  constructor() {
    const initialControls: FlightControlsState = {
      throttle: 70,
      altitude: 8000,
      airspeed: 145,
      heading: 270,
      latitude: 32.5450,
      longitude: 77.2150,
      ambientTemp: 30,
      engineLoad: 70,
      navigationMode: 'MANUAL_PILOT',
    };

    const initialAtmosphere = calculateAtmosphere(initialControls.altitude, initialControls.ambientTemp);
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
      engineOn: false, // Engine OFF initially
      simTimeSeconds: 0,
      speedMultiplier: 1.0,
      sensorNoiseEnabled: true,
      flightPhase: 'STANDBY',
      controls: initialControls,
      atmosphere: initialAtmosphere,
      engine: initialEngine,
      thermal: initialThermal,
      sensors: initialSensors,
      fault: initialFault,
    };

    this.uavPosition = {
      lat: initialControls.latitude,
      lon: initialControls.longitude,
      altitude: 0,
      airspeed: 0,
      heading: initialControls.heading,
      currentWaypointIndex: 0,
      distanceToNextKm: 0,
      missionProgressPercent: 0,
    };
  }

  public setEngineOn(isOn: boolean): void {
    this.state.engineOn = isOn;
    if (!isOn) {
      this.state.flightPhase = 'STANDBY';
      this.uavPosition.airspeed = 0;
      this.state.controls.airspeed = 0;
    } else {
      if (this.state.controls.throttle > 50) {
        this.state.flightPhase = 'CRUISE';
        this.state.controls.airspeed = Math.round(90 + (this.state.controls.throttle / 100) * 80);
        this.uavPosition.airspeed = this.state.controls.airspeed;
      } else {
        this.state.flightPhase = 'STARTUP';
        this.state.controls.airspeed = 45;
        this.uavPosition.airspeed = 45;
      }
    }
  }

  public setControl<K extends keyof FlightControlsState>(key: K, value: FlightControlsState[K]): void {
    this.state.controls[key] = value;

    // Direct synchronization of position coordinates & heading
    if (key === 'latitude') {
      this.uavPosition.lat = value as number;
    } else if (key === 'longitude') {
      this.uavPosition.lon = value as number;
    } else if (key === 'heading') {
      this.uavPosition.heading = value as number;
    } else if (key === 'altitude') {
      this.uavPosition.altitude = this.state.engineOn ? (value as number) : 0;
    } else if (key === 'airspeed') {
      this.uavPosition.airspeed = this.state.engineOn ? (value as number) : 0;
    } else if (key === 'throttle') {
      // Throttle couples naturally to airspeed in continuous flight
      if (this.state.engineOn) {
        const targetSpeed = Math.round(70 + ((value as number) / 100) * 110);
        this.state.controls.airspeed = targetSpeed;
        this.uavPosition.airspeed = targetSpeed;
      }
    }

    this.updateFlightPhaseFromControls();
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
    this.setEngineOn(false);
    this.state.controls = {
      throttle: 70,
      altitude: 8000,
      airspeed: 145,
      heading: 270,
      latitude: 32.5450,
      longitude: 77.2150,
      ambientTemp: 30,
      engineLoad: 70,
      navigationMode: 'MANUAL_PILOT',
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

  private updateFlightPhaseFromControls(): void {
    if (!this.state.engineOn) {
      this.state.flightPhase = 'STANDBY';
      return;
    }
    const { throttle, altitude } = this.state.controls;
    if (throttle < 20 && altitude < 100) {
      this.state.flightPhase = 'STARTUP';
    } else if (throttle >= 85 && altitude < 1500) {
      this.state.flightPhase = 'TAKEOFF';
    } else if (throttle >= 75 && altitude < 6000) {
      this.state.flightPhase = 'CLIMB';
    } else if (throttle <= 40 && altitude > 2000) {
      this.state.flightPhase = 'DESCENT';
    } else if (throttle <= 30 && altitude <= 1000) {
      this.state.flightPhase = 'LANDING';
    } else {
      this.state.flightPhase = 'CRUISE';
    }
  }

  /**
   * Main Physics Tick (30Hz - 60Hz)
   */
  public update(dtSeconds: number): void {
    const effectiveDt = dtSeconds * this.state.speedMultiplier;
    this.state.simTimeSeconds += effectiveDt;
    this.state.fault.elapsedSeconds += effectiveDt;

    // 1. Atmosphere Physics Calculation
    this.state.atmosphere = calculateAtmosphere(
      this.state.engineOn ? this.state.controls.altitude : 0,
      this.state.controls.ambientTemp
    );

    // 2. Rotax 912 Engine Physics
    this.state.engine = this.engineModel.update(
      effectiveDt,
      this.state.engineOn,
      this.state.controls,
      this.state.atmosphere,
      this.state.fault,
      this.state.simTimeSeconds
    );

    // 3. Thermodynamics & Oil/Coolant Fluid Mechanics
    this.state.thermal = this.thermalModel.update(
      effectiveDt,
      this.state.engine,
      this.state.controls,
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

    // 5. True Geodetic Flight Navigation & Position Propagation
    if (this.state.engineOn) {
      this.updateUAVNavigation(effectiveDt);
    }
  }

  private updateUAVNavigation(dt: number): void {
    const airspeedKmh = this.state.controls.airspeed || 145;
    const speedMs = (airspeedKmh * 1000) / 3600; // m/s
    const distanceMovedMeters = speedMs * dt;

    if (this.state.controls.navigationMode === 'MANUAL_PILOT') {
      // Direct Manual Dead-Reckoning Navigation along chosen Heading
      const headingRad = (this.state.controls.heading * Math.PI) / 180;
      
      // Spherical Geodesy displacement:
      // 1 degree latitude ~ 111,139 meters
      // 1 degree longitude ~ 111,139 * cos(lat) meters
      const deltaLat = (distanceMovedMeters * Math.cos(headingRad)) / 111139;
      const currentLatRad = (this.uavPosition.lat * Math.PI) / 180;
      const deltaLon = (distanceMovedMeters * Math.sin(headingRad)) / (111139 * Math.max(0.1, Math.cos(currentLatRad)));

      this.uavPosition.lat += deltaLat;
      this.uavPosition.lon += deltaLon;

      // Keep within realistic operational map boundaries
      if (this.uavPosition.lat > 32.595) this.uavPosition.lat = 32.505;
      if (this.uavPosition.lat < 32.505) this.uavPosition.lat = 32.595;
      if (this.uavPosition.lon > 77.280) this.uavPosition.lon = 77.160;
      if (this.uavPosition.lon < 77.160) this.uavPosition.lon = 77.280;

      // Sync controls
      this.state.controls.latitude = Number(this.uavPosition.lat.toFixed(4));
      this.state.controls.longitude = Number(this.uavPosition.lon.toFixed(4));

      // Progress accumulation
      this.uavPosition.missionProgressPercent = (this.uavPosition.missionProgressPercent + (distanceMovedMeters / 500)) % 100;
    } else {
      // Tactical Waypoint Corridor Following
      const targetWp = this.waypoints[this.currentWpIndex];
      if (targetWp) {
        const dLat = targetWp.lat - this.uavPosition.lat;
        const dLon = targetWp.lon - this.uavPosition.lon;
        const distKm = Math.sqrt(dLat * dLat + dLon * dLon) * 111.139;

        // Auto calculate heading towards target waypoint
        const targetHeadingRad = Math.atan2(dLon, dLat);
        let targetHeadingDeg = (targetHeadingRad * 180) / Math.PI;
        if (targetHeadingDeg < 0) targetHeadingDeg += 360;

        // Smooth steering toward waypoint
        const currentHeading = this.state.controls.heading;
        let headingDiff = targetHeadingDeg - currentHeading;
        if (headingDiff > 180) headingDiff -= 360;
        if (headingDiff < -180) headingDiff += 360;
        
        const newHeading = (currentHeading + headingDiff * Math.min(1.0, dt * 2.0) + 360) % 360;
        this.state.controls.heading = Math.round(newHeading);
        this.uavPosition.heading = this.state.controls.heading;

        // Move toward waypoint
        const headingRad = (this.state.controls.heading * Math.PI) / 180;
        const deltaLat = (distanceMovedMeters * Math.cos(headingRad)) / 111139;
        const currentLatRad = (this.uavPosition.lat * Math.PI) / 180;
        const deltaLon = (distanceMovedMeters * Math.sin(headingRad)) / (111139 * Math.max(0.1, Math.cos(currentLatRad)));

        this.uavPosition.lat += deltaLat;
        this.uavPosition.lon += deltaLon;

        this.state.controls.latitude = Number(this.uavPosition.lat.toFixed(4));
        this.state.controls.longitude = Number(this.uavPosition.lon.toFixed(4));
        this.uavPosition.distanceToNextKm = Number(distKm.toFixed(1));

        if (distKm < 0.35) {
          this.currentWpIndex = (this.currentWpIndex + 1) % this.waypoints.length;
          this.uavPosition.currentWaypointIndex = this.currentWpIndex;
        }

        // Mission %
        this.uavPosition.missionProgressPercent = Number(((this.currentWpIndex / this.waypoints.length) * 100).toFixed(0));
      }
    }

    this.uavPosition.altitude = this.state.controls.altitude;
    this.uavPosition.airspeed = this.state.controls.airspeed;
    this.uavPosition.heading = this.state.controls.heading;
  }

  /**
   * Generates Telemetry JSON packet matching external interface contract
   */
  public getTelemetryPacket(): TelemetryPacket {
    return {
      timestamp: new Date().toISOString(),
      aircraft: 'MALE_UAV',
      engine: 'ROTAX_912_ULS',
      flight_phase: this.state.flightPhase,
      engine_on: this.state.engineOn,
      rpm: this.state.sensors.rpm.value,
      cht: this.state.sensors.cht.value,
      egt: this.state.sensors.egt.value,
      oil_pressure: this.state.sensors.oilPressure.value,
      oil_temperature: this.state.sensors.oilTemperature.value,
      vibration: this.state.sensors.vibration.value,
      fuel_flow: this.state.sensors.fuelFlow.value,
      fuel_pressure: this.state.sensors.fuelPressure.value,
      map: this.state.sensors.map.value,
      altitude: Math.round(this.state.engineOn ? this.state.controls.altitude : 0),
      airspeed: Math.round(this.state.engineOn ? this.state.controls.airspeed : 0),
      heading: Math.round(this.state.controls.heading),
      throttle: Math.round(this.state.controls.throttle),
      engine_load: Math.round(this.state.engineOn ? this.state.controls.engineLoad : 0),
      ambient_temp: Math.round(this.state.controls.ambientTemp),
      fault: this.state.fault.activeFault,
      fault_severity: this.state.fault.severity
    };
  }
}
