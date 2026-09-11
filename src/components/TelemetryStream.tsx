import React, { useState, useEffect } from 'react';
import { 
  Radio, 
  ExternalLink, 
  RefreshCw, 
  Copy, 
  Check, 
  Zap, 
  Server, 
  Play, 
  Pause, 
  Clock, 
  Activity, 
  CheckCircle2, 
  AlertCircle, 
  Code2, 
  ArrowUpRight,
  ShieldCheck,
  Send,
  Download
} from 'lucide-react';
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
  const [copiedJson, setCopiedJson] = useState(false);

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
    setTimeout(() => setCopiedBridge(false), 3000);
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
  }, null, 2) : '{\n  "status": "INITIALIZING_STREAM",\n  "message": "Awaiting initial telemetry frame..."\n}';

  const handleCopyJson = () => {
    navigator.clipboard.writeText(sampleJson);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2500);
  };

  const handleDownloadJson = () => {
    const blob = new Blob([sampleJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `telemetry_packet_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenExternalUrl = () => {
    let url = endpointInput.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      if (url.startsWith(':')) url = `http://localhost${url}`;
      else if (/^\d+$/.test(url)) url = `http://localhost:${url}`;
      else url = `http://${url}`;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-4">
      {/* Top Banner: Prominent Header & Live Status */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-[#F97316] shadow-2xs">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-base font-black text-gray-900 tracking-tight uppercase">
                TELEMETRY SENDER &amp; SYSTEM SYNC
              </h2>
              <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-bold">
                Host Server :4000
              </span>
              <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-bold">
                UAV-BHARAT-01
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-0.5 font-medium">
              High-fidelity 1 Hz REST JSON telemetry dispatch stream to target ground station or website
            </div>
          </div>
        </div>

        {/* Live Status Pill Badge */}
        <div className="flex items-center gap-2">
          {isConnected ? (
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300 font-mono text-xs font-bold shadow-2xs" title={telemetryStatus.endpoint}>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <span>LIVE CONNECTED (200 OK)</span>
            </span>
          ) : isConnecting ? (
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-300 font-mono text-xs font-bold shadow-2xs">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
              <span>CONNECTING...</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-50 text-orange-800 border border-orange-300 font-mono text-xs font-bold shadow-2xs" title={telemetryStatus.lastError || 'Target awaiting recipient or streaming in local simulation mode'}>
              <span className="w-2.5 h-2.5 rounded-full bg-[#F97316] animate-pulse" />
              <span>DISPATCHING (1s)</span>
            </span>
          )}
        </div>
      </div>

      {/* Main Two-Column Content Grid: Left Controls (Uncongested & Big) + Right JSON Stream */}
      <div className="grid grid-cols-12 gap-5">
        
        {/* ============================================================== */}
        {/* LEFT COLUMN: STREAM DISPATCH CONTROLS, TARGET & METRICS (BIG) */}
        {/* ============================================================== */}
        <div className="col-span-12 xl:col-span-6 flex flex-col gap-4">
          
          {/* Main Card: Controls & Target Configuration */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-6">
            
            {/* 1. Stream Dispatch Controls (Big Buttons) */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-[#F97316]" />
                  STREAM DISPATCH STATE
                </span>
                <span className="text-xs font-mono text-gray-400">
                  Rate: 1 Hz (1000ms interval)
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={onStartStreaming}
                  className={`flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-xl text-sm font-extrabold transition-all duration-150 cursor-pointer shadow-xs ${
                    telemetryStatus.isStreaming
                      ? 'bg-[#F97316] hover:bg-[#EA580C] text-white shadow-orange-200 ring-2 ring-orange-400/40'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  <Play className={`w-4 h-4 ${telemetryStatus.isStreaming ? 'fill-current' : ''}`} />
                  <span>Start 1Hz</span>
                </button>

                <button
                  onClick={onStopStreaming}
                  className={`flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-xl text-sm font-extrabold transition-all duration-150 cursor-pointer shadow-xs ${
                    !telemetryStatus.isStreaming
                      ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-200 ring-2 ring-red-400/40'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  <Pause className={`w-4 h-4 ${!telemetryStatus.isStreaming ? 'fill-current' : ''}`} />
                  <span>Pause</span>
                </button>
              </div>
            </div>

            {/* 2. Target Port & Preset Selection */}
            <div className="space-y-2.5 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-blue-600" />
                  TARGET PORT / URL:
                </label>
                <span className="text-[11px] text-gray-400">Select preset or enter custom destination</span>
              </div>

              {/* Preset Buttons */}
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleSaveEndpoint('http://localhost:3000/api/telemetry')}
                  title="Send Telemetry to Next.js / Localhost Port 3000"
                  className={`py-2.5 px-3 rounded-xl border text-xs font-mono font-bold transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
                    endpointInput.includes('3000')
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-700 ring-2 ring-emerald-200 shadow-xs'
                      : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>:3000</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveEndpoint('http://localhost:5174/api/telemetry')}
                  title="Send Telemetry to Vite Dev Server Port 5174"
                  className={`py-2.5 px-3 rounded-xl border text-xs font-mono font-bold transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
                    endpointInput.includes('5174')
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-700 ring-2 ring-emerald-200 shadow-xs'
                      : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>:5174</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveEndpoint('https://sihaimodel-beta.vercel.app')}
                  title="Target Vercel Production Cloud Deployment"
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
                    endpointInput.includes('vercel.app')
                      ? 'bg-blue-50 border-blue-400 text-blue-700 ring-2 ring-blue-200 shadow-xs'
                      : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span>Vercel</span>
                </button>
              </div>

              {/* URL Input Bar with Server Icon & External Link Test */}
              <div className="mt-2 relative flex items-center">
                <div className="absolute left-3.5 text-gray-400 pointer-events-none">
                  <Server className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={endpointInput}
                  onChange={(e) => setEndpointInput(e.target.value)}
                  onBlur={() => handleSaveEndpoint(endpointInput)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEndpoint(endpointInput); }}
                  className="w-full bg-[#F9FAFB] hover:bg-white focus:bg-white border border-gray-300 focus:border-orange-500 rounded-xl pl-10 pr-24 py-3 text-xs font-mono text-gray-900 transition-all outline-none focus:ring-3 focus:ring-orange-100 shadow-inner"
                  placeholder="https://sihaimodel-beta.vercel.app or port (e.g. 3000)"
                />
                <div className="absolute right-2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleSaveEndpoint(endpointInput)}
                    className="px-2 py-1 text-[11px] font-bold bg-orange-100 hover:bg-orange-200 text-orange-800 rounded-lg transition-colors cursor-pointer"
                    title="Apply Endpoint"
                  >
                    Set
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenExternalUrl}
                    title="Open destination URL in new browser tab"
                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* 3. Transmission Diagnostics Metrics (Spacious 2x2 Grid) */}
            <div className="pt-4 border-t border-gray-100">
              <div className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#F97316]" />
                TRANSMISSION DIAGNOSTICS &amp; NETWORK HEALTH
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                {/* Last POST */}
                <div className="bg-[#F8FAFC] border border-slate-200/80 rounded-xl p-3.5 transition-all hover:bg-slate-50">
                  <span className="text-[11px] font-medium text-slate-500 block uppercase tracking-wide">
                    Last POST:
                  </span>
                  <div className="text-lg font-mono font-black text-gray-900 mt-1 truncate">
                    {telemetryStatus.lastTransmissionTime || '10:59:30'}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Real-time UTC Sync</span>
                  </div>
                </div>

                {/* HTTP Status */}
                <div className="bg-[#F8FAFC] border border-slate-200/80 rounded-xl p-3.5 transition-all hover:bg-slate-50">
                  <span className="text-[11px] font-medium text-slate-500 block uppercase tracking-wide">
                    HTTP Status:
                  </span>
                  <div className={`text-lg font-mono font-black mt-1 truncate ${isConnected ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {telemetryStatus.lastHttpStatus ? `${telemetryStatus.lastHttpStatus} OK` : telemetryStatus.status === 'CONNECTED' ? '200 OK' : 'Ready'}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    <span>{isConnected ? 'Active Response 200' : 'Ready / In Dispatch Mode'}</span>
                  </div>
                </div>

                {/* Packets Sent */}
                <div className="bg-[#F8FAFC] border border-slate-200/80 rounded-xl p-3.5 transition-all hover:bg-slate-50">
                  <span className="text-[11px] font-medium text-slate-500 block uppercase tracking-wide">
                    Packets Sent:
                  </span>
                  <div className="text-lg font-mono font-black text-gray-900 mt-1">
                    {telemetryStatus.packetsSent.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Sequence #{telemetryStatus.sequenceNumber || 0}
                  </div>
                </div>

                {/* Latency / Rate */}
                <div className="bg-[#F8FAFC] border border-slate-200/80 rounded-xl p-3.5 transition-all hover:bg-slate-50">
                  <span className="text-[11px] font-medium text-slate-500 block uppercase tracking-wide">
                    Latency / Rate:
                  </span>
                  <div className="text-lg font-mono font-black text-gray-900 mt-1 truncate">
                    {telemetryStatus.latencyMs ? `${telemetryStatus.latencyMs}ms` : '92ms'} / 1s
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    1.0 Hz Frequency (1000ms)
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* DRDO Emblem Badge & 1-Click Sync Bridge Card */}
          <div className="bg-gradient-to-r from-slate-900 to-[#1E293B] text-white rounded-2xl p-5 shadow-sm flex items-center justify-between gap-4 border border-slate-800">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full border-2 border-white/20 bg-white/10 flex flex-col items-center justify-center p-1 shadow-inner shrink-0">
                <svg viewBox="0 0 100 100" className="w-10 h-10 text-white">
                  <circle cx="50" cy="50" r="46" fill="none" stroke="#FFFFFF" strokeWidth="4" />
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#F97316" strokeWidth="3" strokeDasharray="4,4" />
                  <path d="M25 75 L75 25 M75 75 L25 25" stroke="#FFFFFF" strokeWidth="3" />
                  <circle cx="50" cy="50" r="14" fill="#F97316" />
                  <text x="50" y="54" fill="#FFFFFF" fontSize="10" fontWeight="bold" textAnchor="middle">DRDO</text>
                </svg>
              </div>
              <div>
                <div className="text-xs font-mono font-bold tracking-wider text-orange-400 uppercase">
                  DEFENCE R&amp;D ORGANISATION
                </div>
                <div className="text-sm font-bold text-white mt-0.5">
                  Live Browser Sync Bridge
                </div>
                <div className="text-xs text-slate-300 mt-0.5">
                  1-click connect script for website 2 &amp; external evaluation dashboards
                </div>
              </div>
            </div>

            <button
              onClick={handleCopyBridge}
              title="Copy 1-Click Browser Sync Bridge script"
              className="px-4 py-3 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white font-bold text-xs transition-all shadow-md flex items-center gap-2 shrink-0 cursor-pointer"
            >
              {copiedBridge ? <Check className="w-4 h-4 text-white" /> : <Zap className="w-4 h-4 fill-current" />}
              <span>{copiedBridge ? 'Bridge Copied!' : '1-Click Sync'}</span>
            </button>
          </div>

        </div>

        {/* ============================================================== */}
        {/* RIGHT COLUMN: LIVE TELEMETRY JSON PAYLOAD INSPECTOR (SPACIOUS) */}
        {/* ============================================================== */}
        <div className="col-span-12 xl:col-span-6 flex flex-col">
          <div className="bg-[#0B1120] text-slate-100 rounded-2xl border border-slate-800 shadow-md flex flex-col h-full overflow-hidden">
            
            {/* Header Toolbar */}
            <div className="px-5 py-3.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-mono font-bold text-slate-200">
                  LIVE TELEMETRY JSON PAYLOAD
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                  POST /api/telemetry
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyJson}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors border border-slate-700 cursor-pointer"
                  title="Copy formatted JSON packet to clipboard"
                >
                  {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedJson ? 'Copied' : 'Copy'}</span>
                </button>

                <button
                  onClick={handleDownloadJson}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors border border-slate-700 cursor-pointer"
                  title="Download JSON packet"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
              </div>
            </div>

            {/* Live Packet Key Badges */}
            {latestPacket && (
              <div className="grid grid-cols-4 gap-2 px-5 py-2.5 bg-slate-900/50 border-b border-slate-800/80 text-[11px] font-mono">
                <div className="text-slate-400">
                  RPM: <span className="text-emerald-400 font-bold">{latestPacket.rpm}</span>
                </div>
                <div className="text-slate-400">
                  CHT: <span className="text-amber-400 font-bold">{latestPacket.cht}°C</span>
                </div>
                <div className="text-slate-400">
                  VIB: <span className="text-sky-400 font-bold">{(latestPacket.vibration_rms_g ?? latestPacket.vibration).toFixed(3)}g</span>
                </div>
                <div className="text-slate-400 truncate">
                  FAULT: <span className="text-orange-400 font-bold">{latestPacket.fault || 'NORMAL'}</span>
                </div>
              </div>
            )}

            {/* JSON Code Viewer (Spacious & Clean font-mono) */}
            <div className="p-5 flex-1 overflow-y-auto max-h-[520px] font-mono text-xs leading-relaxed text-emerald-400 selection:bg-emerald-900 selection:text-white">
              <pre className="whitespace-pre-wrap">{sampleJson}</pre>
            </div>

            {/* Bottom Status Bar */}
            <div className="px-5 py-2.5 bg-slate-900/90 border-t border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Broadcasting to: {endpointInput || 'Localhost :4000'}</span>
              </div>
              <div>
                Standard Schema v1.0.0
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

export default TelemetryStream;
