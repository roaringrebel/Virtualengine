import { FlightControlsState, FlightPhase, FlightState, NavigationMode } from '../types/simulation';
import { LocationCoord, Waypoint } from '../types/mission';
import { SIMULATION_CONFIG } from './simulationConfig';
import { haversineDistanceKm, initialBearingDeg, REAL_WORLD_MISSION_PRESETS } from './geoMath';

export const DEFAULT_MISSION_WAYPOINTS: Waypoint[] = [
  {
    id: 'vitap_source',
    name: 'VIT-AP University — AIRBASE',
    lat: 16.4941,
    lon: 80.4982,
    altitudeFt: 0,
    targetAirspeedKmh: 0,
    type: 'SOURCE',
    description: 'VIT-AP University runway and airfield'
  },
  {
    id: 'wp1_climb',
    name: 'WP1 — CLIMB CORRIDOR',
    lat: 16.5032,
    lon: 80.5728,
    altitudeFt: 4500,
    targetAirspeedKmh: 135,
    type: 'CLIMB',
    description: 'Initial ascent vector across Krishna river basin'
  },
  {
    id: 'wp2_cruise',
    name: 'WP2 — CRUISE SECTOR',
    lat: 16.5186,
    lon: 80.6437,
    altitudeFt: 6500,
    targetAirspeedKmh: 145,
    type: 'CRUISE',
    description: 'Tactical transit corridor over Vijayawada metro'
  },
  {
    id: 'wp3_descent',
    name: 'WP3 — DESCENT APPROACH',
    lat: 16.5250,
    lon: 80.7200,
    altitudeFt: 3000,
    targetAirspeedKmh: 125,
    type: 'RETURN',
    description: 'Descent sequencing into airport approach sector'
  },
  {
    id: 'vja_dest',
    name: 'Vijayawada Int Airport — DESTINATION',
    lat: 16.5304,
    lon: 80.7968,
    altitudeFt: 0,
    targetAirspeedKmh: 75,
    type: 'DESTINATION',
    description: 'Runway touchdown and mission destination'
  }
];

export const MISSION_WAYPOINTS = DEFAULT_MISSION_WAYPOINTS;

/**
 * Deterministic Physics-Inspired Flight Dynamics & Geospatial Navigation Engine
 * Single authoritative source of truth for 2D and 3D flight.
 */
export class FlightDynamicsModel {
  // Core Position & Attitude State (VIT-AP default starting coordinate)
  public latitude: number = 16.4941;
  public longitude: number = 80.4982;
  public altitude: number = 0; // ft MSL above airfield
  public heading: number = 80;
  public airspeed: number = 0; // km/h true airspeed
  public groundSpeed: number = 0; // km/h
  public verticalSpeed: number = 0; // ft/min
  public groundTrack: number = 80; // deg
  public bankAngleDeg: number = 0;
  public turnRateDegPerSec: number = 0;

  // Commanded Targets
  public targetHeading: number = 80;
  public targetAltitude: number = 6500;
  public targetAirspeed: number = 145;
  public throttle: number = 70;
  public engineLoad: number = 70;

  // Environment
  public windSpeed: number = SIMULATION_CONFIG.defaultWindSpeedKmh; // km/h
  public windDirection: number = SIMULATION_CONFIG.defaultWindDirectionDeg; // deg

  // Autopilot Waypoints
  public waypoints: Waypoint[] = DEFAULT_MISSION_WAYPOINTS;
  public currentWaypointIndex: number = 0;
  public flightPhase: FlightPhase = 'STANDBY';
  public navigationMode: NavigationMode = 'WAYPOINT_ROUTE';
  public isCompleted: boolean = false;

  // Physical Limits from Config
  public maxTurnRateDegPerSec: number = SIMULATION_CONFIG.maxTurnRateDegPerSec;
  public maxClimbRateFpm: number = SIMULATION_CONFIG.maxClimbRateFpm;
  public maxDescentRateFpm: number = SIMULATION_CONFIG.maxDescentRateFpm;
  public minFlightAirspeedKmh: number = SIMULATION_CONFIG.minFlightAirspeedKmh;
  public maxFlightAirspeedKmh: number = SIMULATION_CONFIG.maxFlightAirspeedKmh;

  constructor() {
    this.resetToInitialState();
  }

  public resetToInitialState(): void {
    const startWp = this.waypoints[0] || DEFAULT_MISSION_WAYPOINTS[0];
    this.latitude = startWp.lat;
    this.longitude = startWp.lon;
    this.altitude = 0;
    this.heading = 80;
    this.airspeed = 0;
    this.groundSpeed = 0;
    this.verticalSpeed = 0;
    this.groundTrack = 80;
    this.bankAngleDeg = 0;
    this.turnRateDegPerSec = 0;

    this.targetHeading = 80;
    this.targetAltitude = 6500;
    this.targetAirspeed = 145;
    this.throttle = 70;
    this.engineLoad = 70;

    this.windSpeed = SIMULATION_CONFIG.defaultWindSpeedKmh;
    this.windDirection = SIMULATION_CONFIG.defaultWindDirectionDeg;
    this.currentWaypointIndex = 0;
    this.flightPhase = 'STANDBY';
    this.navigationMode = 'WAYPOINT_ROUTE';
    this.isCompleted = false;
  }

  public setMissionRoute(waypoints: Waypoint[]): void {
    if (waypoints.length > 0) {
      this.waypoints = waypoints;
      this.currentWaypointIndex = 0;
      this.isCompleted = false;
      this.latitude = waypoints[0].lat;
      this.longitude = waypoints[0].lon;
      if (waypoints.length > 1) {
        this.targetHeading = initialBearingDeg(waypoints[0].lat, waypoints[0].lon, waypoints[1].lat, waypoints[1].lon);
        this.heading = this.targetHeading;
        this.groundTrack = this.targetHeading;
      }
    }
  }

  /**
   * Main Physics Update Step (30-60 Hz)
   */
  public update(
    dt: number,
    engineOn: boolean,
    enginePowerHp: number,
    simTime: number,
    airDensityKgM3: number = SIMULATION_CONFIG.seaLevelAirDensityKgM3
  ): FlightState {
    if (this.isCompleted) {
      const destWp = this.waypoints[this.waypoints.length - 1] || this.waypoints[0];
      this.latitude = destWp.lat;
      this.longitude = destWp.lon;
      this.altitude = destWp.altitudeFt || 0;
      this.airspeed = 0;
      this.groundSpeed = 0;
      this.verticalSpeed = 0;
      this.turnRateDegPerSec = 0;
      this.bankAngleDeg = 0;
      this.flightPhase = 'LANDING';

      return {
        latitude: Number(this.latitude.toFixed(6)),
        longitude: Number(this.longitude.toFixed(6)),
        altitude: Math.round(this.altitude),
        heading: Math.round(this.heading),
        airspeed: 0,
        groundSpeed: 0,
        verticalSpeed: 0,
        groundTrack: this.groundTrack,
        targetHeading: Math.round(this.targetHeading),
        targetAltitude: Math.round(this.targetAltitude),
        targetAirspeed: 0,
        throttle: 0,
        engineLoad: 0,
        flightPhase: 'LANDING',
        windSpeed: this.windSpeed,
        windDirection: this.windDirection,
        currentWaypointIndex: this.waypoints.length - 1,
        currentWaypointName: destWp.name,
        distanceToWaypointKm: 0,
        bearingToWaypointDeg: 0,
        missionProgressPercent: 100,
        turnRateDegPerSec: 0,
        bankAngleDeg: 0,
        isCompleted: true
      };
    }

    // 1. Waypoint Autopilot Logic
    let distToWpKm = 0;
    let bearingToWpDeg = 0;

    const currentWp = this.waypoints[this.currentWaypointIndex] || this.waypoints[0];
    distToWpKm = haversineDistanceKm(this.latitude, this.longitude, currentWp.lat, currentWp.lon);
    bearingToWpDeg = initialBearingDeg(this.latitude, this.longitude, currentWp.lat, currentWp.lon);

    if (engineOn && this.navigationMode === 'WAYPOINT_ROUTE') {
      this.targetHeading = bearingToWpDeg;
      if (currentWp.altitudeFt > 0) {
        this.targetAltitude = currentWp.altitudeFt;
      }
      if (currentWp.targetAirspeedKmh > 0) {
        this.targetAirspeed = currentWp.targetAirspeedKmh;
      }

      // Check if destination is reached (final waypoint)
      if (this.currentWaypointIndex === this.waypoints.length - 1) {
        if (distToWpKm <= 0.35) { // within 350 meters of destination terminal point
          this.latitude = currentWp.lat;
          this.longitude = currentWp.lon;
          this.altitude = currentWp.altitudeFt || 0;
          this.airspeed = 0;
          this.groundSpeed = 0;
          this.verticalSpeed = 0;
          this.turnRateDegPerSec = 0;
          this.bankAngleDeg = 0;
          this.flightPhase = 'LANDING';
          this.isCompleted = true;

          return {
            latitude: Number(this.latitude.toFixed(6)),
            longitude: Number(this.longitude.toFixed(6)),
            altitude: Math.round(this.altitude),
            heading: Math.round(this.heading),
            airspeed: 0,
            groundSpeed: 0,
            verticalSpeed: 0,
            groundTrack: this.groundTrack,
            targetHeading: Math.round(this.targetHeading),
            targetAltitude: Math.round(this.targetAltitude),
            targetAirspeed: 0,
            throttle: 0,
            engineLoad: 0,
            flightPhase: 'LANDING',
            windSpeed: this.windSpeed,
            windDirection: this.windDirection,
            currentWaypointIndex: this.currentWaypointIndex,
            currentWaypointName: currentWp.name,
            distanceToWaypointKm: 0,
            bearingToWaypointDeg: 0,
            missionProgressPercent: 100,
            turnRateDegPerSec: 0,
            bankAngleDeg: 0,
            isCompleted: true
          };
        }
      } else if (distToWpKm < 0.8) {
        this.currentWaypointIndex++;
      }
    }

    // 2. Smooth Heading Dynamics with Inertia & Limited Turn Rate
    if (engineOn && this.airspeed > 15) {
      let headingDiff = ((this.targetHeading - this.heading + 540) % 360) - 180;
      const turnAgility = Math.min(1.0, this.airspeed / 80.0);
      const effectiveMaxTurnRate = this.maxTurnRateDegPerSec * turnAgility;
      const desiredTurnRate = Math.sign(headingDiff) * Math.min(effectiveMaxTurnRate, Math.abs(headingDiff) * 1.6);

      const turnTau = 0.5; // seconds
      this.turnRateDegPerSec += (desiredTurnRate - this.turnRateDegPerSec) * (1.0 - Math.exp(-dt / turnTau));
      this.heading = (this.heading + this.turnRateDegPerSec * dt + 360) % 360;

      // Banking angle in coordinated turn
      const targetBank = -this.turnRateDegPerSec * 4.2;
      this.bankAngleDeg += (targetBank - this.bankAngleDeg) * Math.min(1.0, dt * 5.0);
    } else {
      this.turnRateDegPerSec = 0;
      this.bankAngleDeg = 0;
    }

    // 3. Longitudinal Flight Dynamics (Thrust vs Aerodynamic Drag Force Balance)
    if (!engineOn) {
      // Aerodynamic deceleration when engine is OFF
      this.airspeed = Math.max(0, this.airspeed - 22.0 * dt);
    } else {
      const vMs = Math.max(0.1, (this.airspeed * 1000.0) / 3600.0);
      const powerWatts = enginePowerHp * 745.7;

      // Propeller thrust: T = (P * eta) / V
      const effectiveSpeedMs = Math.max(vMs, 14.0);
      const thrustNewtons = (powerWatts * SIMULATION_CONFIG.propulsiveEfficiency) / effectiveSpeedMs;

      // Aerodynamic drag: D = 0.5 * rho * V^2 * Cd * S + D_induced
      const dynamicPressure = 0.5 * airDensityKgM3 * vMs * vMs;
      const parasiteDragNewtons = dynamicPressure * SIMULATION_CONFIG.zeroLiftDragCoeff * SIMULATION_CONFIG.referenceAreaM2;
      const inducedDragNewtons = Math.min(400, (SIMULATION_CONFIG.aircraftMassKg * 9.81 * 0.08) / Math.max(1.0, vMs / 10.0));
      const totalDragNewtons = parasiteDragNewtons + inducedDragNewtons;

      // Net longitudinal force & Newton acceleration
      const netForceNewtons = thrustNewtons - totalDragNewtons;
      const accelerationMs2 = netForceNewtons / SIMULATION_CONFIG.aircraftMassKg;

      // Target airspeed governor coupling
      const throttleNorm = Math.max(0, Math.min(100, this.throttle)) / 100.0;
      const targetEquilibriumKmh = 60.0 + (throttleNorm * 145.0 * Math.max(0.2, enginePowerHp / 95.0));
      const commandedTargetKmh = this.navigationMode === 'MANUAL_PILOT' ? targetEquilibriumKmh : Math.min(this.targetAirspeed, targetEquilibriumKmh + 10.0);

      // Integrate acceleration with lag smoothing
      const accelKmhPerSec = accelerationMs2 * 3.6;
      const rawNewSpeedKmh = Math.max(0, this.airspeed + accelKmhPerSec * dt);

      const speedTau = 2.0; // seconds
      const speedAlpha = 1.0 - Math.exp(-dt / speedTau);
      this.airspeed += (commandedTargetKmh - this.airspeed) * speedAlpha * 0.4 + (rawNewSpeedKmh - this.airspeed) * 0.6;
      this.airspeed = Math.max(0, Math.min(this.maxFlightAirspeedKmh, this.airspeed));
    }

    // 4. Smooth Altitude & Vertical Speed Dynamics
    if (!engineOn) {
      if (this.altitude > 0) {
        this.verticalSpeed += (-500 - this.verticalSpeed) * Math.min(1.0, dt * 2.0);
        this.altitude = Math.max(0, this.altitude + (this.verticalSpeed / 60.0) * dt);
      } else {
        this.verticalSpeed = 0;
        this.altitude = 0;
      }
    } else {
      const altDiff = this.targetAltitude - this.altitude;
      const powerRatio = Math.max(0.35, Math.min(1.2, enginePowerHp / 70.0));

      let desiredVzFpm = 0;
      if (altDiff > 10) {
        desiredVzFpm = Math.min(this.maxClimbRateFpm * powerRatio, Math.max(250, altDiff * 0.8));
      } else if (altDiff < -10) {
        desiredVzFpm = Math.max(-this.maxDescentRateFpm, Math.min(-250, altDiff * 0.8));
      } else {
        desiredVzFpm = 0;
      }

      const vzTau = 0.8; // seconds
      this.verticalSpeed += (desiredVzFpm - this.verticalSpeed) * (1.0 - Math.exp(-dt / vzTau));
      this.altitude = Math.max(0, this.altitude + (this.verticalSpeed / 60.0) * dt);
    }

    // 5. Environmental Wind & Ground Velocity Vector Calculation
    const headingRad = (this.heading * Math.PI) / 180.0;
    const airSpeedMs = (this.airspeed * 1000.0) / 3600.0;
    const airNorthMs = airSpeedMs * Math.cos(headingRad);
    const airEastMs = airSpeedMs * Math.sin(headingRad);

    // Wind vector (wind blowing FROM windDirection)
    const windToRad = (((this.windDirection + 180) % 360) * Math.PI) / 180.0;
    const windSpeedMs = (this.windSpeed * 1000.0) / 3600.0;
    const windNorthMs = windSpeedMs * Math.cos(windToRad);
    const windEastMs = windSpeedMs * Math.sin(windToRad);

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

    // 7. Geodetic Coordinate Propagation (Authoritative Earth Equations)
    if (engineOn && this.groundSpeed > 1.0) {
      const distanceMovedMeters = groundSpeedMs * dt;
      const effectiveHeadingRad = ((this.groundTrack + turbHeading) * Math.PI) / 180.0;

      // North & East displacement vectors
      const northDistance = distanceMovedMeters * Math.cos(effectiveHeadingRad);
      const eastDistance = distanceMovedMeters * Math.sin(effectiveHeadingRad);

      const metersPerDegreeLatitude = 111320.0;
      const currentLatRad = (this.latitude * Math.PI) / 180.0;
      const metersPerDegreeLongitude = 111320.0 * Math.max(0.01, Math.cos(currentLatRad));

      this.latitude += northDistance / metersPerDegreeLatitude;
      this.longitude += eastDistance / metersPerDegreeLongitude;
    }

    // 8. Flight Phase Logic
    this.updateFlightPhase(engineOn);

    // 9. Mission Progress Calculation
    const totalLegs = Math.max(1, this.waypoints.length - 1);
    const legProgress = Math.max(0, Math.min(1.0, 1.0 - (distToWpKm / 5.0)));
    const totalProgress = ((this.currentWaypointIndex + legProgress) / totalLegs) * 100.0;
    const missionProgress = Math.min(100, Math.round(totalProgress));

    return {
      latitude: Number(this.latitude.toFixed(6)),
      longitude: Number(this.longitude.toFixed(6)),
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
    } else if (this.throttle >= 70 && this.altitude < 1200 && this.verticalSpeed > 100) {
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
