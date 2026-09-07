import { FlightControlsState, FlightPhase, FlightState, NavigationMode } from '../types/simulation';
import { Waypoint } from '../types/mission';

export const MISSION_WAYPOINTS: Waypoint[] = [
  { id: 'wp1', name: 'WP1 — TAKEOFF / AIRBASE', lat: 32.5280, lon: 77.1850, altitudeFt: 500, targetAirspeedKmh: 105, type: 'TAKEOFF', description: 'Runway departure and initial climb vector' },
  { id: 'wp2', name: 'WP2 — RIVER CORRIDOR', lat: 32.5420, lon: 77.2050, altitudeFt: 4500, targetAirspeedKmh: 135, type: 'CLIMB', description: 'Climb along the central river valley' },
  { id: 'wp3', name: 'WP3 — URBAN CENTER', lat: 32.5650, lon: 77.2280, altitudeFt: 8000, targetAirspeedKmh: 155, type: 'SURVEILLANCE', description: 'Active tactical surveillance over city blocks' },
  { id: 'wp4', name: 'WP4 — NORTH EAST HILLS', lat: 32.5780, lon: 77.2550, altitudeFt: 8000, targetAirspeedKmh: 150, type: 'SURVEILLANCE', description: 'Highland perimeter tactical patrol' },
  { id: 'wp5', name: 'WP5 — RECOVERY VECTOR', lat: 32.5480, lon: 77.2420, altitudeFt: 3500, targetAirspeedKmh: 125, type: 'RETURN', description: 'Descent to recovery approach corridor' },
  { id: 'base', name: 'BASE — RUNWAY TERMINAL', lat: 32.5280, lon: 77.1850, altitudeFt: 0, targetAirspeedKmh: 75, type: 'BASE', description: 'Home airbase runway touchdown point' },
];

/**
 * Deterministic Physics-Inspired Flight Dynamics & Geospatial Navigation Engine
 * Provides smooth inertia-driven heading, first-order airspeed response,
 * gradual vertical speed altitude climbing/descending, geodetic position propagation,
 * wind vector resolution, smooth low-frequency turbulence, and waypoint autopilot.
 */
export class FlightDynamicsModel {
  // Core Position & Attitude State
  public latitude: number = 32.5450;
  public longitude: number = 77.2150;
  public altitude: number = 8000;
  public heading: number = 270;
  public airspeed: number = 145;
  public groundSpeed: number = 145;
  public verticalSpeed: number = 0; // ft/min
  public groundTrack: number = 270;
  public bankAngleDeg: number = 0;
  public turnRateDegPerSec: number = 0;

  // Commanded Targets
  public targetHeading: number = 270;
  public targetAltitude: number = 8000;
  public targetAirspeed: number = 145;
  public throttle: number = 70;
  public engineLoad: number = 70;

  // Environment
  public windSpeed: number = 12; // km/h
  public windDirection: number = 240; // deg (wind blowing FROM 240°)

  // Autopilot Waypoints
  public waypoints: Waypoint[] = MISSION_WAYPOINTS;
  public currentWaypointIndex: number = 2; // WP3 Urban Center by default
  public flightPhase: FlightPhase = 'CRUISE';
  public navigationMode: NavigationMode = 'MANUAL_PILOT';

  // Configurable Flight Constants
  public maxTurnRateDegPerSec: number = 4.0; // Standard cruise turn rate
  public maxClimbRateFpm: number = 1200; // ft/min climb limit
  public maxDescentRateFpm: number = 900; // ft/min descent limit
  public minFlightAirspeedKmh: number = 70; // Stall boundary
  public maxFlightAirspeedKmh: number = 215; // Max level speed

  constructor() {
    this.resetToInitialState();
  }

  public resetToInitialState(): void {
    this.latitude = 32.5450;
    this.longitude = 77.2150;
    this.altitude = 0;
    this.heading = 270;
    this.airspeed = 0;
    this.groundSpeed = 0;
    this.verticalSpeed = 0;
    this.groundTrack = 270;
    this.bankAngleDeg = 0;
    this.turnRateDegPerSec = 0;

    this.targetHeading = 270;
    this.targetAltitude = 8000;
    this.targetAirspeed = 145;
    this.throttle = 70;
    this.engineLoad = 70;

    this.windSpeed = 12;
    this.windDirection = 240;
    this.currentWaypointIndex = 0;
    this.flightPhase = 'STANDBY';
    this.navigationMode = 'MANUAL_PILOT';
  }

  /**
   * Main Physics Update Step
   * @param dt Timestep in seconds (e.g. 0.033 to 0.1s)
   * @param engineOn Engine master switch
   * @param enginePowerHp Available power from Rotax 912 engine model (accounting for density & faults)
   * @param simTime Total elapsed simulation seconds
   */
  public update(
    dt: number,
    engineOn: boolean,
    enginePowerHp: number,
    simTime: number
  ): FlightState {
    // 1. Waypoint Autopilot Logic (if active)
    let distToWpKm = 0;
    let bearingToWpDeg = 0;

    const currentWp = this.waypoints[this.currentWaypointIndex] || this.waypoints[0];
    const dLat = currentWp.lat - this.latitude;
    const dLon = currentWp.lon - this.longitude;
    const avgLatRad = ((this.latitude + currentWp.lat) / 2) * (Math.PI / 180);
    const dNorthM = dLat * 111139.0;
    const dEastM = dLon * 111139.0 * Math.max(0.1, Math.cos(avgLatRad));
    distToWpKm = Number((Math.sqrt(dNorthM * dNorthM + dEastM * dEastM) / 1000.0).toFixed(2));
    const bearingRad = Math.atan2(dEastM, dNorthM);
    bearingToWpDeg = Math.round((bearingRad * 180 / Math.PI + 360) % 360);

    if (engineOn && this.navigationMode === 'WAYPOINT_ROUTE') {
      this.targetHeading = bearingToWpDeg;
      this.targetAltitude = currentWp.altitudeFt;
      this.targetAirspeed = currentWp.targetAirspeedKmh;

      // Waypoint arrival detection
      if (distToWpKm < 0.35) {
        this.currentWaypointIndex = (this.currentWaypointIndex + 1) % this.waypoints.length;
      }
    }

    // 2. Smooth Heading Dynamics with Inertia & 0°/360° Wraparound
    if (engineOn && this.airspeed > 20) {
      // Calculate shortest angular distance (-180 to +180)
      let headingDiff = ((this.targetHeading - this.heading + 540) % 360) - 180;
      
      // Calculate desired turn rate toward target
      const turnAgility = Math.min(1.0, this.airspeed / 80.0);
      const effectiveMaxTurnRate = this.maxTurnRateDegPerSec * turnAgility;
      const desiredTurnRate = Math.sign(headingDiff) * Math.min(effectiveMaxTurnRate, Math.abs(headingDiff) * 1.5);

      // Turn rate lag / angular inertia
      const turnTau = 0.5; // seconds
      this.turnRateDegPerSec += (desiredTurnRate - this.turnRateDegPerSec) * (1.0 - Math.exp(-dt / turnTau));
      
      // Integrate heading
      this.heading = (this.heading + this.turnRateDegPerSec * dt + 360) % 360;

      // Dynamic banking angle in coordinated turn
      const targetBank = -this.turnRateDegPerSec * 4.2;
      this.bankAngleDeg += (targetBank - this.bankAngleDeg) * Math.min(1.0, dt * 5.0);
    } else {
      this.turnRateDegPerSec = 0;
      this.bankAngleDeg = 0;
    }

    // 3. Smooth Airspeed Dynamics (Coupled with Engine Power & Throttle)
    if (!engineOn) {
      // Coast down when engine is stopped
      this.airspeed = Math.max(0, this.airspeed - 25.0 * dt);
    } else {
      // Available engine power ratio (100 hp nominal)
      const powerRatio = Math.max(0.15, Math.min(1.15, enginePowerHp / 100.0));
      const throttleNorm = Math.max(0, Math.min(100, this.throttle)) / 100.0;

      // Thrust target speed based on throttle and available power
      const thrustAirspeed = 65.0 + (throttleNorm * 135.0 * powerRatio);
      
      let commandedSpeed = this.targetAirspeed;
      if (this.navigationMode === 'MANUAL_PILOT') {
        commandedSpeed = thrustAirspeed;
      } else {
        commandedSpeed = Math.min(this.targetAirspeed, thrustAirspeed + 10.0);
      }

      // First-order aerodynamic response
      const speedTau = 2.4; // seconds
      const speedAlpha = 1.0 - Math.exp(-dt / speedTau);
      this.airspeed += (commandedSpeed - this.airspeed) * speedAlpha;
      this.airspeed = Math.max(0, Math.min(this.maxFlightAirspeedKmh, this.airspeed));
    }

    // 4. Smooth Altitude & Vertical Speed Dynamics
    if (!engineOn) {
      if (this.altitude > 0) {
        // Glide descent without power
        this.verticalSpeed += (-600 - this.verticalSpeed) * Math.min(1.0, dt * 2.0);
        this.altitude = Math.max(0, this.altitude + (this.verticalSpeed / 60.0) * dt);
      } else {
        this.verticalSpeed = 0;
        this.altitude = 0;
      }
    } else {
      const altDiff = this.targetAltitude - this.altitude;
      const powerRatio = Math.max(0.4, Math.min(1.2, enginePowerHp / 70.0));

      let desiredVzFpm = 0;
      if (altDiff > 10) {
        // Climb: bounded by maximum climb rate (approx 5-7 m/s -> 1000-1400 ft/min)
        desiredVzFpm = Math.min(this.maxClimbRateFpm * powerRatio, Math.max(250, altDiff * 0.8));
      } else if (altDiff < -10) {
        // Descent: standard rate
        desiredVzFpm = Math.max(-this.maxDescentRateFpm, Math.min(-250, altDiff * 0.8));
      } else {
        desiredVzFpm = 0;
      }

      // First-order vertical speed lag
      const vzTau = 0.8; // seconds
      this.verticalSpeed += (desiredVzFpm - this.verticalSpeed) * (1.0 - Math.exp(-dt / vzTau));
      this.altitude = Math.max(0, this.altitude + (this.verticalSpeed / 60.0) * dt);
    }

    // 5. Environmental Wind & Ground Velocity Vector Calculation
    // Air velocity vector
    const headingRad = (this.heading * Math.PI) / 180.0;
    const airSpeedMs = (this.airspeed * 1000.0) / 3600.0;
    const airNorthMs = airSpeedMs * Math.cos(headingRad);
    const airEastMs = airSpeedMs * Math.sin(headingRad);

    // Wind vector (meteorological: wind direction is where wind comes FROM)
    const windToRad = (((this.windDirection + 180) % 360) * Math.PI) / 180.0;
    const windSpeedMs = (this.windSpeed * 1000.0) / 3600.0;
    const windNorthMs = windSpeedMs * Math.cos(windToRad);
    const windEastMs = windSpeedMs * Math.sin(windToRad);

    // Ground velocity vector = Air velocity + Wind velocity
    const groundNorthMs = airNorthMs + (engineOn ? windNorthMs : 0);
    const groundEastMs = airEastMs + (engineOn ? windEastMs : 0);
    const groundSpeedMs = Math.sqrt(groundNorthMs * groundNorthMs + groundEastMs * groundEastMs);
    this.groundSpeed = Number(((groundSpeedMs * 3600.0) / 1000.0).toFixed(1));

    if (this.groundSpeed > 5.0) {
      const trackRad = Math.atan2(groundEastMs, groundNorthMs);
      this.groundTrack = Math.round((trackRad * 180.0 / Math.PI + 360) % 360);
    } else {
      this.groundTrack = Math.round(this.heading);
    }

    // 6. Smooth Controlled Low-Frequency Atmospheric Turbulence
    let turbHeading = 0;
    let turbVz = 0;
    let turbSpeed = 0;
    if (engineOn && this.airspeed > 40) {
      turbHeading = Math.sin(simTime * 0.45) * 0.35 + Math.cos(simTime * 0.95) * 0.25;
      turbVz = Math.sin(simTime * 0.65) * 15.0 + Math.cos(simTime * 1.25) * 10.0;
      turbSpeed = Math.sin(simTime * 0.35) * 1.2;
    }

    // 7. Geodetic Coordinate Propagation (Local Earth Approximation)
    if (engineOn && this.groundSpeed > 1.0) {
      const distanceMovedMeters = groundSpeedMs * dt;
      const effectiveHeadingRad = ((this.groundTrack + turbHeading) * Math.PI) / 180.0;

      const deltaLat = (distanceMovedMeters * Math.cos(effectiveHeadingRad)) / 111139.0;
      const currentLatRad = (this.latitude * Math.PI) / 180.0;
      const deltaLon = (distanceMovedMeters * Math.sin(effectiveHeadingRad)) / (111139.0 * Math.max(0.1, Math.cos(currentLatRad)));

      this.latitude += deltaLat;
      this.longitude += deltaLon;

      // Soft operational boundary wrapping to keep UAV in tactical sector
      if (this.latitude > 32.610) this.latitude = 32.490;
      if (this.latitude < 32.490) this.latitude = 32.610;
      if (this.longitude > 77.290) this.longitude = 77.140;
      if (this.longitude < 77.140) this.longitude = 77.290;
    }

    // 8. Deterministic Flight Phase Logic
    this.updateFlightPhase(engineOn);

    // 9. Mission Progress Percentage
    const totalLegs = this.waypoints.length;
    const legProgress = Math.max(0, Math.min(1.0, 1.0 - (distToWpKm / 4.5)));
    const totalProgress = ((this.currentWaypointIndex + legProgress) / totalLegs) * 100.0;
    const missionProgress = Math.round(totalProgress % 100);

    return {
      latitude: Number(this.latitude.toFixed(4)),
      longitude: Number(this.longitude.toFixed(4)),
      altitude: Math.round(this.altitude),
      heading: Math.round((this.heading + turbHeading + 360) % 360),
      airspeed: Math.round(Math.max(0, this.airspeed + turbSpeed)),
      groundSpeed: Math.round(this.groundSpeed),
      verticalSpeed: Math.round(this.verticalSpeed + turbVz),
      groundTrack: this.groundTrack,
      targetHeading: Math.round(this.targetHeading),
      targetAltitude: Math.round(this.targetAltitude),
      targetAirspeed: Math.round(this.targetAirspeed),
      throttle: Math.round(this.throttle),
      engineLoad: Math.round(this.engineLoad),
      flightPhase: this.flightPhase,
      windSpeed: this.windSpeed,
      windDirection: this.windDirection,
      currentWaypointIndex: this.currentWaypointIndex,
      currentWaypointName: currentWp.name,
      distanceToWaypointKm: distToWpKm,
      bearingToWaypointDeg: bearingToWpDeg,
      missionProgressPercent: missionProgress,
      turnRateDegPerSec: Number(this.turnRateDegPerSec.toFixed(2)),
      bankAngleDeg: Number(this.bankAngleDeg.toFixed(1)),
    };
  }

  private updateFlightPhase(engineOn: boolean): void {
    if (!engineOn) {
      this.flightPhase = 'STANDBY';
      return;
    }

    if (this.throttle < 35 && this.altitude < 150 && this.airspeed < 50) {
      this.flightPhase = 'STARTUP';
    } else if (this.throttle >= 80 && this.altitude < 1200 && this.verticalSpeed > 200) {
      this.flightPhase = 'TAKEOFF';
    } else if (this.verticalSpeed >= 180 && this.altitude < this.targetAltitude - 150) {
      this.flightPhase = 'CLIMB';
    } else if (this.verticalSpeed <= -180 && this.altitude > 800) {
      this.flightPhase = 'DESCENT';
    } else if (this.altitude <= 800 && this.verticalSpeed < -50 && this.airspeed < 110) {
      this.flightPhase = 'LANDING';
    } else {
      this.flightPhase = 'CRUISE';
    }
  }
}
