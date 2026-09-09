import React from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  Activity,
  Cpu,
  Clock,
  Gauge,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Timer,
  Zap,
  Check,
  Navigation,
  MapPin,
  Compass
} from 'lucide-react';
import { FaultState, FlightPhase, FlightState, MissionReliabilityState, SensorSuiteState } from '../types/simulation';
import { LocationCoord, Waypoint, ELPCandidate } from '../types/mission';

interface MissionReliabilityCardProps {
  reliability?: MissionReliabilityState;
  flight?: FlightState;
  sensors?: SensorSuiteState;
  fault?: FaultState;
  flightPhase: FlightPhase;
  engineOn: boolean;
  source: LocationCoord;
  destination: LocationCoord;
  activeWaypoints: Waypoint[];
}

export const MissionReliabilityCard: React.FC<MissionReliabilityCardProps> = ({
  reliability,
  flight,
  sensors,
  fault,
  flightPhase,
  engineOn,
  source,
  destination,
  activeWaypoints
}) => {
  const relScore = reliability?.reliabilityScore ?? (engineOn ? 98 : 99);
  const decision = reliability?.decision ?? 'GO';
  const riskLevel = reliability?.riskLevel ?? 'LOW';
  const decisionReason = reliability?.decisionReason || 'All engine health parameters nominal and mission endurance margin is adequate.';
  const engineSOH = reliability?.engineSOH ?? 99;
  const rulHours = reliability?.rulHours ?? 240.0;
  const faultRisk = reliability?.faultRiskPercent ?? 3;
  const anomalyScore = reliability?.anomalyScore ?? 0.04;
  
  // Authoritative mission parameters from central simulation state (ONE truth)
  const totalMissionDistKm = reliability?.totalMissionDistanceKm ?? 32.1;
  const estimatedFlightTimeMinutes = reliability?.estimatedFlightTimeMinutes ?? Math.max(1, Math.round((totalMissionDistKm / 145.0) * 60));
  const missionDemandHours = reliability?.missionDemandHours ?? Number((estimatedFlightTimeMinutes / 60.0).toFixed(2));
  const rulMarginHours = reliability?.rulMarginHours ?? Number((rulHours - missionDemandHours).toFixed(2));
  
  const enduranceCheck = reliability?.enduranceCheck ?? {
    status: rulHours >= missionDemandHours ? 'PASS' : 'FAIL',
    requiredHours: missionDemandHours,
    rulHours: rulHours,
    marginHours: rulMarginHours,
    details: `Margin +${rulMarginHours} h`
  };

  const healthCheck = reliability?.healthCheck ?? {
    status: fault?.activeFault === 'NORMAL' || !fault ? 'PASS' : 'CRITICAL',
    faultName: fault?.activeFault || 'NORMAL',
    faultSeverity: fault?.severity || 'NONE',
    details: 'All engine parameters nominal'
  };

  const riskCheck = reliability?.riskCheck ?? {
    status: faultRisk > 60 ? 'FAIL' : faultRisk > 30 ? 'ELEVATED' : 'PASS',
    riskScorePercent: faultRisk,
    details: `Operational risk ${faultRisk}%`
  };

  const criticalPersistenceSec = reliability?.criticalPersistenceSeconds ?? 0;
  const isCriticalPersistenceActive = criticalPersistenceSec > 0 && criticalPersistenceSec < 30;
  const emergencyRecovery = reliability?.emergencyRecovery;
  const isEmergencyRecovery = decision === 'EMERGENCY RECOVERY' || reliability?.emergencyRecoveryTriggered || flightPhase === 'EMERGENCY_DIVERT' || flightPhase === 'RECOVERY_APPROACH' || flightPhase === 'RECOVERED';
  const isRecovered = flightPhase === 'RECOVERED';

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 shadow-sm flex flex-col justify-between space-y-3.5">
      
      {/* 1. Header & Badges */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center text-[#F97316]">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-[#1F2937] uppercase tracking-tight">
                MISSION RELIABILITY & DECISION
              </h2>
              <div className="text-[10.5px] text-[#6B7280]">
                Physics-Inspired Prognostics &bull; Multi-Gate Safety Engine
              </div>
            </div>
          </div>

          <span className="text-[9.5px] font-mono font-bold bg-slate-100 text-slate-800 px-2.5 py-1 rounded border border-slate-300">
            PHASE: {flightPhase}
          </span>
        </div>

        {/* 2. Prominent MISSION DECISION Banner (GO / CAUTION / NO-GO / EMERGENCY RECOVERY) */}
        <div className={`rounded-xl p-3.5 text-white shadow-sm flex items-center justify-between transition-all ${
          isRecovered
            ? 'bg-gradient-to-r from-emerald-600 via-teal-700 to-emerald-800 border border-emerald-400'
            : isEmergencyRecovery
            ? 'bg-gradient-to-r from-red-700 via-rose-800 to-red-900 border border-red-500 animate-pulse'
            : decision === 'GO'
            ? 'bg-gradient-to-r from-emerald-600 to-emerald-700'
            : decision === 'CAUTION'
            ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950'
            : 'bg-gradient-to-r from-red-600 to-red-700'
        }`}>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-90">
              MISSION DECISION
            </div>
            <div className="text-xl font-black tracking-tight flex items-center gap-2 mt-0.5">
              {decision === 'GO' && !isRecovered && <ShieldCheck className="w-5 h-5 text-emerald-100" />}
              {decision === 'CAUTION' && <AlertTriangle className="w-5 h-5 text-slate-950" />}
              {decision === 'NO-GO' && <AlertOctagon className="w-5 h-5 animate-pulse" />}
              {isEmergencyRecovery && !isRecovered && <Zap className="w-5 h-5 text-yellow-300 animate-bounce" />}
              {isRecovered && <CheckCircle2 className="w-5 h-5 text-emerald-200" />}
              <span>{isRecovered ? 'MISSION RECOVERED' : isEmergencyRecovery ? 'EMERGENCY RECOVERY' : decision}</span>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-90">
              RELIABILITY
            </div>
            <div className="text-xl font-black font-mono mt-0.5">
              {relScore}%
            </div>
          </div>
        </div>

        {/* In-Flight Critical Persistence Countdown Banner */}
        {isCriticalPersistenceActive && !isEmergencyRecovery && (
          <div className="bg-red-50 border border-red-300 rounded-xl p-2.5 space-y-1 text-xs">
            <div className="flex items-center justify-between font-bold text-red-700">
              <span className="flex items-center gap-1.5">
                <Timer className="w-3.5 h-3.5 animate-spin" />
                <span>IN-FLIGHT CRITICAL PERSISTENCE</span>
              </span>
              <span className="font-mono bg-red-100 px-2 py-0.5 rounded text-[11px] border border-red-300">
                {Math.floor(criticalPersistenceSec)} / 30 sec
              </span>
            </div>
            <div className="w-full bg-red-200 h-1.5 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-600 transition-all duration-200"
                style={{ width: `${Math.min(100, (criticalPersistenceSec / 30) * 100)}%` }}
              />
            </div>
            <div className="text-[10px] text-red-600 leading-tight">
              Continuous propulsion failure active in flight. At 30 continuous seconds, emergency recovery is initiated.
            </div>
          </div>
        )}

        {/* 3. Concise Engineering Decision Reasoning */}
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-2.5 space-y-1">
          <div className="text-[10px] font-bold text-[#475569] uppercase flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-[#F97316]" />
            <span>DECISION REASONING:</span>
          </div>
          <p className="text-xs font-medium text-[#1E293B] leading-snug">
            {decisionReason}
          </p>
        </div>
      </div>

      {/* 4. EMERGENCY RECOVERY & ELP CANDIDATES VIEW (When Recovery is Active) */}
      {isEmergencyRecovery && emergencyRecovery && (
        <div className="bg-rose-50/70 border border-rose-300 rounded-xl p-3 space-y-2 text-xs">
          <div className="flex items-center justify-between border-b border-rose-200 pb-1.5">
            <span className="font-extrabold text-rose-900 uppercase flex items-center gap-1.5 text-[11px]">
              <AlertOctagon className="w-4 h-4 text-rose-600" />
              <span>EMERGENCY DIVERSION TO SAFEST ELP</span>
            </span>
            <span className="text-[9px] font-mono font-bold bg-rose-200 text-rose-900 px-2 py-0.5 rounded">
              ORIGINAL MISSION ABORTED
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="text-[10px] font-bold text-slate-700 uppercase">
              EVALUATED EMERGENCY LANDING POINTS (ELPs):
            </div>

            <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
              {emergencyRecovery.candidates.map((elp) => (
                <div
                  key={elp.id}
                  className={`p-2 rounded-lg border text-[10.5px] flex items-center justify-between transition-all ${
                    elp.isSelected
                      ? 'bg-emerald-100/80 border-emerald-400 text-emerald-950 font-bold shadow-xs'
                      : elp.reachable
                      ? 'bg-white border-slate-200 text-slate-700'
                      : 'bg-gray-100 border-gray-200 text-gray-400 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${elp.isSelected ? 'bg-emerald-600' : elp.reachable ? 'bg-amber-500' : 'bg-red-500'}`} />
                    <div>
                      <div className="font-bold flex items-center gap-1.5">
                        <span>{elp.id}: {elp.name}</span>
                        {elp.isSelected && (
                          <span className="bg-emerald-600 text-white text-[8.5px] px-1.5 py-0.2 rounded font-mono font-bold">
                            SELECTED
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] text-slate-500">
                        {elp.distanceFromUavKm} km &bull; ~{elp.estimatedDiversionTimeMinutes} min &bull; {elp.landingSuitability.replace(/_/g, ' ')}
                      </div>
                    </div>
                  </div>

                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                    elp.reachable
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-red-50 text-red-800 border-red-300'
                  }`}>
                    {elp.reachable ? 'REACHABLE' : 'UNREACHABLE'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 5. Multi-Factor Separate Check Cards */}
      <div className="space-y-1.5">
        <div className="text-[10.5px] font-bold text-[#4B5563] uppercase tracking-wider flex items-center justify-between">
          <span>MISSION SAFETY & READINESS CHECKS</span>
          <span className="text-[9.5px] font-normal text-slate-500">Separated Prognostic & Health Gates</span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          
          {/* CHECK A: ENDURANCE CHECK */}
          <div className={`rounded-xl p-2.5 border space-y-1 flex flex-col justify-between ${
            enduranceCheck.status === 'PASS'
              ? 'bg-emerald-50/50 border-emerald-200'
              : enduranceCheck.status === 'MARGINAL'
              ? 'bg-amber-50/50 border-amber-200'
              : 'bg-red-50/50 border-red-200'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase text-slate-700">ENDURANCE</span>
              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                enduranceCheck.status === 'PASS'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : enduranceCheck.status === 'MARGINAL'
                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                  : 'bg-red-100 text-red-800 border-red-300'
              }`}>
                {enduranceCheck.status}
              </span>
            </div>
            <div className="space-y-0.5 text-[10px] text-slate-600 font-mono">
              <div className="flex justify-between">
                <span>Demand:</span>
                <span className="font-bold text-slate-900">{missionDemandHours} h</span>
              </div>
              <div className="flex justify-between">
                <span>RUL:</span>
                <span className="font-bold text-cyan-700">{rulHours} h</span>
              </div>
              <div className="flex justify-between pt-0.5 border-t border-slate-200/80">
                <span>Margin:</span>
                <span className={`font-black ${rulMarginHours >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {rulMarginHours >= 0 ? `+${rulMarginHours}` : rulMarginHours} h
                </span>
              </div>
            </div>
          </div>

          {/* CHECK B: CURRENT HEALTH CHECK */}
          <div className={`rounded-xl p-2.5 border space-y-1 flex flex-col justify-between ${
            healthCheck.status === 'PASS' || healthCheck.status === 'NORMAL'
              ? 'bg-emerald-50/50 border-emerald-200'
              : healthCheck.status === 'WARNING'
              ? 'bg-yellow-50/60 border-yellow-300'
              : healthCheck.status === 'DEGRADED'
              ? 'bg-amber-50/50 border-amber-200'
              : 'bg-red-50/50 border-red-200'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase text-slate-700">HEALTH</span>
              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                healthCheck.status === 'PASS' || healthCheck.status === 'NORMAL'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : healthCheck.status === 'WARNING'
                  ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                  : healthCheck.status === 'DEGRADED'
                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                  : 'bg-red-100 text-red-800 border-red-300'
              }`}>
                {healthCheck.status}
              </span>
            </div>
            <div className="space-y-0.5 text-[10px] text-slate-600 font-mono">
              <div className="flex justify-between">
                <span>SOH:</span>
                <span className="font-bold text-emerald-700">{engineSOH}%</span>
              </div>
              <div className="truncate text-[9.5px]" title={healthCheck.faultName}>
                <span>Fault: </span>
                <span className="font-bold text-slate-900">{healthCheck.faultName.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex justify-between pt-0.5 border-t border-slate-200/80 text-[9.5px]">
                <span>Severity:</span>
                <span className={`font-bold ${healthCheck.faultSeverity === 'HIGH' || healthCheck.faultSeverity === 'CRITICAL' ? 'text-red-600' : 'text-slate-700'}`}>
                  {healthCheck.faultSeverity}
                </span>
              </div>
            </div>
          </div>

          {/* CHECK C: RISK CHECK */}
          <div className={`rounded-xl p-2.5 border space-y-1 flex flex-col justify-between ${
            riskCheck.status === 'PASS'
              ? 'bg-emerald-50/50 border-emerald-200'
              : riskCheck.status === 'ELEVATED'
              ? 'bg-amber-50/50 border-amber-200'
              : 'bg-red-50/50 border-red-200'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase text-slate-700">MISSION RISK</span>
              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                riskCheck.status === 'PASS'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : riskCheck.status === 'ELEVATED'
                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                  : 'bg-red-100 text-red-800 border-red-300'
              }`}>
                {riskCheck.status}
              </span>
            </div>
            <div className="space-y-0.5 text-[10px] text-slate-600 font-mono">
              <div className="flex justify-between">
                <span>Fault Risk:</span>
                <span className={`font-bold ${faultRisk > 30 ? 'text-amber-600' : 'text-slate-900'}`}>{faultRisk}%</span>
              </div>
              <div className="flex justify-between">
                <span>Anomaly:</span>
                <span className="font-bold text-purple-700">{anomalyScore}</span>
              </div>
              <div className="flex justify-between pt-0.5 border-t border-slate-200/80">
                <span>Level:</span>
                <span className={`font-black ${riskLevel === 'CRITICAL' ? 'text-red-700' : riskLevel === 'HIGH' ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {riskLevel}
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* 6. Authoritative MISSION DEMAND VS ENGINE CAPABILITY BAR */}
      <div className="bg-slate-900 text-white rounded-xl p-3 font-mono text-xs space-y-1.5 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1 text-[10px]">
          <span className="text-slate-400 font-bold uppercase">
            {isEmergencyRecovery ? 'EMERGENCY RECOVERY ENDURANCE MARGIN' : 'AUTHORITATIVE MISSION DEMAND & CAPABILITY'}
          </span>
          <span className="text-emerald-400 font-bold">{totalMissionDistKm} km &bull; ~{estimatedFlightTimeMinutes} min</span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center pt-0.5">
          <div className="bg-slate-800/80 p-1.5 rounded-lg">
            <div className="text-slate-400 text-[9px] uppercase">MISSION DEMAND</div>
            <div className="text-sm font-black text-amber-300">{missionDemandHours} h</div>
            <div className="text-[8.5px] text-slate-400">~{estimatedFlightTimeMinutes} min</div>
          </div>
          <div className="bg-slate-800/80 p-1.5 rounded-lg">
            <div className="text-slate-400 text-[9px] uppercase">ENGINE RUL</div>
            <div className="text-sm font-black text-cyan-300">{rulHours} h</div>
            <div className="text-[8.5px] text-slate-400">Prognostic Life</div>
          </div>
          <div className="bg-slate-800/80 p-1.5 rounded-lg">
            <div className="text-slate-400 text-[9px] uppercase">RUL MARGIN</div>
            <div className={`text-sm font-black ${rulMarginHours >= 0.5 ? 'text-emerald-400' : 'text-red-400'}`}>
              {rulMarginHours >= 0 ? `+${rulMarginHours}` : rulMarginHours} h
            </div>
            <div className="text-[8.5px] text-slate-400">RUL - Demand</div>
          </div>
        </div>
      </div>

    </div>
  );
};
