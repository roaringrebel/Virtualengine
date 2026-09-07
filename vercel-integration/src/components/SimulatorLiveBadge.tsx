import React from 'react';
import { SimulatorConnectionState } from '../hooks/useSimulatorTelemetry';

interface SimulatorLiveBadgeProps {
  connectionState: SimulatorConnectionState;
  secondsAgo: number | null;
  missedPackets?: number;
  simulationId?: string;
}

export const SimulatorLiveBadge: React.FC<SimulatorLiveBadgeProps> = ({
  connectionState,
  secondsAgo,
  missedPackets = 0,
  simulationId
}) => {
  return (
    <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full text-xs font-mono shadow-sm">
      {/* Live / Offline Status */}
      {connectionState === 'LIVE' && (
        <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span>SIMULATOR TELEMETRY ● LIVE</span>
        </span>
      )}

      {connectionState === 'STALE' && (
        <span className="flex items-center gap-1.5 text-amber-400 font-bold">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span>TELEMETRY STALE ({secondsAgo}s ago)</span>
        </span>
      )}

      {connectionState === 'OFFLINE' && (
        <span className="flex items-center gap-1.5 text-rose-400 font-bold">
          <span className="w-2 h-2 rounded-full bg-rose-500" />
          <span>SIMULATOR OFFLINE</span>
        </span>
      )}

      {connectionState === 'WAITING_FOR_SIMULATOR' && (
        <span className="flex items-center gap-1.5 text-sky-400 font-bold">
          <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
          <span>WAITING FOR SIMULATOR...</span>
        </span>
      )}

      {/* Time Ago Indicator */}
      {secondsAgo !== null && connectionState === 'LIVE' && (
        <span className="text-slate-400 text-[11px] border-l border-slate-700 pl-2">
          {secondsAgo === 0 ? 'Just now' : `${secondsAgo}s ago`}
        </span>
      )}

      {/* Missed Packet Counter */}
      {missedPackets > 0 && (
        <span className="text-amber-400 text-[10px] bg-amber-950/60 border border-amber-800/80 px-1.5 py-0.2 rounded">
          Missed: {missedPackets}
        </span>
      )}
    </div>
  );
};
