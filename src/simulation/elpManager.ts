import { ELPCandidate, EmergencyRecoveryState, LocationCoord } from '../types/mission';
import { haversineDistanceKm, initialBearingDeg } from './geoMath';

/**
 * Pre-surveyed emergency landing sites across the flight operational corridor
 * (Krishna River Basin / Amaravati / Vijayawada / Guntur Tactical Sector).
 */
export const PREDEFINED_ELP_DATABASE: Omit<ELPCandidate, 'distanceFromUavKm' | 'bearingFromUavDeg' | 'reachable' | 'estimatedDiversionTimeMinutes' | 'overallRisk' | 'score' | 'isSelected'>[] = [
  {
    id: 'ELP-01',
    name: 'Gannavaram Auxiliary Strip',
    lat: 16.5240,
    lon: 80.7850,
    elevationFt: 85,
    runwayLengthM: 1200,
    terrainSuitability: 'EXCELLENT',
    obstacleRisk: 'LOW',
    landingSuitability: 'HARD_RUNWAY'
  },
  {
    id: 'ELP-02',
    name: 'Krishna Riverbed Emergency Flat',
    lat: 16.5080,
    lon: 80.6120,
    elevationFt: 45,
    runwayLengthM: 850,
    terrainSuitability: 'GOOD',
    obstacleRisk: 'LOW',
    landingSuitability: 'UNPREPARED_FLAT'
  },
  {
    id: 'ELP-03',
    name: 'Mangalagiri Highway Straight Corridor',
    lat: 16.4420,
    lon: 80.5650,
    elevationFt: 75,
    runwayLengthM: 1400,
    terrainSuitability: 'GOOD',
    obstacleRisk: 'MEDIUM',
    landingSuitability: 'HARD_RUNWAY'
  },
  {
    id: 'ELP-04',
    name: 'Guntur Rural Agricultural Flat Field',
    lat: 16.3450,
    lon: 80.4620,
    elevationFt: 110,
    runwayLengthM: 600,
    terrainSuitability: 'FAIR',
    obstacleRisk: 'HIGH',
    landingSuitability: 'GRASS_STRIP'
  },
  {
    id: 'ELP-05',
    name: 'Amaravati Capital Open Reserve Sector',
    lat: 16.5410,
    lon: 80.5280,
    elevationFt: 60,
    runwayLengthM: 950,
    terrainSuitability: 'GOOD',
    obstacleRisk: 'LOW',
    landingSuitability: 'GRASS_STRIP'
  }
];

export class ELPManager {
  /**
   * Evaluates all ELP candidates relative to current UAV position, remaining RUL, SOH, and airspeed.
   * Disqualifies unreachable candidates and selects the safest reachable ELP using multi-criteria risk scoring.
   */
  public static evaluateELPs(
    uavLat: number,
    uavLon: number,
    airspeedKmh: number,
    rulHours: number,
    engineSOH: number,
    engineOn: boolean,
    existingSelectedId?: string
  ): EmergencyRecoveryState {
    const effectiveSpeed = Math.max(90.0, airspeedKmh > 30 ? airspeedKmh : 130.0);
    // Safe available endurance considering degraded propulsion capacity (hours)
    const safeEnduranceHours = Math.max(0.08, (rulHours * Math.max(0.25, engineSOH / 100.0)) * (engineOn ? 0.9 : 0.4));

    const evaluatedCandidates: ELPCandidate[] = PREDEFINED_ELP_DATABASE.map((base) => {
      const distKm = haversineDistanceKm(uavLat, uavLon, base.lat, base.lon);
      const bearingDeg = initialBearingDeg(uavLat, uavLon, base.lat, base.lon);
      const diversionMinutes = Math.max(1, Math.round((distKm / effectiveSpeed) * 60));
      const requiredHours = diversionMinutes / 60.0;

      // Reachability: Must be within safe glide/powered endurance and realistic range (< 40km)
      const reachable = requiredHours <= safeEnduranceHours && distKm <= 40.0;

      // Multi-criteria risk scoring
      // Lower score = higher safety & suitability
      const distanceFactor = distKm * 1.5;

      const terrainRiskScore = 
        base.terrainSuitability === 'EXCELLENT' ? 0 :
        base.terrainSuitability === 'GOOD' ? 6 :
        base.terrainSuitability === 'FAIR' ? 18 : 40;

      const obstacleRiskScore = 
        base.obstacleRisk === 'LOW' ? 0 :
        base.obstacleRisk === 'MEDIUM' ? 12 : 28;

      const landingSuitabilityScore = 
        base.landingSuitability === 'HARD_RUNWAY' ? 0 :
        base.landingSuitability === 'GRASS_STRIP' ? 8 : 16;

      const engineDegradationPenalty = (100 - engineSOH) * 0.15;
      const reachabilityPenalty = reachable ? 0 : 5000;

      const score = Number((
        distanceFactor +
        terrainRiskScore +
        obstacleRiskScore +
        landingSuitabilityScore +
        engineDegradationPenalty +
        reachabilityPenalty
      ).toFixed(1));

      let overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
      if (!reachable) {
        overallRisk = 'CRITICAL';
      } else if (score > 45 || base.obstacleRisk === 'HIGH') {
        overallRisk = 'HIGH';
      } else if (score > 25 || base.obstacleRisk === 'MEDIUM' || base.terrainSuitability === 'FAIR') {
        overallRisk = 'MEDIUM';
      } else {
        overallRisk = 'LOW';
      }

      return {
        ...base,
        distanceFromUavKm: Number(distKm.toFixed(2)),
        bearingFromUavDeg: Math.round(bearingDeg),
        reachable,
        estimatedDiversionTimeMinutes: diversionMinutes,
        overallRisk,
        score
      };
    });

    // Select candidate with minimum score among reachable candidates
    const reachableList = evaluatedCandidates.filter(c => c.reachable);
    
    let selected: ELPCandidate | null = null;
    if (existingSelectedId) {
      selected = evaluatedCandidates.find(c => c.id === existingSelectedId && c.reachable) || null;
    }

    if (!selected && reachableList.length > 0) {
      reachableList.sort((a, b) => a.score - b.score);
      selected = reachableList[0];
    } else if (!selected && evaluatedCandidates.length > 0) {
      // Fallback to closest candidate if none fully meet nominal reachability
      const sortedByDist = [...evaluatedCandidates].sort((a, b) => a.distanceFromUavKm - b.distanceFromUavKm);
      selected = sortedByDist[0];
    }

    if (selected) {
      evaluatedCandidates.forEach(c => {
        c.isSelected = c.id === selected!.id;
      });
    }

    return {
      isActive: true,
      triggerReason: 'Critical propulsion anomaly persisted continuously for 30 seconds in flight.',
      originalMissionAborted: true,
      selectedELP: selected,
      candidates: evaluatedCandidates,
      recoveryPhase: 'DIVERTING',
      diversionDistanceKm: selected ? selected.distanceFromUavKm : 0,
      diversionEtaMinutes: selected ? selected.estimatedDiversionTimeMinutes : 0,
      diversionProgressPercent: 0
    };
  }
}
