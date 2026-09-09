import { FaultState, FlightState, Rotax912State, ThermalState, MissionReliabilityState, MissionRisk, MissionDecision } from '../types/simulation';
import { Waypoint, ELPCandidate, EmergencyRecoveryState } from '../types/mission';
import { haversineDistanceKm } from './geoMath';
import { ELPManager } from './elpManager';

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
 * Model-Based Mission Reliability, Health Assessment, Dynamic Degradation & ELP Recovery Engine
 */
export class ReliabilityModel {
  public criticalPersistenceSeconds: number = 0;
  public static readonly CRITICAL_PERSISTENCE_MAX_SEC = 30;
  public static readonly CRUISE_SPEED_KMH = 145.0;

  // Dynamic Cumulative Degradation & Prognostics
  private cumulativeWearPercent: number = 0;
  private smoothedRulHours: number = 240.0;
  private isInitialized: boolean = false;

  public reset(): void {
    this.criticalPersistenceSeconds = 0;
    this.cumulativeWearPercent = 0;
    this.smoothedRulHours = 240.0;
    this.isInitialized = false;
  }

  public calculate(
    engine: Rotax912State,
    thermal: ThermalState,
    fault: FaultState,
    flight: FlightState,
    waypoints: Waypoint[],
    simTimeSeconds: number,
    engineOn: boolean,
    dt: number = 0.05
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

    // 3. Dynamic Physics-Informed Degradation & SOH Engine
    if (engineOn) {
      // Continuous operational wear rate (% per second)
      let wearRatePerSec = 0.0001; // baseline nominal mechanical wear

      if (engine.vibration > 0.045) {
        wearRatePerSec += (engine.vibration - 0.045) * 0.12;
      }
      if (thermal.cht > 125) {
        wearRatePerSec += (thermal.cht - 125) * 0.003;
      }
      if (thermal.oilTemperature > 115) {
        wearRatePerSec += (thermal.oilTemperature - 115) * 0.002;
      }
      if (thermal.oilPressure < 2.0 && thermal.oilPressure > 0) {
        wearRatePerSec += (2.0 - thermal.oilPressure) * 0.08;
      }
      if (fault.activeFault !== 'NORMAL') {
        const sevRate = fault.severity === 'LOW' ? 0.02 : fault.severity === 'MEDIUM' ? 0.08 : fault.severity === 'HIGH' ? 0.22 : 0.45;
        wearRatePerSec += sevRate;
      }

      this.cumulativeWearPercent = Math.min(85, this.cumulativeWearPercent + wearRatePerSec * dt);
    }

    // Instantaneous SOH calculation (combining base condition, cumulative degradation, and active fault penalty)
    let rawSoh = (engine.engineCondition * 100) - this.cumulativeWearPercent;

    if (engine.vibration > 0.045) {
      rawSoh -= Math.min(25, (engine.vibration - 0.045) * 350);
    }
    if (thermal.cht > 130) {
      rawSoh -= Math.min(30, (thermal.cht - 130) * 0.70);
    }
    if (thermal.oilTemperature > 120) {
      rawSoh -= Math.min(20, (thermal.oilTemperature - 120) * 0.80);
    }
    if (engineOn && thermal.oilPressure < 2.0) {
      rawSoh -= Math.min(35, (2.0 - thermal.oilPressure) * 20);
    }
    if (fault.activeFault !== 'NORMAL') {
      const severityMult = fault.severity === 'LOW' ? 8 : fault.severity === 'MEDIUM' ? 18 : fault.severity === 'HIGH' ? 38 : 50;
      rawSoh -= severityMult;
    }

    const engineSOH = Math.round(Math.max(1, Math.min(99, rawSoh)));

    // 4. Prognostic RUL (Hours) with Smooth Exponential Moving Average
    let rawRulHours = 240.0;
    if (engineSOH >= 85) {
      rawRulHours = 120 + (engineSOH - 85) * 8.0;
    } else if (engineSOH >= 65) {
      rawRulHours = 30 + (engineSOH - 65) * 4.5; // e.g. SOH 74 -> 70.5 h RUL
    } else if (engineSOH >= 45) {
      rawRulHours = 8 + (engineSOH - 45) * 1.1;
    } else if (engineSOH >= 25) {
      rawRulHours = 1.5 + (engineSOH - 25) * 0.325; // e.g. SOH 32 -> 3.7 h RUL
    } else if (engineSOH >= 10) {
      rawRulHours = 0.2 + (engineSOH - 10) * 0.086;
    } else {
      rawRulHours = Math.max(0.05, (engineSOH / 10.0) * 0.18); // e.g. SOH 5 -> 0.09 h RUL
    }

    if (!this.isInitialized) {
      this.smoothedRulHours = rawRulHours;
      this.isInitialized = true;
    } else {
      const smoothingAlpha = Math.min(1.0, dt * 1.2);
      this.smoothedRulHours += (rawRulHours - this.smoothedRulHours) * smoothingAlpha;
    }

    const rulHours = Number(this.smoothedRulHours.toFixed(2));

    // 5. Fault Risk (%)
    let faultRiskPercent = 3;
    if (fault.activeFault !== 'NORMAL') {
      if (fault.severity === 'LOW') faultRiskPercent = 20;
      else if (fault.severity === 'MEDIUM') faultRiskPercent = 45;
      else if (fault.severity === 'HIGH') faultRiskPercent = 75;
      else faultRiskPercent = 90;
    }
    if (engine.vibration > 0.060) faultRiskPercent = Math.max(faultRiskPercent, 55);
    if (thermal.cht > 145) faultRiskPercent = Math.max(faultRiskPercent, 70);
    if (engineOn && thermal.oilPressure < 1.8) faultRiskPercent = Math.max(faultRiskPercent, 70);
    faultRiskPercent = Math.min(99, Math.max(1, faultRiskPercent));

    // 6. Sensor Anomaly Score (0.0 to 1.0)
    let anomaly = 0.04;
    if (engine.vibration > 0.040) anomaly += Math.min(0.35, (engine.vibration - 0.040) * 7.0);
    if (thermal.cht > 115) anomaly += Math.min(0.30, (thermal.cht - 115) / 50.0);
    if (thermal.oilTemperature > 110) anomaly += Math.min(0.20, (thermal.oilTemperature - 110) / 40.0);
    if (engineOn && thermal.oilPressure < 2.2) anomaly += Math.min(0.30, (2.2 - thermal.oilPressure) / 1.5);
    if (engineOn && engine.fuelPressure < 2.2) anomaly += Math.min(0.30, (2.2 - engine.fuelPressure) / 1.5);
    if (fault.activeFault !== 'NORMAL') {
      anomaly += fault.severity === 'LOW' ? 0.18 : fault.severity === 'MEDIUM' ? 0.35 : fault.severity === 'HIGH' ? 0.55 : 0.70;
    }
    const anomalyScore = Number(Math.min(0.98, Math.max(0.02, anomaly)).toFixed(2));

    // 7. ONE Authoritative Total Mission Distance & Demand
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

    const estimatedFlightTimeMinutes = Math.max(1, Math.round((totalMissionDistKm / ReliabilityModel.CRUISE_SPEED_KMH) * 60));
    const missionDemandHours = Number((estimatedFlightTimeMinutes / 60.0).toFixed(2));
    const rulMarginHours = Number((rulHours - missionDemandHours).toFixed(2));
    const missionMarginHours = rulMarginHours;

    // Dynamic distance remaining from current position
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

    const effectiveSpeedKmh = Math.max(90, flight.groundSpeed > 10 ? flight.groundSpeed : ReliabilityModel.CRUISE_SPEED_KMH);
    const timeRemainingHours = distRemainingKm / effectiveSpeedKmh;
    const timeRemainingSec = Math.round(timeRemainingHours * 3600);

    const remMin = Math.floor(timeRemainingSec / 60);
    const remSec = timeRemainingSec % 60;
    const timeRemainingFormatted = `${String(remMin).padStart(2, '0')}:${String(remSec).padStart(2, '0')}`;

    const elapsedMin = Math.floor(simTimeSeconds / 60);
    const elapsedSec = Math.floor(simTimeSeconds % 60);
    const missionTimeFormatted = `${String(elapsedMin).padStart(2, '0')}:${String(elapsedSec).padStart(2, '0')}`;

    // 8. Individual Multi-Gate Safety & Prognostic Checks

    // GATE A: ENDURANCE CHECK (RUL Prognostic Feasibility)
    let enduranceStatus: 'PASS' | 'MARGINAL' | 'FAIL' = 'PASS';
    let enduranceDetails = `Adequate margin (+${rulMarginHours >= 0 ? '+' : ''}${rulMarginHours} h)`;
    if (rulHours < missionDemandHours) {
      enduranceStatus = 'FAIL';
      enduranceDetails = `Insufficient RUL (${rulHours} h < ${missionDemandHours} h requirement)`;
    } else if (rulMarginHours < 0.5) {
      enduranceStatus = 'MARGINAL';
      enduranceDetails = `Tight margin (+${rulMarginHours} h)`;
    }

    // GATE B: CURRENT OPERATING HEALTH CHECK
    const isCriticalHealth = (
      (fault.severity === 'CRITICAL') ||
      (fault.severity === 'HIGH' && (
        fault.activeFault === 'EXCESSIVE_VIBRATION' ||
        fault.activeFault === 'OVERHEATING' ||
        fault.activeFault === 'LOW_OIL_PRESSURE' ||
        fault.activeFault === 'MECHANICAL_FAULT'
      )) ||
      (engineOn && thermal.oilPressure < 1.3) ||
      thermal.cht > 155 ||
      thermal.oilTemperature > 135 ||
      engine.vibration > 0.090 ||
      (engineOn && engine.fuelPressure < 0.9) ||
      engineSOH < 25
    );

    const isDegradedHealth = !isCriticalHealth && (
      fault.severity === 'MEDIUM' ||
      (fault.severity === 'HIGH' && (
        fault.activeFault === 'FUEL_PRESSURE_DROP' ||
        fault.activeFault === 'COOLING_PROBLEM' ||
        fault.activeFault === 'HIGH_CHT' ||
        fault.activeFault === 'RPM_INSTABILITY' ||
        fault.activeFault === 'BEARING_FAULT'
      )) ||
      thermal.cht > 125 ||
      thermal.oilTemperature > 118 ||
      (engineOn && thermal.oilPressure < 1.9) ||
      engine.vibration > 0.060 ||
      (engineOn && engine.fuelPressure < 1.6) ||
      engineSOH < 60 ||
      anomalyScore >= 0.40
    );

    const isWarningHealth = !isCriticalHealth && !isDegradedHealth && (
      fault.activeFault !== 'NORMAL' ||
      thermal.cht > 115 ||
      thermal.oilTemperature > 108 ||
      (engineOn && thermal.oilPressure < 2.3) ||
      engine.vibration > 0.045 ||
      (engineOn && engine.fuelPressure < 2.3) ||
      engineSOH < 80 ||
      anomalyScore >= 0.20
    );

    let healthStatus: 'NORMAL' | 'PASS' | 'WARNING' | 'DEGRADED' | 'FAIL' | 'CRITICAL' = 'PASS';
    let healthDetails = 'All engine health parameters nominal';
    if (isCriticalHealth) {
      healthStatus = 'CRITICAL';
      const faultLabel = fault.activeFault === 'NORMAL' ? 'Critical Sensor Threshold' : fault.activeFault.replace(/_/g, ' ');
      healthDetails = `Critical propulsion anomaly (${faultLabel})`;
    } else if (isDegradedHealth) {
      healthStatus = 'DEGRADED';
      const faultLabel = fault.activeFault === 'NORMAL' ? 'Thermal/Vibration Elevation' : fault.activeFault.replace(/_/g, ' ');
      healthDetails = `Degraded health state (${faultLabel})`;
    } else if (isWarningHealth) {
      healthStatus = 'WARNING';
      const faultLabel = fault.activeFault === 'NORMAL' ? 'Parameter Drift' : fault.activeFault.replace(/_/g, ' ');
      healthDetails = `Low-severity ${faultLabel.toLowerCase()} anomaly`;
    }

    // GATE C: MISSION RISK ASSESSMENT
    let riskLevel: MissionRisk = 'LOW';
    if (isCriticalHealth || rulMarginHours < 0 || faultRiskPercent >= 75) {
      riskLevel = 'CRITICAL';
    } else if (isDegradedHealth && (rulMarginHours < 0.5 || faultRiskPercent >= 50 || fault.severity === 'HIGH')) {
      riskLevel = 'HIGH';
    } else if (isDegradedHealth || isWarningHealth || faultRiskPercent >= 20 || anomalyScore >= 0.20 || rulMarginHours < 0.5) {
      riskLevel = 'MEDIUM';
    } else {
      riskLevel = 'LOW';
    }

    let riskStatus: 'PASS' | 'ELEVATED' | 'FAIL' = 'PASS';
    let riskDetails = `Low operational risk (${faultRiskPercent}%)`;
    if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
      riskStatus = 'FAIL';
      riskDetails = `${riskLevel === 'CRITICAL' ? 'Critical' : 'High'} operational risk (${faultRiskPercent}%)`;
    } else if (riskLevel === 'MEDIUM') {
      riskStatus = 'ELEVATED';
      riskDetails = `Elevated operational risk (${faultRiskPercent}%)`;
    }

    // 9. Flight Phase Recognition & Continuous In-Flight Persistence Tracker
    const isCompleted = Boolean(flight.isCompleted || flight.missionProgressPercent >= 100 || flight.flightPhase === 'COMPLETED' || flight.flightPhase === 'RECOVERED');

    const isAirborne = engineOn && !isCompleted && (
      flight.flightPhase === 'TAKEOFF' ||
      flight.flightPhase === 'CLIMB' ||
      flight.flightPhase === 'CRUISE' ||
      flight.flightPhase === 'DESCENT' ||
      flight.flightPhase === 'APPROACH' ||
      flight.flightPhase === 'LANDING' ||
      flight.flightPhase === 'EMERGENCY_DIVERT' ||
      flight.flightPhase === 'RECOVERY_APPROACH' ||
      flight.airspeed > 40 ||
      flight.altitude > 100
    );

    // Persistence Timer (Requirements 10, 11, 12, 13, 24, 25)
    if (isCriticalHealth && isAirborne) {
      this.criticalPersistenceSeconds = Math.min(
        ReliabilityModel.CRITICAL_PERSISTENCE_MAX_SEC,
        this.criticalPersistenceSeconds + dt
      );
    } else {
      this.criticalPersistenceSeconds = 0;
    }

    const emergencyRecoveryTriggered = isAirborne && this.criticalPersistenceSeconds >= ReliabilityModel.CRITICAL_PERSISTENCE_MAX_SEC;

    // 10. Emergency Landing Point (ELP) Evaluation State
    let emergencyRecovery: EmergencyRecoveryState | undefined = undefined;
    if (emergencyRecoveryTriggered || flight.flightPhase === 'EMERGENCY_DIVERT' || flight.flightPhase === 'RECOVERY_APPROACH' || flight.flightPhase === 'RECOVERED') {
      emergencyRecovery = ELPManager.evaluateELPs(
        flight.latitude,
        flight.longitude,
        flight.airspeed,
        rulHours,
        engineSOH,
        engineOn
      );
      if (flight.flightPhase === 'RECOVERED') {
        emergencyRecovery.recoveryPhase = 'RECOVERED';
      } else if (flight.flightPhase === 'LANDING' && emergencyRecoveryTriggered) {
        emergencyRecovery.recoveryPhase = 'LANDING';
      } else if (flight.flightPhase === 'RECOVERY_APPROACH') {
        emergencyRecovery.recoveryPhase = 'APPROACH';
      }
    }

    // 11. Multi-Factor Decision Synthesis Engine
    let decision: MissionDecision = 'GO';
    let decisionReason = `All engine health parameters nominal (SOH ${engineSOH}%) and mission endurance margin is +${rulMarginHours} h.`;

    if (flight.flightPhase === 'RECOVERED') {
      decision = 'GO';
      riskLevel = 'LOW';
      decisionReason = `Emergency recovery completed successfully. UAV safely landed at ${emergencyRecovery?.selectedELP?.name || 'ELP'}.`;
    } else if (isCompleted) {
      decision = 'GO';
      riskLevel = 'LOW';
      decisionReason = `Mission completed successfully. UAV safely landed at destination.`;
    } else if (!engineOn) {
      // Pre-mission Standby / Ground unstarted
      if (enduranceStatus === 'FAIL') {
        decision = 'NO-GO';
        riskLevel = 'CRITICAL';
        decisionReason = `Insufficient engine RUL (${rulHours} h) for planned route (${missionDemandHours} h). Capability margin is negative (${rulMarginHours} h). Engine maintenance required before dispatch.`;
      } else {
        decision = 'GO';
        riskLevel = 'LOW';
        decisionReason = `Engine in Standby. Planned mission demand is ${missionDemandHours} h (~${estimatedFlightTimeMinutes} min). Ready for startup sequence.`;
      }
    } else if (emergencyRecoveryTriggered || flight.flightPhase === 'EMERGENCY_DIVERT' || flight.flightPhase === 'RECOVERY_APPROACH') {
      // In-flight continuous critical persistence >= 30 seconds
      decision = 'EMERGENCY RECOVERY';
      riskLevel = 'CRITICAL';
      const elpTargetName = emergencyRecovery?.selectedELP ? `${emergencyRecovery.selectedELP.id} (${emergencyRecovery.selectedELP.name})` : 'Nearest Reachable ELP';
      decisionReason = `CRITICAL PERSISTENCE (30/30 sec) EXCEEDED: Severe continuous propulsion failure in flight. Original mission ABORTED. Diverting to safest reachable emergency landing point: ${elpTargetName}.`;
    } else if (isAirborne && isCriticalHealth) {
      // In-flight active critical anomaly before 30s threshold
      decision = 'NO-GO';
      riskLevel = 'CRITICAL';
      decisionReason = `CRITICAL ANOMALY IN FLIGHT: ${healthDetails}. Mission endurance is +${rulMarginHours} h, but active failure overrides prognostic RUL. Persistence: ${Math.floor(this.criticalPersistenceSeconds)}/30 sec before auto-emergency recovery.`;
    } else if (enduranceStatus === 'FAIL') {
      // Negative endurance margin
      decision = 'NO-GO';
      riskLevel = 'CRITICAL';
      decisionReason = `Insufficient remaining useful life (RUL ${rulHours} h < mission demand ${missionDemandHours} h). Negative capability margin (${rulMarginHours} h).`;
    } else if (!isAirborne && isCriticalHealth) {
      // Pre-flight / Ground engine running with critical fault
      decision = 'NO-GO';
      riskLevel = 'CRITICAL';
      if (fault.activeFault !== 'NORMAL') {
        decisionReason = `Mission endurance is sufficient (+${rulMarginHours} h), but a critical propulsion anomaly (${fault.activeFault.replace(/_/g, ' ')}) is currently active. Pre-flight abort advised.`;
      } else {
        decisionReason = `Severe engine degradation detected (SOH ${engineSOH}%). Pre-flight abort advised.`;
      }
    } else if (riskLevel === 'CRITICAL') {
      // Excessive operational risk
      decision = 'NO-GO';
      riskLevel = 'CRITICAL';
      decisionReason = `Mission risk (${faultRiskPercent}%) exceeds maximum allowable safety threshold.`;
    } else if (isDegradedHealth || isWarningHealth || enduranceStatus === 'MARGINAL' || riskLevel === 'HIGH' || riskLevel === 'MEDIUM') {
      // Cautionary operational state with sufficient endurance
      decision = 'CAUTION';
      if (fault.activeFault !== 'NORMAL' && fault.severity === 'LOW') {
        decisionReason = `Low-severity ${fault.activeFault.replace(/_/g, ' ').toLowerCase()} anomaly detected. Predicted endurance is sufficient (+${rulMarginHours} h), but continued monitoring is advised.`;
      } else if (isDegradedHealth) {
        decisionReason = `${healthDetails}. Mission endurance is sufficient (+${rulMarginHours} h), but continued operation requires caution and monitoring.`;
      } else if (enduranceStatus === 'MARGINAL') {
        decisionReason = `Tight endurance margin (+${rulMarginHours} h). Predicted endurance meets mission demand, but reserve is limited.`;
      } else {
        decisionReason = `${healthDetails}. Mission endurance is +${rulMarginHours} h with elevated monitoring recommended.`;
      }
    } else {
      decision = 'GO';
      riskLevel = 'LOW';
      decisionReason = `All engine health parameters nominal (SOH ${engineSOH}%) and mission endurance margin is +${rulMarginHours} h.`;
    }

    // 12. Explainable Mission Reliability Score (%)
    // Formula: Reliability = 0.35*SOH + 0.30*(100-FaultRisk) + 0.20*min(100, RUL*2.5) + 0.15*(1.0-Anomaly)*100
    let rel = 0.35 * engineSOH + 0.30 * (100 - faultRiskPercent) + 0.20 * Math.min(100, rulHours * 2.5) + 0.15 * (1.0 - anomalyScore) * 100;
    if (decision === 'NO-GO' || decision === 'EMERGENCY RECOVERY' || emergencyRecoveryTriggered) {
      rel = Math.min(rel, 30);
    } else if (decision === 'CAUTION') {
      rel = Math.min(rel, 68);
    }
    const reliabilityScore = Math.round(Math.max(10, Math.min(99, rel)));

    return {
      reliabilityScore,
      riskLevel,
      decision,
      decisionReason,
      engineSOH,
      rulHours,
      faultRiskPercent,
      missionMarginHours,
      rulMarginHours,
      totalMissionDistanceKm: totalMissionDistKm,
      estimatedFlightTimeMinutes,
      missionDemandHours,
      enduranceCheck: {
        status: enduranceStatus,
        requiredHours: missionDemandHours,
        rulHours,
        marginHours: rulMarginHours,
        details: enduranceDetails
      },
      healthCheck: {
        status: healthStatus,
        faultName: fault.activeFault,
        faultSeverity: fault.severity,
        details: healthDetails
      },
      riskCheck: {
        status: riskStatus,
        riskScorePercent: faultRiskPercent,
        details: riskDetails
      },
      criticalPersistenceSeconds: Number(this.criticalPersistenceSeconds.toFixed(1)),
      criticalPersistenceMaxSeconds: ReliabilityModel.CRITICAL_PERSISTENCE_MAX_SEC,
      emergencyRecoveryTriggered,
      emergencyRecovery,
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
