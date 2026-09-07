import { FlightControlsState, FlightPhase, FlightState, NavigationMode } from '../types/simulation';
import { Waypoint } from '../types/mission';
import { SIMULATION_CONFIG } from './simulationConfig';

export const MISSION_WAYPOINTS: Waypoint[] = [
  { id: 'home', name: 'HOME / AIRBASE', lat: 32.5450, lon: 77.2150, altitudeFt: 0, targetAirspeedKmh: 0, type: 'BASE', description: 'Simulated home airfield base' },
  { id: 'wp1', name: 'WP1 — MOUNTAIN PASS', lat: 32.5650, lon: 77.2500, altitudeFt: 4500, targetAirspeedKmh: 135, type: 'CLIMB', description: 'Initial climb corridor through eastern valley' },
  { id: 'wp2', name: 'WP2 — NORTH HIGHLANDS', lat: 32.5900, lon: 77.3000, altitudeFt: 8000, targetAirspeedKmh: 145, type: 'SURVEILLANCE', description: 'Highland tactical surveillance sector' },
  { id: 'wp3', name: 'WP3 — EAST PERIMETER', lat: 32.5700, lon: 77.3500, altitudeFt: 8000, targetAirspeedKmh: 150, type: 'SURVEILLANCE', description: 'Eastern reconnaissance perimeter' },
  { id: 'wp4', name: 'WP4 — SOUTHERN VECTOR', lat: 32.5300, lon: 77.3200, altitudeFt: 3500, targetAirspeedKmh: 130, type: 'RETURN', description: 'Recovery approach vector to home base' },
  { id: 'home_rtb', name: 'HOME — RECOVERY', lat: 32.5450, lon: 77.2150, altitudeFt: 0, targetAirspeedKmh: 75, type: 'BASE', description: 'Runway touchdown and recovery' },
];

/**
 * Deterministic Physics-Inspired Flight Dynamics & Geospatial Navigation Engine
 * Longitudinal aerodynamics: Thrust - Drag = Net Force -> a = F/m -> V(t+dt) = V(t) + a*dt
 * Geodetic local Earth integration: dLat/dt = V_north / R_earth, dLon/dt = V_east / (R_earth * cos(lat))
 * Coordinated turn dynamics, continuous vertical speed integration, and waypoint navigation.
 */
export class FlightDynamicsModel {
  // Core Position & Attitude State
  public latitude: number = 32.5450;
  public longitude: number = 77.2150;
  public altitude: number = 8000;
  public heading: number = 270;
  public airspeed: number = 145; // km/h true airspeed
  public groundSpeed: number = 145; // km/h
  public verticalSpeed: number = 0; // ft/min
  public groundTrack: number = 270; // deg
  public bankAngleDeg: number = 0;
  public turnRateDegPerSec: number = 0;

  // Commanded Targets
  public targetHeading: number = 270;
  public targetAltitude: number = 8000;
  public targetAirspeed: number = 145;
  public throttle: number = 70;
  public engineLoad: number = 70;

  // Environment
  public windSpeed: number = SIMULATION_CONFIG.defaultWindSpeedKmh; // km/h
  public windDirection: number = SIMULATION_CONFIG.defaultWindDirectionDeg; // deg

  // Autopilot Waypoints
  public waypoints: Waypoint[] = MISSION_WAYPOINTS;
  public currentWaypointIndex: number = 2; // WP2 Sector Alpha by default
  public flightPhase: FlightPhase = 'CRUISE';
  public navigationMode: NavigationMode = 'MANUAL_PILOT';

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

    this.windSpeed = SIMULATION_CONFIG.defaultWindSpeedKmh;
    this.windDirection = SIMULATION_CONFIG.defaultWindDirectionDeg;
    this.currentWaypointIndex = 0;
    this.flightPhase = 'STANDBY';
    this.navigationMode = 'MANUAL_PILOT';
  }

  /**
   * Main Physics Update Step
   */
  public update(
    dt: number,
    engineOn: boolean,
    enginePowerHp: number,
    simTime: number,
    airDensityKgM3: number = SIMULATION_CONFIG.seaLevelAirDensityKgM3
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
      if (distToWpKm < SIMULATION_CONFIG.waypointArrivalRadiusKm) {
        this.currentWaypointIndex = (this.currentWaypointIndex + 1) % this.waypoints.length;
      }
    }

    // 2. Smooth Heading Dynamics with Inertia & Shortest Angular Arc Wraparound
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

      // Propeller thrust: T = (P * eta) / V (with low-speed thrust limit)
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

    // 7. Geodetic Coordinate Propagation (Local Earth Equations)
    if (engineOn && this.groundSpeed > 1.0) {
      const distanceMovedMeters = groundSpeedMs * dt;
      const effectiveHeadingRad = ((this.groundTrack + turbHeading) * Math.PI) / 180.0;

      const deltaLat = (distanceMovedMeters * Math.cos(effectiveHeadingRad)) / 111139.0;
      const currentLatRad = (this.latitude * Math.PI) / 180.0;
      const deltaLon = (distanceMovedMeters * Math.sin(effectiveHeadingRad)) / (111139.0 * Math.max(0.1, Math.cos(currentLatRad)));

      this.latitude += deltaLat;
      this.longitude += deltaLon;

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
    } else if (this.throttle >= 75 && this.altitude < 1200 && this.verticalSpeed > 150) {
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
