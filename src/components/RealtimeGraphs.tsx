import React, { useEffect, useState } from 'react';
import { LineChart as ChartIcon, ChevronDown } from 'lucide-react';
import { SensorSuiteState } from '../types/simulation';

interface RealtimeGraphsProps {
  sensors: SensorSuiteState;
  engineOn: boolean;
  airspeed?: number;
}

interface HistoryPoint {
  time: number;
  rpm: number;
  cht: number;
  egt: number;
  oilPressure: number;
  vibration: number;
  airspeed: number;
  fuelFlow: number;
}

export const RealtimeGraphs: React.FC<RealtimeGraphsProps> = ({ sensors, engineOn, airspeed = 0 }) => {
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const maxPoints = 50;

  useEffect(() => {
    const interval = setInterval(() => {
      setHistory(prev => {
        const newPt: HistoryPoint = {
          time: Date.now(),
          rpm: engineOn ? sensors.rpm.value : 0,
          cht: engineOn ? sensors.cht.value : 25,
          egt: engineOn ? sensors.egt.value : 25,
          oilPressure: engineOn ? sensors.oilPressure.value : 0,
          vibration: engineOn ? sensors.vibration.value : 0,
          airspeed: engineOn ? airspeed : 0,
          fuelFlow: engineOn ? sensors.fuelFlow.value : 0,
        };
        const next = [...prev, newPt];
        return next.length > maxPoints ? next.slice(next.length - maxPoints) : next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [sensors, engineOn, airspeed]);

  const graphsConfig = [
    { key: 'rpm' as const, title: 'RPM (Rotax 912)', min: 0, max: 6500, unit: 'RPM' },
    { key: 'cht' as const, title: 'CHT (Cylinder)', min: 50, max: 160, unit: '°C' },
    { key: 'vibration' as const, title: 'Vibration RMS', min: 0, max: 10, unit: 'mm/s' },
    { key: 'oilPressure' as const, title: 'Oil Pressure', min: 0, max: 8, unit: 'bar' },
    { key: 'airspeed' as const, title: 'True Airspeed', min: 0, max: 220, unit: 'km/h' },
    { key: 'fuelFlow' as const, title: 'Fuel Flow', min: 0, max: 35, unit: 'L/h' },
  ];

  const renderSparkline = (cfg: typeof graphsConfig[0]) => {
    const width = 180;
    const height = 44;
    const pts = history.map(h => h[cfg.key]);

    if (pts.length < 2) {
      return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-11 bg-gray-50/50 rounded border border-gray-100">
          <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="#E5E7EB" strokeWidth="1" strokeDasharray="3,3" />
        </svg>
      );
    }

    const stepX = width / (maxPoints - 1);
    const startX = (maxPoints - pts.length) * stepX;

    const coords = pts.map((v, i) => {
      const x = startX + i * stepX;
      const clamped = Math.max(cfg.min, Math.min(cfg.max, v));
      const norm = (clamped - cfg.min) / (cfg.max - cfg.min);
      const y = height - norm * (height - 8) - 4;
      return { x, y };
    });

    const pathD = coords.reduce((acc, pt, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`, '');
    const fillD = `${pathD} L ${coords[coords.length - 1].x},${height} L ${coords[0].x},${height} Z`;

    const latestValue = pts.length > 0 ? pts[pts.length - 1] : 0;

    return (
      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-10 bg-[#F9FAFB] rounded border border-[#E5E7EB]">
          {/* Grid lines */}
          <line x1="0" y1="11" x2={width} y2="11" stroke="#E5E7EB" strokeWidth="0.75" strokeDasharray="2,2" />
          <line x1="0" y1="22" x2={width} y2="22" stroke="#E5E7EB" strokeWidth="0.75" strokeDasharray="2,2" />
          <line x1="0" y1="33" x2={width} y2="33" stroke="#E5E7EB" strokeWidth="0.75" strokeDasharray="2,2" />

          {/* Area fill */}
          <path d={fillD} fill="rgba(249, 115, 22, 0.12)" />

          {/* Line trace */}
          <path d={pathD} fill="none" stroke="#F97316" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />

          {/* Leading dot */}
          {coords.length > 0 && (
            <circle
              cx={coords[coords.length - 1].x}
              cy={coords[coords.length - 1].y}
              r="2.2"
              fill="#F97316"
              stroke="#FFFFFF"
              strokeWidth="1"
            />
          )}
        </svg>

        {/* Live reading indicator */}
        <div className="flex justify-between items-center text-[7.5px] font-mono text-slate-500 px-0.5 mt-0.5">
          <span>{cfg.min}</span>
          <span className="font-bold text-[#F97316]">{typeof latestValue === 'number' ? latestValue.toFixed(cfg.key === 'vibration' || cfg.key === 'oilPressure' ? 1 : 0) : latestValue} {cfg.unit}</span>
          <span>{cfg.max}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-3 shadow-sm flex flex-col justify-between h-full select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-md bg-orange-50 border border-orange-200 flex items-center justify-center text-[#F97316]">
            <ChartIcon className="w-3 h-3" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-[#1F2937] tracking-tight uppercase">REAL-TIME GRAPHS</h2>
          </div>
        </div>

        <span className="text-[8.5px] font-mono font-bold text-slate-500 bg-[#F9FAFB] border border-[#E5E7EB] px-1.5 py-0.5 rounded">
          Continuous 1Hz Sampling
        </span>
      </div>

      {/* 6 Graphs Grid (3 columns x 2 rows) */}
      <div className="grid grid-cols-3 gap-2">
        {graphsConfig.map((cfg) => (
          <div key={cfg.key} className="bg-white p-1 rounded-lg border border-[#E5E7EB] shadow-2xs">
            <div className="flex justify-between items-center text-[8.5px] font-semibold text-[#4B5563] mb-0.5 truncate">
              <span className="truncate">{cfg.title}</span>
            </div>
            {renderSparkline(cfg)}
          </div>
        ))}
      </div>
    </div>
  );
};
