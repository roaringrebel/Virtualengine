import React from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  Activity,
  Cpu,
  CheckCircle2,
  Timer,
  Zap,
  HelpCircle,
  Play
} from 'lucide-react';
import { FaultState, FlightPhase, FlightState, MissionReliabilityState, SensorSuiteState } from '../types/simulation';
import { LocationCoord, Waypoint } from '../types/mission';

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
  flightPhase,
  engineOn,
}) => {
  // Parked & Completion State Determinations
  const isParked = reliability?.isParked ?? (!engineOn || flightPhase === 'PARKED' || flightPhase === 'STANDBY');
  const isRecovered = flightPhase === 'RECOVERED';
  const isCompleted = (flightPhase === 'COMPLETED' || reliability?.isCompleted) && !isRecovered;

  const decision = reliability?.decision ?? (isParked ? 'GO' : 'GO');
  const riskLevel = reliability?.riskLevel ?? (isParked ? 'LOW' : 'LOW');
  const decisionReason = reliability?.decisionReason || (isParked 
    ? 'Engine in standby. Reliability assessment will activate when the mission starts.'
    : 'All engine health parameters nominal and mission endurance margin is adequate.');
  
  const relScore = reliability?.reliabilityScore ?? 99;
  const engineSOH = reliability?.engineSOH ?? 99;
  const rulHours = reliability?.rulHours ?? 240.0;
  const faultRisk = reliability?.faultRiskPercent ?? 0;
  const anomalyScore = reliability?.anomalyScore ?? 0.00;
  
  // Authoritative mission parameters from central simulation state (ONE truth)
  const totalMissionDistKm = reliability?.totalMissionDistanceKm ?? 32.1;
  const estimatedFlightTimeMinutes = reliability?.estimatedFlightTimeMinutes ?? Math.max(1, Math.round((totalMissionDistKm / 145.0) * 60));
  const missionDemandHours = reliability?.missionDemandHours ?? Number((estimatedFlightTimeMinutes / 60.0).toFixed(2));
  const rulMarginHours = reliability?.rulMarginHours ?? Number((rulHours - missionDemandHours).toFixed(2));
  
  const enduranceCheck = reliability?.enduranceCheck ?? {
    status: isParked ? 'PASS' : rulHours >= missionDemandHours ? 'PASS' : 'FAIL',
    requiredHours: missionDemandHours,
    rulHours: rulHours,
    marginHours: rulMarginHours,
    details: isParked ? 'READY' : `Margin +${rulMarginHours} h`
  };

  const healthCheck = reliability?.healthCheck ?? {
    status: 'NORMAL',
    faultName: 'NORMAL',
    faultSeverity: 'NONE',
    details: isParked ? 'BASELINE' : 'All engine parameters nominal'
  };

  const riskCheck = reliability?.riskCheck ?? {
    status: 'PASS',
    riskScorePercent: isParked ? 0 : faultRisk,
    details: isParked ? 'NOT ACTIVE' : `Operational risk ${faultRisk}%`
  };

  const criticalPersistenceSec = reliability?.criticalPersistenceSeconds ?? 0;
  const isCriticalPersistenceActive = criticalPersistenceSec > 0 && criticalPersistenceSec < 30;
  const emergencyRecovery = reliability?.emergencyRecovery;
  const isEmergencyRecovery = decision === 'EMERGENCY RECOVERY' || reliability?.emergencyRecoveryTriggered || flightPhase === 'EMERGENCY_DIVERT' || flightPhase === 'RECOVERY_APPROACH';

  // Format decision text for prominent banner
  let decisionDisplayText = 'READY';
  if (isRecovered) {
    decisionDisplayText = 'MISSION RECOVERED';
  } else if (isCompleted) {
    decisionDisplayText = 'MISSION COMPLETED';
  } else if (isEmergencyRecovery) {
    decisionDisplayText = 'EMERGENCY RECOVERY';
  } else if (isParked) {
    decisionDisplayText = 'READY';
  } else {
    decisionDisplayText = decision;
  }

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

        {/* 2. Prominent MISSION DECISION Banner */}
        <div className={`rounded-xl p-3.5 text-white shadow-sm flex items-center justify-between transition-all ${
          isRecovered
            ? 'bg-gradient-to-r from-emerald-600 via-teal-700 to-emerald-800 border border-emerald-400'
            : isCompleted
            ? 'bg-gradient-to-r from-emerald-700 to-teal-800 border border-emerald-500'
            : isEmergencyRecovery
            ? 'bg-gradient-to-r from-red-700 via-rose-800 to-red-900 border border-red-500 animate-pulse'
            : isParked
            ? 'bg-gradient-to-r from-slate-700 to-slate-800 border border-slate-600'
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
              {isParked && <Play className="w-5 h-5 text-amber-300" />}
              {!isParked && decision === 'GO' && !isRecovered && !isCompleted && <ShieldCheck className="w-5 h-5 text-emerald-100" />}
              {!isParked && decision === 'CAUTION' && <AlertTriangle className="w-5 h-5 text-slate-950" />}
              {!isParked && decision === 'NO-GO' && !isEmergencyRecovery && <AlertOctagon className="w-5 h-5 animate-pulse" />}
              {isEmergencyRecovery && !isRecovered && <Zap className="w-5 h-5 text-yellow-300 animate-bounce" />}
              {(isRecovered || isCompleted) && <CheckCircle2 className="w-5 h-5 text-emerald-200" />}
              <span>{decisionDisplayText}</span>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-90 flex items-center justify-end gap-1" title="Composite mission reliability derived from current engine health, fault risk, anomaly level and mission endurance.">
              <span>RELIABILITY</span>
              <HelpCircle className="w-2.5 h-2.5 opacity-75" />
            </div>
            <div className="text-xl font-black font-mono mt-0.5">
              {isParked ? 'READY' : `${relScore}%`}
            </div>
          </div>
        </div>

        {/* Reliability Explanatory Subtext */}
        <div className="text-[9px] text-[#64748B] italic text-right -mt-1 px-1">
          Composite mission reliability derived from current engine health, fault risk, anomaly level and mission endurance.
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

      {/* 5. Multi-Factor Separate Safety & Readiness Checks */}
      <div className="space-y-1.5">
        <div className="text-[10.5px] font-bold text-[#4B5563] uppercase tracking-wider flex items-center justify-between">
          <span>MISSION SAFETY & READINESS CHECKS</span>
          <span className="text-[9.5px] font-normal text-slate-500">Separated Prognostic & Health Gates</span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          
          {/* CHECK A: ENDURANCE CHECK */}
          <div className={`rounded-xl p-2.5 border space-y-1 flex flex-col justify-between ${
            isParked
              ? 'bg-slate-50 border-slate-200'
              : enduranceCheck.status === 'PASS'
              ? 'bg-emerald-50/50 border-emerald-200'
              : enduranceCheck.status === 'MARGINAL'
              ? 'bg-amber-50/50 border-amber-200'
              : 'bg-red-50/50 border-red-200'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase text-slate-700">ENDURANCE</span>
              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                isParked
                  ? 'bg-slate-100 text-slate-700 border-slate-300'
                  : enduranceCheck.status === 'PASS'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : enduranceCheck.status === 'MARGINAL'
                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                  : 'bg-red-100 text-red-800 border-red-300'
              }`}>
                {isParked ? 'READY' : enduranceCheck.status}
              </span>
            </div>
            <div className="space-y-0.5 text-[10px] text-slate-600 font-mono">
              <div className="flex justify-between">
                <span>Demand:</span>
                <span className="font-bold text-slate-900">{missionDemandHours} h</span>
              </div>
              <div className="flex justify-between">
                <span>RUL:</span>
                <span className="font-bold text-cyan-700">{isParked ? 'READY' : `${rulHours} h`}</span>
              </div>
              <div className="flex justify-between pt-0.5 border-t border-slate-200/80">
                <span>Margin:</span>
                <span className={`font-black ${isParked ? 'text-slate-700' : rulMarginHours >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {isParked ? `+${rulMarginHours} h` : rulMarginHours >= 0 ? `+${rulMarginHours} h` : `${rulMarginHours} h`}
                </span>
              </div>
            </div>
          </div>

          {/* CHECK B: CURRENT HEALTH CHECK */}
          <div className={`rounded-xl p-2.5 border space-y-1 flex flex-col justify-between ${
            isParked
              ? 'bg-slate-50 border-slate-200'
              : healthCheck.status === 'PASS' || healthCheck.status === 'NORMAL'
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
                isParked
                  ? 'bg-slate-100 text-slate-700 border-slate-300'
                  : healthCheck.status === 'PASS' || healthCheck.status === 'NORMAL'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : healthCheck.status === 'WARNING'
                  ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                  : healthCheck.status === 'DEGRADED'
                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                  : 'bg-red-100 text-red-800 border-red-300'
              }`}>
                {isParked ? 'BASELINE' : healthCheck.status}
              </span>
            </div>
            <div className="space-y-0.5 text-[10px] text-slate-600 font-mono">
              <div className="flex justify-between">
                <span>SOH:</span>
                <span className="font-bold text-emerald-700">{engineSOH}%</span>
              </div>
              <div className="truncate text-[9.5px]" title={healthCheck.faultName}>
                <span>Fault: </span>
                <span className="font-bold text-slate-900">{isParked ? 'NORMAL' : healthCheck.faultName.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex justify-between pt-0.5 border-t border-slate-200/80 text-[9.5px]">
                <span>Severity:</span>
                <span className={`font-bold ${healthCheck.faultSeverity === 'HIGH' || healthCheck.faultSeverity === 'CRITICAL' ? 'text-red-600' : 'text-slate-700'}`}>
                  {isParked ? 'NONE' : healthCheck.faultSeverity}
                </span>
              </div>
            </div>
          </div>

          {/* CHECK C: RISK CHECK */}
          <div className={`rounded-xl p-2.5 border space-y-1 flex flex-col justify-between ${
            isParked
              ? 'bg-slate-50 border-slate-200'
              : riskCheck.status === 'PASS'
              ? 'bg-emerald-50/50 border-emerald-200'
              : riskCheck.status === 'ELEVATED'
              ? 'bg-amber-50/50 border-amber-200'
              : 'bg-red-50/50 border-red-200'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase text-slate-700">MISSION RISK</span>
              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                isParked
                  ? 'bg-slate-100 text-slate-700 border-slate-300'
                  : riskCheck.status === 'PASS'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : riskCheck.status === 'ELEVATED'
                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                  : 'bg-red-100 text-red-800 border-red-300'
              }`}>
                {isParked ? 'NOT ACTIVE' : riskCheck.status}
              </span>
            </div>
            <div className="space-y-0.5 text-[10px] text-slate-600 font-mono">
              <div className="flex justify-between">
                <span>Fault Risk:</span>
                <span className={`font-bold ${faultRisk > 30 ? 'text-amber-600' : 'text-slate-900'}`}>{isParked ? '0%' : `${faultRisk}%`}</span>
              </div>
              <div className="flex justify-between">
                <span>Anomaly:</span>
                <span className="font-bold text-purple-700">{isParked ? '0.00' : anomalyScore.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-0.5 border-t border-slate-200/80">
                <span>Level:</span>
                <span className={`font-black ${isParked ? 'text-slate-600' : riskLevel === 'CRITICAL' ? 'text-red-700' : riskLevel === 'HIGH' ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {isParked ? 'NOT ACTIVE' : riskLevel}
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
            <div className="text-sm font-black text-cyan-300">{isParked ? 'READY' : `${rulHours} h`}</div>
            <div className="text-[8.5px] text-slate-400">{isParked ? 'Baseline: 240h' : 'Prognostic Life'}</div>
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
