import React from 'react';
import { Play, Pause, CheckCircle2, AlertTriangle, ShieldCheck, AlertOctagon } from 'lucide-react';

interface DemoModeProps {
  isDemoRunning: boolean;
  demoStep: number;
  demoStepRemaining: number;
  onStartDemo: () => void;
  onStopDemo: () => void;
}

export const DEMO_STAGES = [
  { step: 1, name: '1. UAV at Base Airfield', desc: 'Engine OFF, Standby mode, Mission Decision: GO' },
  { step: 2, name: '2. Start Engine & Warm-Up', desc: 'Ignition ON, Rotax 912 spools to Idle, oil pressure rises' },
  { step: 3, name: '3. Throttle 70% Applied', desc: 'Thrust increases, longitudinal acceleration on runway' },
  { step: 4, name: '4. Takeoff & Climb Phase', desc: 'Airspeed > 110 km/h, positive VSI climb towards 4,500 ft' },
  { step: 5, name: '5. Waypoint Auto Engaged', desc: 'Autopilot tracks planned route corridor (WP1 -> WP2 -> WP3)' },
  { step: 6, name: '6. Cruise & Route Progress', desc: 'Airspeed 145 km/h, planned route & cyan track active' },
  { step: 7, name: '7. Inject Excessive Vibration', desc: 'Fault injected: high-order vibration > 6.5 mm/s RMS' },
  { step: 8, name: '8. Power Sag & CAUTION', desc: 'Vib ↑, Condition ↓, Reliability 68%, Decision: CAUTION' },
  { step: 9, name: '9. Severe Anomaly & NO-GO', desc: 'High thermal load, Margin < 0, Decision: NO-GO' },
  { step: 10, name: '10. Clear Fault & Recovery', desc: 'Thermodynamics restore, Reliability 92%, Decision: GO' },
  { step: 11, name: '11. Resume Mission Route', desc: 'Waypoint navigation continues towards WP4 Southern Vector' },
  { step: 12, name: '12. Recovery & Return to Base', desc: 'Mission progress 100%, descent to runway base' }
];

export const DemoMode: React.FC<DemoModeProps> = ({
  isDemoRunning,
  demoStep,
  demoStepRemaining,
  onStartDemo,
  onStopDemo
}) => {
  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-3 shadow-sm flex flex-col justify-between h-full select-none">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-md bg-orange-50 border border-orange-200 flex items-center justify-center text-[#F97316]">
              <Play className="w-3 h-3 fill-current" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-[#1F2937] tracking-tight uppercase">SIH DEMO MODE</h2>
            </div>
          </div>
          <span className="text-[8.5px] font-mono font-bold px-1.5 py-0.2 rounded bg-orange-50 text-orange-700 border border-orange-200">
            12-STAGE SCENARIO
          </span>
        </div>

        {/* Big Action Button */}
        <button
          onClick={isDemoRunning ? onStopDemo : onStartDemo}
          className={`w-full py-1.5 rounded-lg text-xs font-bold text-white transition-all shadow-sm flex items-center justify-center gap-1.5 ${
            isDemoRunning
              ? 'bg-[#EF4444] hover:bg-red-600'
              : 'bg-[#F97316] hover:bg-orange-600 shadow-orange-glow'
          }`}
        >
          {isDemoRunning ? (
            <>
              <Pause className="w-3 h-3 fill-current" />
              <span>Stop Demo (Stage {demoStep}/12 — {demoStepRemaining}s)</span>
            </>
          ) : (
            <>
              <Play className="w-3 h-3 fill-current" />
              <span>Run 12-Stage SIH Demo</span>
            </>
          )}
        </button>
      </div>

      {/* 12 Numbered Steps List */}
      <div className="space-y-1 mt-2 max-h-[175px] overflow-y-auto pr-1">
        {DEMO_STAGES.map((s) => {
          const isActive = isDemoRunning && demoStep === s.step;
          const isDone = isDemoRunning && demoStep > s.step;

          return (
            <div
              key={s.step}
              className={`flex items-start gap-1.5 text-[9.5px] p-1 rounded transition-colors ${
                isActive ? 'bg-orange-50/90 border border-orange-300 shadow-xs' : 'hover:bg-gray-50'
              }`}
            >
              <div
                className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-mono font-bold flex-shrink-0 mt-0.5 ${
                  isDone
                    ? 'bg-[#10B981] text-white'
                    : isActive
                    ? 'bg-[#F97316] text-white animate-pulse'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                {isDone ? '✓' : s.step}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`font-semibold leading-tight truncate ${isActive ? 'text-[#F97316] font-bold' : isDone ? 'text-emerald-700' : 'text-[#374151]'}`}>
                  {s.name}
                </div>
                {isActive && (
                  <div className="text-[8px] text-slate-500 leading-none mt-0.5 font-mono">
                    {s.desc}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
