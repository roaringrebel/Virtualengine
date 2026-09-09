import React from 'react';
import { Power, CheckCircle, AlertTriangle, Play, Square, Activity, Radio, Zap } from 'lucide-react';
import { Rotax912State, SensorSuiteState } from '../types/simulation';
import { SensorCard } from './SensorCard';

interface EnginePanelProps {
  engine: Rotax912State;
  sensors: SensorSuiteState;
  engineOn: boolean;
  liveWaveform?: number[];
  onStartEngine: () => void;
  onStopEngine: () => void;
}

export const EnginePanel: React.FC<EnginePanelProps> = ({
  engine,
  sensors,
  engineOn,
  liveWaveform = [],
  onStartEngine,
  onStopEngine
}) => {
  const isAnyWarning = Object.values(sensors).some(s => s.status === 'warning' || s.status === 'critical');
  const isCritical = Object.values(sensors).some(s => s.status === 'critical');

  const getStatusBadge = () => {
    switch (engine.status) {
      case 'OFF':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-gray-100 text-gray-500 border border-gray-200">
            <span className="w-2 h-2 rounded-full bg-gray-400" />
            <span>ENGINE OFF (STANDBY)</span>
          </div>
        );
      case 'CRANKING':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            <span>CRANKING (~300 RPM)</span>
          </div>
        );
      case 'IGNITION':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-orange-100 text-orange-800 border border-orange-300 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-[#F97316]" />
            <span>IGNITION / COMBUSTION</span>
          </div>
        );
      case 'STARTING':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-[#F59E0B] border border-amber-200 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
            <span>STARTING</span>
          </div>
        );
      case 'IDLE':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-600 border border-blue-200">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span>IDLE (~1,400 RPM)</span>
          </div>
        );
      case 'STOPPING':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-gray-200 text-gray-700 border border-gray-300">
            <span className="w-2 h-2 rounded-full bg-gray-500" />
            <span>SPOOLING DOWN</span>
          </div>
        );
      case 'FAULT':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-50 text-[#EF4444] border border-red-200 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
            <span>FAULT ACTIVE</span>
          </div>
        );
      case 'RUNNING':
      default:
        if (isCritical) {
          return (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-50 text-[#EF4444] border border-red-200 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
              <span>CRITICAL</span>
            </div>
          );
        }
        if (isAnyWarning) {
          return (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-[#F59E0B] border border-amber-200">
              <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
              <span>WARNING</span>
            </div>
          );
        }
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-[#10B981] border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-[#10B981]" />
            <span>RUNNING (NOMINAL)</span>
          </div>
        );
    }
  };

  const vibMetrics = engine.vibrationMetrics;
  const waveformSamples = liveWaveform.length > 0 ? liveWaveform : new Array(100).fill(0.001);

  // Render live SVG vibration waveform
  const renderWaveformSvg = () => {
    const width = 420;
    const height = 55;
    const N = waveformSamples.length;

    if (N < 2) {
      return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-14 bg-gray-900 rounded-lg">
          <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="#374151" strokeWidth="1" strokeDasharray="3,3" />
        </svg>
      );
    }

    // Determine scale based on max value in waveform
    const maxVal = Math.max(0.06, ...waveformSamples);
    const stepX = width / (N - 1);

    const coords = waveformSamples.map((v, i) => {
      const x = i * stepX;
      const norm = Math.min(1.0, Math.max(0, v / maxVal));
      const y = height - norm * (height - 10) - 5;
      return { x, y };
    });

    const pathD = coords.reduce((acc, pt, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`, '');
    const fillD = `${pathD} L ${width},${height} L 0,${height} Z`;

    const isFault = engine.status === 'FAULT' || (vibMetrics && vibMetrics.rmsG > 0.060);
    const strokeColor = isFault ? '#EF4444' : engineOn ? '#10B981' : '#6B7280';
    const fillColor = isFault ? 'rgba(239, 68, 68, 0.18)' : engineOn ? 'rgba(16, 185, 129, 0.15)' : 'rgba(107, 114, 128, 0.08)';

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-14 bg-[#0F172A] rounded-lg overflow-hidden border border-[#1E293B]">
        {/* Grid lines */}
        <line x1="0" y1={height * 0.25} x2={width} y2={height * 0.25} stroke="#1E293B" strokeWidth="1" strokeDasharray="2,2" />
        <line x1="0" y1={height * 0.50} x2={width} y2={height * 0.50} stroke="#334155" strokeWidth="1" strokeDasharray="2,2" />
        <line x1="0" y1={height * 0.75} x2={width} y2={height * 0.75} stroke="#1E293B" strokeWidth="1" strokeDasharray="2,2" />

        {/* Gradient fill & trace */}
        <path d={fillD} fill={fillColor} />
        <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />

        {/* Leading point */}
        {coords.length > 0 && (
          <circle 
            cx={coords[coords.length - 1].x} 
            cy={coords[coords.length - 1].y} 
            r="3" 
            fill={strokeColor} 
            className={engineOn ? 'animate-ping' : ''} 
          />
        )}
      </svg>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-3.5 shadow-sm flex flex-col justify-between h-full space-y-3">
      {/* Top Header */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-orange-50 border border-orange-200 flex items-center justify-center text-[#F97316]">
              <Power className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-[#1F2937] tracking-tight uppercase">ENGINE: ROTAX 912 ULS</h2>
              <div className="text-[10px] text-[#6B7280]">REDUCED-ORDER PHYSICS & VIBRATION TWIN</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {getStatusBadge()}

            {engineOn ? (
              <button
                onClick={onStopEngine}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-[#EF4444] hover:bg-red-600 text-white transition-all shadow-sm"
                title="Stop engine / Cutoff fuel & ignition"
              >
                <Square className="w-3 h-3 fill-current" />
                <span>STOP ENGINE</span>
              </button>
            ) : (
              <button
                onClick={onStartEngine}
                className="flex items-center gap-1.5 px-3.5 py-1 rounded-lg text-xs font-bold bg-[#F97316] hover:bg-orange-600 text-white transition-all shadow-orange-glow animate-pulse"
                title="Start engine ignition and activate simulator"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>START ENGINE</span>
              </button>
            )}
          </div>
        </div>

        {/* Engine Visual Graphic & Specs Table */}
        <div className="grid grid-cols-12 gap-3 mb-3 items-center bg-[#F9FAFB] p-2.5 rounded-xl border border-[#E5E7EB]">
          {/* Rotax 912 ULS High-Detail Graphic Rendering */}
          <div className="col-span-6 flex items-center justify-center relative">
            <svg viewBox="0 0 340 180" className="w-full max-h-[100px] drop-shadow-md select-none">
              <defs>
                <linearGradient id="engineBlockGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#374151" />
                  <stop offset="50%" stopColor="#1F2937" />
                  <stop offset="100%" stopColor="#111827" />
                </linearGradient>

                <linearGradient id="metalPipeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#9CA3AF" />
                  <stop offset="50%" stopColor="#4B5563" />
                  <stop offset="100%" stopColor="#374151" />
                </linearGradient>

                <linearGradient id="rotaxCoverGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#1F2937" />
                  <stop offset="50%" stopColor="#111827" />
                  <stop offset="100%" stopColor="#030712" />
                </linearGradient>
              </defs>

              {/* Crankcase and Reduction Gearbox */}
              <rect x="180" y="45" width="130" height="90" rx="8" fill="url(#metalPipeGrad)" stroke="#6B7280" strokeWidth="2" />
              
              {/* Propeller Hub Flange */}
              <rect x="295" y="65" width="25" height="50" rx="4" fill="#9CA3AF" stroke="#4B5563" strokeWidth="2" />
              <circle cx="307" cy="90" r="10" fill="#374151" />

              {/* Central Engine Block & Cylinder Barrels */}
              <rect x="40" y="30" width="160" height="120" rx="10" fill="url(#engineBlockGrad)" stroke="#4B5563" strokeWidth="2" />

              {/* Cylinder Head Valve Cover */}
              <rect x="50" y="45" width="140" height="85" rx="8" fill="url(#rotaxCoverGrad)" stroke="#F97316" strokeWidth="1.5" />
              
              {/* ROTAX Badge */}
              <rect x="75" y="70" width="90" height="35" rx="4" fill="#000000" stroke="#4B5563" strokeWidth="1" />
              <text x="120" y="93" fill="#FFFFFF" fontSize="16" fontWeight="900" fontFamily="sans-serif" textAnchor="middle" letterSpacing="2">ROTAX</text>
              <text x="120" y="103" fill="#F97316" fontSize="6.5" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle" letterSpacing="1">912 ULS</text>

              {/* Dual Bing Carburetors & Air Intake Pipes */}
              <path d="M 70,30 L 70,15 L 110,15 L 110,30" fill="none" stroke="url(#metalPipeGrad)" strokeWidth="6" />
              <path d="M 130,30 L 130,15 L 170,15 L 170,30" fill="none" stroke="url(#metalPipeGrad)" strokeWidth="6" />
              <circle cx="90" cy="15" r="8" fill="#4B5563" />
              <circle cx="150" cy="15" r="8" fill="#4B5563" />

              {/* Exhaust Manifold Pipes */}
              <path d="M 60,150 L 60,165 L 180,165" fill="none" stroke="#78350F" strokeWidth="5" opacity="0.85" />
              <path d="M 120,150 L 120,165" fill="none" stroke="#78350F" strokeWidth="5" opacity="0.85" />

              {/* Engine Status Glow Dots */}
              {engineOn && (
                <>
                  <circle cx="65" cy="55" r="3" fill="#10B981" className="animate-ping" />
                  <circle cx="65" cy="55" r="2.5" fill="#10B981" />
                  <circle cx="175" cy="55" r="2.5" fill="#F97316" />
                </>
              )}
            </svg>
          </div>

          {/* Specifications Table */}
          <div className="col-span-6 pl-2 border-l border-[#E5E7EB] text-[10px] space-y-1">
            <div className="text-[11px] font-extrabold text-[#1F2937] mb-1">
              ROTAX 912 ULS
            </div>
            <div className="flex justify-between text-[#6B7280]">
              <span>Type</span>
              <strong className="text-[#1F2937]">4-cyl, 4-stroke</strong>
            </div>
            <div className="flex justify-between text-[#6B7280]">
              <span>Displacement</span>
              <strong className="text-[#1F2937]">1,352 cm³</strong>
            </div>
            <div className="flex justify-between text-[#6B7280]">
              <span>Power Rating</span>
              <strong className="text-[#1F2937]">100 hp @ 5,800 RPM</strong>
            </div>
            <div className="flex justify-between text-[#6B7280]">
              <span>Vibration Model</span>
              <strong className="text-[#10B981]">3-Axis FFT (01_dataset calibrated)</strong>
            </div>
            <div className="flex justify-between text-[#6B7280]">
              <span>Standard Units</span>
              <strong className="text-[#F97316]">Acceleration in g</strong>
            </div>
          </div>
        </div>

        {/* LIVE VIBRATION SIGNAL & FFT SPECTRUM CARD */}
        <div className="bg-[#F8FAFC] p-3 rounded-xl border border-[#CBD5E1] mb-3 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#0F172A]">
              <Activity className="w-4 h-4 text-[#F97316]" />
              <span>LIVE VIBRATION SIGNAL (RESULTANT ACCELERATION IN g)</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-[#475569]">
              <span className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${engineOn ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
                <span>{engineOn ? '500 Hz Continuous Sampling' : 'Sensor Standby'}</span>
              </span>
              <span>•</span>
              <span>1X Shaft: {engineOn ? (engine.rpm / 60.0).toFixed(1) : '0.0'} Hz</span>
            </div>
          </div>

          {/* Animated Waveform */}
          <div className="mb-2.5">
            {renderWaveformSvg()}
          </div>

          {/* 6 Vibration Metrics Pills */}
          <div className="grid grid-cols-6 gap-1.5 text-[10px]">
            <div className="bg-white p-1.5 rounded-lg border border-[#E2E8F0] text-center shadow-2xs">
              <div className="text-[9px] text-[#64748B] font-semibold">RMS (g)</div>
              <div className="font-extrabold font-mono text-xs text-[#0F172A] mt-0.5">
                {engineOn ? (vibMetrics?.rmsG || 0.001).toFixed(3) : '0.001'}
              </div>
            </div>

            <div className="bg-white p-1.5 rounded-lg border border-[#E2E8F0] text-center shadow-2xs">
              <div className="text-[9px] text-[#64748B] font-semibold">PEAK (g)</div>
              <div className="font-extrabold font-mono text-xs text-[#0F172A] mt-0.5">
                {engineOn ? (vibMetrics?.peakG || 0.002).toFixed(3) : '0.002'}
              </div>
            </div>

            <div className="bg-white p-1.5 rounded-lg border border-[#E2E8F0] text-center shadow-2xs">
              <div className="text-[9px] text-[#64748B] font-semibold">PEAK-PEAK (g)</div>
              <div className="font-extrabold font-mono text-xs text-[#0F172A] mt-0.5">
                {engineOn ? (vibMetrics?.peakToPeakG || 0.003).toFixed(3) : '0.003'}
              </div>
            </div>

            <div className="bg-white p-1.5 rounded-lg border border-[#E2E8F0] text-center shadow-2xs">
              <div className="text-[9px] text-[#64748B] font-semibold">CREST FACTOR</div>
              <div className="font-extrabold font-mono text-xs text-[#0F172A] mt-0.5">
                {engineOn ? (vibMetrics?.crestFactor || 2.0).toFixed(2) : '2.00'}
              </div>
            </div>

            <div className="bg-white p-1.5 rounded-lg border border-[#E2E8F0] text-center shadow-2xs">
              <div className="text-[9px] text-[#64748B] font-semibold">DOMINANT FREQ</div>
              <div className="font-extrabold font-mono text-xs text-[#2563EB] mt-0.5">
                {engineOn ? `${(vibMetrics?.dominantFreqHz || 0).toFixed(1)} Hz` : '0.0 Hz'}
              </div>
            </div>

            <div className="bg-white p-1.5 rounded-lg border border-[#E2E8F0] text-center shadow-2xs">
              <div className="text-[9px] text-[#64748B] font-semibold">SPECTRAL ENERGY</div>
              <div className="font-extrabold font-mono text-xs text-[#7C3AED] mt-0.5">
                {engineOn ? (vibMetrics?.spectralEnergy || 0.0001).toExponential(2) : '0.00e+0'}
              </div>
            </div>
          </div>
        </div>

        {/* Subheader */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-[#1F2937] uppercase tracking-wide">
            PRIMARY ENGINE PARAMETERS (10 CHANNELS)
          </span>
          <div className="flex items-center gap-1.5 text-[10px] font-semibold">
            {engineOn ? (
              <span className="text-[#10B981] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                <span>{isAnyWarning ? 'Parameter Warning' : 'All Systems Nominal'}</span>
              </span>
            ) : (
              <span className="text-gray-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                <span>Sensors Standby (Engine Off)</span>
              </span>
            )}
          </div>
        </div>

        {/* 10 Primary Sensor Cards in 5x2 Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <SensorCard label="1. Engine RPM" reading={sensors.rpm} iconType="rpm" engineOn={engineOn} />
          <SensorCard label="2. CHT" reading={sensors.cht} iconType="cht" engineOn={engineOn} />
          <SensorCard label="3. EGT" reading={sensors.egt} iconType="egt" engineOn={engineOn} />
          <SensorCard label="4. Oil Pressure" reading={sensors.oilPressure} iconType="oilPressure" engineOn={engineOn} />
          <SensorCard label="5. Oil Temp." reading={sensors.oilTemperature} iconType="oilTemp" engineOn={engineOn} />
          <SensorCard label="6. Fuel Flow" reading={sensors.fuelFlow} iconType="fuelFlow" engineOn={engineOn} />
          <SensorCard label="7. Fuel Pressure" reading={sensors.fuelPressure} iconType="fuelPressure" engineOn={engineOn} />
          <SensorCard label="8. MAP" reading={sensors.map} iconType="map" engineOn={engineOn} />
          <SensorCard label="9. Vibration RMS" reading={sensors.vibration} iconType="vibration" engineOn={engineOn} />
          <SensorCard label="10. Engine Load" reading={sensors.engineLoad || { value: 0, unit: '%', status: 'normal', trend: 'flat', min: 0, max: 100, nominalRange: [20, 85], warnRange: [10, 95] }} iconType="engineLoad" engineOn={engineOn} />
        </div>
      </div>
    </div>
  );
};
