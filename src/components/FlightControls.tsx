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
  ArrowUpRight,
  Radio
} from 'lucide-react';
import { FlightControlsState, FlightState } from '../types/simulation';

interface FlightControlsProps {
  controls: FlightControlsState;
  flight?: FlightState;
  onChangeControl: <K extends keyof FlightControlsState>(key: K, value: FlightControlsState[K]) => void;
  engineOn: boolean;
}

export const FlightControls: React.FC<FlightControlsProps> = ({
  controls,
  flight,
  onChangeControl,
  engineOn
}) => {
  // Cardinal direction helper
  const getHeadingLabel = (deg: number) => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(((deg % 360) / 45)) % 8;
    return directions[index];
  };

  const currentHeading = flight?.heading ?? controls.heading ?? 270;
  const currentAltitude = flight?.altitude ?? controls.altitude ?? 0;
  const currentAirspeed = flight?.airspeed ?? controls.airspeed ?? 0;
  const currentGroundSpeed = flight?.groundSpeed ?? currentAirspeed;
  const verticalSpeed = flight?.verticalSpeed ?? 0;
  const groundTrack = flight?.groundTrack ?? currentHeading;

  const targetHeading = controls.targetHeading ?? controls.heading ?? 270;
  const targetAltitude = controls.targetAltitude ?? controls.altitude ?? 8000;
  const targetAirspeed = controls.targetAirspeed ?? controls.airspeed ?? 145;
  const windSpeed = controls.windSpeed ?? 12;
  const windDirection = controls.windDirection ?? 240;

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-3 shadow-sm flex flex-col justify-between h-full space-y-2 select-none">
      
      {/* Header & Navigation Mode Switch */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-orange-50 border border-orange-200 flex items-center justify-center text-[#F97316]">
            <Sliders className="w-3.5 h-3.5" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-[#1F2937] tracking-tight uppercase">FLIGHT TARGET CONTROLS</h2>
            <div className="text-[9px] text-[#6B7280]">Commanded targets with smooth physical inertia & aerodynamics</div>
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

      {/* Primary Flight Target Sliders */}
      <div className="space-y-2">
        
        {/* 1. THROTTLE */}
        <div className="flex items-center gap-2">
          <div className="w-24 flex items-center gap-1.5 flex-shrink-0">
            <Gauge className="w-3.5 h-3.5 text-[#F97316]" />
            <span className="text-[10.5px] font-semibold text-[#374151]">Throttle</span>
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

        {/* 2. COMMANDED HEADING */}
        <div className="flex items-center gap-2">
          <div className="w-24 flex flex-col flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-[#F97316]" />
              <span className="text-[10.5px] font-semibold text-[#374151]">Target Hdg</span>
            </div>
            <span className="text-[8px] text-slate-400 font-mono pl-5">Cur: {currentHeading}°</span>
          </div>
          <div className="flex-1 flex items-center">
            <input
              type="range"
              min={0}
              max={360}
              step={1}
              value={targetHeading}
              disabled={!engineOn || controls.navigationMode === 'WAYPOINT_ROUTE'}
              onChange={(e) => onChangeControl('targetHeading', Number(e.target.value))}
              className="w-full cursor-pointer accent-[#F97316]"
            />
          </div>
          <div className="w-16 text-right font-mono text-[11px] font-bold text-[#1F2937] flex-shrink-0">
            <span>{targetHeading}°</span>
            <span className="text-[9px] font-bold text-[#F97316] ml-1">{getHeadingLabel(targetHeading)}</span>
          </div>
        </div>

        {/* 3. COMMANDED ALTITUDE */}
        <div className="flex items-center gap-2">
          <div className="w-24 flex flex-col flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <MoveUp className="w-3.5 h-3.5 text-[#F97316]" />
              <span className="text-[10.5px] font-semibold text-[#374151]">Target Alt</span>
            </div>
            <span className="text-[8px] text-slate-400 font-mono pl-5">
              VSI: {verticalSpeed > 0 ? `+${verticalSpeed}` : verticalSpeed}
            </span>
          </div>
          <div className="flex-1 flex items-center">
            <input
              type="range"
              min={0}
              max={20000}
              step={100}
              value={targetAltitude}
              disabled={!engineOn || controls.navigationMode === 'WAYPOINT_ROUTE'}
              onChange={(e) => onChangeControl('targetAltitude', Number(e.target.value))}
              className="w-full cursor-pointer accent-[#F97316]"
            />
          </div>
          <div className="w-16 text-right font-mono text-[11px] font-bold text-[#1F2937] flex-shrink-0">
            <span>{targetAltitude.toLocaleString()}</span>
            <span className="text-[9.5px] font-normal text-[#6B7280] ml-0.5">ft</span>
          </div>
        </div>

        {/* 4. COMMANDED AIRSPEED */}
        <div className="flex items-center gap-2">
          <div className="w-24 flex flex-col flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <Wind className="w-3.5 h-3.5 text-[#F97316]" />
              <span className="text-[10.5px] font-semibold text-[#374151]">Target Speed</span>
            </div>
            <span className="text-[8px] text-slate-400 font-mono pl-5">GS: {currentGroundSpeed}</span>
          </div>
          <div className="flex-1 flex items-center">
            <input
              type="range"
              min={0}
              max={220}
              step={5}
              value={targetAirspeed}
              disabled={!engineOn || controls.navigationMode === 'WAYPOINT_ROUTE'}
              onChange={(e) => onChangeControl('targetAirspeed', Number(e.target.value))}
              className="w-full cursor-pointer accent-[#F97316]"
            />
          </div>
          <div className="w-16 text-right font-mono text-[11px] font-bold text-[#1F2937] flex-shrink-0">
            <span>{targetAirspeed}</span>
            <span className="text-[9.5px] font-normal text-[#6B7280] ml-0.5">km/h</span>
          </div>
        </div>

        {/* 5. ENVIRONMENTAL WIND (SPEED & DIRECTION) */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-100">
          {/* Wind Speed */}
          <div className="flex items-center gap-1.5">
            <Wind className="w-3 h-3 text-blue-500 flex-shrink-0" />
            <span className="text-[9.5px] font-semibold text-[#4B5563] truncate">Wind:</span>
            <input
              type="range"
              min={0}
              max={60}
              step={1}
              value={windSpeed}
              onChange={(e) => onChangeControl('windSpeed', Number(e.target.value))}
              className="w-full cursor-pointer accent-blue-500 h-1"
            />
            <span className="text-[9.5px] font-mono font-bold text-[#1F2937]">{windSpeed}kph</span>
          </div>

          {/* Wind Direction */}
          <div className="flex items-center gap-1.5">
            <Compass className="w-3 h-3 text-blue-500 flex-shrink-0" />
            <span className="text-[9.5px] font-semibold text-[#4B5563] truncate">Dir:</span>
            <input
              type="range"
              min={0}
              max={360}
              step={5}
              value={windDirection}
              onChange={(e) => onChangeControl('windDirection', Number(e.target.value))}
              className="w-full cursor-pointer accent-blue-500 h-1"
            />
            <span className="text-[9.5px] font-mono font-bold text-[#1F2937]">{windDirection}°</span>
          </div>
        </div>

        {/* 6. ENGINE LOAD & AMBIENT TEMP */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-100">
          {/* Engine Load */}
          <div className="flex items-center gap-1.5">
            <Cpu className="w-3 h-3 text-[#F97316] flex-shrink-0" />
            <span className="text-[9.5px] font-semibold text-[#4B5563] truncate">Load:</span>
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
            <span className="text-[9.5px] font-mono font-bold text-[#1F2937]">{controls.engineLoad}%</span>
          </div>

          {/* Ambient Temp */}
          <div className="flex items-center gap-1.5">
            <Sun className="w-3 h-3 text-[#F97316] flex-shrink-0" />
            <span className="text-[9.5px] font-semibold text-[#4B5563] truncate">Temp:</span>
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
            <span className="text-[9.5px] font-mono font-bold text-[#1F2937]">{controls.ambientTemp}°C</span>
          </div>
        </div>

        {/* 7. GEODETIC READOUT & QUICK STEER PRESETS */}
        <div className="flex items-center justify-between gap-1 pt-1 border-t border-gray-100 text-[8.5px]">
          <div className="flex items-center gap-1 font-mono text-slate-500">
            <MapPin className="w-2.5 h-2.5 text-[#F97316]" />
            <span>{(flight?.latitude ?? controls.latitude ?? 32.545).toFixed(4)}°N, {(flight?.longitude ?? controls.longitude ?? 77.215).toFixed(4)}°E</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={!engineOn || controls.navigationMode === 'WAYPOINT_ROUTE'}
              onClick={() => onChangeControl('targetHeading', 0)}
              className="px-1.5 py-0.5 rounded bg-gray-100 hover:bg-orange-100 hover:text-[#F97316] text-[8.5px] font-bold text-gray-700 transition-colors"
            >
              N (0°)
            </button>
            <button
              type="button"
              disabled={!engineOn || controls.navigationMode === 'WAYPOINT_ROUTE'}
              onClick={() => onChangeControl('targetHeading', 90)}
              className="px-1.5 py-0.5 rounded bg-gray-100 hover:bg-orange-100 hover:text-[#F97316] text-[8.5px] font-bold text-gray-700 transition-colors"
            >
              E (90°)
            </button>
            <button
              type="button"
              disabled={!engineOn || controls.navigationMode === 'WAYPOINT_ROUTE'}
              onClick={() => onChangeControl('targetHeading', 180)}
              className="px-1.5 py-0.5 rounded bg-gray-100 hover:bg-orange-100 hover:text-[#F97316] text-[8.5px] font-bold text-gray-700 transition-colors"
            >
              S (180°)
            </button>
            <button
              type="button"
              disabled={!engineOn || controls.navigationMode === 'WAYPOINT_ROUTE'}
              onClick={() => onChangeControl('targetHeading', 270)}
              className="px-1.5 py-0.5 rounded bg-gray-100 hover:bg-orange-100 hover:text-[#F97316] text-[8.5px] font-bold text-gray-700 transition-colors"
            >
              W (270°)
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
