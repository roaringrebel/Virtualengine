import React, { useState } from 'react';
import { 
  Settings as SettingsIcon, 
  Globe, 
  Server, 
  Activity, 
  Cpu, 
  Sliders, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  Zap, 
  Radio, 
  Compass, 
  Flame,
  Gauge
} from 'lucide-react';
import { FlightDebugPanel } from './FlightDebugPanel';
import { FlightState, NavigationMode } from '../types/simulation';

interface SettingsViewProps {
  apiEndpoint: string;
  onUpdateEndpoint: (endpoint: string) => void;
  speedMultiplier: number;
  onUpdateSpeed: (speed: number) => void;
  sensorNoiseEnabled: boolean;
  onToggleNoise: (enabled: boolean) => void;
  flight?: FlightState;
  enginePowerHp?: number;
  efficiencyLossRatio?: number;
  simTimeSeconds?: number;
  navigationMode?: NavigationMode;
  engineOn?: boolean;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  apiEndpoint,
  onUpdateEndpoint,
  speedMultiplier,
  onUpdateSpeed,
  sensorNoiseEnabled,
  onToggleNoise,
  flight,
  enginePowerHp = 100,
  efficiencyLossRatio = 0,
  simTimeSeconds = 0,
  navigationMode = 'WAYPOINT_ROUTE',
  engineOn = false
}) => {
  const [endpointInput, setEndpointInput] = useState(apiEndpoint);
  const [showAdvancedDebug, setShowAdvancedDebug] = useState(false);
  const [safetyStandard, setSafetyStandard] = useState<'MIL_SPEC' | 'DEFENCE_STRICT' | 'STANDARD'>('MIL_SPEC');
  const [elpAutoDivert, setElpAutoDivert] = useState(true);

  const handleSaveEndpoint = (val: string) => {
    setEndpointInput(val);
    onUpdateEndpoint(val);
  };

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 shadow-sm space-y-4">
      
      {/* 1. Header */}
      <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center text-[#F97316]">
            <SettingsIcon className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-black text-[#1F2937] tracking-tight uppercase">
              SIMULATOR & MISSION RELIABILITY CONFIGURATION
            </h2>
            <div className="text-[11px] text-[#6B7280]">
              Telemetry Integrations &bull; Multi-Gate Safety Engine &bull; Physics Calibration
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[9.5px] font-mono font-bold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded border border-emerald-300">
            SYSTEM RELIABILITY: OPTIMIZED
          </span>
          <span className="text-[9.5px] font-mono font-bold bg-slate-100 text-slate-800 px-2.5 py-1 rounded border border-slate-300">
            DRDO CONFIG v2.5
          </span>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        
        {/* LEFT COLUMN: TELEMETRY ENDPOINT & RUNTIME CONTROLS */}
        <div className="col-span-12 lg:col-span-6 space-y-4">
          
          {/* SECTION A: DIGITAL TWIN TELEMETRY ENDPOINT */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#1E293B] uppercase flex items-center gap-1.5">
                <Server className="w-4 h-4 text-[#F97316]" />
                <span>TELEMETRY API ENDPOINT</span>
              </span>
              <span className="text-[9.5px] font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-bold">
                Port :4000
              </span>
            </div>

            {/* Quick Presets */}
            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => handleSaveEndpoint('3000')}
                className={`py-1 px-1.5 rounded-lg border text-[10px] font-mono font-bold transition-all ${
                  endpointInput.includes('3000')
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-700 shadow-2xs'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                :3000
              </button>
              <button
                type="button"
                onClick={() => handleSaveEndpoint('5174')}
                className={`py-1 px-1.5 rounded-lg border text-[10px] font-mono font-bold transition-all ${
                  endpointInput.includes('5174')
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-700 shadow-2xs'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                :5174
              </button>
              <button
                type="button"
                onClick={() => handleSaveEndpoint('5000')}
                className={`py-1 px-1.5 rounded-lg border text-[10px] font-mono font-bold transition-all ${
                  endpointInput.includes('5000')
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-700 shadow-2xs'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                :5000
              </button>
              <button
                type="button"
                onClick={() => handleSaveEndpoint('https://sihaimodel.vercel.app/api/telemetry')}
                className={`py-1 px-1.5 rounded-lg border text-[10px] font-bold transition-all flex items-center justify-center gap-1 ${
                  endpointInput.includes('vercel.app')
                    ? 'bg-blue-50 border-blue-400 text-blue-700 shadow-2xs'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Globe className="w-3 h-3 text-blue-600" />
                <span>Vercel</span>
              </button>
            </div>

            {/* Input field */}
            <input
              type="text"
              value={endpointInput}
              onChange={(e) => setEndpointInput(e.target.value)}
              onBlur={() => handleSaveEndpoint(endpointInput)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEndpoint(endpointInput); }}
              className="w-full font-mono text-xs p-2.5 rounded-lg border border-[#CBD5E1] bg-white focus:border-[#F97316] outline-none"
              placeholder="Enter Port (e.g. 3000) or Full URL"
            />
            <p className="text-[10px] text-[#64748B]">
              Telemetry packets dispatched via HTTP POST at 1 Hz with full 9-sensor physics telemetry.
            </p>
          </div>

          {/* SECTION B: RUNTIME CONTROLS */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3.5 space-y-3">
            <span className="text-xs font-bold text-[#1E293B] uppercase flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-[#F97316]" />
              <span>SIMULATION RUNTIME MULTIPLIERS</span>
            </span>

            <div className="grid grid-cols-4 gap-2">
              {[0.5, 1, 2, 5].map((speed) => (
                <button
                  key={speed}
                  onClick={() => onUpdateSpeed(speed)}
                  className={`py-2 rounded-xl font-mono font-bold text-xs border transition-all ${
                    speedMultiplier === speed
                      ? 'bg-[#F97316] border-[#F97316] text-white shadow-xs'
                      : 'bg-white border-[#E2E8F0] text-[#475569] hover:bg-slate-50'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>

            {/* Realistic Sensor Noise Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-[#E2E8F0]">
              <div>
                <div className="text-xs font-bold text-[#1F2937]">Realistic Physical Sensor Noise</div>
                <div className="text-[10px] text-[#64748B]">Deterministic thermal & vibration sensor variance</div>
              </div>
              <button
                onClick={() => onToggleNoise(!sensorNoiseEnabled)}
                className={`w-11 h-6 rounded-full transition-colors relative ${
                  sensorNoiseEnabled ? 'bg-[#F97316]' : 'bg-gray-300'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                    sensorNoiseEnabled ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: OPTIMIZED MISSION RELIABILITY & PROGNOSTICS (Replacing Demo Mode) */}
        <div className="col-span-12 lg:col-span-6 space-y-4">
          
          {/* SECTION C: MISSION RELIABILITY & MULTI-GATE SAFETY ENGINE */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#1E293B] uppercase flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>MISSION RELIABILITY &amp; SAFETY ENGINE</span>
              </span>
              <span className="text-[9.5px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                ACTIVE
              </span>
            </div>

            <p className="text-[10.5px] text-[#64748B] leading-relaxed">
              Physics-informed digital twin evaluating 3-gate safety criteria: Engine Health (SOH), Mission Endurance Margin (RUL vs Demand), and Cumulative Operational Risk.
            </p>

            {/* Safety Standard Preset Selector */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <Gauge className="w-3 h-3 text-[#F97316]" />
                <span>Multi-Gate Safety Threshold Standard:</span>
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'MIL_SPEC', label: 'MIL-SPEC 810H', desc: 'Strict Zero-Tolerance' },
                  { id: 'DEFENCE_STRICT', label: 'DRDO STRICT', desc: 'High Resilience' },
                  { id: 'STANDARD', label: 'CIVIL AVIATION', desc: 'Standard 14 CFR' }
                ].map((std) => (
                  <button
                    key={std.id}
                    onClick={() => setSafetyStandard(std.id as any)}
                    className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                      safetyStandard === std.id
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-900 shadow-2xs font-bold'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-[10.5px] font-black">{std.label}</div>
                    <div className="text-[8.5px] text-slate-500 font-normal">{std.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Multi-Gate Safety Engine Parameters Grid */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex flex-col justify-between">
                <div className="flex items-center gap-1.5 text-slate-600">
                  <Flame className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-[10px] font-bold">Thermal Stress Limit (CHT)</span>
                </div>
                <div className="text-xs font-mono font-black text-slate-800 mt-1">
                  135.0 °C <span className="text-[9px] font-normal text-slate-500">(150°C Warning)</span>
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex flex-col justify-between">
                <div className="flex items-center gap-1.5 text-slate-600">
                  <Activity className="w-3.5 h-3.5 text-red-500" />
                  <span className="text-[10px] font-bold">Vibration RMS Threshold</span>
                </div>
                <div className="text-xs font-mono font-black text-slate-800 mt-1">
                  0.050 g <span className="text-[9px] font-normal text-slate-500">(&gt;0.080g Critical)</span>
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex flex-col justify-between">
                <div className="flex items-center gap-1.5 text-slate-600">
                  <Cpu className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-[10px] font-bold">Dynamic RUL Model</span>
                </div>
                <div className="text-xs font-mono font-black text-emerald-700 mt-1">
                  Weibull-Arrhenius <span className="text-[9px] font-normal text-slate-500">(500Hz Integrator)</span>
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex flex-col justify-between">
                <div className="flex items-center gap-1.5 text-slate-600">
                  <Compass className="w-3.5 h-3.5 text-[#F97316]" />
                  <span className="text-[10px] font-bold">Autonomous ELP Divert</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs font-mono font-black text-slate-800">1:8 Glide Ratio</span>
                  <button
                    onClick={() => setElpAutoDivert(!elpAutoDivert)}
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded cursor-pointer ${
                      elpAutoDivert ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {elpAutoDivert ? 'ENABLED' : 'MANUAL'}
                  </button>
                </div>
              </div>
            </div>

            {/* Performance Status Banner */}
            <div className="p-2.5 rounded-lg bg-emerald-50/80 border border-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="text-[10px] text-emerald-900 leading-tight">
                <span className="font-bold">Real-time Numerical Optimization Active:</span> 60 FPS deterministic flight trajectory &amp; sub-millisecond reliability assessment pipeline.
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* SECTION 4: ADVANCED PHYSICS DEBUG TOGGLE */}
      <div className="pt-2 border-t border-slate-100">
        <button
          onClick={() => setShowAdvancedDebug(!showAdvancedDebug)}
          className="text-xs font-bold text-slate-600 hover:text-[#F97316] flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>{showAdvancedDebug ? 'Hide Advanced Flight Physics Diagnostics' : 'Show Advanced Flight Physics Diagnostics'}</span>
        </button>

        {showAdvancedDebug && flight && (
          <div className="mt-3">
            <FlightDebugPanel
              flight={flight}
              enginePowerHp={enginePowerHp}
              efficiencyLossRatio={efficiencyLossRatio}
              speedMultiplier={speedMultiplier}
              simTimeSeconds={simTimeSeconds}
              navigationMode={navigationMode}
              engineOn={engineOn}
            />
          </div>
        )}
      </div>

    </div>
  );
};

export default SettingsView;
