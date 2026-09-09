import { MissionManager } from '../src/MissionManager';
import { Waypoint } from '../../shared/schemas/types';

export function runMissionFsmVerification(): { passed: boolean; report: string } {
  const testWaypoints: Waypoint[] = [
    { id: 'WP0', name: 'Runway 07', lat: 13.0827, lng: 80.2707, altMeters: 0, speedKts: 0, phase: 'TAKEOFF' },
    { id: 'WP1', name: 'Climb Waypoint', lat: 13.0900, lng: 80.2800, altMeters: 500, speedKts: 80, phase: 'CLIMB' },
    { id: 'WP2', name: 'Cruise Waypoint', lat: 13.1500, lng: 80.3500, altMeters: 1500, speedKts: 110, phase: 'CRUISE' },
    { id: 'WP3', name: 'Descent Fix', lat: 13.2000, lng: 80.4000, altMeters: 800, speedKts: 90, phase: 'DESCENT' },
    { id: 'WP4', name: 'Terminal Destination', lat: 13.2400, lng: 80.4500, altMeters: 0, speedKts: 0, phase: 'LANDING' }
  ];

  const manager = new MissionManager('VERIFY-M01', testWaypoints);
  const transitionLogs: string[] = [];

  let currentLat = testWaypoints[0].lat;
  let currentLng = testWaypoints[0].lng;
  let currentAlt = 0;
  let timestamp = 0;
  let completed = false;

  transitionLogs.push(`[INIT] Mission initialized with ${testWaypoints.length} waypoints.`);

  for (let step = 0; step < 1000; step++) {
    timestamp += 1000;
    const cmd = manager.update({ lat: currentLat, lng: currentLng, altMeters: currentAlt }, 1.0, timestamp);
    
    // Step toward active waypoint
    const activeWp = manager.getActiveWaypoint();
    if (!activeWp || cmd.isCompleted) {
      completed = true;
      transitionLogs.push(`[COMPLETED] Step ${step}: Terminal destination reached. Throttle=${cmd.commandedThrottle.toFixed(2)}, Phase=${cmd.currentPhase}`);
      break;
    }

    const dLat = (activeWp.lat - currentLat) * 0.2;
    const dLng = (activeWp.lng - currentLng) * 0.2;
    currentLat += dLat;
    currentLng += dLng;
    currentAlt += (activeWp.altMeters - currentAlt) * 0.2;

    if (step % 5 === 0) {
      transitionLogs.push(`[STEP ${step}] Phase: ${cmd.currentPhase}, WP: ${cmd.activeWaypointIndex} (${activeWp.name}), Dist: ${cmd.distanceToTargetKm.toFixed(2)} km, Throttle: ${cmd.commandedThrottle.toFixed(2)}, Progress: ${cmd.missionProgressPct.toFixed(1)}%`);
    }
  }

  const passed = completed && manager.update({ lat: currentLat, lng: currentLng, altMeters: currentAlt }, 1.0, timestamp).commandedThrottle === 0.0;
  const report = transitionLogs.join('\n');
  return { passed, report };
}

