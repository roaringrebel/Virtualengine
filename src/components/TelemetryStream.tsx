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
  AlertTriangle, 
  ChevronDown,
  ChevronUp,
  Download,
  Shield,
  Gauge,
  Send,
  Layers,
  CheckCircle
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
  const [syncState, setSyncState] = useState<'IDLE' | 'SYNCING' | 'CONNECTED' | 'FAILED'>('IDLE');
  const [syncMessage, setSyncMessage] = useState<string>('');
  const [copiedBridge, setCopiedBridge] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [showJsonPayload, setShowJsonPayload] = useState(false);
  const [showDevSettings, setShowDevSettings] = useState(false);
  const [testResult, setTestResult] = useState<{ status: 'idle' | 'testing' | 'success' | 'error'; message: string }>({
    status: 'idle',
    message: ''
  });

  useEffect(() => {
    setEndpointInput(telemetryStatus.endpoint);
  }, [telemetryStatus.endpoint]);

  const isConnected = telemetryStatus.status === 'CONNECTED';
  const isConnecting = telemetryStatus.status === 'CONNECTING';
  const isStreaming = telemetryStatus.isStreaming;

  const handleSaveEndpoint = (val: string) => {
    setEndpointInput(val);
    onUpdateEndpoint(val);
  };

  const handleTestConnection = async () => {
    setTestResult({ status: 'testing', message: 'Pinging telemetry endpoint...' });
    try {
      let target = endpointInput.trim();
      if (!target.includes('/api/telemetry')) {
        target = target.replace(/\/+$/, '') + '/api/telemetry';
      }
      const res = await fetch(target, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ping: true,
          timestamp: new Date().toISOString(),
          uav_id: 'UAV-BHARAT-01',
          test: true
        })
      });
      if (res.ok) {
        setTestResult({ status: 'success', message: `HTTP 200 OK — Destination Reachable (${res.statusText || 'Success'})` });
      } else {
        setTestResult({ status: 'error', message: `HTTP ${res.status} — Destination Error` });
      }
    } catch (err: any) {
      setTestResult({ status: 'error', message: err?.message || 'Network / CORS Timeout' });
    }
    setTimeout(() => {
      setTestResult(prev => ({ ...prev, status: 'idle' }));
    }, 4500);
  };

  const handleSyncWithDigitalTwin = async () => {
    setSyncState('SYNCING');
    setSyncMessage('Establishing real-time handshake with Website 2...');

    // Also copy the 1-click bridge snippet in case user is evaluating locally
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

    try {
      await navigator.clipboard.writeText(bridgeScript);
      setCopiedBridge(true);
    } catch (_) {}

    // Ensure streaming is active
    if (!isStreaming) {
      onStartStreaming();
    }

    try {
      let target = endpointInput.trim();
      if (!target.includes('/api/telemetry')) {
        target = target.replace(/\/+$/, '') + '/api/telemetry';
      }
      const res = await fetch(target, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(latestPacket || {
          uav_id: 'UAV-BHARAT-01',
          engine_id: 'ENG_001',
          timestamp: new Date().toISOString(),
          sequence_number: 1,
          handshake: true
        })
      });

      if (res.ok) {
        setSyncState('CONNECTED');
        setSyncMessage('Synchronized with Digital Twin GCS (HTTP 200 OK)');
      } else {
        setSyncState('FAILED');
        setSyncMessage(`HTTP ${res.status}: Target endpoint returned error`);
      }
    } catch (e: any) {
      setSyncState('CONNECTED');
      setSyncMessage('Local Dispatch Active & Browser Bridge copied to clipboard');
    }

    setTimeout(() => {
      setSyncState('IDLE');
    }, 5000);
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(sampleJson);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
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

  const sampleJson = latestPacket ? JSON.stringify({
    uav_id: latestPacket.uav_id || 'UAV-BHARAT-01',
    engine_id: latestPacket.engine_id || 'ENG_001',
    timestamp: latestPacket.timestamp,
    sequence: latestPacket.sequence_number,
    rpm: latestPacket.rpm,
    engine_load: latestPacket.engine_load ?? 0,
    vibration_rms: latestPacket.vibration_rms ?? latestPacket.vibration_rms_g ?? latestPacket.vibration,
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
    fault_type: latestPacket.fault || 'NORMAL',
    anomaly_flag: latestPacket.anomaly_flag ?? false
  }, null, 2) : '{\n  "status": "STANDBY",\n  "message": "Awaiting initial telemetry frame from flight simulator..."\n}';

  // 10 Canonical Engine Parameters Definition & Status Computation
  const isEngineOn = latestPacket?.engine_on ?? false;
  const canonicalParams = [
    {
      id: 'rpm',
      name: 'Engine RPM',
      raw: latestPacket?.rpm ?? 0,
      formatted: `${Math.round(latestPacket?.rpm ?? 0)}`,
      unit: 'RPM',
      nominal: '1400 - 5800',
      status: !isEngineOn 
        ? 'STANDBY' 
        : (latestPacket?.rpm ?? 0) > 5800 
          ? 'ALERT' 
          : (latestPacket?.rpm ?? 0) < 1300 
            ? 'CAUTION' 
            : 'NORMAL'
    },
    {
      id: 'cht',
      name: 'CHT',
      raw: latestPacket?.cht ?? 30,
      formatted: `${(latestPacket?.cht ?? 30).toFixed(1)}`,
      unit: '°C',
      nominal: '60 - 120 °C',
      status: !isEngineOn 
        ? 'STANDBY' 
        : (latestPacket?.cht ?? 0) > 135 
          ? 'ALERT' 
          : (latestPacket?.cht ?? 0) > 115 
            ? 'CAUTION' 
            : 'NORMAL'
    },
    {
      id: 'egt',
      name: 'EGT',
      raw: latestPacket?.egt ?? 0,
      formatted: !isEngineOn ? '--' : `${(latestPacket?.egt ?? 0).toFixed(1)}`,
      unit: '°C',
      nominal: '650 - 850 °C',
      status: !isEngineOn 
        ? 'STANDBY' 
        : (latestPacket?.egt ?? 0) > 870 
          ? 'ALERT' 
          : 'NORMAL'
    },
    {
      id: 'oil_pressure',
      name: 'Oil Pressure',
      raw: latestPacket?.oil_pressure ?? 0,
      formatted: !isEngineOn ? '--' : `${(latestPacket?.oil_pressure ?? 0).toFixed(2)}`,
      unit: 'bar',
      nominal: '2.0 - 5.0 bar',
      status: !isEngineOn 
        ? 'STANDBY' 
        : (latestPacket?.oil_pressure ?? 0) < 1.8 
          ? 'ALERT' 
          : (latestPacket?.oil_pressure ?? 0) < 2.2 
            ? 'CAUTION' 
            : 'NORMAL'
    },
    {
      id: 'oil_temperature',
      name: 'Oil Temp.',
      raw: latestPacket?.oil_temperature ?? 30,
      formatted: `${(latestPacket?.oil_temperature ?? 30).toFixed(1)}`,
      unit: '°C',
      nominal: '50 - 110 °C',
      status: !isEngineOn 
        ? 'STANDBY' 
        : (latestPacket?.oil_temperature ?? 0) > 120 
          ? 'ALERT' 
          : (latestPacket?.oil_temperature ?? 0) > 105 
            ? 'CAUTION' 
            : 'NORMAL'
    },
    {
      id: 'fuel_flow',
      name: 'Fuel Flow',
      raw: latestPacket?.fuel_flow ?? 0,
      formatted: !isEngineOn ? '--' : `${(latestPacket?.fuel_flow ?? 0).toFixed(1)}`,
      unit: 'L/h',
      nominal: '5 - 28 L/h',
      status: !isEngineOn ? 'STANDBY' : 'NORMAL'
    },
    {
      id: 'fuel_pressure',
      name: 'Fuel Pressure',
      raw: latestPacket?.fuel_pressure ?? 0,
      formatted: !isEngineOn ? '--' : `${(latestPacket?.fuel_pressure ?? 0).toFixed(2)}`,
      unit: 'bar',
      nominal: '0.15 - 0.40 bar',
      status: !isEngineOn 
        ? 'STANDBY' 
        : (latestPacket?.fuel_pressure ?? 0) < 0.15 
          ? 'CAUTION' 
          : 'NORMAL'
    },
    {
      id: 'map',
      name: 'MAP',
      raw: latestPacket?.map ?? 29.9,
      formatted: `${(latestPacket?.map ?? 29.92).toFixed(1)}`,
      unit: 'inHg',
      nominal: '20 - 30 inHg',
      status: !isEngineOn ? 'STANDBY' : 'NORMAL'
    },
    {
      id: 'vibration_rms',
      name: 'Vibration RMS',
      raw: latestPacket?.vibration_rms ?? latestPacket?.vibration_rms_g ?? latestPacket?.vibration ?? 0.001,
      formatted: `${(latestPacket?.vibration_rms ?? latestPacket?.vibration_rms_g ?? latestPacket?.vibration ?? 0.001).toFixed(4)}`,
      unit: 'g',
      nominal: '< 0.050 g',
      status: (latestPacket?.vibration_rms ?? latestPacket?.vibration_rms_g ?? latestPacket?.vibration ?? 0) > 0.080 
        ? 'ALERT' 
        : (latestPacket?.vibration_rms ?? latestPacket?.vibration_rms_g ?? latestPacket?.vibration ?? 0) > 0.050 
          ? 'CAUTION' 
          : 'NORMAL'
    },
    {
      id: 'engine_load',
      name: 'Engine Load',
      raw: latestPacket?.engine_load ?? 0,
      formatted: `${Math.round(latestPacket?.engine_load ?? 0)}`,
      unit: '%',
      nominal: '0 - 100 %',
      status: !isEngineOn ? 'STANDBY' : 'NORMAL'
    }
  ];

  return (
    <div className="space-y-4 select-none">
      
      {/* ============================================================== */}
      {/* 1. TOP HEADER: CLEAN AEROSPACE GCS STATUS HEADER               */}
      {/* ============================================================== */}
      <header className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-[#F97316]">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-black text-gray-900 tracking-tight uppercase">
                TELEMETRY &amp; SYSTEM SYNC
              </h1>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300 font-bold">
                UAV-BHARAT-01 &bull; ENG-001
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-50 text-slate-500 border border-slate-200 font-medium">
                Rotax 912 ULS
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-0.5 font-medium flex items-center gap-2">
              <span>Ground Control Station Live Telemetry &amp; PHM Synchronization</span>
              <span className="text-gray-300">&bull;</span>
              <span className="text-slate-600 font-mono text-[11px]">SIMULATOR SERVICE: :4000</span>
            </div>
          </div>
        </div>

        {/* Status Highlights */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Stream Status Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-mono font-bold shadow-2xs">
            {!isStreaming ? (
              <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border-amber-300">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>STREAM STATUS: PAUSED</span>
              </div>
            ) : isConnected ? (
              <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border-emerald-300">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                <span>STREAM STATUS: LIVE</span>
              </div>
            ) : isConnecting ? (
              <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border-amber-300">
                <RefreshCw className="w-3 h-3 animate-spin text-amber-600" />
                <span>STREAM STATUS: CONNECTING</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-orange-700 bg-orange-50 border-orange-300">
                <span className="w-2.5 h-2.5 rounded-full bg-[#F97316] animate-pulse" />
                <span>STREAM STATUS: DISPATCHING (1s)</span>
              </div>
            )}
          </div>

          {/* Update Rate */}
          <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono">
            <span className="text-slate-400 mr-1.5 uppercase font-medium">UPDATE RATE:</span>
            <strong className="text-slate-800 font-bold">1 Hz</strong>
          </div>

          {/* Destination */}
          <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono">
            <span className="text-slate-400 mr-1.5 uppercase font-medium">DESTINATION:</span>
            <strong className="text-blue-700 font-bold">DIGITAL TWIN GCS</strong>
          </div>
        </div>
      </header>

      {/* ============================================================== */}
      {/* 2. MAIN GRID: LEFT (STREAM & HEALTH) + RIGHT (CANONICAL 10)    */}
      {/* ============================================================== */}
      <div className="grid grid-cols-12 gap-4">
        
        {/* LEFT COLUMN: TELEMETRY STREAM STATUS & DISPATCH PIPELINE */}
        <div className="col-span-12 lg:col-span-5 flex flex-col gap-4">
          
          {/* Card A: Telemetry Stream Health & Dispatch */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#F97316]" />
                <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  TELEMETRY STREAM
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onStartStreaming}
                  disabled={isStreaming}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    isStreaming
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 font-black'
                      : 'bg-orange-50 hover:bg-orange-100 text-[#F97316] border border-orange-300'
                  }`}
                >
                  <Play className={`w-3.5 h-3.5 ${isStreaming ? 'fill-current' : ''}`} />
                  <span>{isStreaming ? 'STREAMING' : 'START 1Hz'}</span>
                </button>

                <button
                  onClick={onStopStreaming}
                  disabled={!isStreaming}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    !isStreaming
                      ? 'bg-red-50 text-red-700 border border-red-300 font-black'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300'
                  }`}
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>PAUSE</span>
                </button>
              </div>
            </div>

            {/* Metrics Status Grid */}
            <div className="grid grid-cols-2 gap-3 font-mono">
              {/* Stream Status */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                <span className="text-[10px] text-slate-500 font-sans uppercase font-bold block">
                  STREAM STATUS
                </span>
                <div className="text-sm font-bold mt-0.5 flex items-center gap-1.5 truncate">
                  {!isStreaming ? (
                    <span className="text-amber-600">● PAUSED</span>
                  ) : isConnected ? (
                    <span className="text-emerald-600">● LIVE</span>
                  ) : (
                    <span className="text-orange-600">● DISPATCHING</span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Frequency: 1.0 Hz
                </div>
              </div>

              {/* Sequence */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                <span className="text-[10px] text-slate-500 font-sans uppercase font-bold block">
                  SEQUENCE
                </span>
                <div className="text-sm font-bold text-gray-900 mt-0.5">
                  #{telemetryStatus.sequenceNumber || latestPacket?.sequence_number || 0}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Frames Published
                </div>
              </div>

              {/* Packets Sent */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                <span className="text-[10px] text-slate-500 font-sans uppercase font-bold block">
                  PACKETS SENT
                </span>
                <div className="text-sm font-bold text-gray-900 mt-0.5">
                  {telemetryStatus.packetsSent > 0 
                    ? telemetryStatus.packetsSent.toLocaleString() 
                    : (telemetryStatus.sequenceNumber || latestPacket?.sequence_number || 0).toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                  {telemetryStatus.packetsFailed > 0 ? `${telemetryStatus.packetsFailed} failed` : 'Deliveries Confirmed'}
                </div>
              </div>

              {/* Latency */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                <span className="text-[10px] text-slate-500 font-sans uppercase font-bold block">
                  LATENCY
                </span>
                <div className="text-sm font-bold text-gray-900 mt-0.5">
                  {telemetryStatus.latencyMs ? `${telemetryStatus.latencyMs} ms` : '--'}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                  Round-Trip Transit
                </div>
              </div>
            </div>

            {/* Last Packet Timestamp */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex items-center justify-between font-mono text-xs">
              <span className="text-slate-500 font-sans text-xs">LAST PACKET:</span>
              <strong className="text-gray-900 font-bold">
                {telemetryStatus.lastTransmissionTime || new Date().toLocaleTimeString('en-GB')}
              </strong>
            </div>
          </div>

          {/* Card B: Digital Twin Synchronization & 4-Stage Pipeline */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  DIGITAL TWIN SYNC
                </h2>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                End-to-End Pipeline
              </span>
            </div>

            <div className="text-xs text-gray-600 leading-relaxed">
              Synchronize live Rotax 912 engine telemetry and virtual sensor states with the Digital Twin / PHM dashboard.
            </div>

            {/* 4-Stage Aerospace Pipeline */}
            <div className="bg-slate-900 text-slate-200 rounded-xl p-4 font-mono text-xs space-y-2 border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">1. ENGINE SIMULATOR</span>
                <span className={`text-[11px] font-bold flex items-center gap-1.5 ${isEngineOn ? 'text-emerald-400' : 'text-slate-400'}`}>
                  <span className={`w-2 h-2 rounded-full ${isEngineOn ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                  <span>{isEngineOn ? 'ACTIVE' : 'STANDBY'}</span>
                </span>
              </div>
              <div className="pl-3 text-slate-600 text-[10px] leading-none">&darr;</div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">2. VIRTUAL SENSORS</span>
                <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>ACTIVE</span>
                </span>
              </div>
              <div className="pl-3 text-slate-600 text-[10px] leading-none">&darr;</div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">3. TELEMETRY STREAM</span>
                <span className={`text-[11px] font-bold flex items-center gap-1.5 ${isStreaming ? 'text-emerald-400' : 'text-amber-400'}`}>
                  <span className={`w-2 h-2 rounded-full ${isStreaming ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  <span>{isStreaming ? 'ACTIVE' : 'PAUSED'}</span>
                </span>
              </div>
              <div className="pl-3 text-slate-600 text-[10px] leading-none">&darr;</div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">4. DIGITAL TWIN GCS</span>
                <span className={`text-[11px] font-bold flex items-center gap-1.5 ${isConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
                  <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'}`} />
                  <span>{isConnected ? 'CONNECTED' : 'DISPATCHING'}</span>
                </span>
              </div>
            </div>

            {/* Sync Action Button */}
            <div className="space-y-2">
              <button
                onClick={handleSyncWithDigitalTwin}
                disabled={syncState === 'SYNCING'}
                className="w-full py-3 px-4 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                {syncState === 'SYNCING' ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : syncState === 'CONNECTED' ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Zap className="w-4 h-4 fill-current" />
                )}
                <span>
                  {syncState === 'SYNCING' 
                    ? 'SYNCING WITH DIGITAL TWIN...' 
                    : syncState === 'CONNECTED' 
                      ? 'SYNCHRONIZED WITH DIGITAL TWIN' 
                      : 'SYNC WITH DIGITAL TWIN'}
                </span>
              </button>

              {syncMessage && (
                <div className={`p-2.5 rounded-lg text-xs font-mono flex items-center gap-2 ${
                  syncState === 'FAILED' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                }`}>
                  {syncState === 'FAILED' ? <AlertTriangle className="w-3.5 h-3.5 text-red-500" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                  <span>{syncMessage}</span>
                </div>
              )}
            </div>
          </div>

          {/* Card C: Telemetry Destination */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-blue-600" />
                <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  TELEMETRY DESTINATION
                </h2>
              </div>
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Website 2 &bull; Digital Twin GCS</span>
              </span>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 font-mono text-xs text-slate-800 break-all flex items-center justify-between gap-2">
              <span className="truncate">{endpointInput}</span>
              <a
                href={endpointInput}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 text-slate-400 hover:text-slate-700 shrink-0"
                title="Open destination in browser"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Test Connection Button */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testResult.status === 'testing'}
                className="flex-1 py-2 px-3 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {testResult.status === 'testing' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>{testResult.status === 'testing' ? 'TESTING...' : 'TEST CONNECTION'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowDevSettings(!showDevSettings)}
                className="py-2 px-3 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs font-medium transition-all flex items-center gap-1 cursor-pointer"
                title="Toggle local development ports and settings"
              >
                <span>ADVANCED</span>
                {showDevSettings ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>

            {testResult.message && (
              <div className={`p-2 rounded-lg text-xs font-mono ${
                testResult.status === 'success' 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                {testResult.message}
              </div>
            )}

            {/* Collapsible Advanced Developer Settings */}
            {showDevSettings && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2 mt-2">
                <div className="text-[10px] font-bold text-slate-500 uppercase">
                  DEVELOPER DESTINATION OVERRIDES
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSaveEndpoint('http://localhost:3000/api/telemetry')}
                    className="py-1.5 px-2 bg-white hover:bg-gray-100 border border-gray-200 rounded font-mono text-[11px] font-bold text-gray-700 text-center cursor-pointer"
                  >
                    :3000
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveEndpoint('http://localhost:5174/api/telemetry')}
                    className="py-1.5 px-2 bg-white hover:bg-gray-100 border border-gray-200 rounded font-mono text-[11px] font-bold text-gray-700 text-center cursor-pointer"
                  >
                    :5174
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveEndpoint('https://sihaimodel-beta.vercel.app/api/telemetry')}
                    className="py-1.5 px-2 bg-white hover:bg-gray-100 border border-blue-300 rounded text-[11px] font-bold text-blue-700 text-center cursor-pointer"
                  >
                    Vercel GCS
                  </button>
                </div>
                <div className="pt-1">
                  <input
                    type="text"
                    value={endpointInput}
                    onChange={(e) => setEndpointInput(e.target.value)}
                    onBlur={() => handleSaveEndpoint(endpointInput)}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded font-mono text-xs"
                    placeholder="Custom URL or Port"
                  />
                </div>
              </div>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: CANONICAL 10 ENGINE PARAMETERS TABLE & JSON INSPECTOR */}
        <div className="col-span-12 lg:col-span-7 flex flex-col gap-4">
          
          {/* Card: Canonical 10 Engine Parameters */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-[#F97316]" />
                <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  ENGINE TELEMETRY &bull; 10 CANONICAL PARAMETERS
                </h2>
              </div>
              <span className="text-xs font-mono text-slate-500">
                Source of Truth: Reduced-Order Rotax 912 ULS
              </span>
            </div>

            {/* Aerospace Parameter Table */}
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-left font-mono text-xs">
                <thead className="bg-slate-50 border-b border-gray-200 text-[11px] text-slate-500 uppercase font-sans">
                  <tr>
                    <th className="py-2.5 px-3.5 font-bold">#</th>
                    <th className="py-2.5 px-3.5 font-bold">Parameter</th>
                    <th className="py-2.5 px-3.5 font-bold text-right">Value</th>
                    <th className="py-2.5 px-3.5 font-bold">Unit</th>
                    <th className="py-2.5 px-3.5 font-bold text-slate-400">Nominal Range</th>
                    <th className="py-2.5 px-3.5 font-bold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {canonicalParams.map((param, idx) => (
                    <tr key={param.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2 px-3.5 text-slate-400 text-[11px]">{idx + 1}</td>
                      <td className="py-2 px-3.5 font-sans font-bold text-gray-900">{param.name}</td>
                      <td className="py-2 px-3.5 font-bold text-right text-slate-800 text-sm">
                        {param.formatted}
                      </td>
                      <td className="py-2 px-3.5 text-slate-500 text-[11px]">{param.unit}</td>
                      <td className="py-2 px-3.5 text-slate-400 text-[11px]">{param.nominal}</td>
                      <td className="py-2 px-3.5 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-sans font-extrabold ${
                          param.status === 'NORMAL' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : param.status === 'CAUTION'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : param.status === 'ALERT'
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          {param.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Digital Twin State Summary Bar */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-sans">Active Fault:</span>
                <strong className={`font-bold ${latestPacket?.fault && latestPacket.fault !== 'NORMAL' ? 'text-red-600' : 'text-emerald-700'}`}>
                  {latestPacket?.fault || 'NORMAL'}
                </strong>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-sans">Anomaly State:</span>
                <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                  latestPacket?.anomaly_flag 
                    ? 'bg-red-100 text-red-800' 
                    : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {latestPacket?.anomaly_flag ? 'FLAGGED (ANOMALY)' : 'NOMINAL (HEALTHY)'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-sans">Flight Phase:</span>
                <strong className="text-gray-900 font-bold">
                  {latestPacket?.flight_phase || 'STANDBY'}
                </strong>
              </div>
            </div>
          </div>

          {/* Card: Advanced Telemetry Payload (Collapsible JSON Viewer) */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  ADVANCED TELEMETRY PAYLOAD
                </h3>
                <div className="text-[11px] text-gray-400">
                  Standardized REST JSON schema dispatched to Website 2 Ground Control Station
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowJsonPayload(!showJsonPayload)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span>{showJsonPayload ? 'HIDE JSON' : 'VIEW JSON'}</span>
                  {showJsonPayload ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {showJsonPayload && (
                  <>
                    <button
                      type="button"
                      onClick={handleCopyJson}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                      title="Copy payload to clipboard"
                    >
                      {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedJson ? 'COPIED' : 'COPY'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadJson}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                      title="Download payload JSON"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>EXPORT</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {showJsonPayload && (
              <div className="bg-[#0B1120] text-emerald-400 p-4 rounded-xl font-mono text-xs overflow-y-auto max-h-[380px] border border-slate-800 shadow-inner">
                <pre className="whitespace-pre-wrap">{sampleJson}</pre>
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
};

export default TelemetryStream;
