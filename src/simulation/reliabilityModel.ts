import { FaultState, FlightState, Rotax912State, ThermalState } from '../types/simulation';
import { Waypoint } from '../types/mission';
import { haversineDistanceKm } from './geoMath';

export type MissionRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type MissionDecision = 'GO' | 'CAUTION' | 'NO-GO';

export interface MissionReliabilityState {
  reliabilityScore: number;         // 0 - 100%
  riskLevel: MissionRisk;           // LOW | MEDIUM | HIGH | CRITICAL
  decision: MissionDecision;         // GO | CAUTION | NO-GO
  decisionReason: string;
  engineSOH: number;                // 0 - 100%
  rulHours: number;                 // Remaining Useful Life in hours
  faultRiskPercent: number;         // 0 - 100%
  missionMarginHours: number;       // RUL - remaining mission time (hours)
  anomalyScore: number;             // 0.0 - 1.0
  missionProgressPercent: number;   // 0 - 100%
  totalMissionDistanceKm: number;   // total distance across all route legs (km)
  distanceRemainingKm: number;      // remaining distance to destination (km)
  timeRemainingSeconds: number;     // seconds
  timeRemainingFormatted: string;   // mm:ss or hh:mm:ss
  missionTimeFormatted: string;     // mm:ss
  terrainElevationFt: number;       // ft MSL
  aglAltitudeFt: number;            // ft AGL (Altitude - Terrain)
  routeDeviationKm: number;         // cross-track deviation (km)
}

/**
 * Calculates simulated terrain elevation (ft MSL) based on geographic location.
 * Provides realistic terrain context (e.g. coastal Andhra plain vs mountain foothills).
 */
export function getSimulatedTerrainElevation(lat: number, lon: number): number {
  if (lat > 28.0) {
    // Northern/Himalayan foothills
    const dLat = (lat - 32.5450) * 111.32;
    const dLon = (lon - 77.2150) * 94.12;
    const baseElev = 3850;
    const ridgeEast = Math.max(0, dLon * 120);
    const ridgeNorth = Math.sin(dLat * 0.45) * 320 + Math.cos(dLon * 0.55) * 240;
    const valleyVariation = Math.sin(dLat * 0.85 + dLon * 0.6) * 180;
    return Math.max(3200, Math.min(6500, Math.round(baseElev + ridgeEast + ridgeNorth + valleyVariation)));
  } else {
    // Deccan / Andhra plain / Krishna basin (VIT-AP / Vijayawada)
    const baseElev = 75; // ft MSL
    const localHill = Math.sin(lat * 12.0) * 45 + Math.cos(lon * 15.0) * 35;
    return Math.max(40, Math.min(350, Math.round(baseElev + localHill)));
  }
}

/**
 * Calculates cross-track deviation distance (km) between UAV and current planned route segment.
 */
export function calculateRouteDeviationKm(
  uavLat: number,
  uavLon: number,
  waypoints: Waypoint[],
  currentWpIdx: number
): number {
  if (waypoints.length < 2) return 0;
  const prevIdx = Math.max(0, currentWpIdx - 1);
  const nextIdx = Math.min(waypoints.length - 1, currentWpIdx);
  const p1 = waypoints[prevIdx];
  const p2 = waypoints[nextIdx];

  // Convert geodetic to local Cartesian coordinates (km)
  const latRef = (p1.lat + p2.lat) / 2;
  const cosLat = Math.cos((latRef * Math.PI) / 180);
  const kx = 111.32 * cosLat;
  const ky = 111.32;

  const x0 = uavLon * kx;
  const y0 = uavLat * ky;
  const x1 = p1.lon * kx;
  const y1 = p1.lat * ky;
  const x2 = p2.lon * kx;
  const y2 = p2.lat * ky;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const segLenSq = dx * dx + dy * dy;

  if (segLenSq === 0) {
    return Number(Math.hypot(x0 - x1, y0 - y1).toFixed(2));
  }

  // Cross-track perpendicular distance
  const crossTrackDist = Math.abs(dy * x0 - dx * y0 + x2 * y1 - y2 * x1) / Math.sqrt(segLenSq);
  return Number(Math.min(15.0, crossTrackDist).toFixed(2));
}

/**
 * Model-Based Mission Reliability & Health Assessment Engine
 */
export class ReliabilityModel {
  public calculate(
    engine: Rotax912State,
    thermal: ThermalState,
    fault: FaultState,
    flight: FlightState,
    waypoints: Waypoint[],
    simTimeSeconds: number,
    engineOn: boolean
  ): MissionReliabilityState {
    const activeWaypoints = waypoints && waypoints.length > 0 ? waypoints : [];

    // 1. Terrain & Altitude AGL
    const terrainElevFt = getSimulatedTerrainElevation(flight.latitude, flight.longitude);
    const uavMslAltitudeFt = engineOn ? (terrainElevFt + flight.altitude) : terrainElevFt;
    const aglFt = Math.max(0, uavMslAltitudeFt - terrainElevFt);

    // 2. Route Deviation
    const routeDevKm = calculateRouteDeviationKm(
      flight.latitude,
      flight.longitude,
      activeWaypoints,
      flight.currentWaypointIndex
    );

    // 3. Engine State of Health (SOH %)
    let rawSoh = engine.engineCondition * 100;

    // Proportional sensor penalties based on physics model
    if (engine.vibration > 5.0) {
      rawSoh -= Math.min(22, (engine.vibration - 5.0) * 3.5);
    }
    if (thermal.cht > 135) {
      rawSoh -= Math.min(35, (thermal.cht - 135) * 0.65);
    }
    if (thermal.oilTemperature > 125) {
      rawSoh -= Math.min(25, (thermal.oilTemperature - 125) * 0.75);
    }
    if (engineOn && thermal.oilPressure < 2.0) {
      rawSoh -= Math.min(35, (2.0 - thermal.oilPressure) * 20);
    }
    if (fault.activeFault !== 'NORMAL') {
      const severityMult = fault.severity === 'LOW' ? 8 : fault.severity === 'MEDIUM' ? 18 : 38;
      rawSoh -= severityMult;
    }

    const engineSOH = Math.round(Math.max(12, Math.min(99, rawSoh)));

    // 4. Remaining Useful Life (RUL Hours)
    let rulHours = 240.0;
    if (engineSOH >= 88) {
      rulHours = 210 + (engineSOH - 88) * 2.5;
    } else if (engineSOH >= 65) {
      rulHours = 35 + (engineSOH - 65) * 3.2;
    } else if (engineSOH >= 45) {
      rulHours = 6 + (engineSOH - 45) * 1.45;
    } else {
      rulHours = Math.max(0.5, (engineSOH / 45.0) * 5.0);
    }
    rulHours = Number(rulHours.toFixed(1));

    // 5. Fault Risk (%)
    let faultRiskPercent = 3;
    if (fault.activeFault !== 'NORMAL') {
      if (fault.severity === 'LOW') faultRiskPercent = 18;
      else if (fault.severity === 'MEDIUM') faultRiskPercent = 42;
      else faultRiskPercent = 88;
    }
    if (engine.vibration > 6.0) faultRiskPercent = Math.max(faultRiskPercent, 55);
    if (thermal.cht > 165) faultRiskPercent = Math.max(faultRiskPercent, 85);

    // 6. Sensor Anomaly Score (0.0 to 1.0)
    let anomaly = 0.04;
    if (engine.vibration > 3.5) anomaly += Math.min(0.35, (engine.vibration - 3.5) / 10.0);
    if (thermal.cht > 120) anomaly += Math.min(0.35, (thermal.cht - 120) / 80.0);
    if (thermal.oilTemperature > 115) anomaly += Math.min(0.20, (thermal.oilTemperature - 115) / 50.0);
    if (fault.activeFault !== 'NORMAL') {
      anomaly += fault.severity === 'LOW' ? 0.15 : fault.severity === 'MEDIUM' ? 0.32 : 0.60;
    }
    const anomalyScore = Number(Math.min(0.98, Math.max(0.02, anomaly)).toFixed(2));

    // 7. Dynamic Total Distance and Remaining Distance Calculation from Active Waypoints
    let totalMissionDistKm = 0;
    for (let i = 0; i < activeWaypoints.length - 1; i++) {
      totalMissionDistKm += haversineDistanceKm(
        activeWaypoints[i].lat,
        activeWaypoints[i].lon,
        activeWaypoints[i + 1].lat,
        activeWaypoints[i + 1].lon
      );
    }
    totalMissionDistKm = Number(Math.max(1.0, totalMissionDistKm).toFixed(2));

    // Distance remaining from current position to next waypoint + subsequent legs
    let distRemainingKm = 0;
    if (activeWaypoints.length > 0) {
      const curIdx = Math.min(flight.currentWaypointIndex, activeWaypoints.length - 1);
      const nextTargetWp = activeWaypoints[curIdx] || activeWaypoints[activeWaypoints.length - 1];
      distRemainingKm += haversineDistanceKm(flight.latitude, flight.longitude, nextTargetWp.lat, nextTargetWp.lon);

      for (let j = curIdx; j < activeWaypoints.length - 1; j++) {
        distRemainingKm += haversineDistanceKm(
          activeWaypoints[j].lat,
          activeWaypoints[j].lon,
          activeWaypoints[j + 1].lat,
          activeWaypoints[j + 1].lon
        );
      }
    }
    distRemainingKm = Number(Math.max(0, distRemainingKm).toFixed(2));

    const progress = totalMissionDistKm > 0 
      ? Math.max(0, Math.min(100, Math.round(((totalMissionDistKm - distRemainingKm) / totalMissionDistKm) * 100)))
      : flight.missionProgressPercent;

    const effectiveSpeedKmh = Math.max(90, flight.groundSpeed > 10 ? flight.groundSpeed : 140);
    const timeRemainingHours = distRemainingKm / effectiveSpeedKmh;
    const timeRemainingSec = Math.round(timeRemainingHours * 3600);

    const remMin = Math.floor(timeRemainingSec / 60);
    const remSec = timeRemainingSec % 60;
    const timeRemainingFormatted = `${String(remMin).padStart(2, '0')}:${String(remSec).padStart(2, '0')}`;

    const elapsedMin = Math.floor(simTimeSeconds / 60);
    const elapsedSec = Math.floor(simTimeSeconds % 60);
    const missionTimeFormatted = `${String(elapsedMin).padStart(2, '0')}:${String(elapsedSec).padStart(2, '0')}`;

    // Mission Margin = RUL - Mission Time Remaining (hours)
    const missionMarginHours = Number(Math.max(-5.0, rulHours - timeRemainingHours).toFixed(1));

    // 8. Overall Mission Reliability Score (%)
    let rel = 0.40 * engineSOH + 0.30 * (100 - faultRiskPercent) + 0.20 * Math.min(100, rulHours * 2.5) + 0.10 * (1.0 - anomalyScore) * 100;
    
    // Penalize if mission duration exceeds RUL (Digital Twin Core Logic)
    if (rulHours < timeRemainingHours) {
      rel = Math.min(rel, 25);
    } else if (missionMarginHours < 1.0) {
      rel = Math.min(rel, 48);
    }

    const reliabilityScore = Math.round(Math.max(10, Math.min(99, rel)));

    // 9. Mission Risk & Decision (GO / CAUTION / NO-GO)
    let riskLevel: MissionRisk = 'LOW';
    let decision: MissionDecision = 'GO';
    let decisionReason = 'Nominal aero-propulsion & thermal equilibrium. Mission within engine capability.';

    if (!engineOn) {
      decision = 'GO';
      riskLevel = 'LOW';
      decisionReason = 'Engine in Standby. Ready for pre-flight mission startup sequence.';
    } else if (rulHours < timeRemainingHours) {
      riskLevel = 'CRITICAL';
      decision = 'NO-GO';
      decisionReason = `Insufficient RUL (${rulHours}h) for mission duration (${timeRemainingHours.toFixed(1)}h). Risk of in-flight failure.`;
    } else if (fault.activeFault === 'OVERHEATING' || fault.activeFault === 'LOW_OIL_PRESSURE' || (fault.activeFault !== 'NORMAL' && fault.severity === 'HIGH') || engineSOH < 40 || thermal.oilPressure < 1.5) {
      riskLevel = 'CRITICAL';
      decision = 'NO-GO';
      decisionReason = `Critical propulsion anomaly detected (${fault.activeFault}). Immediate abort / RTB advised.`;
    } else if (reliabilityScore >= 80 && fault.activeFault === 'NORMAL' && engineSOH >= 80) {
      riskLevel = 'LOW';
      decision = 'GO';
      decisionReason = 'Engine parameters healthy, low anomaly score, adequate mission margin.';
    } else {
      riskLevel = faultRiskPercent > 35 ? 'HIGH' : 'MEDIUM';
      decision = 'CAUTION';
      if (engine.vibration > 5.0) {
        decisionReason = 'Elevated vibration reduces predicted mission margin. Continuous monitoring recommended.';
      } else if (thermal.cht > 140) {
        decisionReason = 'Elevated cylinder head temperature. Restrict throttle to maintain thermal bounds.';
      } else if (fault.activeFault !== 'NORMAL') {
        decisionReason = `Minor fault (${fault.activeFault}) active. Mission feasible with heightened vigilance.`;
      } else {
        decisionReason = 'Engine degradation detected. Reduced safety margin for extended mission duration.';
      }
    }

    return {
      reliabilityScore,
      riskLevel,
      decision,
      decisionReason,
      engineSOH,
      rulHours,
      faultRiskPercent,
      missionMarginHours,
      anomalyScore,
      missionProgressPercent: progress,
      totalMissionDistanceKm: totalMissionDistKm,
      distanceRemainingKm: distRemainingKm,
      timeRemainingSeconds: timeRemainingSec,
      timeRemainingFormatted,
      missionTimeFormatted,
      terrainElevationFt: terrainElevFt,
      aglAltitudeFt: aglFt,
      routeDeviationKm: routeDevKm
    };
  }
}

