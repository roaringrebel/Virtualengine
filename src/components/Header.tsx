import React, { useEffect, useState } from 'react';
import { Play, Pause, RotateCcw, Activity, Power, Film } from 'lucide-react';
import { TelemetryClientStatus } from '../types/telemetry';

interface HeaderProps {
  telemetryStatus: TelemetryClientStatus;
  engineOn: boolean;
  isPaused: boolean;
  isCompleted?: boolean;
  speedMultiplier: number;
  onTogglePause: () => void;
  onChangeSpeed: (speed: number) => void;
  onResetMission: () => void;
  onShowIntro?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  telemetryStatus, 
  engineOn,
  isPaused,
  isCompleted = false,
  speedMultiplier,
  onTogglePause,
  onChangeSpeed,
  onResetMission,
  onShowIntro
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
  const isStreaming = telemetryStatus.isStreaming;

  const simStatusText = isCompleted ? 'COMPLETED' : isPaused ? 'PAUSED' : engineOn ? 'ACTIVE' : 'READY';
  const telStatusText = isCompleted ? 'STOPPED' : isStreaming ? 'LIVE' : 'OFFLINE';

  return (
    <header className="bg-white border-b border-[#E5E7EB] px-4 py-2 flex flex-col gap-1.5 shadow-xs select-none">
      
      {/* Main Header Bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        {/* Brand & Clean Engineering Title (Official DRDO Digital Twin) */}
        <div className="flex items-center gap-2.5">
          <img 
            src="/drdo_logo.png" 
            alt="DRDO Official Seal" 
            className="w-10 h-10 object-contain shrink-0 drop-shadow-xs" 
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/app_logo.png';
            }}
          />

          <div>
            <div className="flex items-baseline gap-2">
              <h1 className="text-[16px] font-black tracking-wide text-[#1F2937]">
                BHARAT <span className="text-[#F97316]">AEROTWIN</span>
              </h1>
              <span className="text-[9px] font-mono font-extrabold px-1.5 py-0.5 rounded bg-orange-50 text-orange-600 border border-orange-200">
                DRDO DIGITAL TWIN
              </span>
            </div>
            <div className="text-[9.5px] font-bold text-slate-700 tracking-tight flex items-center gap-1.5">
              <span className="text-[#F97316]">DEFENCE R&D ORGANISATION</span>
              <span className="text-gray-300">|</span>
              <span className="text-slate-500 font-medium">Rotax 912 ULS Telemetry &amp; Reliability Platform</span>
            </div>
          </div>
        </div>

        {/* Center: Clean Status Indicators (Requirement 42) */}
        <div className="hidden lg:flex items-center gap-2">
          {/* SIMULATION STATUS */}
          <div className="flex items-center gap-1.5 bg-[#F9FAFB] border border-[#E5E7EB] px-2.5 py-1 rounded-md text-[9.5px] font-mono">
            <span className={`w-2 h-2 rounded-full ${isPaused ? 'bg-amber-400 animate-pulse' : engineOn ? 'bg-[#10B981] animate-pulse' : 'bg-slate-400'}`} />
            <span className="text-[#6B7280] font-bold">SIMULATION:</span>
            <span className={`font-bold ${isPaused ? 'text-amber-600' : engineOn ? 'text-emerald-700' : 'text-slate-600'}`}>
              {simStatusText}
            </span>
          </div>

          {/* TELEMETRY STATUS */}
          <div className="flex items-center gap-1.5 bg-[#F9FAFB] border border-[#E5E7EB] px-2.5 py-1 rounded-md text-[9.5px] font-mono">
            <span className={`w-2 h-2 rounded-full ${isStreaming ? 'bg-[#10B981] animate-pulse' : 'bg-[#EF4444]'}`} />
            <span className="text-[#6B7280] font-bold">TELEMETRY:</span>
            <span className={`font-bold ${isStreaming ? 'text-emerald-700' : 'text-red-600'}`}>
              {telStatusText}
            </span>
          </div>

          {/* MODEL STATUS */}
          <div className="flex items-center gap-1.5 bg-[#F9FAFB] border border-[#E5E7EB] px-2.5 py-1 rounded-md text-[9.5px] font-mono">
            <Activity className="w-3 h-3 text-[#F97316]" />
            <span className="text-[#6B7280] font-bold">MODEL:</span>
            <span className="font-bold text-[#1F2937]">PHYSICS-BASED</span>
          </div>
        </div>

        {/* Right: Simulation Clock & Primary Controls */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-[#F9FAFB] border border-[#E5E7EB] px-2 py-0.5 rounded-lg">
            {/* Play / Pause */}
            <button
              onClick={onTogglePause}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold transition-all ${
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
            <div className="flex items-center gap-0.5 bg-gray-200/80 p-0.5 rounded text-[8.5px] font-mono font-bold text-slate-700">
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

            {/* Reset Mission */}
            <button
              onClick={onResetMission}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-white hover:bg-red-50 text-slate-700 hover:text-red-600 border border-gray-200 transition-all"
              title="Reset flight to runway base and clear faults"
            >
              <RotateCcw className="w-2.5 h-2.5 text-[#F97316]" />
              <span>RESET</span>
            </button>

            {/* Intro Video Tour */}
            {onShowIntro && (
              <button
                onClick={onShowIntro}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-50 hover:bg-orange-100 text-[#F97316] border border-orange-200 transition-all cursor-pointer"
                title="Watch Virtual Engine Video Tour"
              >
                <Film className="w-2.5 h-2.5 text-[#F97316]" />
                <span>INTRO</span>
              </button>
            )}
          </div>

          {/* Clock */}
          <div className="text-right pl-2 border-l border-[#E5E7EB]">
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
