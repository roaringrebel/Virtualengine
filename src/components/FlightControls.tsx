import React from 'react';
import { Sliders, Gauge, MoveUp, Wind, Compass, Sun, Cpu } from 'lucide-react';
import { FlightControlsState } from '../types/simulation';

interface FlightControlsProps {
  controls: FlightControlsState;
  onChangeControl: <K extends keyof FlightControlsState>(key: K, value: number) => void;
  engineOn: boolean;
}

export const FlightControls: React.FC<FlightControlsProps> = ({
  controls,
  onChangeControl,
  engineOn
}) => {
  const controlItems = [
    {
      key: 'throttle' as const,
      label: 'Throttle',
      icon: Gauge,
      min: 0,
      max: 100,
      step: 1,
      unit: '%',
      value: controls.throttle,
    },
    {
      key: 'altitude' as const,
      label: 'Altitude',
      icon: MoveUp,
      min: 0,
      max: 25000,
      step: 250,
      unit: 'ft',
      value: controls.altitude,
      formatted: controls.altitude.toLocaleString(),
    },
    {
      key: 'airspeed' as const,
      label: 'Airspeed',
      icon: Wind,
      min: 0,
      max: 250,
      step: 5,
      unit: 'km/h',
      value: controls.airspeed,
    },
    {
      key: 'heading' as const,
      label: 'Heading',
      icon: Compass,
      min: 0,
      max: 360,
      step: 5,
      unit: '°',
      value: controls.heading,
    },
    {
      key: 'ambientTemp' as const,
      label: 'Ambient Temp.',
      icon: Sun,
      min: -30,
      max: 50,
      step: 1,
      unit: '°C',
      value: controls.ambientTemp,
    },
    {
      key: 'engineLoad' as const,
      label: 'Engine Load',
      icon: Cpu,
      min: 0,
      max: 100,
      step: 1,
      unit: '%',
      value: controls.engineLoad,
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-3.5 shadow-sm flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-md bg-orange-50 border border-orange-200 flex items-center justify-center text-[#F97316]">
          <Sliders className="w-3.5 h-3.5" />
        </div>
        <div>
          <h2 className="text-xs font-bold text-[#1F2937] tracking-tight uppercase">FLIGHT CONTROLS</h2>
          <div className="text-[10px] text-[#6B7280]">Adjust parameters to simulate real-time UAV behaviour</div>
        </div>
      </div>

      {/* Sliders Grid */}
      <div className="space-y-2.5">
        {controlItems.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.key} className="flex items-center gap-2.5">
              {/* Icon & Label */}
              <div className="w-28 flex items-center gap-1.5 flex-shrink-0">
                <Icon className="w-3.5 h-3.5 text-[#F97316]" />
                <span className="text-[11px] font-semibold text-[#4B5563] truncate">
                  {item.label}
                </span>
              </div>

              {/* Slider Track */}
              <div className="flex-1 flex items-center">
                <input
                  type="range"
                  min={item.min}
                  max={item.max}
                  step={item.step}
                  value={item.value}
                  disabled={!engineOn}
                  onChange={(e) => onChangeControl(item.key, Number(e.target.value))}
                  className="w-full cursor-pointer accent-[#F97316]"
                />
              </div>

              {/* Numeric Value */}
              <div className="w-16 text-right font-mono text-[11px] font-bold text-[#1F2937] flex-shrink-0">
                <span>{item.formatted || item.value}</span>
                <span className="text-[9.5px] font-normal text-[#6B7280] ml-1">{item.unit}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
