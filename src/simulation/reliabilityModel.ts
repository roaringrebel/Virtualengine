import { FaultState, FlightState, Rotax912State, ThermalState } from '../types/simulation';
import { Waypoint } from '../types/mission';

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
  distanceRemainingKm: number;      // km
  timeRemainingSeconds: number;     // seconds
  timeRemainingFormatted: string;   // mm:ss
  missionTimeFormatted: string;     // mm:ss
  terrainElevationFt: number;       // ft MSL
  aglAltitudeFt: number;            // ft AGL (Altitude - Terrain)
  routeDeviationKm: number;         // cross-track deviation (km)
}

/**
 * Calculates simulated terrain elevation (ft MSL) based on local topography of Himachal foothills.
 */
export function getSimulatedTerrainElevation(lat: number, lon: number): number {
  const dLat = (lat - 32.5450) * 111.32;
  const dLon = (lon - 77.2150) * 94.12;

  // Continuous smooth undulating topography (3,600 ft to 5,200 ft)
  const baseElev = 3850;
  const ridgeEast = Math.max(0, dLon * 120);
  const ridgeNorth = Math.sin(dLat * 0.45) * 320 + Math.cos(dLon * 0.55) * 240;
  const valleyVariation = Math.sin(dLat * 0.85 + dLon * 0.6) * 180;

  const elev = Math.round(baseElev + ridgeEast + ridgeNorth + valleyVariation);
  return Math.max(3500, Math.min(5400, elev));
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
  const prevIdx = (currentWpIdx - 1 + waypoints.length) % waypoints.length;
  const p1 = waypoints[prevIdx];
  const p2 = waypoints[currentWpIdx];

  // Convert geodetic to local Cartesian coordinates (km)
  const latRef = waypoints[0].lat;
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
    // 1. Terrain & Altitude AGL
    const terrainElevFt = getSimulatedTerrainElevation(flight.latitude, flight.longitude);
    // Display total MSL altitude: base 3,850 ft + relative flight altitude
    const uavMslAltitudeFt = engineOn ? (3850 + flight.altitude) : terrainElevFt;
    const aglFt = Math.max(0, uavMslAltitudeFt - terrainElevFt);

    // 2. Route Deviation
    const routeDevKm = calculateRouteDeviationKm(
      flight.latitude,
      flight.longitude,
      waypoints,
      flight.currentWaypointIndex
    );

    // 3. Engine State of Health (SOH %)
    let rawSoh = engine.engineCondition * 100;

    // Proportional sensor penalties without double-counting
    if (engine.vibration > 5.0) {
      rawSoh -= Math.min(18, (engine.vibration - 5.0) * 2.8);
    }
    if (thermal.cht > 135) {
      rawSoh -= Math.min(30, (thermal.cht - 135) * 0.55);
    }
    if (thermal.oilTemperature > 125) {
      rawSoh -= Math.min(20, (thermal.oilTemperature - 125) * 0.65);
    }
    if (engineOn && thermal.oilPressure < 2.0) {
      rawSoh -= Math.min(30, (2.0 - thermal.oilPressure) * 18);
    }
    if (fault.activeFault !== 'NORMAL') {
      const severityMult = fault.severity === 'LOW' ? 6 : fault.severity === 'MEDIUM' ? 14 : 32;
      rawSoh -= severityMult;
    }

    const engineSOH = Math.round(Math.max(15, Math.min(99, rawSoh)));

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
      else if (fault.severity === 'MEDIUM') faultRiskPercent = 38;
      else faultRiskPercent = 82;
    }
    if (engine.vibration > 6.0) faultRiskPercent = Math.max(faultRiskPercent, 45);
    if (thermal.cht > 165) faultRiskPercent = Math.max(faultRiskPercent, 80);

    // 6. Sensor Anomaly Score (0.0 to 1.0)
    let anomaly = 0.04;
    if (engine.vibration > 3.5) anomaly += Math.min(0.35, (engine.vibration - 3.5) / 10.0);
    if (thermal.cht > 120) anomaly += Math.min(0.35, (thermal.cht - 120) / 80.0);
    if (thermal.oilTemperature > 115) anomaly += Math.min(0.20, (thermal.oilTemperature - 115) / 50.0);
    if (fault.activeFault !== 'NORMAL') {
      anomaly += fault.severity === 'LOW' ? 0.15 : fault.severity === 'MEDIUM' ? 0.32 : 0.60;
    }
    const anomalyScore = Number(Math.min(0.98, Math.max(0.02, anomaly)).toFixed(2));

    // 7. Mission Distance & Remaining Time
    const totalMissionDistKm = 42.0;
    const progress = Math.max(0, Math.min(100, flight.missionProgressPercent));
    const distRemainingKm = Number((totalMissionDistKm * (1.0 - progress / 100.0)).toFixed(1));

    const effectiveSpeedKmh = Math.max(90, flight.groundSpeed > 10 ? flight.groundSpeed : 135);
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
    let rel = 0.45 * engineSOH + 0.30 * (100 - faultRiskPercent) + 0.15 * Math.min(100, rulHours * 3.0) + 0.10 * (1.0 - anomalyScore) * 100;
    
    // Penalize if mission margin is critically low (< 0.5 hour)
    if (missionMarginHours < 0.5) {
      rel = Math.min(rel, 35);
    }

    const reliabilityScore = Math.round(Math.max(12, Math.min(98, rel)));

    // 9. Mission Risk & Decision (GO / CAUTION / NO-GO)
    let riskLevel: MissionRisk = 'LOW';
    let decision: MissionDecision = 'GO';
    let decisionReason = 'Mission can safely continue under nominal simulated parameters.';

    if (reliabilityScore >= 80 && fault.activeFault === 'NORMAL' && engineSOH >= 82) {
      riskLevel = 'LOW';
      decision = 'GO';
      decisionReason = 'Nominal aero-propulsion & thermal equilibrium. Full mission capability available.';
    } else if (reliabilityScore >= 52 && engineSOH >= 45 && fault.severity !== 'HIGH') {
      riskLevel = faultRiskPercent > 35 ? 'HIGH' : 'MEDIUM';
      decision = 'CAUTION';
      decisionReason = 'Engine degradation / abnormal vibration detected. Mission completion possible with active monitoring.';
    } else {
      riskLevel = 'CRITICAL';
      decision = 'NO-GO';
      decisionReason = 'Predicted engine capability insufficient for remaining mission duration. Immediate recovery/RTB advised.';
    }

    if (!engineOn) {
      decision = 'GO';
      riskLevel = 'LOW';
      decisionReason = 'Engine in Standby. Ready for pre-flight startup sequence.';
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
