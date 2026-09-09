import React, { useState, useEffect } from 'react';
import { Radio, ExternalLink, Globe, Laptop, RefreshCw, AlertTriangle, CheckCircle2, Copy, Check, Zap, Server } from 'lucide-react';
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
  const [copiedBridge, setCopiedBridge] = useState(false);

  useEffect(() => {
    setEndpointInput(telemetryStatus.endpoint);
  }, [telemetryStatus.endpoint]);

  const handleSaveEndpoint = (val: string) => {
    setEndpointInput(val);
    onUpdateEndpoint(val);
  };

  const handleCopyBridge = () => {
    const bridgeScript = `(function connectToSimulator() {
  console.log("%c🔥 BHARAT AEROTWIN LIVE BRIDGE CONNECTED", "background:#f97316;color:white;font-weight:bold;padding:4px 8px;border-radius:4px;");
  let lastFault = null;
  setInterval(async () => {
    try {
      const res = await fetch("http://localhost:4000/api/telemetry");
      if (!res.ok) return;
      const data = await res.json();
      if (!data.telemetry) return;
      const t = data.telemetry;
      if (t.fault !== lastFault) {
        lastFault = t.fault;
        console.log("⚡ Live Telemetry Fault Received from Simulator (Port 4000):", t.fault, t);
        const buttons = Array.from(document.querySelectorAll("button"));
        let targetText = "";
        if (t.fault === "OVERHEATING") targetText = "Overheating";
        else if (t.fault === "EXCESSIVE_VIBRATION") targetText = "Vibration";
        else if (t.fault === "LOW_OIL_PRESSURE") targetText = "Oil";
        else if (t.fault === "HIGH_CHT") targetText = "High CHT";
        else if (t.fault === "COOLING_PROBLEM") targetText = "Cooling";
        else if (t.fault === "NORMAL") targetText = "Nominal";
        if (targetText) {
          const btn = buttons.find(b => b.textContent && b.textContent.includes(targetText));
          if (btn) btn.click();
        }
      }
    } catch (e) {}
  }, 1000);
})();`;
    navigator.clipboard.writeText(bridgeScript);
    setCopiedBridge(true);
    setTimeout(() => setCopiedBridge(false), 4000);
  };

  const isConnected = telemetryStatus.status === 'CONNECTED';
  const isConnecting = telemetryStatus.status === 'CONNECTING';

  const sampleJson = latestPacket ? JSON.stringify({
    uav_id: latestPacket.uav_id || 'UAV-BHARAT-01',
    engine_id: latestPacket.engine_id || 'ENG_001',
    timestamp: latestPacket.timestamp,
    sequence: latestPacket.sequence_number,
    rpm: latestPacket.rpm,
    engine_load: latestPacket.engine_load,
    vibration_rms_g: latestPacket.vibration_rms_g ?? latestPacket.vibration,
    vibration_peak_g: latestPacket.vibration_peak_g,
    dominant_frequency_hz: latestPacket.dominant_frequency_hz,
    spectral_energy: latestPacket.spectral_energy,
    cht: latestPacket.cht,
    egt: latestPacket.egt,
    oil_pressure: latestPacket.oil_pressure,
    oil_temperature: latestPacket.oil_temperature,
    fuel_flow: latestPacket.fuel_flow,
    fuel_pressure: latestPacket.fuel_pressure,
    map: latestPacket.map,
    altitude: latestPacket.altitude,
    airspeed: latestPacket.airspeed,
    throttle: latestPacket.throttle,
    ambient_temperature: latestPacket.ambient_temperature,
    flight_phase: latestPacket.flight_phase,
    fault_type: latestPacket.fault,
    anomaly_flag: latestPacket.anomaly_flag
  }, null, 2) : '{\n  "status": "INITIALIZING_STREAM"\n}';

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-3 shadow-sm flex flex-col justify-between h-full">
      {/* Header with Connection State & App Port Indicator */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-orange-50 border border-orange-200 flex items-center justify-center text-[#F97316]">
            <Radio className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-xs font-bold text-[#1F2937] tracking-tight uppercase">TELEMETRY SENDER & SYNC</h2>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200 font-bold">
                Host :4000
              </span>
            </div>
            <div className="text-[10px] text-[#6B7280]">Real-Time REST Telemetry to Target Website / Port</div>
          </div>
        </div>

        {/* Live Status Badge */}
        <div className="flex items-center gap-1.5 text-[10px] font-semibold">
          {isConnected ? (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono" title={telemetryStatus.endpoint}>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>LIVE CONNECTED (200 OK)</span>
            </span>
          ) : isConnecting ? (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-mono">
              <RefreshCw className="w-2.5 h-2.5 animate-spin" />
              <span>CONNECTING...</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-50 text-orange-800 border border-orange-200 font-mono" title={telemetryStatus.lastError || 'Target offline or awaiting recipient'}>
              <span className="w-2 h-2 rounded-full bg-orange-500" />
              <span>DISPATCHING (1s)</span>
            </span>
          )}
        </div>
      </div>

      {/* Main Grid: DRDO Badge + JSON Inspector + Controls */}
      <div className="grid grid-cols-12 gap-2.5 items-center">
        {/* Left DRDO Emblem Badge & 1-Click Sync Button */}
        <div className="col-span-3 flex flex-col items-center justify-center text-center p-1 border-r border-[#E5E7EB] space-y-1">
          <div className="w-10 h-10 rounded-full border-2 border-[#1E3A8A] bg-white flex flex-col items-center justify-center p-0.5 shadow-sm">
            <svg viewBox="0 0 100 100" className="w-7 h-7 text-[#1E3A8A]">
              <circle cx="50" cy="50" r="46" fill="none" stroke="#1E3A8A" strokeWidth="4" />
              <circle cx="50" cy="50" r="38" fill="none" stroke="#F97316" strokeWidth="2" strokeDasharray="4,4" />
              <path d="M25 75 L75 25 M75 75 L25 25" stroke="#1E3A8A" strokeWidth="3" />
              <circle cx="50" cy="50" r="14" fill="#F97316" />
              <text x="50" y="54" fill="#FFFFFF" fontSize="10" fontWeight="bold" textAnchor="middle">DRDO</text>
            </svg>
          </div>
          <div className="text-[9px] font-extrabold text-[#1E3A8A] tracking-wider leading-tight">
            DRDO
          </div>
          <button
            onClick={handleCopyBridge}
            title="Copy 1-Click Browser Sync Bridge for port 4000"
            className="w-full flex items-center justify-center gap-1 py-1 px-1 rounded bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 font-bold text-[8px] transition-colors shadow-2xs"
          >
            {copiedBridge ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : <Zap className="w-2.5 h-2.5 text-amber-600" />}
            <span>{copiedBridge ? 'Bridge Copied!' : '1-Click Sync'}</span>
          </button>
        </div>

        {/* Center Live JSON Payload Code Block */}
        <div className="col-span-5 bg-[#0F172A] text-emerald-400 p-2 rounded-lg font-mono text-[8.5px] leading-tight max-h-[110px] overflow-y-auto border border-slate-700 shadow-inner">
          <pre className="whitespace-pre-wrap">{sampleJson}</pre>
        </div>

        {/* Right API Controls & Metrics */}
        <div className="col-span-4 pl-1 text-[10px] space-y-1.5">
          {/* Stream Toggle Buttons */}
          <div className="flex gap-1">
            <button
              onClick={onStartStreaming}
              className={`flex-1 py-1 rounded text-[9.5px] font-bold transition-all ${
                telemetryStatus.isStreaming
                  ? 'bg-[#F97316] text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Start 1Hz
            </button>
            <button
              onClick={onStopStreaming}
              className={`flex-1 py-1 rounded text-[9.5px] font-bold transition-all ${
                !telemetryStatus.isStreaming
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Pause
            </button>
          </div>

          {/* Quick Target Port / Endpoint Presets */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[8px] font-semibold text-gray-500">
              <span>TARGET PORT / URL:</span>
            </div>
            <div className="grid grid-cols-3 gap-1 text-[8px]">
              <button
                onClick={() => handleSaveEndpoint('3000')}
                title="Send Telemetry to http://localhost:3000/api/telemetry"
                className={`py-0.5 px-1 rounded border font-mono truncate text-center ${
                  endpointInput.includes('3000')
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-700 font-bold'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                :3000
              </button>
              <button
                onClick={() => handleSaveEndpoint('5174')}
                title="Send Telemetry to http://localhost:5174/api/telemetry"
                className={`py-0.5 px-1 rounded border font-mono truncate text-center ${
                  endpointInput.includes('5174')
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-700 font-bold'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                :5174
              </button>
              <button
                onClick={() => handleSaveEndpoint('https://sihaimodel.vercel.app/api/telemetry')}
                title="Target Vercel Production Deployment"
                className={`py-0.5 px-1 rounded border font-sans truncate text-center ${
                  endpointInput.includes('vercel.app')
                    ? 'bg-blue-50 border-blue-400 text-blue-700 font-bold'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                Vercel
              </button>
            </div>
          </div>

          {/* Target Port / Endpoint Input Field */}
          <div className="space-y-0.5">
            <div className="flex items-center gap-1 bg-[#F9FAFB] border border-[#E5E7EB] rounded px-1.5 py-0.5 text-[8.5px] font-mono">
              <Server className="w-2.5 h-2.5 text-gray-400 flex-shrink-0" />
              <input
                type="text"
                value={endpointInput}
                onChange={(e) => setEndpointInput(e.target.value)}
                onBlur={() => handleSaveEndpoint(endpointInput)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEndpoint(endpointInput); }}
                className="w-full bg-transparent text-[#1F2937] outline-none truncate"
                placeholder="Enter Port (e.g. 3000) or URL"
                title="Type target port (e.g. 3000, 5000, 8080) or full URL"
              />
              <ExternalLink className="w-2.5 h-2.5 text-[#9CA3AF] flex-shrink-0" />
            </div>
          </div>

          {/* Transmission Diagnostics Metrics */}
          <div className="grid grid-cols-2 gap-1 text-[8.5px] font-mono pt-0.5 border-t border-[#E5E7EB]">
            <div>
              <span className="text-[#9CA3AF]">Last POST:</span>
              <div className="font-bold text-[#1F2937] truncate">{telemetryStatus.lastTransmissionTime || '--:--:--'}</div>
            </div>
            <div>
              <span className="text-[#9CA3AF]">HTTP Status:</span>
              <div className={`font-bold truncate ${isConnected ? 'text-emerald-600' : 'text-amber-600'}`}>
                {telemetryStatus.lastHttpStatus ? `${telemetryStatus.lastHttpStatus}` : telemetryStatus.status === 'CONNECTED' ? '200 OK' : 'Ready'}
              </div>
            </div>
            <div>
              <span className="text-[#9CA3AF]">Packets Sent:</span>
              <div className="font-bold text-[#1F2937]">{telemetryStatus.packetsSent.toLocaleString()}</div>
            </div>
            <div>
              <span className="text-[#9CA3AF]">Latency / Rate:</span>
              <div className="font-bold text-[#1F2937]">{telemetryStatus.latencyMs}ms / 1s</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


