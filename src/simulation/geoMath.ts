import { LocationCoord, Waypoint } from '../types/mission';

const EARTH_RADIUS_METERS = 6371000;
const EARTH_RADIUS_KM = 6371;

/**
 * Calculates Great Circle Haversine distance between two coordinates in kilometers.
 */
export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const rLat1 = (lat1 * Math.PI) / 180;
  const rLat2 = (lat2 * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));

  return Number((EARTH_RADIUS_KM * c).toFixed(3));
}

/**
 * Calculates Great Circle initial bearing in degrees (0 - 360°).
 */
export function initialBearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const rLat1 = (lat1 * Math.PI) / 180;
  const rLat2 = (lat2 * Math.PI) / 180;

  const y = Math.sin(dLon) * Math.cos(rLat2);
  const x =
    Math.cos(rLat1) * Math.sin(rLat2) -
    Math.sin(rLat1) * Math.cos(rLat2) * Math.cos(dLon);

  const bearingRad = Math.atan2(y, x);
  const bearingDeg = (bearingRad * 180) / Math.PI;

  return Math.round((bearingDeg + 360) % 360);
}

/**
 * Calculates cross-track perpendicular distance from UAV to planned route leg in kilometers.
 */
export function crossTrackDeviationKm(
  uavLat: number,
  uavLon: number,
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number
): number {
  const d13 = haversineDistanceKm(startLat, startLon, uavLat, uavLon) / EARTH_RADIUS_KM; // angular dist
  const brg13 = (initialBearingDeg(startLat, startLon, uavLat, uavLon) * Math.PI) / 180;
  const brg12 = (initialBearingDeg(startLat, startLon, endLat, endLon) * Math.PI) / 180;

  const dXt = Math.asin(Math.sin(d13) * Math.sin(brg13 - brg12));
  return Number(Math.abs(dXt * EARTH_RADIUS_KM).toFixed(2));
}

/**
 * Validates latitude and longitude ranges.
 */
export function validateCoordinates(lat: number, lon: number): { valid: boolean; error?: string } {
  if (isNaN(lat) || isNaN(lon)) {
    return { valid: false, error: 'Coordinates must be valid numbers' };
  }
  if (lat < -90 || lat > 90) {
    return { valid: false, error: 'Latitude must be between -90.0° and +90.0°' };
  }
  if (lon < -180 || lon > 180) {
    return { valid: false, error: 'Longitude must be between -180.0° and +180.0°' };
  }
  return { valid: true };
}

/**
 * Formats coordinates for high-precision aerospace display.
 * e.g. 16.494100° N, 80.498200° E
 */
export function formatCoordinateDisplay(lat: number, lon: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  const latAbs = Math.abs(lat).toFixed(6);
  const lonAbs = Math.abs(lon).toFixed(6);
  return `${latAbs}° ${latDir}, ${lonAbs}° ${lonDir}`;
}

/**
 * Automatically generates a multi-point mission route between any Source and Destination on Earth.
 */
export function generateMissionRoute(
  source: LocationCoord,
  destination: LocationCoord,
  targetAltitudeFt: number = 8000,
  targetAirspeedKmh: number = 145
): Waypoint[] {
  const totalDist = haversineDistanceKm(source.lat, source.lon, destination.lat, destination.lon);

  if (totalDist < 5.0) {
    // Short mission: direct point-to-point
    return [
      {
        id: 'wp_source',
        name: `${source.name} (TAKEOFF)`,
        lat: source.lat,
        lon: source.lon,
        altitudeFt: 0,
        targetAirspeedKmh: 0,
        type: 'SOURCE',
        description: 'Takeoff and runway climb point'
      },
      {
        id: 'wp_dest',
        name: `${destination.name} (RECOVERY)`,
        lat: destination.lat,
        lon: destination.lon,
        altitudeFt: 0,
        targetAirspeedKmh: 80,
        type: 'DESTINATION',
        description: 'Touchdown and recovery destination'
      }
    ];
  }

  // Multi-waypoint tactical route corridor (Source -> Climb -> Cruise -> Surveillance -> Descent -> Dest)
  const waypoints: Waypoint[] = [];

  // 1. SOURCE
  waypoints.push({
    id: 'wp_source',
    name: `${source.name} — AIRBASE`,
    lat: source.lat,
    lon: source.lon,
    altitudeFt: 0,
    targetAirspeedKmh: 0,
    type: 'SOURCE',
    description: 'Runway departure airfield'
  });

  // 2. WP1 (Climb corridor at 25% distance)
  const lat1 = source.lat + (destination.lat - source.lat) * 0.25;
  const lon1 = source.lon + (destination.lon - source.lon) * 0.25;
  waypoints.push({
    id: 'wp_climb',
    name: 'WP1 — CLIMB CORRIDOR',
    lat: Number(lat1.toFixed(6)),
    lon: Number(lon1.toFixed(6)),
    altitudeFt: Math.round(targetAltitudeFt * 0.55),
    targetAirspeedKmh: 135,
    type: 'CLIMB',
    description: 'Initial ascent through departure vector'
  });

  // 3. WP2 (Cruise sector at 55% distance)
  const lat2 = source.lat + (destination.lat - source.lat) * 0.55;
  const lon2 = source.lon + (destination.lon - source.lon) * 0.55;
  waypoints.push({
    id: 'wp_cruise',
    name: 'WP2 — CRUISE SECTOR',
    lat: Number(lat2.toFixed(6)),
    lon: Number(lon2.toFixed(6)),
    altitudeFt: targetAltitudeFt,
    targetAirspeedKmh: targetAirspeedKmh,
    type: 'CRUISE',
    description: 'Tactical transit corridor at assigned cruise altitude'
  });

  // 4. WP3 (Descent vector at 85% distance)
  const lat3 = source.lat + (destination.lat - source.lat) * 0.85;
  const lon3 = source.lon + (destination.lon - source.lon) * 0.85;
  waypoints.push({
    id: 'wp_descent',
    name: 'WP3 — DESCENT VECTOR',
    lat: Number(lat3.toFixed(6)),
    lon: Number(lon3.toFixed(6)),
    altitudeFt: Math.round(targetAltitudeFt * 0.4),
    targetAirspeedKmh: 125,
    type: 'RETURN',
    description: 'Approach and arrival sequencing vector'
  });

  // 5. DESTINATION
  waypoints.push({
    id: 'wp_dest',
    name: `${destination.name} — DESTINATION`,
    lat: destination.lat,
    lon: destination.lon,
    altitudeFt: 0,
    targetAirspeedKmh: 75,
    type: 'DESTINATION',
    description: 'Touchdown, recovery, and final mission waypoint'
  });

  return waypoints;
}

/**
 * Built-in real-world mission presets for instant demonstration.
 */
export const REAL_WORLD_MISSION_PRESETS: {
  id: string;
  name: string;
  source: LocationCoord;
  destination: LocationCoord;
  targetAltitudeFt: number;
}[] = [
  {
    id: 'vitap_to_vja_airport',
    name: 'VIT-AP University → Vijayawada Airport (VGA)',
    source: {
      name: 'VIT-AP University Airbase',
      lat: 16.4941,
      lon: 80.4982
    },
    destination: {
      name: 'Vijayawada Int Airport (Gannavaram)',
      lat: 16.5304,
      lon: 80.7968
    },
    targetAltitudeFt: 6500
  },
  {
    id: 'vitap_to_amaravati',
    name: 'VIT-AP University → Amaravati Capital Complex',
    source: {
      name: 'VIT-AP University Airbase',
      lat: 16.4941,
      lon: 80.4982
    },
    destination: {
      name: 'Amaravati Capital Secretariat',
      lat: 16.5131,
      lon: 80.5165
    },
    targetAltitudeFt: 4500
  },
  {
    id: 'vitap_to_guntur',
    name: 'VIT-AP University → Guntur Tactical Vector',
    source: {
      name: 'VIT-AP University Airbase',
      lat: 16.4941,
      lon: 80.4982
    },
    destination: {
      name: 'Guntur District Command Sector',
      lat: 16.3067,
      lon: 80.4365
    },
    targetAltitudeFt: 7000
  },
  {
    id: 'himachal_mountain_patrol',
    name: 'Himachal Tactical Valley Sector (Kullu Corridor)',
    source: {
      name: 'Himachal Base Airfield',
      lat: 32.5450,
      lon: 77.2150
    },
    destination: {
      name: 'East Perimeter Highlands',
      lat: 32.5700,
      lon: 77.3500
    },
    targetAltitudeFt: 8000
  }
];
