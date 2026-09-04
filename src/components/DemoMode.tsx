import React from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface DemoModeProps {
  isDemoRunning: boolean;
  demoStep: number;
  demoStepRemaining: number;
  onStartDemo: () => void;
  onStopDemo: () => void;
}

export const DemoMode: React.FC<DemoModeProps> = ({
  isDemoRunning,
  demoStep,
  demoStepRemaining,
  onStartDemo,
  onStopDemo
}) => {
  const steps = [
    { num: 1, title: 'Normal flight' },
    { num: 2, title: 'Increase engine load' },
    { num: 3, title: 'Inject fault (e.g. vibration)' },
    { num: 4, title: 'Observe telemetry changes' },
  ];

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-3.5 shadow-sm flex flex-col justify-between h-full">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2.5">
          <div className="w-6 h-6 rounded-md bg-orange-50 border border-orange-200 flex items-center justify-center text-[#F97316]">
            <Play className="w-3.5 h-3.5 fill-current" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-[#1F2937] tracking-tight uppercase">DEMO MODE</h2>
            <div className="text-[10px] text-[#6B7280]">Run a pre-defined mission scenario</div>
          </div>
        </div>

        {/* Big Action Button */}
        <button
          onClick={isDemoRunning ? onStopDemo : onStartDemo}
          className={`w-full py-2 rounded-lg text-xs font-bold text-white transition-all shadow-sm flex items-center justify-center gap-2 ${
            isDemoRunning
              ? 'bg-[#EF4444] hover:bg-red-600'
              : 'bg-[#F97316] hover:bg-orange-600 shadow-orange-glow'
          }`}
        >
          {isDemoRunning ? (
            <>
              <Pause className="w-3.5 h-3.5 fill-current" />
              <span>Stop Demo ({demoStepRemaining}s)</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run Demo Scenario</span>
            </>
          )}
        </button>
      </div>

      {/* 4 Numbered Steps List */}
      <div className="space-y-1.5 mt-2.5">
        {steps.map((s) => {
          const isActive = isDemoRunning && demoStep === s.num;
          const isDone = isDemoRunning && demoStep > s.num;

          return (
            <div
              key={s.num}
              className={`flex items-center gap-2 text-[10px] p-1 rounded transition-colors ${
                isActive ? 'bg-orange-50/80 border border-orange-200' : ''
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 ${
                  isDone
                    ? 'bg-[#10B981] text-white'
                    : isActive
                    ? 'bg-[#F97316] text-white animate-pulse'
                    : 'bg-[#FED7AA] text-[#C2410C]'
                }`}
              >
                {s.num}
              </div>
              <span className={`font-semibold ${isActive ? 'text-[#F97316] font-bold' : isDone ? 'text-emerald-700' : 'text-[#4B5563]'}`}>
                {s.title}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
