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
  TrendingUp
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
  const decisionReason = reliability?.decisionReason || 'Engine health is within operating limits and predicted endurance exceeds the planned mission requirement.';
  const engineSOH = reliability?.engineSOH ?? 99;
  const rulHours = reliability?.rulHours ?? 237.5;
  const faultRisk = reliability?.faultRiskPercent ?? 3;
  const anomalyScore = reliability?.anomalyScore ?? 0.04;
  
  const totalMissionDistKm = reliability?.totalMissionDistanceKm ?? 32.1;
  const cruiseSpeedKmh = 145.0;
  const missionDemandHours = Number((totalMissionDistKm / cruiseSpeedKmh).toFixed(1));
  const availableMarginHours = Number(Math.max(0, rulHours - missionDemandHours).toFixed(1));
  const marginDiffHours = Number((rulHours - missionDemandHours).toFixed(1));

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 shadow-sm flex flex-col justify-between space-y-4">
      
      {/* 1. Header & Badges (Requirement 9) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center text-[#F97316]">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-[#1F2937] uppercase tracking-tight">
                MISSION RELIABILITY & HEALTH
              </h2>
              <div className="text-[11px] text-[#6B7280]">
                Physics Digital Twin &bull; Mission-Aware Decision
              </div>
            </div>
          </div>

          <span className="text-[9.5px] font-mono font-bold bg-slate-100 text-slate-800 px-2.5 py-1 rounded border border-slate-300">
            PHASE: {flightPhase}
          </span>
        </div>

        {/* 2. Prominent MISSION DECISION Banner (GO / CAUTION / NO-GO) */}
        <div className={`rounded-xl p-4 text-white shadow-sm flex items-center justify-between transition-all ${
          decision === 'GO'
            ? 'bg-gradient-to-r from-emerald-600 to-emerald-700'
            : decision === 'CAUTION'
            ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950'
            : 'bg-gradient-to-r from-red-600 to-red-700'
        }`}>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-90">
              MISSION DECISION
            </div>
            <div className="text-2xl font-black tracking-tight flex items-center gap-2 mt-0.5">
              {decision === 'GO' && <ShieldCheck className="w-6 h-6" />}
              {decision === 'CAUTION' && <AlertTriangle className="w-6 h-6 text-slate-950" />}
              {decision === 'NO-GO' && <AlertOctagon className="w-6 h-6 animate-pulse" />}
              <span>{decision}</span>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-90">
              RELIABILITY
            </div>
            <div className="text-2xl font-black font-mono mt-0.5">
              {relScore}%
            </div>
          </div>
        </div>

        {/* 3. Concise Engineering Decision Reasoning ("WHY?") (Requirement 10) */}
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 space-y-1">
          <div className="text-[10px] font-bold text-[#475569] uppercase flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-[#F97316]" />
            <span>DECISION REASONING:</span>
          </div>
          <p className="text-xs font-medium text-[#1E293B] leading-relaxed">
            {decisionReason}
          </p>
        </div>
      </div>

      {/* 4. Clean 2x2 Core Health Metrics Grid (Requirement 9) */}
      <div className="space-y-2">
        <div className="text-[10.5px] font-bold text-[#4B5563] uppercase tracking-wider">
          ENGINE STATE OF HEALTH & RISK
        </div>

        <div className="grid grid-cols-2 gap-2.5 text-xs">
          
          {/* ENGINE SOH */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-[#64748B] font-bold">
              <span>ENGINE SOH</span>
              <span className="text-emerald-600 font-mono font-black">{engineSOH}%</span>
            </div>
            <div className="w-full bg-[#E2E8F0] h-2 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  engineSOH >= 80 ? 'bg-emerald-500' : engineSOH >= 50 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${engineSOH}%` }}
              />
            </div>
          </div>

          {/* REMAINING LIFE (RUL) */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 space-y-1">
            <div className="text-[10px] text-[#64748B] font-bold uppercase">REMAINING LIFE</div>
            <div className="text-base font-black font-mono text-cyan-700">
              {rulHours} <span className="text-[11px] font-semibold text-slate-500">hours</span>
            </div>
          </div>

          {/* FAULT RISK */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 space-y-1">
            <div className="text-[10px] text-[#64748B] font-bold uppercase">FAULT RISK</div>
            <div className={`text-base font-black font-mono ${faultRisk > 30 ? 'text-amber-600' : 'text-slate-800'}`}>
              {faultRisk}%
            </div>
          </div>

          {/* ANOMALY SCORE */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 space-y-1">
            <div className="text-[10px] text-[#64748B] font-bold uppercase">ANOMALY SCORE</div>
            <div className={`text-base font-black font-mono ${anomalyScore > 0.4 ? 'text-purple-600' : 'text-slate-800'}`}>
              {anomalyScore}
            </div>
          </div>
        </div>
      </div>

      {/* 5. MISSION DEMAND VS ENGINE CAPABILITY (Requirements 11, 12) */}
      <div className="bg-slate-900 text-white rounded-xl p-3.5 font-mono text-xs space-y-2">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
          <span className="text-slate-400 font-bold uppercase text-[10px]">MISSION DEMAND VS CAPABILITY</span>
          <span className="text-emerald-400 font-bold">{totalMissionDistKm} km</span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center pt-1">
          <div className="bg-slate-800/80 p-2 rounded-lg">
            <div className="text-slate-400 text-[9.5px]">MISSION DEMAND</div>
            <div className="text-sm font-black text-amber-300">{missionDemandHours} h</div>
          </div>
          <div className="bg-slate-800/80 p-2 rounded-lg">
            <div className="text-slate-400 text-[9.5px]">ENGINE RUL</div>
            <div className="text-sm font-black text-cyan-300">{rulHours} h</div>
          </div>
          <div className="bg-slate-800/80 p-2 rounded-lg">
            <div className="text-slate-400 text-[9.5px]">MARGIN</div>
            <div className={`text-sm font-black ${marginDiffHours >= 1.0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {marginDiffHours >= 0 ? `+${marginDiffHours}` : marginDiffHours} h
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
