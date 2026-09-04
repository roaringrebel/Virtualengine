export interface Waypoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
  altitudeFt: number;
  targetAirspeedKmh: number;
  type: 'TAKEOFF' | 'CLIMB' | 'SURVEILLANCE' | 'RETURN' | 'BASE';
  description: string;
}

export interface MissionEventLog {
  id: string;
  simTimestamp: string;
  message: string;
  category: 'INFO' | 'FLIGHT' | 'ENGINE' | 'FAULT' | 'TELEMETRY';
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
