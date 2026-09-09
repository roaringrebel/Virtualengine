import React from 'react';
import { LineChart as ChartIcon } from 'lucide-react';
import { SensorSuiteState, SimulationHistoryPoint } from '../types/simulation';

interface RealtimeGraphsProps {
  sensors: SensorSuiteState;
  engineOn: boolean;
  airspeed?: number;
  history?: SimulationHistoryPoint[];
}

export const RealtimeGraphs: React.FC<RealtimeGraphsProps> = ({ 
  sensors, 
  engineOn, 
  airspeed = 0,
  history = [] 
}) => {
  const maxPoints = 50;

  // Build points from authoritative simulation history if available, or fallback gracefully
  const dataPoints = history.length > 0
    ? history.slice(-maxPoints)
    : [
        {
          timeMs: Date.now(),
          simTimeSec: 0,
          rpm: engineOn ? sensors.rpm.value : 0,
          cht: sensors.cht.value,
          egt: sensors.egt.value,
          oilPressure: sensors.oilPressure.value,
          oilTemperature: sensors.oilTemperature.value,
          fuelFlow: sensors.fuelFlow.value,
          fuelPressure: sensors.fuelPressure.value,
          manifoldPressure: sensors.map.value,
          engineLoad: sensors.engineLoad?.value || 0,
          vibrationRmsG: sensors.vibration.value,
          vibrationPeakG: sensors.vibration.value * 1.5,
          dominantFreqHz: 0,
          airspeed: airspeed,
          altitude: 0
        }
      ];

  const graphsConfig = [
    { key: 'rpm' as const, title: 'RPM (Rotax 912)', min: 0, max: 6000, unit: 'RPM', color: '#F97316' },
    { key: 'cht' as const, title: 'CHT (Cylinder)', min: 20, max: 150, unit: '°C', color: '#EF4444' },
    { key: 'vibrationRmsG' as const, title: 'Vibration RMS', min: 0, max: 0.15, unit: 'g', color: '#10B981', decimals: 3 },
    { key: 'oilPressure' as const, title: 'Oil Pressure', min: 0, max: 6.0, unit: 'bar', color: '#3B82F6', decimals: 2 },
    { key: 'airspeed' as const, title: 'True Airspeed', min: 0, max: 200, unit: 'km/h', color: '#8B5CF6' },
    { key: 'fuelFlow' as const, title: 'Fuel Flow', min: 0, max: 30, unit: 'L/h', color: '#EC4899', decimals: 1 },
  ];

  const renderSparkline = (cfg: typeof graphsConfig[0]) => {
    const width = 180;
    const height = 44;
    const pts = dataPoints.map(h => (h as any)[cfg.key] ?? 0);

    const latestValue = pts.length > 0 ? pts[pts.length - 1] : 0;
    const formatDecimals = (cfg as any).decimals !== undefined ? (cfg as any).decimals : 0;
    const displayVal = formatDecimals > 0 ? latestValue.toFixed(formatDecimals) : Math.round(latestValue).toLocaleString();

    if (pts.length < 2) {
      return (
        <div className="relative">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-10 bg-[#F9FAFB] rounded border border-[#E5E7EB]">
            <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="#E5E7EB" strokeWidth="1" strokeDasharray="3,3" />
          </svg>
          <div className="absolute top-1.5 right-2 text-[10px] font-mono font-bold text-[#1F2937]">
            {displayVal} <span className="text-[9px] text-[#9CA3AF]">{cfg.unit}</span>
          </div>
        </div>
      );
    }

    const stepX = width / Math.max(1, pts.length - 1);

    const coords = pts.map((v, i) => {
      const x = i * stepX;
      const clamped = Math.max(cfg.min, Math.min(cfg.max, v));
      const norm = (clamped - cfg.min) / (cfg.max - cfg.min);
      const y = height - norm * (height - 10) - 5;
      return { x, y };
    });

    const pathD = coords.reduce((acc, pt, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`, '');
    const fillD = `${pathD} L ${width},${height} L 0,${height} Z`;

    return (
      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-10 bg-[#F9FAFB] rounded border border-[#E5E7EB] overflow-hidden">
          {/* Grid lines */}
          <line x1="0" y1="11" x2={width} y2="11" stroke="#F1F5F9" strokeWidth="0.75" strokeDasharray="2,2" />
          <line x1="0" y1="22" x2={width} y2="22" stroke="#E2E8F0" strokeWidth="0.75" strokeDasharray="2,2" />
          <line x1="0" y1="33" x2={width} y2="33" stroke="#F1F5F9" strokeWidth="0.75" strokeDasharray="2,2" />

          {/* Area fill */}
          <path d={fillD} fill={`${cfg.color}18`} />

          {/* Line trace */}
          <path d={pathD} fill="none" stroke={cfg.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />

          {/* Leading dot */}
          {coords.length > 0 && (
            <circle
              cx={coords[coords.length - 1].x}
              cy={coords[coords.length - 1].y}
              r="2.5"
              fill={cfg.color}
            />
          )}
        </svg>

        {/* Live numerical readout overlay */}
        <div className="absolute top-1 right-2 text-[10px] font-mono font-extrabold text-[#0F172A] bg-white/85 px-1.5 py-0.5 rounded shadow-2xs border border-gray-100">
          {displayVal} <span className="text-[8px] font-bold text-[#64748B]">{cfg.unit}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-3 shadow-sm h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-md bg-orange-50 border border-orange-200 flex items-center justify-center text-[#F97316]">
              <ChartIcon className="w-3 h-3" />
            </div>
            <span className="text-xs font-bold text-[#1F2937] uppercase tracking-tight">
              REAL-TIME PHYSICAL TELEMETRY TRENDS
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-[#6B7280]">
            <span className={`w-1.5 h-1.5 rounded-full ${engineOn ? 'bg-[#10B981] animate-pulse' : 'bg-gray-400'}`} />
            <span>{engineOn ? 'Live Stream (2Hz History)' : 'Standby'}</span>
          </div>
        </div>

        {/* 6 Real-time Graphs Grid (3 columns x 2 rows) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {graphsConfig.map((cfg) => (
            <div key={cfg.key} className="bg-white p-2 rounded-lg border border-[#E5E7EB] shadow-2xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-[#374151] truncate">
                  {cfg.title}
                </span>
                <span className="text-[9px] font-semibold text-[#9CA3AF]">
                  [{cfg.min} - {cfg.max}]
                </span>
              </div>
              {renderSparkline(cfg)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
