import React from 'react';
import { 
  Gauge, 
  Thermometer, 
  Flame, 
  Droplet, 
  Activity, 
  Fuel, 
  Compass as DialIcon,
  Cpu
} from 'lucide-react';
import { VirtualSensorReading } from '../types/simulation';

interface SensorCardProps {
  label: string;
  reading: VirtualSensorReading;
  iconType: 'rpm' | 'cht' | 'egt' | 'oilPressure' | 'oilTemp' | 'vibration' | 'fuelFlow' | 'fuelPressure' | 'map' | 'engineLoad';
  engineOn: boolean;
}

export const SensorCard: React.FC<SensorCardProps> = ({ label, reading, iconType, engineOn }) => {
  const renderIcon = () => {
    switch (iconType) {
      case 'rpm':
        return <Gauge className="w-4 h-4 text-[#F97316]" />;
      case 'cht':
        return <Thermometer className="w-4 h-4 text-[#F97316]" />;
      case 'egt':
        return <Flame className="w-4 h-4 text-[#F97316]" />;
      case 'oilPressure':
        return <Droplet className="w-4 h-4 text-[#F97316]" />;
      case 'oilTemp':
        return <Thermometer className="w-4 h-4 text-[#F97316]" />;
      case 'vibration':
        return <Activity className="w-4 h-4 text-[#F97316]" />;
      case 'fuelFlow':
        return <Fuel className="w-4 h-4 text-[#F97316]" />;
      case 'fuelPressure':
        return <DialIcon className="w-4 h-4 text-[#F97316]" />;
      case 'map':
        return <Gauge className="w-4 h-4 text-[#F97316]" />;
      case 'engineLoad':
        return <Cpu className="w-4 h-4 text-[#F97316]" />;
      default:
        return <Gauge className="w-4 h-4 text-[#F97316]" />;
    }
  };

  const getStatusColor = () => {
    if (!engineOn) return 'text-[#9CA3AF]';
    if (reading.status === 'critical') return 'text-[#EF4444]';
    if (reading.status === 'warning') return 'text-[#F59E0B]';
    return 'text-[#1F2937]';
  };

  const getCardBorder = () => {
    if (!engineOn) return 'border-[#E5E7EB] bg-[#F9FAFB]/70 opacity-80';
    if (reading.status === 'critical') return 'border-red-300 bg-red-50/30 ring-1 ring-red-400';
    if (reading.status === 'warning') return 'border-amber-300 bg-amber-50/30';
    return 'border-[#E5E7EB] bg-white';
  };

  const formatDisplayValue = () => {
    if (!engineOn) {
      if (iconType === 'rpm') return '0';
      if (iconType === 'vibration') return '0.001';
      if (iconType === 'oilPressure' || iconType === 'fuelFlow' || iconType === 'engineLoad') return '0.0';
      if (iconType === 'map') return '29.9';
      if (iconType === 'cht' || iconType === 'oilTemp' || iconType === 'egt') return reading.value.toFixed(1);
      return '0.0';
    }

    if (iconType === 'rpm') return reading.value.toLocaleString();
    if (iconType === 'vibration') return reading.value.toFixed(3);
    if (iconType === 'engineLoad') return Math.round(reading.value).toString();
    return reading.value.toFixed(1);
  };

  return (
    <div className={`p-2.5 rounded-xl border ${getCardBorder()} shadow-xs hover:shadow-sm transition-all duration-200 flex items-center justify-between`}>
      <div className="flex items-center gap-2.5">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border ${
          engineOn ? 'bg-orange-50/90 border-orange-200 text-[#F97316]' : 'bg-gray-100 border-gray-200 text-gray-400'
        }`}>
          {renderIcon()}
        </div>
        <div>
          <div className="text-[10px] font-semibold text-[#6B7280] leading-tight uppercase">
            {label}
          </div>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className={`text-base font-extrabold font-mono tracking-tight leading-none ${getStatusColor()}`}>
              {formatDisplayValue()}
            </span>
            <span className="text-[10px] font-bold text-[#9CA3AF]">
              {reading.unit}
            </span>
          </div>
        </div>
      </div>

      {/* Active State / Trend Indicator */}
      <div>
        {engineOn ? (
          <span className={`text-xs font-bold ${
            reading.trend === 'up' ? 'text-amber-500' : reading.trend === 'down' ? 'text-blue-500' : 'text-gray-300'
          }`}>
            {reading.trend === 'up' ? '↑' : reading.trend === 'down' ? '↓' : '→'}
          </span>
        ) : (
          <span className="text-[8px] font-bold font-mono text-gray-400 bg-gray-200/60 px-1.5 py-0.5 rounded">
            OFF
          </span>
        )}
      </div>
    </div>
  );
};
