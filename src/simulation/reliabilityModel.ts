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
 * Authoritative Mission Reliability & Digital Twin Assessment Engine
 * 
 * Implements a deterministic, explainable composite reliability formula:
 * Reliability Score = 0.35 * Health + 0.25 * Risk + 0.20 * Endurance + 0.10 * Anomaly + 0.10 * FaultSeverity
 * 
 * Features:
 * - Frozen / Standby state while parked (no recalculations or random noise before mission start)
 * - Activates only when mission starts (missionStarted / engineOn)
 * - Dynamic SOH and RUL degradation models driven genuinely by physical state
 * - Bounded EMA smoothing preventing jumpy percentage changes
 * - Complete freeze upon mission completion or emergency recovery touchdown
 */
export class ReliabilityModel {
  public criticalPersistenceSeconds: number = 0;
  public static readonly CRITICAL_PERSISTENCE_MAX_SEC = 30;
  public static readonly CRUISE_SPEED_KMH = 145.0;

  // Internal smooth state trackers
  private cumulativeWearPercent: number = 0;
  private smoothedSoh: number = 99.0;
  private smoothedRulHours: number = 240.0;
  private smoothedReliability: number = 98.0;
  private isInitialized: boolean = false;
  private isFrozenOnCompletion: boolean = false;
  private frozenState: MissionReliabilityState | null = null;
  private runningTimeSeconds: number = 0;

  public reset(): void {
    this.criticalPersistenceSeconds = 0;
    this.cumulativeWearPercent = 0;
    this.smoothedSoh = 99.0;
    this.smoothedRulHours = 240.0;
    this.smoothedReliability = 98.0;
    this.isInitialized = false;
    this.isFrozenOnCompletion = false;
    this.frozenState = null;
    this.runningTimeSeconds = 0;
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

    // 3. ONE Authoritative Total Mission Distance & Demand
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

    // Completion / Landed Check
    const isCompleted = Boolean(flight.isCompleted || flight.missionProgressPercent >= 100 || flight.flightPhase === 'COMPLETED' || flight.flightPhase === 'RECOVERED');

    if (isCompleted && this.frozenState) {
      return {
        ...this.frozenState,
        missionProgressPercent: 100,
        distanceRemainingKm: 0,
        timeRemainingSeconds: 0,
        timeRemainingFormatted: '00:00',
        missionTimeFormatted,
        isCompleted: true,
        missionStatus: 'COMPLETED'
      };
    }

    // =========================================================================
    // SECTION A: PARKED / STANDBY STATE (BEFORE MISSION START)
    // =========================================================================
    const isParked = !engineOn || flight.flightPhase === 'PARKED' || flight.flightPhase === 'STANDBY';

    if (isParked) {
      this.criticalPersistenceSeconds = 0;
      this.cumulativeWearPercent = 0;
      this.smoothedSoh = 99.0;
      this.smoothedRulHours = 240.0;
      this.smoothedReliability = 98.0;
      this.runningTimeSeconds = 0;

      const baseRulMargin = Number((240.0 - missionDemandHours).toFixed(2));

      return {
        reliabilityScore: 99, // baseline number, UI shows READY / -- when isParked is true
        riskLevel: 'LOW',
        decision: 'GO',
        decisionReason: 'Engine in standby. Reliability assessment will activate when the mission starts.',
        engineSOH: 99,
        rulHours: 240.0,
        faultRiskPercent: 0,
        missionMarginHours: baseRulMargin,
        rulMarginHours: baseRulMargin,
        totalMissionDistanceKm: totalMissionDistKm,
        estimatedFlightTimeMinutes,
        missionDemandHours,
        enduranceCheck: {
          status: 'PASS',
          requiredHours: missionDemandHours,
          rulHours: 240.0,
          marginHours: baseRulMargin,
          details: 'READY'
        },
        healthCheck: {
          status: 'NORMAL',
          faultName: 'NORMAL',
          faultSeverity: 'NONE',
          details: 'BASELINE'
        },
        riskCheck: {
          status: 'PASS',
          riskScorePercent: 0,
          details: 'NOT ACTIVE'
        },
        criticalPersistenceSeconds: 0,
        criticalPersistenceMaxSeconds: ReliabilityModel.CRITICAL_PERSISTENCE_MAX_SEC,
        emergencyRecoveryTriggered: false,
        anomalyScore: 0.00,
        missionProgressPercent: 0,
        distanceRemainingKm: totalMissionDistKm,
        timeRemainingSeconds: Math.round(missionDemandHours * 3600),
        timeRemainingFormatted,
        missionTimeFormatted: '00:00',
        terrainElevationFt: terrainElevFt,
        aglAltitudeFt: 0,
        routeDeviationKm: 0,
        isParked: true,
        isCompleted: false,
        missionStatus: 'STANDBY'
      };
    }

    // =========================================================================
    // SECTION B: ACTIVE MISSION ASSESSMENT (ACTIVATES UPON ENGINE/MISSION START)
    // =========================================================================
    this.runningTimeSeconds += dt;
    const isWarmedUp = this.runningTimeSeconds > 2.5 && engine.rpm > 1200;
    const hasActiveFault = fault.activeFault !== 'NORMAL';

    // 1. Dynamic Cumulative Wear & Physical Degradation Engine
    let wearRatePerSec = 0.0001; // nominal baseline mechanical wear rate

    if (engine.vibration > 0.055) {
      wearRatePerSec += (engine.vibration - 0.055) * 0.10;
    }
    if (thermal.cht > 125) {
      wearRatePerSec += (thermal.cht - 125) * 0.003;
    }
    if (thermal.oilTemperature > 115) {
      wearRatePerSec += (thermal.oilTemperature - 115) * 0.002;
    }
    if (isWarmedUp && thermal.oilPressure < 2.0 && thermal.oilPressure > 0) {
      wearRatePerSec += (2.0 - thermal.oilPressure) * 0.08;
    }
    if (hasActiveFault) {
      const sevRate = fault.severity === 'LOW' ? 0.015 : fault.severity === 'MEDIUM' ? 0.06 : fault.severity === 'HIGH' ? 0.20 : 0.40;
      wearRatePerSec += sevRate;
    }

    this.cumulativeWearPercent = Math.min(85, this.cumulativeWearPercent + wearRatePerSec * dt);

    // Instantaneous SOH calculation with physical sensitivity
    let rawSoh = (engine.engineCondition * 100) - this.cumulativeWearPercent;

    if (engine.vibration > 0.055) {
      rawSoh -= Math.min(25, (engine.vibration - 0.055) * 350);
    }
    if (thermal.cht > 130) {
      rawSoh -= Math.min(30, (thermal.cht - 130) * 0.70);
    }
    if (thermal.oilTemperature > 120) {
      rawSoh -= Math.min(20, (thermal.oilTemperature - 120) * 0.80);
    }
    if (isWarmedUp && thermal.oilPressure < 2.0) {
      rawSoh -= Math.min(35, (2.0 - thermal.oilPressure) * 20);
    }
    if (hasActiveFault) {
      const severityMult = fault.severity === 'LOW' ? 6 : fault.severity === 'MEDIUM' ? 16 : fault.severity === 'HIGH' ? 36 : 50;
      rawSoh -= severityMult;
    }

    const targetSoh = Math.max(1, Math.min(99, rawSoh));
    const sohAlpha = Math.min(1.0, dt * 1.5);
    this.smoothedSoh += (targetSoh - this.smoothedSoh) * sohAlpha;
    const engineSOH = Math.round(this.smoothedSoh);

    // 2. Dynamic Prognostic RUL (Hours)
    let rawRulHours = 240.0;
    if (engineSOH >= 85) {
      rawRulHours = 120 + (engineSOH - 85) * 8.0; // 120 - 232 h
    } else if (engineSOH >= 65) {
      rawRulHours = 30 + (engineSOH - 65) * 4.5;  // 30 - 120 h
    } else if (engineSOH >= 45) {
      rawRulHours = 8 + (engineSOH - 45) * 1.1;   // 8 - 30 h
    } else if (engineSOH >= 25) {
      rawRulHours = 1.5 + (engineSOH - 25) * 0.325; // 1.5 - 8 h
    } else if (engineSOH >= 10) {
      rawRulHours = 0.2 + (engineSOH - 10) * 0.086; // 0.2 - 1.5 h
    } else {
      rawRulHours = Math.max(0.05, (engineSOH / 10.0) * 0.18);
    }

    // Subtract actual active engine running hours
    const missionElapsedHours = simTimeSeconds / 3600.0;
    rawRulHours = Math.max(0.05, rawRulHours - missionElapsedHours);

    if (!this.isInitialized) {
      this.smoothedRulHours = rawRulHours;
      this.smoothedReliability = 98.0;
      this.isInitialized = true;
    } else {
      const rulAlpha = Math.min(1.0, dt * 1.0);
      this.smoothedRulHours += (rawRulHours - this.smoothedRulHours) * rulAlpha;
    }

    const rulHours = Number(this.smoothedRulHours.toFixed(2));
    const rulMarginHours = Number((rulHours - missionDemandHours).toFixed(2));
    const missionMarginHours = rulMarginHours;

    // 3. Deterministic Fault Risk (%)
    let faultRiskPercent = 3;
    if (hasActiveFault) {
      if (fault.severity === 'LOW') faultRiskPercent = 20;
      else if (fault.severity === 'MEDIUM') faultRiskPercent = 45;
      else if (fault.severity === 'HIGH') faultRiskPercent = 75;
      else faultRiskPercent = 90;
    }
    if (engine.vibration > 0.075) faultRiskPercent = Math.max(faultRiskPercent, 55);
    if (thermal.cht > 145) faultRiskPercent = Math.max(faultRiskPercent, 70);
    if (isWarmedUp && thermal.oilPressure < 1.8) faultRiskPercent = Math.max(faultRiskPercent, 70);
    faultRiskPercent = Math.min(99, Math.max(1, faultRiskPercent));

    // 4. Deterministic Sensor Anomaly Score (0.00 to 1.00)
    let anomaly = 0.03;
    if (engine.vibration > 0.052) anomaly += Math.min(0.35, (engine.vibration - 0.052) * 6.0);
    if (thermal.cht > 115) anomaly += Math.min(0.25, (thermal.cht - 115) / 45.0);
    if (thermal.oilTemperature > 110) anomaly += Math.min(0.20, (thermal.oilTemperature - 110) / 35.0);
    if (isWarmedUp && thermal.oilPressure < 2.5) anomaly += Math.min(0.25, (2.5 - thermal.oilPressure) / 1.5);
    if (isWarmedUp && engine.fuelPressure < 2.5) anomaly += Math.min(0.25, (2.5 - engine.fuelPressure) / 1.5);
    if (hasActiveFault) {
      anomaly += fault.severity === 'LOW' ? 0.18 : fault.severity === 'MEDIUM' ? 0.35 : fault.severity === 'HIGH' ? 0.55 : 0.70;
    }
    const anomalyScore = Number(Math.min(0.98, Math.max(0.02, anomaly)).toFixed(2));

    // 5. Multi-Gate Health Classification
    const isCriticalHealth = (
      (hasActiveFault && (
        fault.severity === 'CRITICAL' ||
        (fault.severity === 'HIGH' && (
          fault.activeFault === 'EXCESSIVE_VIBRATION' ||
          fault.activeFault === 'OVERHEATING' ||
          fault.activeFault === 'LOW_OIL_PRESSURE' ||
          fault.activeFault === 'MECHANICAL_FAULT'
        ))
      )) ||
      (isWarmedUp && thermal.oilPressure < 1.2) ||
      thermal.cht > 155 ||
      thermal.oilTemperature > 140 ||
      engine.vibration > 0.110 ||
      (isWarmedUp && engine.fuelPressure < 0.8) ||
      engineSOH < 25
    );

    const isDegradedHealth = !isCriticalHealth && (
      (hasActiveFault && (
        fault.severity === 'MEDIUM' ||
        (fault.severity === 'HIGH' && (
          fault.activeFault === 'FUEL_PRESSURE_DROP' ||
          fault.activeFault === 'COOLING_PROBLEM' ||
          fault.activeFault === 'HIGH_CHT' ||
          fault.activeFault === 'RPM_INSTABILITY' ||
          fault.activeFault === 'BEARING_FAULT'
        ))
      )) ||
      thermal.cht > 125 ||
      thermal.oilTemperature > 120 ||
      (isWarmedUp && thermal.oilPressure < 1.8) ||
      engine.vibration > 0.075 ||
      (isWarmedUp && engine.fuelPressure < 1.5) ||
      engineSOH < 60 ||
      anomalyScore >= 0.45
    );

    const isWarningHealth = !isCriticalHealth && !isDegradedHealth && (
      hasActiveFault ||
      thermal.cht > 115 ||
      thermal.oilTemperature > 110 ||
      (isWarmedUp && thermal.oilPressure < 2.4) ||
      engine.vibration > 0.052 ||
      (isWarmedUp && engine.fuelPressure < 2.4) ||
      engineSOH < 80 ||
      anomalyScore >= 0.20
    );

    let healthStatus: 'NORMAL' | 'PASS' | 'WARNING' | 'DEGRADED' | 'FAIL' | 'CRITICAL' = 'PASS';
    let healthDetails = 'All engine health parameters nominal';
    if (isCriticalHealth) {
      healthStatus = 'CRITICAL';
      const faultLabel = !hasActiveFault ? 'Critical Sensor Threshold' : fault.activeFault.replace(/_/g, ' ');
      healthDetails = `Critical propulsion anomaly (${faultLabel})`;
    } else if (isDegradedHealth) {
      healthStatus = 'DEGRADED';
      const faultLabel = !hasActiveFault ? 'Thermal/Vibration Elevation' : fault.activeFault.replace(/_/g, ' ');
      healthDetails = `Degraded health state (${faultLabel})`;
    } else if (isWarningHealth) {
      healthStatus = 'WARNING';
      const faultLabel = !hasActiveFault ? 'Parameter Drift' : fault.activeFault.replace(/_/g, ' ');
      healthDetails = `Low-severity ${faultLabel.toLowerCase()} anomaly`;
    }

    // Endurance Gate
    let enduranceStatus: 'PASS' | 'MARGINAL' | 'FAIL' = 'PASS';
    let enduranceDetails = `Adequate margin (+${rulMarginHours >= 0 ? '+' : ''}${rulMarginHours} h)`;
    if (rulHours < missionDemandHours) {
      enduranceStatus = 'FAIL';
      enduranceDetails = `Insufficient RUL (${rulHours} h < ${missionDemandHours} h requirement)`;
    } else if (rulMarginHours < 0.5) {
      enduranceStatus = 'MARGINAL';
      enduranceDetails = `Tight margin (+${rulMarginHours} h)`;
    }

    // Risk Gate
    let riskLevel: MissionRisk = 'LOW';
    if (isCriticalHealth || rulMarginHours < 0 || faultRiskPercent >= 75) {
      riskLevel = 'CRITICAL';
    } else if (isDegradedHealth && (rulMarginHours < 0.5 || faultRiskPercent >= 50 || (hasActiveFault && fault.severity === 'HIGH'))) {
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

    // 6. In-Flight Critical Persistence & Emergency Recovery
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

    if (isCriticalHealth && isAirborne) {
      this.criticalPersistenceSeconds = Math.min(
        ReliabilityModel.CRITICAL_PERSISTENCE_MAX_SEC,
        this.criticalPersistenceSeconds + dt
      );
    } else {
      this.criticalPersistenceSeconds = 0;
    }

    const emergencyRecoveryTriggered = isAirborne && this.criticalPersistenceSeconds >= ReliabilityModel.CRITICAL_PERSISTENCE_MAX_SEC;

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

    // 7. Multi-Gate Decision Synthesis
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
    } else if (emergencyRecoveryTriggered || flight.flightPhase === 'EMERGENCY_DIVERT' || flight.flightPhase === 'RECOVERY_APPROACH') {
      decision = 'EMERGENCY RECOVERY';
      riskLevel = 'CRITICAL';
      const elpTargetName = emergencyRecovery?.selectedELP ? `${emergencyRecovery.selectedELP.id} (${emergencyRecovery.selectedELP.name})` : 'Nearest Reachable ELP';
      decisionReason = `CRITICAL PERSISTENCE (30/30 sec) EXCEEDED: Severe continuous propulsion failure in flight. Original mission ABORTED. Diverting to safest reachable emergency landing point: ${elpTargetName}.`;
    } else if (isAirborne && isCriticalHealth) {
      decision = 'NO-GO';
      riskLevel = 'CRITICAL';
      decisionReason = `CRITICAL ANOMALY IN FLIGHT: ${healthDetails}. Mission endurance is +${rulMarginHours} h, but active failure overrides prognostic RUL. Persistence: ${Math.floor(this.criticalPersistenceSeconds)}/30 sec before auto-emergency recovery.`;
    } else if (enduranceStatus === 'FAIL') {
      decision = 'NO-GO';
      riskLevel = 'CRITICAL';
      decisionReason = `Insufficient remaining useful life (RUL ${rulHours} h < mission demand ${missionDemandHours} h). Negative capability margin (${rulMarginHours} h).`;
    } else if (!isAirborne && isCriticalHealth) {
      decision = 'NO-GO';
      riskLevel = 'CRITICAL';
      decisionReason = hasActiveFault
        ? `Mission endurance is sufficient (+${rulMarginHours} h), but a critical propulsion anomaly (${fault.activeFault.replace(/_/g, ' ')}) is currently active. Pre-flight abort advised.`
        : `Severe engine degradation detected (SOH ${engineSOH}%). Pre-flight abort advised.`;
    } else if (riskLevel === 'CRITICAL') {
      decision = 'NO-GO';
      riskLevel = 'CRITICAL';
      decisionReason = `Mission risk (${faultRiskPercent}%) exceeds maximum allowable safety threshold.`;
    } else if (isDegradedHealth || isWarningHealth || enduranceStatus === 'MARGINAL' || riskLevel === 'HIGH' || riskLevel === 'MEDIUM') {
      decision = 'CAUTION';
      if (hasActiveFault && fault.severity === 'LOW') {
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

    // =========================================================================
    // SECTION C: TRANSPARENT COMPOSITE RELIABILITY FORMULA (0–100)
    // =========================================================================
    //
    // Fixed & Documented Component Weights:
    // reliabilityScore = 0.35 * healthComponent
    //                  + 0.25 * riskComponent
    //                  + 0.20 * enduranceComponent
    //                  + 0.10 * anomalyComponent
    //                  + 0.10 * faultSeverityComponent
    //

    // 1. Health Component (35% weight)
    let healthComponent = 95;
    if (isCriticalHealth) {
      healthComponent = Math.min(39, Math.max(0, (engineSOH / 100) * 39));
    } else if (isDegradedHealth) {
      healthComponent = Math.min(69, Math.max(40, 40 + (engineSOH / 100) * 29));
    } else if (isWarningHealth) {
      healthComponent = Math.min(89, Math.max(70, 70 + (engineSOH / 100) * 19));
    } else {
      healthComponent = Math.min(100, Math.max(90, engineSOH));
    }

    // 2. Risk Component (25% weight)
    const riskComponent = Math.max(0, Math.min(100, 100 - faultRiskPercent));

    // 3. Endurance Component (20% weight) - Note: Endurance does NOT dominate overall score
    let enduranceComponent = 95;
    if (rulHours < missionDemandHours) {
      enduranceComponent = Math.max(0, Math.min(15, (rulHours / Math.max(0.01, missionDemandHours)) * 15));
    } else if (rulMarginHours < 0.5) {
      enduranceComponent = 50 + (rulMarginHours / 0.5) * 20; // 50 - 70
    } else if (rulMarginHours < 2.0) {
      enduranceComponent = 70 + ((rulMarginHours - 0.5) / 1.5) * 25; // 70 - 95
    } else {
      enduranceComponent = Math.min(100, 95 + (rulMarginHours - 2.0) * 0.5); // 95 - 100
    }

    // 4. Anomaly Component (10% weight)
    const anomalyComponent = Math.max(0, Math.min(100, 100 * (1.0 - anomalyScore)));

    // 5. Fault Severity Component (10% weight)
    let faultSeverityComponent = 100;
    if (hasActiveFault) {
      if (fault.severity === 'LOW') faultSeverityComponent = 80;
      else if (fault.severity === 'MEDIUM') faultSeverityComponent = 60;
      else if (fault.severity === 'HIGH') faultSeverityComponent = 30;
      else faultSeverityComponent = 0;
    }

    // Compute Weighted Composite
    let rawReliability = (
      0.35 * healthComponent +
      0.25 * riskComponent +
      0.20 * enduranceComponent +
      0.10 * anomalyComponent +
      0.10 * faultSeverityComponent
    );

    // Apply safety gate bounding
    if (decision === 'NO-GO' || decision === 'EMERGENCY RECOVERY' || emergencyRecoveryTriggered) {
      rawReliability = Math.min(rawReliability, 35);
    } else if (decision === 'CAUTION') {
      rawReliability = Math.min(rawReliability, 72);
    }

    rawReliability = Math.max(1, Math.min(99, rawReliability));

    // Smooth Update Rate Limiting (Prevent wild unphysical jumps)
    const maxChangePerSec = isCriticalHealth ? 25.0 : isDegradedHealth ? 8.0 : 2.5;
    const maxDelta = maxChangePerSec * dt;
    const targetDelta = rawReliability - this.smoothedReliability;
    const boundedDelta = Math.max(-maxDelta, Math.min(maxDelta, targetDelta));

    this.smoothedReliability += boundedDelta;
    const reliabilityScore = Math.round(Math.max(1, Math.min(99, this.smoothedReliability)));

    const resultState: MissionReliabilityState = {
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
        faultSeverity: hasActiveFault ? fault.severity : 'NONE',
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
      routeDeviationKm: routeDevKm,
      isParked: false,
      isCompleted,
      missionStatus: isCompleted ? 'COMPLETED' : 'IN_PROGRESS'
    };

    if (isCompleted && !this.isFrozenOnCompletion) {
      this.isFrozenOnCompletion = true;
      this.frozenState = { ...resultState };
    }

    return resultState;
  }
}
