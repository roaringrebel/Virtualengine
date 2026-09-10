import { FlightControlsState, FlightPhase, FlightState, NavigationMode } from '../types/simulation';
import { LocationCoord, Waypoint, ELPCandidate } from '../types/mission';
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

  // Autopilot Waypoints & Normal Mission Lifecycle
  public waypoints: Waypoint[] = DEFAULT_MISSION_WAYPOINTS;
  public currentWaypointIndex: number = 0;
  public flightPhase: FlightPhase = 'PARKED';
  public navigationMode: NavigationMode = 'WAYPOINT_ROUTE';
  public isCompleted: boolean = false;
  public isLanded: boolean = false;
  private landingSequenceTimer: number = 0;

  // Emergency Recovery & ELP Diversion State
  public emergencyDivertActive: boolean = false;
  public recoveryTarget: ELPCandidate | null = null;
  public recoveryPhase: 'EVALUATING' | 'DIVERTING' | 'APPROACH' | 'LANDING' | 'RECOVERED' = 'EVALUATING';
  public isRecovered: boolean = false;

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
    this.flightPhase = 'PARKED';
    this.navigationMode = 'WAYPOINT_ROUTE';
    this.isCompleted = false;
    this.isLanded = false;
    this.landingSequenceTimer = 0;

    this.emergencyDivertActive = false;
    this.recoveryTarget = null;
    this.recoveryPhase = 'EVALUATING';
    this.isRecovered = false;
  }

  public setMissionRoute(waypoints: Waypoint[]): void {
    if (waypoints.length > 0) {
      this.waypoints = waypoints;
      this.currentWaypointIndex = 0;
      this.isCompleted = false;
      this.isLanded = false;
      this.landingSequenceTimer = 0;
      this.emergencyDivertActive = false;
      this.recoveryTarget = null;
      this.isRecovered = false;
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
   * Activates emergency diversion toward a selected ELP candidate
   */
  public activateEmergencyDivert(elp: ELPCandidate): void {
    this.emergencyDivertActive = true;
    this.recoveryTarget = elp;
    this.recoveryPhase = 'DIVERTING';
    this.flightPhase = 'EMERGENCY_DIVERT';
    this.isCompleted = false;
    this.isRecovered = false;

    // Direct guidance toward ELP
    this.targetHeading = initialBearingDeg(this.latitude, this.longitude, elp.lat, elp.lon);
    this.targetAltitude = Math.min(this.altitude, Math.max(1200, elp.elevationFt + 1200));
    this.targetAirspeed = 125; // Controlled glide/penetration airspeed
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
    // -------------------------------------------------------------
    // CASE A: MISSION ALREADY COMPLETED (Terminal state lock)
    // -------------------------------------------------------------
    if (this.isCompleted || this.isRecovered) {
      const destTarget = this.isRecovered && this.recoveryTarget
        ? { lat: this.recoveryTarget.lat, lon: this.recoveryTarget.lon, alt: this.recoveryTarget.elevationFt, name: this.recoveryTarget.name }
        : (this.waypoints[this.waypoints.length - 1] || this.waypoints[0]);

      this.latitude = destTarget.lat;
      this.longitude = destTarget.lon;
      this.altitude = ('alt' in destTarget ? destTarget.alt : 'altitudeFt' in destTarget ? destTarget.altitudeFt : 0) || 0;
      this.airspeed = 0;
      this.groundSpeed = 0;
      this.verticalSpeed = 0;
      this.turnRateDegPerSec = 0;
      this.bankAngleDeg = 0;
      this.flightPhase = this.isRecovered ? 'RECOVERED' : 'COMPLETED';

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
        flightPhase: this.flightPhase,
        windSpeed: this.windSpeed,
        windDirection: this.windDirection,
        currentWaypointIndex: this.waypoints.length - 1,
        currentWaypointName: destTarget.name,
        distanceToWaypointKm: 0,
        bearingToWaypointDeg: 0,
        missionProgressPercent: 100,
        turnRateDegPerSec: 0,
        bankAngleDeg: 0,
        isCompleted: true
      };
    }

    // -------------------------------------------------------------
    // CASE B: EMERGENCY RECOVERY DIVERSION PATHWAY
    // -------------------------------------------------------------
    if (this.emergencyDivertActive && this.recoveryTarget) {
      const elp = this.recoveryTarget;
      const distToElpKm = haversineDistanceKm(this.latitude, this.longitude, elp.lat, elp.lon);
      const bearingToElpDeg = initialBearingDeg(this.latitude, this.longitude, elp.lat, elp.lon);

      this.targetHeading = bearingToElpDeg;

      // ELP Arrival & Approach Thresholds
      if (distToElpKm <= 0.35) {
        // Snap to ELP and execute touchdown sequence
        this.latitude = elp.lat;
        this.longitude = elp.lon;
        this.landingSequenceTimer += dt;

        if (this.landingSequenceTimer < 2.5) {
          this.flightPhase = 'LANDING';
          this.recoveryPhase = 'LANDING';
          this.altitude = Math.max(0, this.altitude - 400 * dt);
          this.airspeed = Math.max(0, this.airspeed - 35 * dt);
        } else {
          this.altitude = elp.elevationFt || 0;
          this.airspeed = 0;
          this.groundSpeed = 0;
          this.verticalSpeed = 0;
          this.flightPhase = 'RECOVERED';
          this.recoveryPhase = 'RECOVERED';
          this.isRecovered = true;
          this.isCompleted = true;
        }

        return {
          latitude: Number(this.latitude.toFixed(6)),
          longitude: Number(this.longitude.toFixed(6)),
          altitude: Math.round(this.altitude),
          heading: Math.round(this.heading),
          airspeed: Math.round(this.airspeed),
          groundSpeed: Math.round(this.groundSpeed),
          verticalSpeed: Math.round(this.verticalSpeed),
          groundTrack: this.groundTrack,
          targetHeading: Math.round(this.targetHeading),
          targetAltitude: elp.elevationFt,
          targetAirspeed: 0,
          throttle: 0,
          engineLoad: 0,
          flightPhase: this.flightPhase,
          windSpeed: this.windSpeed,
          windDirection: this.windDirection,
          currentWaypointIndex: this.waypoints.length - 1,
          currentWaypointName: `EMERGENCY DIVERT: ${elp.name}`,
          distanceToWaypointKm: 0,
          bearingToWaypointDeg: Math.round(bearingToElpDeg),
          missionProgressPercent: 100,
          turnRateDegPerSec: 0,
          bankAngleDeg: 0,
          isCompleted: this.isRecovered
        };
      } else if (distToElpKm < 2.5) {
        this.flightPhase = 'RECOVERY_APPROACH';
        this.recoveryPhase = 'APPROACH';
        this.targetAltitude = elp.elevationFt + 300;
        this.targetAirspeed = 95;
      } else {
        this.flightPhase = 'EMERGENCY_DIVERT';
        this.recoveryPhase = 'DIVERTING';
        this.targetAltitude = Math.max(elp.elevationFt + 800, this.altitude - 200 * dt);
        this.targetAirspeed = 125;
      }

      // Execute dynamic physics update toward ELP
      return this.integrateKinematics(dt, engineOn, enginePowerHp, simTime, airDensityKgM3, distToElpKm, bearingToElpDeg, elp.name);
    }

    // -------------------------------------------------------------
    // CASE C: NORMAL MISSION PATHWAY
    // -------------------------------------------------------------
    const finalDestWp = this.waypoints[this.waypoints.length - 1] || this.waypoints[0];
    const totalDistToDestKm = haversineDistanceKm(this.latitude, this.longitude, finalDestWp.lat, finalDestWp.lon);

    let currentWp = this.waypoints[this.currentWaypointIndex] || this.waypoints[0];
    let distToWpKm = haversineDistanceKm(this.latitude, this.longitude, currentWp.lat, currentWp.lon);
    let bearingToWpDeg = initialBearingDeg(this.latitude, this.longitude, currentWp.lat, currentWp.lon);

    // Check Destination Arrival Boundary
    const isAtDestinationLeg = this.currentWaypointIndex >= this.waypoints.length - 1 || totalDistToDestKm < 3.5;

    if (totalDistToDestKm <= 0.35) {
      // SNAP TO DESTINATION — STOP FORWARD ADVANCEMENT
      this.latitude = finalDestWp.lat;
      this.longitude = finalDestWp.lon;
      this.landingSequenceTimer += dt;

      if (this.landingSequenceTimer < 3.0) {
        this.flightPhase = 'LANDING';
        this.altitude = Math.max(0, this.altitude - 350 * dt);
        this.airspeed = Math.max(0, this.airspeed - 30 * dt);
      } else {
        this.altitude = finalDestWp.altitudeFt || 0;
        this.airspeed = 0;
        this.groundSpeed = 0;
        this.verticalSpeed = 0;
        this.flightPhase = 'COMPLETED';
        this.isCompleted = true;
        this.isLanded = true;
      }

      return {
        latitude: Number(this.latitude.toFixed(6)),
        longitude: Number(this.longitude.toFixed(6)),
        altitude: Math.round(this.altitude),
        heading: Math.round(this.heading),
        airspeed: Math.round(this.airspeed),
        groundSpeed: 0,
        verticalSpeed: 0,
        groundTrack: this.groundTrack,
        targetHeading: Math.round(this.targetHeading),
        targetAltitude: finalDestWp.altitudeFt || 0,
        targetAirspeed: 0,
        throttle: 0,
        engineLoad: 0,
        flightPhase: this.flightPhase,
        windSpeed: this.windSpeed,
        windDirection: this.windDirection,
        currentWaypointIndex: this.waypoints.length - 1,
        currentWaypointName: finalDestWp.name,
        distanceToWaypointKm: 0,
        bearingToWaypointDeg: 0,
        missionProgressPercent: 100,
        turnRateDegPerSec: 0,
        bankAngleDeg: 0,
        isCompleted: this.isCompleted
      };
    }

    // Normal Waypoint Progression
    if (engineOn && this.navigationMode === 'WAYPOINT_ROUTE') {
      this.targetHeading = bearingToWpDeg;

      if (isAtDestinationLeg && totalDistToDestKm < 2.5) {
        this.flightPhase = 'APPROACH';
        this.targetAltitude = finalDestWp.altitudeFt || 200;
        this.targetAirspeed = 95;
      } else if (isAtDestinationLeg && totalDistToDestKm < 7.0) {
        this.flightPhase = 'DESCENT';
        this.targetAltitude = 1800;
        this.targetAirspeed = 125;
      } else {
        if (currentWp.altitudeFt > 0) {
          this.targetAltitude = currentWp.altitudeFt;
        }
        if (currentWp.targetAirspeedKmh > 0) {
          this.targetAirspeed = currentWp.targetAirspeedKmh;
        }
      }

      if (distToWpKm < 0.8 && this.currentWaypointIndex < this.waypoints.length - 1) {
        this.currentWaypointIndex++;
        currentWp = this.waypoints[this.currentWaypointIndex];
        distToWpKm = haversineDistanceKm(this.latitude, this.longitude, currentWp.lat, currentWp.lon);
        bearingToWpDeg = initialBearingDeg(this.latitude, this.longitude, currentWp.lat, currentWp.lon);
      }
    }

    return this.integrateKinematics(dt, engineOn, enginePowerHp, simTime, airDensityKgM3, distToWpKm, bearingToWpDeg, currentWp.name);
  }

  /**
   * Integrates aerodynamic, heading, vertical speed, and geodetic coordinate displacement
   */
  private integrateKinematics(
    dt: number,
    engineOn: boolean,
    enginePowerHp: number,
    simTime: number,
    airDensityKgM3: number,
    distToTargetKm: number,
    bearingToTargetDeg: number,
    targetName: string
  ): FlightState {
    // 1. Heading Dynamics with Coordinated Bank
    if (engineOn && this.airspeed > 15) {
      let headingDiff = ((this.targetHeading - this.heading + 540) % 360) - 180;
      const turnAgility = Math.min(1.0, this.airspeed / 80.0);
      const effectiveMaxTurnRate = this.maxTurnRateDegPerSec * turnAgility;
      const desiredTurnRate = Math.sign(headingDiff) * Math.min(effectiveMaxTurnRate, Math.abs(headingDiff) * 1.6);

      const turnTau = 0.5;
      this.turnRateDegPerSec += (desiredTurnRate - this.turnRateDegPerSec) * (1.0 - Math.exp(-dt / turnTau));
      this.heading = (this.heading + this.turnRateDegPerSec * dt + 360) % 360;

      const targetBank = -this.turnRateDegPerSec * 4.2;
      this.bankAngleDeg += (targetBank - this.bankAngleDeg) * Math.min(1.0, dt * 5.0);
    } else {
      this.turnRateDegPerSec = 0;
      this.bankAngleDeg = 0;
    }

    // 2. Airspeed Dynamics & Thrust / Drag Balance
    if (!engineOn) {
      this.airspeed = Math.max(0, this.airspeed - 22.0 * dt);
    } else {
      const vMs = Math.max(0.1, (this.airspeed * 1000.0) / 3600.0);
      const powerWatts = enginePowerHp * 745.7;

      const effectiveSpeedMs = Math.max(vMs, 14.0);
      const thrustNewtons = (powerWatts * SIMULATION_CONFIG.propulsiveEfficiency) / effectiveSpeedMs;

      const dynamicPressure = 0.5 * airDensityKgM3 * vMs * vMs;
      const parasiteDragNewtons = dynamicPressure * SIMULATION_CONFIG.zeroLiftDragCoeff * SIMULATION_CONFIG.referenceAreaM2;
      const inducedDragNewtons = Math.min(400, (SIMULATION_CONFIG.aircraftMassKg * 9.81 * 0.08) / Math.max(1.0, vMs / 10.0));
      const totalDragNewtons = parasiteDragNewtons + inducedDragNewtons;

      const netForceNewtons = thrustNewtons - totalDragNewtons;
      const accelerationMs2 = netForceNewtons / SIMULATION_CONFIG.aircraftMassKg;

      const throttleNorm = Math.max(0, Math.min(100, this.throttle)) / 100.0;
      const targetEquilibriumKmh = 60.0 + (throttleNorm * 145.0 * Math.max(0.2, enginePowerHp / 95.0));
      const commandedTargetKmh = this.navigationMode === 'MANUAL_PILOT' ? targetEquilibriumKmh : Math.min(this.targetAirspeed, targetEquilibriumKmh + 10.0);

      const accelKmhPerSec = accelerationMs2 * 3.6;
      const rawNewSpeedKmh = Math.max(0, this.airspeed + accelKmhPerSec * dt);

      const speedTau = 2.0;
      const speedAlpha = 1.0 - Math.exp(-dt / speedTau);
      this.airspeed += (commandedTargetKmh - this.airspeed) * speedAlpha * 0.4 + (rawNewSpeedKmh - this.airspeed) * 0.6;
      this.airspeed = Math.max(0, Math.min(this.maxFlightAirspeedKmh, this.airspeed));
    }

    // 3. Vertical Speed & Altitude Dynamics
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

      const vzTau = 0.8;
      this.verticalSpeed += (desiredVzFpm - this.verticalSpeed) * (1.0 - Math.exp(-dt / vzTau));
      this.altitude = Math.max(0, this.altitude + (this.verticalSpeed / 60.0) * dt);
    }

    // 4. Ground Velocity Vector Calculation
    const headingRad = (this.heading * Math.PI) / 180.0;
    const airSpeedMs = (this.airspeed * 1000.0) / 3600.0;
    const airNorthMs = airSpeedMs * Math.cos(headingRad);
    const airEastMs = airSpeedMs * Math.sin(headingRad);

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

    // 5. Geodetic Coordinate Propagation
    if (engineOn && this.groundSpeed > 1.0) {
      const distanceMovedMeters = groundSpeedMs * dt;
      const effectiveHeadingRad = (this.groundTrack * Math.PI) / 180.0;

      const northDistance = distanceMovedMeters * Math.cos(effectiveHeadingRad);
      const eastDistance = distanceMovedMeters * Math.sin(effectiveHeadingRad);

      const metersPerDegreeLatitude = 111320.0;
      const currentLatRad = (this.latitude * Math.PI) / 180.0;
      const metersPerDegreeLongitude = 111320.0 * Math.max(0.01, Math.cos(currentLatRad));

      this.latitude += northDistance / metersPerDegreeLatitude;
      this.longitude += eastDistance / metersPerDegreeLongitude;
    }

    // 6. Flight Phase State Machine
    this.updateFlightPhase(engineOn);

    // 7. Mission Progress
    let missionProgress = 0;
    if (this.emergencyDivertActive && this.recoveryTarget) {
      missionProgress = Math.max(0, Math.min(99, Math.round((1.0 - Math.min(1.0, distToTargetKm / 10.0)) * 100)));
    } else {
      const totalLegs = Math.max(1, this.waypoints.length - 1);
      const legProgress = Math.max(0, Math.min(1.0, 1.0 - (distToTargetKm / 5.0)));
      const totalProgress = ((this.currentWaypointIndex + legProgress) / totalLegs) * 100.0;
      missionProgress = Math.min(99, Math.round(totalProgress));
    }

    return {
      latitude: Number(this.latitude.toFixed(6)),
      longitude: Number(this.longitude.toFixed(6)),
      altitude: Math.round(this.altitude),
      heading: Math.round(this.heading),
      airspeed: Math.round(this.airspeed),
      groundSpeed: Math.round(this.groundSpeed),
      verticalSpeed: Math.round(this.verticalSpeed),
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
      currentWaypointName: targetName,
      distanceToWaypointKm: distToTargetKm,
      bearingToWaypointDeg: bearingToTargetDeg,
      missionProgressPercent: missionProgress,
      turnRateDegPerSec: Number(this.turnRateDegPerSec.toFixed(2)),
      bankAngleDeg: Number(this.bankAngleDeg.toFixed(1)),
    };
  }

  private updateFlightPhase(engineOn: boolean): void {
    if (!engineOn) {
      this.flightPhase = this.isCompleted ? (this.isRecovered ? 'RECOVERED' : 'COMPLETED') : 'PARKED';
      return;
    }

    if (this.emergencyDivertActive) {
      if (this.isRecovered) {
        this.flightPhase = 'RECOVERED';
      } else if (this.recoveryPhase === 'LANDING') {
        this.flightPhase = 'LANDING';
      } else if (this.recoveryPhase === 'APPROACH') {
        this.flightPhase = 'RECOVERY_APPROACH';
      } else {
        this.flightPhase = 'EMERGENCY_DIVERT';
      }
      return;
    }

    if (this.isCompleted) {
      this.flightPhase = 'COMPLETED';
      return;
    }

    if (this.throttle < 35 && this.altitude < 50 && this.airspeed < 45) {
      this.flightPhase = 'STARTUP';
    } else if (this.throttle >= 60 && this.altitude < 400 && this.airspeed > 40) {
      this.flightPhase = 'TAKEOFF';
    } else if (this.verticalSpeed >= 150 && this.altitude < this.targetAltitude - 150) {
      this.flightPhase = 'CLIMB';
    } else if (this.flightPhase === 'APPROACH') {
      // Retain approach state
    } else if (this.flightPhase === 'DESCENT') {
      // Retain descent state
    } else if (this.verticalSpeed <= -150 && this.altitude > 800) {
      this.flightPhase = 'DESCENT';
    } else {
      this.flightPhase = 'CRUISE';
    }
  }
}
