import { Waypoint, MissionCommand, FlightPhase, GeoCoordinate } from '../../shared/schemas/types';

export class MissionManager {
  private waypoints: Waypoint[] = [];
  private activeIndex: number = 0;
  private currentPhase: FlightPhase = 'PRE_FLIGHT';
  private totalMissionDistanceKm: number = 0;
  private missionId: string;

  constructor(missionId: string = 'UAV-MISSION-ALPHA', waypoints: Waypoint[] = []) {
    this.missionId = missionId;
    this.setWaypoints(waypoints);
  }

  public setWaypoints(waypoints: Waypoint[]): void {
    this.waypoints = waypoints;
    this.activeIndex = 0;
    this.currentPhase = waypoints.length > 0 ? waypoints[0].phase || 'PRE_FLIGHT' : 'PRE_FLIGHT';
    this.calculateTotalDistance();
  }

  public getWaypoints(): Waypoint[] {
    return this.waypoints;
  }

  public getActiveWaypoint(): Waypoint | null {
    if (this.activeIndex < this.waypoints.length) {
      return this.waypoints[this.activeIndex];
    }
    return null;
  }

  public update(currentPos: GeoCoordinate, dtSec: number, timestampMs: number): MissionCommand {
    if (this.waypoints.length === 0) {
      return {
        timestampMs,
        missionId: this.missionId,
        currentPhase: 'COMPLETED',
        activeWaypointIndex: 0,
        targetAltitudeM: 0,
        targetSpeedKts: 0,
        targetHeadingDeg: 0,
        commandedThrottle: 0,
        distanceToTargetKm: 0,
        missionProgressPct: 100,
        isCompleted: true,
      };
    }

    const currentWp = this.waypoints[this.activeIndex];
    const distToCurrent = this.calculateHaversineDistanceKm(
      currentPos.lat, currentPos.lng,
      currentWp.lat, currentWp.lng
    );

    const isFinalWaypoint = this.activeIndex >= this.waypoints.length - 1;
    const waypointArrivalThresholdKm = isFinalWaypoint ? 0.05 : 0.35;

    // Check waypoint sequencing
    if (distToCurrent <= waypointArrivalThresholdKm) {
      if (isFinalWaypoint) {
        this.currentPhase = 'COMPLETED';
      } else {
        this.activeIndex++;
        const nextWp = this.waypoints[this.activeIndex];
        if (nextWp.phase) {
          this.currentPhase = nextWp.phase;
        }
      }
    }

    const targetWp = this.waypoints[this.activeIndex] || currentWp;
    const targetHeading = this.calculateBearingDeg(
      currentPos.lat, currentPos.lng,
      targetWp.lat, targetWp.lng
    );

    const remainingDistance = this.calculateRemainingDistanceKm(currentPos);
    const progressPct = this.totalMissionDistanceKm > 0 
      ? Math.min(100, Math.max(0, ((this.totalMissionDistanceKm - remainingDistance) / this.totalMissionDistanceKm) * 100))
      : 100;

    let commandedThrottle = 0.0;
    if (this.currentPhase === 'TAKEOFF' || this.currentPhase === 'CLIMB') {
      commandedThrottle = 0.95;
    } else if (this.currentPhase === 'CRUISE') {
      commandedThrottle = 0.72;
    } else if (this.currentPhase === 'DESCENT') {
      commandedThrottle = 0.40;
    } else if (this.currentPhase === 'APPROACH') {
      commandedThrottle = 0.30;
    } else if (this.currentPhase === 'LANDING') {
      commandedThrottle = 0.15;
    } else {
      commandedThrottle = 0.0;
    }

    return {
      timestampMs,
      missionId: this.missionId,
      currentPhase: this.currentPhase,
      activeWaypointIndex: this.activeIndex,
      targetAltitudeM: targetWp.altMeters,
      targetSpeedKts: targetWp.speedKts,
      targetHeadingDeg: targetHeading,
      commandedThrottle: this.currentPhase === 'COMPLETED' ? 0.0 : commandedThrottle,
      distanceToTargetKm: distToCurrent,
      missionProgressPct: progressPct,
      isCompleted: this.currentPhase === 'COMPLETED',
    };
  }

  private calculateTotalDistance(): void {
    let total = 0;
    for (let i = 0; i < this.waypoints.length - 1; i++) {
      total += this.calculateHaversineDistanceKm(
        this.waypoints[i].lat, this.waypoints[i].lng,
        this.waypoints[i + 1].lat, this.waypoints[i + 1].lng
      );
    }
    this.totalMissionDistanceKm = total;
  }

  private calculateRemainingDistanceKm(currentPos: GeoCoordinate): number {
    if (this.activeIndex >= this.waypoints.length) return 0;
    let dist = this.calculateHaversineDistanceKm(
      currentPos.lat, currentPos.lng,
      this.waypoints[this.activeIndex].lat, this.waypoints[this.activeIndex].lng
    );
    for (let i = this.activeIndex; i < this.waypoints.length - 1; i++) {
      dist += this.calculateHaversineDistanceKm(
        this.waypoints[i].lat, this.waypoints[i].lng,
        this.waypoints[i + 1].lat, this.waypoints[i + 1].lng
      );
    }
    return dist;
  }

  public calculateHaversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371.0; // Earth radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180.0);
    const dLon = (lon2 - lon1) * (Math.PI / 180.0);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180.0)) * Math.cos(lat2 * (Math.PI / 180.0)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  public calculateBearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const dLon = (lon2 - lon1) * (Math.PI / 180.0);
    const y = Math.sin(dLon) * Math.cos(lat2 * (Math.PI / 180.0));
    const x = 
      Math.cos(lat1 * (Math.PI / 180.0)) * Math.sin(lat2 * (Math.PI / 180.0)) -
      Math.sin(lat1 * (Math.PI / 180.0)) * Math.cos(lat2 * (Math.PI / 180.0)) * Math.cos(dLon);
    let brng = (Math.atan2(y, x) * (180.0 / Math.PI) + 360.0) % 360.0;
    return brng;
  }
}
