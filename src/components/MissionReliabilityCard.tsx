import React from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  Activity,
  Clock,
  Compass,
  Mountain,
  Gauge,
  CheckCircle2,
  TrendingUp,
  Cpu,
  Radio
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
  const relScore = reliability?.reliabilityScore ?? (engineOn ? 94 : 98);
  const decision = reliability?.decision ?? 'GO';
  const riskLevel = reliability?.riskLevel ?? 'LOW';
  const decisionReason = reliability?.decisionReason || 'Nominal aero-propulsion and thermal equilibrium.';
  const engineSOH = reliability?.engineSOH ?? 94;
  const rulHours = reliability?.rulHours ?? 236.0;
  const faultRisk = reliability?.faultRiskPercent ?? 3;
  const missionMargin = reliability?.missionMarginHours ?? 4.2;
  const anomalyScore = reliability?.anomalyScore ?? 0.06;
  const progressPercent = reliability?.missionProgressPercent ?? (flight?.missionProgressPercent ?? 0);
  const distRemainingKm = reliability?.distanceRemainingKm ?? 18.2;
  const estTimeRem = reliability?.timeRemainingFormatted ?? '07:35';
  const routeDevKm = reliability?.routeDeviationKm ?? 0.15;
  const terrainElevFt = reliability?.terrainElevationFt ?? 80;
  const aglFt = reliability?.aglAltitudeFt ?? (flight ? Math.max(0, flight.altitude) : 0);

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-3.5 shadow-sm flex flex-col justify-between h-full space-y-3 overflow-y-auto">
      
      {/* 1. Header with Badge & Overall Score */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-orange-50 border border-orange-200 flex items-center justify-center text-[#F97316]">
              <Cpu className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-[#1F2937] uppercase tracking-tight">
                MISSION RELIABILITY & HEALTH
              </h2>
              <div className="text-[10px] text-[#6B7280]">
                Physics Digital Twin &bull; Mission-Aware Decision
              </div>
            </div>
          </div>

          <span className="text-[9px] font-mono font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-300">
            {flightPhase}
          </span>
        </div>

        {/* 2. Big Prominent Decision Banner (GO / CAUTION / NO-GO) */}
        <div className={`rounded-xl p-3 text-white shadow-md flex items-center justify-between transition-all ${
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
            <div className="text-2xl font-black tracking-tight flex items-center gap-2">
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
            <div className="text-2xl font-black font-mono">
              {relScore}%
            </div>
          </div>
        </div>

        {/* 3. Deterministic "WHY?" Reason Box */}
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-2.5 space-y-1">
          <div className="text-[9.5px] font-bold text-[#475569] uppercase flex items-center gap-1">
            <Activity className="w-3 h-3 text-[#F97316]" />
            <span>DECISION REASONING ("WHY?"):</span>
          </div>
          <p className="text-[10.5px] font-medium text-[#1E293B] leading-relaxed">
            {decisionReason}
          </p>
        </div>
      </div>

      {/* 4. Core Digital Twin Metrics Breakdown Grid */}
      <div className="space-y-2">
        <div className="text-[10px] font-bold text-[#4B5563] uppercase tracking-wider flex items-center justify-between">
          <span>HEALTH & LIFE METRICS</span>
          <span className="text-slate-400 font-normal">Rotax 912 ULS</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          
          {/* Engine SOH */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-2 space-y-1">
            <div className="flex items-center justify-between text-[9px] text-[#64748B] font-bold">
              <span>ENGINE SOH</span>
              <span className="text-emerald-600 font-mono">{engineSOH}%</span>
            </div>
            <div className="w-full bg-[#E2E8F0] h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  engineSOH >= 80 ? 'bg-emerald-500' : engineSOH >= 50 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${engineSOH}%` }}
              />
            </div>
          </div>

          {/* RUL vs Mission Time */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-2 space-y-0.5">
            <div className="text-[9px] text-[#64748B] font-bold">REMAINING LIFE (RUL)</div>
            <div className="text-sm font-black font-mono text-cyan-600">
              {rulHours} <span className="text-[10px] font-semibold text-slate-500">hours</span>
            </div>
            <div className="text-[8.5px] text-slate-500">Margin: +{missionMargin}h</div>
          </div>

          {/* Fault Risk */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-2 space-y-0.5">
            <div className="text-[9px] text-[#64748B] font-bold">FAULT RISK</div>
            <div className={`text-sm font-black font-mono ${faultRisk > 30 ? 'text-amber-600' : 'text-slate-800'}`}>
              {faultRisk}%
            </div>
            <div className="text-[8.5px] text-slate-500">
              Active: {fault?.activeFault === 'NORMAL' ? 'Nominal' : fault?.activeFault}
            </div>
          </div>

          {/* Sensor Anomaly Score */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-2 space-y-0.5">
            <div className="text-[9px] text-[#64748B] font-bold">ANOMALY SCORE</div>
            <div className={`text-sm font-black font-mono ${anomalyScore > 0.4 ? 'text-purple-600' : 'text-slate-800'}`}>
              {anomalyScore}
            </div>
            <div className="text-[8.5px] text-slate-500">Range: 0.02 - 0.98</div>
          </div>
        </div>
      </div>

      {/* 5. Navigation & Flight Track Deviation */}
      <div className="bg-slate-900 text-white rounded-lg p-2.5 font-mono text-[10px] space-y-1.5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1">
          <span className="text-slate-400 font-bold uppercase text-[9px]">MISSION TRACK & PROGRESS</span>
          <span className="text-orange-400 font-bold">{progressPercent}%</span>
        </div>

        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[9.5px]">
          <div className="text-slate-400">REMAINING DIST:</div>
          <div className="text-right text-white font-bold">{distRemainingKm} km</div>

          <div className="text-slate-400">EST. TIME REM (ETA):</div>
          <div className="text-right text-emerald-400 font-bold">{estTimeRem}</div>

          <div className="text-slate-400">ROUTE DEVIATION:</div>
          <div className={`text-right font-bold ${routeDevKm > 0.6 ? 'text-red-400 animate-pulse' : 'text-cyan-300'}`}>
            {routeDevKm} km ({routeDevKm > 0.6 ? 'CAUTION' : 'ON ROUTE'})
          </div>

          <div className="text-slate-400">TERRAIN / AGL:</div>
          <div className="text-right text-amber-300 font-bold">
            {terrainElevFt}ft / {aglFt}ft AGL
          </div>
        </div>
      </div>

      {/* 6. Live 9 Sensor Quick Snapshot */}
      {sensors && (
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-2 space-y-1">
          <div className="text-[9px] font-bold text-[#475569] uppercase flex items-center justify-between">
            <span>9 VIRTUAL ENGINE SENSORS SNAPSHOT</span>
            <span className="text-emerald-600 font-mono text-[8px] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              LIVE
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1 text-[9px] font-mono">
            <div className="bg-white p-1 rounded border border-slate-200">
              <div className="text-slate-400 text-[7.5px]">RPM</div>
              <div className="font-bold text-slate-900">{sensors.rpm.value}</div>
            </div>
            <div className="bg-white p-1 rounded border border-slate-200">
              <div className="text-slate-400 text-[7.5px]">CHT</div>
              <div className="font-bold text-orange-600">{sensors.cht.value.toFixed(1)}°C</div>
            </div>
            <div className="bg-white p-1 rounded border border-slate-200">
              <div className="text-slate-400 text-[7.5px]">EGT</div>
              <div className="font-bold text-red-600">{sensors.egt.value.toFixed(0)}°C</div>
            </div>
            <div className="bg-white p-1 rounded border border-slate-200">
              <div className="text-slate-400 text-[7.5px]">OIL PRESS</div>
              <div className="font-bold text-cyan-700">{sensors.oilPressure.value.toFixed(2)} bar</div>
            </div>
            <div className="bg-white p-1 rounded border border-slate-200">
              <div className="text-slate-400 text-[7.5px]">OIL TEMP</div>
              <div className="font-bold text-amber-600">{sensors.oilTemperature.value.toFixed(1)}°C</div>
            </div>
            <div className="bg-white p-1 rounded border border-slate-200">
              <div className="text-slate-400 text-[7.5px]">VIBRATION</div>
              <div className={`font-bold ${sensors.vibration.value > 5.0 ? 'text-red-600' : 'text-slate-900'}`}>
                {sensors.vibration.value.toFixed(2)} mm/s
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
