import React, { useState } from 'react';
import { Radio, ExternalLink } from 'lucide-react';
import { TelemetryClientStatus, TelemetryPacket } from '../types/telemetry';

interface TelemetryStreamProps {
  telemetryStatus: TelemetryClientStatus;
  latestPacket: TelemetryPacket | null;
  onStartStreaming: () => void;
  onStopStreaming: () => void;
  onUpdateEndpoint: (endpoint: string) => void;
}

export const TelemetryStream: React.FC<TelemetryStreamProps> = ({
  telemetryStatus,
  latestPacket,
  onStartStreaming,
  onStopStreaming,
  onUpdateEndpoint
}) => {
  const [endpointInput, setEndpointInput] = useState(telemetryStatus.endpoint);
  const [isEditingEndpoint, setIsEditingEndpoint] = useState(false);

  const handleSaveEndpoint = () => {
    onUpdateEndpoint(endpointInput);
    setIsEditingEndpoint(false);
  };

  const sampleJson = latestPacket ? JSON.stringify({
    timestamp: latestPacket.timestamp.substring(0, 19).replace('T', ' '),
    rpm: latestPacket.rpm,
    cht: latestPacket.cht,
    egt: latestPacket.egt,
    oil_pressure: latestPacket.oil_pressure,
    oil_temperature: latestPacket.oil_temperature,
    vibration: latestPacket.vibration,
    fuel_flow: latestPacket.fuel_flow,
    fuel_pressure: latestPacket.fuel_pressure,
    map: latestPacket.map,
    altitude: latestPacket.altitude,
    airspeed: latestPacket.airspeed,
    throttle: latestPacket.throttle,
    fault: latestPacket.fault
  }, null, 2) : '{\n  "status": "AWAITING_TELEMETRY"\n}';

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-3.5 shadow-sm flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-orange-50 border border-orange-200 flex items-center justify-center text-[#F97316]">
            <Radio className="w-3.5 h-3.5" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-[#1F2937] tracking-tight uppercase">TELEMETRY STREAM</h2>
            <div className="text-[10px] text-[#6B7280]">Live sensor data being sent to Digital Twin</div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[#10B981]">
          <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
          <span>Streaming...</span>
        </div>
      </div>

      {/* Main Grid: DRDO Badge + JSON Inspector + Controls */}
      <div className="grid grid-cols-12 gap-2.5 items-center">
        {/* Left DRDO Emblem Badge */}
        <div className="col-span-3 flex flex-col items-center justify-center text-center p-1 border-r border-[#E5E7EB]">
          {/* Stylized DRDO Emblem SVG */}
          <div className="w-13 h-13 rounded-full border-2 border-[#1E3A8A] bg-white flex flex-col items-center justify-center p-1 shadow-sm mb-1">
            <svg viewBox="0 0 100 100" className="w-10 h-10 text-[#1E3A8A]">
              <circle cx="50" cy="50" r="46" fill="none" stroke="#1E3A8A" strokeWidth="4" />
              <circle cx="50" cy="50" r="38" fill="none" stroke="#F97316" strokeWidth="2" strokeDasharray="4,4" />
              {/* Crossed Swords / Wings */}
              <path d="M25 75 L75 25 M75 75 L25 25" stroke="#1E3A8A" strokeWidth="3" />
              <circle cx="50" cy="50" r="14" fill="#F97316" />
              <text x="50" y="54" fill="#FFFFFF" fontSize="10" fontWeight="bold" textAnchor="middle">DRDO</text>
            </svg>
          </div>
          <div className="text-[10px] font-extrabold text-[#1E3A8A] tracking-wider leading-tight">
            DRDO
          </div>
          <div className="text-[7.5px] font-bold text-[#6B7280] uppercase tracking-tighter leading-tight mt-0.5">
            TECHNOLOGY FOR A SAFER TOMORROW
          </div>
        </div>

        {/* Center Live JSON Payload Code Block */}
        <div className="col-span-5 bg-[#0F172A] text-emerald-400 p-2 rounded-lg font-mono text-[9px] leading-tight max-h-[110px] overflow-y-auto border border-slate-700 shadow-inner">
          <pre className="whitespace-pre-wrap">{sampleJson}</pre>
        </div>

        {/* Right API Controls & Metrics */}
        <div className="col-span-4 pl-1 text-[10px] space-y-1.5">
          {/* Buttons */}
          <div className="flex gap-1.5">
            <button
              onClick={onStartStreaming}
              className={`flex-1 py-1 rounded text-[10px] font-bold transition-all ${
                telemetryStatus.isStreaming
                  ? 'bg-[#F97316] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Start Stream
            </button>
            <button
              onClick={onStopStreaming}
              className={`flex-1 py-1 rounded text-[10px] font-bold transition-all ${
                !telemetryStatus.isStreaming
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Stop Stream
            </button>
          </div>

          {/* Endpoint Input */}
          <div className="space-y-0.5">
            <div className="text-[9px] font-bold text-[#6B7280] uppercase">API Endpoint</div>
            <div className="flex items-center gap-1 bg-[#F9FAFB] border border-[#E5E7EB] rounded px-1.5 py-0.5 text-[9px] font-mono">
              <input
                type="text"
                value={endpointInput}
                onChange={(e) => setEndpointInput(e.target.value)}
                onBlur={handleSaveEndpoint}
                className="w-full bg-transparent text-[#1F2937] outline-none truncate"
              />
              <ExternalLink className="w-2.5 h-2.5 text-[#9CA3AF] flex-shrink-0" />
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 gap-1 text-[9px] font-mono pt-0.5 border-t border-[#E5E7EB]">
            <div>
              <span className="text-[#9CA3AF]">Last Trans:</span>
              <div className="font-bold text-[#1F2937]">{telemetryStatus.lastTransmissionTime || '10:42:18'}</div>
            </div>
            <div>
              <span className="text-[#9CA3AF]">Status:</span>
              <div className="font-bold text-[#10B981] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                <span>Connected</span>
              </div>
            </div>
            <div>
              <span className="text-[#9CA3AF]">Packets:</span>
              <div className="font-bold text-[#1F2937]">{telemetryStatus.packetsSent.toLocaleString()}</div>
            </div>
            <div>
              <span className="text-[#9CA3AF]">Mode:</span>
              <div className="font-bold text-[#10B981] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                <span>Live</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
