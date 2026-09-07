import React, { useEffect, useState } from 'react';
import { Play, Pause, RotateCcw, FastForward, Activity, ShieldCheck } from 'lucide-react';
import { TelemetryClientStatus } from '../types/telemetry';

interface HeaderProps {
  telemetryStatus: TelemetryClientStatus;
  engineOn: boolean;
  isPaused: boolean;
  speedMultiplier: number;
  onTogglePause: () => void;
  onChangeSpeed: (speed: number) => void;
  onResetMission: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  telemetryStatus, 
  engineOn,
  isPaused,
  speedMultiplier,
  onTogglePause,
  onChangeSpeed,
  onResetMission
}) => {
  const [timeStr, setTimeStr] = useState('10:42:18');
  const [dateStr, setDateStr] = useState('Mon, 18 Jul 2025');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('en-GB'));
      setDateStr(now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const isConnected = telemetryStatus.status === 'CONNECTED';
  const isConnecting = telemetryStatus.status === 'CONNECTING';

  return (
    <header className="bg-white border-b border-[#E5E7EB] px-4 py-2 flex flex-col gap-1.5 shadow-xs select-none">
      
      {/* Top Main Navigation Row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        {/* Brand & Title */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-[#F97316] to-[#EA580C] rounded-lg flex items-center justify-center text-white font-black text-lg shadow-xs transform -rotate-3">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2L2 22h20L12 2zm0 4l6.5 13h-13L12 6z" />
            </svg>
          </div>

          <div>
            <div className="flex items-baseline gap-2">
              <h1 className="text-[15px] font-extrabold tracking-wide text-[#1F2937]">
                BHARAT <span className="text-[#F97316]">AEROTWIN</span>
              </h1>
              <span className="hidden sm:inline-block px-1.5 py-0.2 rounded text-[8px] font-mono font-bold bg-orange-100 text-[#C2410C] border border-orange-200">
                SOURCE OF TRUTH (WEBSITE 1)
              </span>
            </div>
            <div className="text-[9px] font-bold text-slate-700 tracking-tight flex items-center gap-1.5">
              <span className="text-[#F97316]">SIMULATED TELEMETRY — PHYSICS-BASED FLIGHT & ENGINE MODEL</span>
              <span className="text-gray-300">|</span>
              <span className="text-slate-500 font-medium">Reduced-Order Rotax 912 ULS Simulation</span>
            </div>
          </div>
        </div>

        {/* Center: Simulation Clock & Interactive Engine Controls */}
        <div className="flex items-center gap-2 bg-[#F9FAFB] border border-[#E5E7EB] px-2.5 py-1 rounded-lg">
          
          {/* Play / Pause */}
          <button
            onClick={onTogglePause}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9.5px] font-bold transition-all ${
              isPaused
                ? 'bg-amber-500 text-white shadow-xs animate-pulse'
                : 'bg-white hover:bg-gray-100 text-slate-700 border border-gray-200'
            }`}
            title={isPaused ? 'Resume Simulation' : 'Pause Simulation'}
          >
            {isPaused ? <Play className="w-2.5 h-2.5 fill-current" /> : <Pause className="w-2.5 h-2.5 fill-current" />}
            <span>{isPaused ? 'RESUME' : 'PAUSE'}</span>
          </button>

          {/* Speed Multipliers */}
          <div className="flex items-center gap-0.5 bg-gray-200/80 p-0.5 rounded text-[9px] font-mono font-bold text-slate-700">
            {[0.5, 1, 2, 5].map((speed) => (
              <button
                key={speed}
                onClick={() => onChangeSpeed(speed)}
                className={`px-1.5 py-0.5 rounded transition-all ${
                  speedMultiplier === speed
                    ? 'bg-[#F97316] text-white shadow-xs font-black'
                    : 'hover:text-black hover:bg-gray-100'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>

          {/* Reset Mission Button */}
          <button
            onClick={onResetMission}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[9.5px] font-bold bg-white hover:bg-red-50 text-slate-700 hover:text-red-600 border border-gray-200 transition-all"
            title="Reset flight to runway base, clear faults and reset telemetry sequence"
          >
            <RotateCcw className="w-2.5 h-2.5 text-[#F97316]" />
            <span>RESET</span>
          </button>
        </div>

        {/* Status Indicators & Clock */}
        <div className="flex items-center gap-3">
          {/* Status Badges */}
          <div className="hidden md:flex items-center gap-1.5">
            <div className="flex items-center gap-1 bg-[#F9FAFB] border border-[#E5E7EB] px-2 py-0.5 rounded-full text-[9px] font-medium text-[#4B5563]">
              <span className={`w-1.5 h-1.5 rounded-full ${engineOn ? 'bg-[#10B981] animate-pulse' : 'bg-[#9CA3AF]'}`} />
              <span className="font-bold text-[#1F2937]">{engineOn ? 'ACTIVE' : 'STANDBY'}</span>
            </div>

            <div className="flex items-center gap-1 bg-[#F9FAFB] border border-[#E5E7EB] px-2 py-0.5 rounded-full text-[9px] font-medium text-[#4B5563]">
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-[#10B981] animate-ping' : isConnecting ? 'bg-amber-400 animate-spin' : 'bg-[#F97316]'}`} />
              <span className={`font-bold ${isConnected ? 'text-[#10B981]' : isConnecting ? 'text-amber-600' : 'text-[#F97316]'}`}>
                {isConnected ? 'LIVE SYNC (200)' : 'LOCAL SIM'}
              </span>
            </div>
          </div>

          {/* Viksit Bharat @2047 Tag */}
          <div className="hidden xl:flex items-center gap-1.5 pl-2 border-l border-gray-200">
            <div className="text-right">
              <div className="text-[11px] font-extrabold text-[#1F2937] leading-tight">Viksit Bharat</div>
              <div className="text-[9px] font-bold text-[#F97316] leading-none">@2047</div>
            </div>
            <div className="h-4.5 w-2 flex flex-col rounded-2xs overflow-hidden border border-gray-200">
              <div className="h-1.5 bg-[#FF9933]" />
              <div className="h-1.5 bg-white flex items-center justify-center">
                <div className="w-0.5 h-0.5 rounded-full bg-[#000080]" />
              </div>
              <div className="h-1.5 bg-[#138808]" />
            </div>
          </div>

          {/* Clock */}
          <div className="text-right pl-2.5 border-l border-[#E5E7EB]">
            <div className="text-[13px] font-bold font-mono text-[#1F2937] tracking-wider leading-none">
              {timeStr}
            </div>
            <div className="text-[8.5px] font-medium text-[#6B7280] mt-0.5">
              {dateStr}
            </div>
          </div>
        </div>

      </div>
    </header>
  );
};


