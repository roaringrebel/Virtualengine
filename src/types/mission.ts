export interface LocationCoord {
  lat: number;
  lon: number;
  name: string;
  altitudeFt?: number;
}

export interface Waypoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
  altitudeFt: number;
  targetAirspeedKmh: number;
  type: 'SOURCE' | 'TAKEOFF' | 'CLIMB' | 'CRUISE' | 'SURVEILLANCE' | 'RETURN' | 'DESTINATION' | 'BASE';
  description: string;
}

export interface MissionPlan {
  id: string;
  name: string;
  source: LocationCoord;
  destination: LocationCoord;
  waypoints: Waypoint[];
  totalDistanceKm: number;
  initialBearingDeg: number;
  targetAltitudeFt: number;
  targetAirspeedKmh: number;
}

export interface MissionMetrics {
  sourceName: string;
  destinationName: string;
  totalDistanceKm: number;
  remainingDistanceKm: number;
  progressPercent: number;
  currentBearingDeg: number;
  etaSeconds: number;
  etaFormatted: string;
  elapsedFormatted: string;
  routeDeviationKm: number;
  currentLeg: string;
  activeWaypointIndex: number;
}

export interface MissionEventLog {
  id: string;
  simTimestamp: string;
  message: string;
  category: 'INFO' | 'FLIGHT' | 'ENGINE' | 'FAULT' | 'TELEMETRY' | 'MISSION';
  phase?: string;
}

export interface UAVPosition {
  lat: number;
  lon: number;
  altitude: number;
  airspeed: number;
  heading: number;
  currentWaypointIndex: number;
  distanceToNextKm: number;
  missionProgressPercent: number;
}
