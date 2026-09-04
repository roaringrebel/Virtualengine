import React, { useEffect, useRef, useState } from 'react';
import { LineChart as ChartIcon, ChevronDown } from 'lucide-react';
import { SensorSuiteState } from '../types/simulation';

interface RealtimeGraphsProps {
  sensors: SensorSuiteState;
  engineOn: boolean;
}

interface HistoryPoint {
  time: number;
  rpm: number;
  cht: number;
  egt: number;
  oilPressure: number;
  vibration: number;
  fuelFlow: number;
}

export const RealtimeGraphs: React.FC<RealtimeGraphsProps> = ({ sensors, engineOn }) => {
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
          fuelFlow: engineOn ? sensors.fuelFlow.value : 0,
        };
        const next = [...prev, newPt];
        return next.length > maxPoints ? next.slice(next.length - maxPoints) : next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [sensors, engineOn]);

  const graphsConfig = [
    { key: 'rpm' as const, title: 'Engine RPM (RPM)', min: 0, max: 6500, yTicks: ['6000', '4000', '2000'] },
    { key: 'cht' as const, title: 'CHT (°C)', min: 0, max: 150, yTicks: ['150', '100', '50'] },
    { key: 'egt' as const, title: 'EGT (°C)', min: 400, max: 1000, yTicks: ['1000', '750', '500'] },
    { key: 'oilPressure' as const, title: 'Oil Pressure (bar)', min: 0, max: 10, yTicks: ['10', '5', '0'] },
    { key: 'vibration' as const, title: 'Vibration (mm/s)', min: 0, max: 10, yTicks: ['10', '5', '0'] },
    { key: 'fuelFlow' as const, title: 'Fuel Flow (L/h)', min: 0, max: 40, yTicks: ['40', '20', '0'] },
  ];

  const renderSparkline = (cfg: typeof graphsConfig[0]) => {
    const width = 180;
    const height = 48;
    const pts = history.map(h => h[cfg.key]);

    if (pts.length < 2) {
      return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-12 bg-gray-50/50 rounded border border-gray-100">
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

    return (
      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-11 bg-[#F9FAFB] rounded border border-[#E5E7EB]">
          {/* Subtle horizontal grid lines */}
          <line x1="0" y1="12" x2={width} y2="12" stroke="#E5E7EB" strokeWidth="0.75" strokeDasharray="2,2" />
          <line x1="0" y1="24" x2={width} y2="24" stroke="#E5E7EB" strokeWidth="0.75" strokeDasharray="2,2" />
          <line x1="0" y1="36" x2={width} y2="36" stroke="#E5E7EB" strokeWidth="0.75" strokeDasharray="2,2" />

          {/* Area fill */}
          <path d={fillD} fill="rgba(249, 115, 22, 0.12)" />

          {/* Line trace */}
          <path d={pathD} fill="none" stroke="#F97316" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />

          {/* Leading dot */}
          {coords.length > 0 && (
            <circle
              cx={coords[coords.length - 1].x}
              cy={coords[coords.length - 1].y}
              r="2.5"
              fill="#F97316"
              stroke="#FFFFFF"
              strokeWidth="1"
            />
          )}
        </svg>

        {/* X-axis time marks */}
        <div className="flex justify-between text-[7px] font-mono text-[#9CA3AF] px-1 mt-0.5">
          <span>0</span>
          <span>1</span>
          <span>2</span>
          <span>3</span>
          <span>4</span>
          <span>5 min</span>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-3.5 shadow-sm flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-orange-50 border border-orange-200 flex items-center justify-center text-[#F97316]">
            <ChartIcon className="w-3.5 h-3.5" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-[#1F2937] tracking-tight uppercase">REAL-TIME GRAPHS</h2>
          </div>
        </div>

        <button className="flex items-center gap-1 text-[10px] font-semibold text-[#6B7280] bg-[#F9FAFB] border border-[#E5E7EB] px-2 py-1 rounded hover:border-[#F97316]">
          <span>Last 5 minutes</span>
          <ChevronDown className="w-3 h-3 text-[#9CA3AF]" />
        </button>
      </div>

      {/* 6 Graphs Grid (3 columns x 2 rows) */}
      <div className="grid grid-cols-3 gap-2.5">
        {graphsConfig.map((cfg) => (
          <div key={cfg.key} className="bg-white p-1.5 rounded-lg border border-[#E5E7EB] shadow-xs">
            <div className="flex justify-between items-center text-[9.5px] font-semibold text-[#4B5563] mb-1">
              <span className="truncate">{cfg.title}</span>
            </div>
            {renderSparkline(cfg)}
          </div>
        ))}
      </div>
    </div>
  );
};
