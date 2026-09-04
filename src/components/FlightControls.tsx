import React from 'react';
import { 
  Sliders, 
  Gauge, 
  MoveUp, 
  Wind, 
  Compass, 
  Sun, 
  Cpu, 
  MapPin, 
  Navigation, 
  Route, 
  ChevronLeft, 
  ChevronRight,
  ArrowUp,
  ArrowRight,
  ArrowDown
} from 'lucide-react';
import { FlightControlsState } from '../types/simulation';

interface FlightControlsProps {
  controls: FlightControlsState;
  onChangeControl: <K extends keyof FlightControlsState>(key: K, value: FlightControlsState[K]) => void;
  engineOn: boolean;
}

export const FlightControls: React.FC<FlightControlsProps> = ({
  controls,
  onChangeControl,
  engineOn
}) => {
  // Cardinal direction helper
  const getHeadingLabel = (deg: number) => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(((deg % 360) / 45)) % 8;
    return directions[index];
  };

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-3 shadow-sm flex flex-col justify-between h-full space-y-2.5 select-none">
      
      {/* Header & Navigation Mode Switch */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-orange-50 border border-orange-200 flex items-center justify-center text-[#F97316]">
            <Sliders className="w-3.5 h-3.5" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-[#1F2937] tracking-tight uppercase">FLIGHT & POSITION CONTROLS</h2>
            <div className="text-[9.5px] text-[#6B7280]">Live interactive steering, GPS coordinates & physics sliders</div>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="flex items-center bg-[#F3F4F6] border border-[#E5E7EB] p-0.5 rounded-lg text-[9px] font-bold">
          <button
            onClick={() => onChangeControl('navigationMode', 'MANUAL_PILOT')}
            disabled={!engineOn}
            className={`flex items-center gap-1 px-2 py-0.5 rounded transition-all ${
              controls.navigationMode === 'MANUAL_PILOT'
                ? 'bg-[#F97316] text-white shadow-xs'
                : 'text-[#4B5563] hover:text-black'
            }`}
          >
            <Navigation className="w-2.5 h-2.5" />
            <span>Manual Pilot</span>
          </button>
          <button
            onClick={() => onChangeControl('navigationMode', 'WAYPOINT_ROUTE')}
            disabled={!engineOn}
            className={`flex items-center gap-1 px-2 py-0.5 rounded transition-all ${
              controls.navigationMode === 'WAYPOINT_ROUTE'
                ? 'bg-[#F97316] text-white shadow-xs'
                : 'text-[#4B5563] hover:text-black'
            }`}
          >
            <Route className="w-2.5 h-2.5" />
            <span>Waypoint Auto</span>
          </button>
        </div>
      </div>

      {/* Primary Flight Controls Sliders */}
      <div className="space-y-2">
        
        {/* 1. THROTTLE */}
        <div className="flex items-center gap-2">
          <div className="w-24 flex items-center gap-1.5 flex-shrink-0">
            <Gauge className="w-3.5 h-3.5 text-[#F97316]" />
            <span className="text-[11px] font-semibold text-[#374151]">Throttle</span>
          </div>
          <div className="flex-1 flex items-center">
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={controls.throttle}
              disabled={!engineOn}
              onChange={(e) => onChangeControl('throttle', Number(e.target.value))}
              className="w-full cursor-pointer accent-[#F97316]"
            />
          </div>
          <div className="w-16 text-right font-mono text-[11px] font-bold text-[#1F2937] flex-shrink-0">
            <span>{controls.throttle}</span>
            <span className="text-[9.5px] font-normal text-[#6B7280] ml-0.5">%</span>
          </div>
        </div>

        {/* 2. HEADING */}
        <div className="flex items-center gap-2">
          <div className="w-24 flex items-center gap-1.5 flex-shrink-0">
            <Compass className="w-3.5 h-3.5 text-[#F97316]" />
            <span className="text-[11px] font-semibold text-[#374151]">Heading</span>
          </div>
          <div className="flex-1 flex items-center">
            <input
              type="range"
              min={0}
              max={360}
              step={1}
              value={controls.heading}
              disabled={!engineOn}
              onChange={(e) => onChangeControl('heading', Number(e.target.value))}
              className="w-full cursor-pointer accent-[#F97316]"
            />
          </div>
          <div className="w-16 text-right font-mono text-[11px] font-bold text-[#1F2937] flex-shrink-0">
            <span>{controls.heading}°</span>
            <span className="text-[9px] font-bold text-[#F97316] ml-1">{getHeadingLabel(controls.heading)}</span>
          </div>
        </div>

        {/* 3. ALTITUDE */}
        <div className="flex items-center gap-2">
          <div className="w-24 flex items-center gap-1.5 flex-shrink-0">
            <MoveUp className="w-3.5 h-3.5 text-[#F97316]" />
            <span className="text-[11px] font-semibold text-[#374151]">Altitude</span>
          </div>
          <div className="flex-1 flex items-center">
            <input
              type="range"
              min={0}
              max={20000}
              step={100}
              value={controls.altitude}
              disabled={!engineOn}
              onChange={(e) => onChangeControl('altitude', Number(e.target.value))}
              className="w-full cursor-pointer accent-[#F97316]"
            />
          </div>
          <div className="w-16 text-right font-mono text-[11px] font-bold text-[#1F2937] flex-shrink-0">
            <span>{controls.altitude.toLocaleString()}</span>
            <span className="text-[9.5px] font-normal text-[#6B7280] ml-0.5">ft</span>
          </div>
        </div>

        {/* 4. AIRSPEED */}
        <div className="flex items-center gap-2">
          <div className="w-24 flex items-center gap-1.5 flex-shrink-0">
            <Wind className="w-3.5 h-3.5 text-[#F97316]" />
            <span className="text-[11px] font-semibold text-[#374151]">Airspeed</span>
          </div>
          <div className="flex-1 flex items-center">
            <input
              type="range"
              min={0}
              max={220}
              step={5}
              value={controls.airspeed}
              disabled={!engineOn}
              onChange={(e) => onChangeControl('airspeed', Number(e.target.value))}
              className="w-full cursor-pointer accent-[#F97316]"
            />
          </div>
          <div className="w-16 text-right font-mono text-[11px] font-bold text-[#1F2937] flex-shrink-0">
            <span>{controls.airspeed}</span>
            <span className="text-[9.5px] font-normal text-[#6B7280] ml-0.5">km/h</span>
          </div>
        </div>

        {/* 5. LATITUDE POSITION CONTROL */}
        <div className="flex items-center gap-2">
          <div className="w-24 flex items-center gap-1.5 flex-shrink-0">
            <MapPin className="w-3.5 h-3.5 text-[#F97316]" />
            <span className="text-[11px] font-semibold text-[#374151]">Latitude</span>
          </div>
          <div className="flex-1 flex items-center gap-1">
            <button
              type="button"
              disabled={!engineOn}
              onClick={() => onChangeControl('latitude', Number((controls.latitude - 0.005).toFixed(4)))}
              className="w-5 h-5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center text-xs font-bold"
            >
              -
            </button>
            <input
              type="range"
              min={32.5000}
              max={32.5900}
              step={0.0010}
              value={controls.latitude}
              disabled={!engineOn}
              onChange={(e) => onChangeControl('latitude', Number(e.target.value))}
              className="w-full cursor-pointer accent-[#F97316]"
            />
            <button
              type="button"
              disabled={!engineOn}
              onClick={() => onChangeControl('latitude', Number((controls.latitude + 0.005).toFixed(4)))}
              className="w-5 h-5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center text-xs font-bold"
            >
              +
            </button>
          </div>
          <div className="w-16 text-right font-mono text-[11px] font-bold text-[#1F2937] flex-shrink-0">
            <span>{controls.latitude.toFixed(4)}</span>
            <span className="text-[9.5px] font-normal text-[#6B7280] ml-0.5">°N</span>
          </div>
        </div>

        {/* 6. LONGITUDE POSITION CONTROL */}
        <div className="flex items-center gap-2">
          <div className="w-24 flex items-center gap-1.5 flex-shrink-0">
            <MapPin className="w-3.5 h-3.5 text-[#F97316]" />
            <span className="text-[11px] font-semibold text-[#374151]">Longitude</span>
          </div>
          <div className="flex-1 flex items-center gap-1">
            <button
              type="button"
              disabled={!engineOn}
              onClick={() => onChangeControl('longitude', Number((controls.longitude - 0.005).toFixed(4)))}
              className="w-5 h-5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center text-xs font-bold"
            >
              -
            </button>
            <input
              type="range"
              min={77.1600}
              max={77.2700}
              step={0.0010}
              value={controls.longitude}
              disabled={!engineOn}
              onChange={(e) => onChangeControl('longitude', Number(e.target.value))}
              className="w-full cursor-pointer accent-[#F97316]"
            />
            <button
              type="button"
              disabled={!engineOn}
              onClick={() => onChangeControl('longitude', Number((controls.longitude + 0.005).toFixed(4)))}
              className="w-5 h-5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center text-xs font-bold"
            >
              +
            </button>
          </div>
          <div className="w-16 text-right font-mono text-[11px] font-bold text-[#1F2937] flex-shrink-0">
            <span>{controls.longitude.toFixed(4)}</span>
            <span className="text-[9.5px] font-normal text-[#6B7280] ml-0.5">°E</span>
          </div>
        </div>

        {/* 7. ENGINE LOAD & AMBIENT TEMP (COMPACT DUAL ROW) */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-100">
          {/* Engine Load */}
          <div className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-[#F97316] flex-shrink-0" />
            <span className="text-[10px] font-semibold text-[#4B5563] truncate">Load:</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={controls.engineLoad}
              disabled={!engineOn}
              onChange={(e) => onChangeControl('engineLoad', Number(e.target.value))}
              className="w-full cursor-pointer accent-[#F97316] h-1"
            />
            <span className="text-[10px] font-mono font-bold text-[#1F2937]">{controls.engineLoad}%</span>
          </div>

          {/* Ambient Temp */}
          <div className="flex items-center gap-1.5">
            <Sun className="w-3.5 h-3.5 text-[#F97316] flex-shrink-0" />
            <span className="text-[10px] font-semibold text-[#4B5563] truncate">Temp:</span>
            <input
              type="range"
              min={-20}
              max={50}
              step={1}
              value={controls.ambientTemp}
              disabled={!engineOn}
              onChange={(e) => onChangeControl('ambientTemp', Number(e.target.value))}
              className="w-full cursor-pointer accent-[#F97316] h-1"
            />
            <span className="text-[10px] font-mono font-bold text-[#1F2937]">{controls.ambientTemp}°C</span>
          </div>
        </div>

        {/* Quick Steer & Heading Presets */}
        <div className="flex items-center justify-between gap-1 pt-1">
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Quick Steer:</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={!engineOn}
              onClick={() => onChangeControl('heading', 0)}
              className="px-1.5 py-0.5 rounded bg-gray-100 hover:bg-orange-100 hover:text-[#F97316] text-[9px] font-bold text-gray-700 transition-colors"
            >
              North (0°)
            </button>
            <button
              type="button"
              disabled={!engineOn}
              onClick={() => onChangeControl('heading', 90)}
              className="px-1.5 py-0.5 rounded bg-gray-100 hover:bg-orange-100 hover:text-[#F97316] text-[9px] font-bold text-gray-700 transition-colors"
            >
              East (90°)
            </button>
            <button
              type="button"
              disabled={!engineOn}
              onClick={() => onChangeControl('heading', 180)}
              className="px-1.5 py-0.5 rounded bg-gray-100 hover:bg-orange-100 hover:text-[#F97316] text-[9px] font-bold text-gray-700 transition-colors"
            >
              South (180°)
            </button>
            <button
              type="button"
              disabled={!engineOn}
              onClick={() => onChangeControl('heading', 270)}
              className="px-1.5 py-0.5 rounded bg-gray-100 hover:bg-orange-100 hover:text-[#F97316] text-[9px] font-bold text-gray-700 transition-colors"
            >
              West (270°)
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
