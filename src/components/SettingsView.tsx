import React, { useState } from 'react';
import { Settings as SettingsIcon, Globe, Server, Activity, Play, Square, RefreshCw, Cpu, Sliders, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { FlightDebugPanel } from './FlightDebugPanel';
import { FlightState, NavigationMode } from '../types/simulation';

interface SettingsViewProps {
  apiEndpoint: string;
  onUpdateEndpoint: (endpoint: string) => void;
  speedMultiplier: number;
  onUpdateSpeed: (speed: number) => void;
  sensorNoiseEnabled: boolean;
  onToggleNoise: (enabled: boolean) => void;
  isDemoRunning: boolean;
  demoStep: number;
  demoStepRemaining: number;
  onStartDemo: () => void;
  onStopDemo: () => void;
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
  isDemoRunning,
  demoStep,
  demoStepRemaining,
  onStartDemo,
  onStopDemo,
  flight,
  enginePowerHp = 100,
  efficiencyLossRatio = 0,
  simTimeSeconds = 0,
  navigationMode = 'WAYPOINT_ROUTE',
  engineOn = false
}) => {
  const [endpointInput, setEndpointInput] = useState(apiEndpoint);
  const [showAdvancedDebug, setShowAdvancedDebug] = useState(false);

  const handleSaveEndpoint = (val: string) => {
    setEndpointInput(val);
    onUpdateEndpoint(val);
  };

  const DEMO_STAGES = [
    { step: 1, name: 'Standby on Airfield', desc: 'Pre-flight checks at Base runway' },
    { step: 2, name: 'Engine Start & Idle', desc: 'Ignition ON, Rotax 912 at 1,600 RPM' },
    { step: 3, name: 'Ground Roll (70%)', desc: 'Throttle advanced, longitudinal acceleration' },
    { step: 4, name: 'Takeoff & Initial Climb', desc: 'Climb vector established to 4,500 ft' },
    { step: 5, name: 'Waypoint Autopilot Engaged', desc: 'Geodesic corridor auto-tracking active' },
    { step: 6, name: 'Cruise Transit (6,500 ft)', desc: 'Level flight at 145 km/h TAS' },
    { step: 7, name: 'Fault: Excessive Vibration', desc: 'Vibration rises (> 6.5 mm/s RMS)' },
    { step: 8, name: 'Degradation & CAUTION Decision', desc: 'Power sag, Decision: CAUTION' },
    { step: 9, name: 'Severe Overheating -> NO-GO', desc: 'CHT > 175°C, Decision: NO-GO' },
    { step: 10, name: 'Clear Fault & Thermal Recovery', desc: 'SOH recovers (92%), Decision: GO' },
    { step: 11, name: 'Descent Approach Vector', desc: 'Approach vectoring towards Destination' },
    { step: 12, name: 'Touchdown & Recovery', desc: 'Touchdown complete, mission finished' }
  ];

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 shadow-sm space-y-4">
      
      {/* 1. Header (Requirement 37) */}
      <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center text-[#F97316]">
            <SettingsIcon className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-black text-[#1F2937] tracking-tight uppercase">
              SIMULATOR CONFIGURATION & SETTINGS
            </h2>
            <div className="text-[11px] text-[#6B7280]">
              Telemetry Integrations &bull; Runtime Multipliers &bull; Demo Mode
            </div>
          </div>
        </div>

        <div className="text-[9.5px] font-mono font-bold bg-slate-100 text-slate-800 px-2.5 py-1 rounded border border-slate-300">
          CONFIG VERSION 2.0
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

        {/* RIGHT COLUMN: DEMONSTRATION MODE SCENARIOS (Requirement 34) */}
        <div className="col-span-12 lg:col-span-6 space-y-4">
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#1E293B] uppercase flex items-center gap-1.5">
                <Play className="w-4 h-4 text-[#F97316]" />
                <span>DEMONSTRATION MODE SCENARIO</span>
              </span>
              {isDemoRunning && (
                <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300 animate-pulse">
                  STAGE {demoStep}/12 ({demoStepRemaining}s)
                </span>
              )}
            </div>

            <p className="text-[10.5px] text-[#64748B] leading-relaxed">
              Automated 12-stage demonstration covering startup, taxi, takeoff roll, climb, cruise, vibration injection, power sag, overheating, fault clearance, and runway recovery.
            </p>

            {/* Start / Stop Demo Buttons */}
            <div className="flex gap-2">
              {!isDemoRunning ? (
                <button
                  onClick={onStartDemo}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Play className="w-4 h-4" />
                  <span>START 12-STAGE DEMO SEQUENCE</span>
                </button>
              ) : (
                <button
                  onClick={onStopDemo}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Square className="w-4 h-4" />
                  <span>ABORT DEMO SCENARIO</span>
                </button>
              )}
            </div>

            {/* 12-Stage Scrollable Mini-List */}
            <div className="max-h-[220px] overflow-y-auto space-y-1 pr-1">
              {DEMO_STAGES.map((s) => {
                const isCurrent = isDemoRunning && demoStep === s.step;
                const isPast = isDemoRunning && demoStep > s.step;
                return (
                  <div
                    key={s.step}
                    className={`p-2 rounded-lg text-xs flex items-center justify-between border transition-all ${
                      isCurrent
                        ? 'bg-orange-50 border-[#F97316] text-[#F97316] font-bold'
                        : isPast
                        ? 'bg-emerald-50/60 border-emerald-200 text-emerald-800'
                        : 'bg-white border-[#E2E8F0] text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 text-[9px] flex items-center justify-center font-mono font-bold">
                        {s.step}
                      </span>
                      <span className="font-semibold">{s.name}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-normal truncate max-w-[180px]">
                      {s.desc}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>

      {/* SECTION 4: ADVANCED PHYSICS DEBUG TOGGLE (Requirement 25) */}
      <div className="pt-2 border-t border-slate-100">
        <button
          onClick={() => setShowAdvancedDebug(!showAdvancedDebug)}
          className="text-xs font-bold text-slate-600 hover:text-[#F97316] flex items-center gap-1.5 transition-colors"
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
