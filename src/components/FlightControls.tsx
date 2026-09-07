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
  Activity,
  Shield,
  Plane
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
  const getHeadingLabel = (deg: number) => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(((deg % 360) / 45)) % 8;
    return directions[index];
  };

  const currentHeading = flight?.heading ?? controls.heading ?? 80;
  const currentAltitude = flight?.altitude ?? controls.altitude ?? 0;
  const currentAirspeed = flight?.airspeed ?? controls.airspeed ?? 0;
  const currentGroundSpeed = flight?.groundSpeed ?? currentAirspeed;
  const verticalSpeedFpm = flight?.verticalSpeed ?? 0;
  const verticalSpeedMs = (verticalSpeedFpm * 0.00508).toFixed(1);
  const groundTrack = flight?.groundTrack ?? currentHeading;
  const flightPhase = flight?.flightPhase ?? (engineOn ? 'CRUISE' : 'STANDBY');
  const turnRate = flight?.turnRateDegPerSec ?? 0;
  const bankAngle = flight?.bankAngleDeg ?? 0;

  const targetHeading = controls.targetHeading ?? 80;
  const targetAltitude = controls.targetAltitude ?? 6500;
  const targetAirspeed = controls.targetAirspeed ?? 145;
  const windSpeed = controls.windSpeed ?? 12;
  const windDirection = controls.windDirection ?? 240;

  return (
    <div className="grid grid-cols-12 gap-4 select-none">
      
      {/* LEFT COLUMN: COMMANDED FLIGHT CONTROLS (Requirements 23, 24) */}
      <div className="col-span-12 lg:col-span-6 bg-white rounded-xl border border-[#E5E7EB] p-4 shadow-sm space-y-4">
        
        {/* Header & Navigation Mode Switch */}
        <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center text-[#F97316]">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-[#1F2937] tracking-tight uppercase">
                COMMANDED FLIGHT CONTROLS
              </h2>
              <div className="text-[11px] text-[#6B7280]">
                Command Targets with Geodesic Flight Dynamics
              </div>
            </div>
          </div>

          {/* Autopilot Mode Selector */}
          <div className="flex items-center bg-[#F3F4F6] border border-[#E5E7EB] p-0.5 rounded-lg text-[10px] font-bold">
            <button
              onClick={() => onChangeControl('navigationMode', 'MANUAL_PILOT')}
              disabled={!engineOn}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${
                controls.navigationMode === 'MANUAL_PILOT'
                  ? 'bg-[#F97316] text-white shadow-xs font-bold'
                  : 'text-[#4B5563] hover:text-black'
              }`}
            >
              <Navigation className="w-3 h-3" />
              <span>Manual</span>
            </button>
            <button
              onClick={() => onChangeControl('navigationMode', 'WAYPOINT_ROUTE')}
              disabled={!engineOn}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${
                controls.navigationMode === 'WAYPOINT_ROUTE'
                  ? 'bg-[#F97316] text-white shadow-xs font-bold'
                  : 'text-[#4B5563] hover:text-black'
              }`}
            >
              <Route className="w-3 h-3" />
              <span>Autopilot</span>
            </button>
          </div>
        </div>

        {/* Primary Sliders */}
        <div className="space-y-3.5">
          
          {/* 1. THROTTLE */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-[#374151]">
              <span className="flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-[#F97316]" />
                <span>THROTTLE COMMAND</span>
              </span>
              <span className="font-mono text-sm text-[#F97316] font-black">{controls.throttle}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={controls.throttle}
              disabled={!engineOn}
              onChange={(e) => onChangeControl('throttle', Number(e.target.value))}
              className="w-full cursor-pointer accent-[#F97316] h-2 bg-slate-100 rounded-lg"
            />
          </div>

          {/* 2. TARGET HEADING */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-[#374151]">
              <span className="flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-[#F97316]" />
                <span>TARGET HEADING</span>
              </span>
              <span className="font-mono text-sm text-slate-900 font-black">
                {targetHeading}° <span className="text-[#F97316] text-xs">({getHeadingLabel(targetHeading)})</span>
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={360}
              step={1}
              value={targetHeading}
              disabled={!engineOn || controls.navigationMode === 'WAYPOINT_ROUTE'}
              onChange={(e) => onChangeControl('targetHeading', Number(e.target.value))}
              className="w-full cursor-pointer accent-[#F97316] h-2 bg-slate-100 rounded-lg disabled:opacity-50"
            />
          </div>

          {/* 3. TARGET ALTITUDE */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-[#374151]">
              <span className="flex items-center gap-1.5">
                <MoveUp className="w-3.5 h-3.5 text-[#F97316]" />
                <span>TARGET ALTITUDE (MSL)</span>
              </span>
              <span className="font-mono text-sm text-slate-900 font-black">
                {targetAltitude.toLocaleString()} <span className="text-[11px] font-normal text-slate-500">ft</span>
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={18000}
              step={100}
              value={targetAltitude}
              disabled={!engineOn || controls.navigationMode === 'WAYPOINT_ROUTE'}
              onChange={(e) => onChangeControl('targetAltitude', Number(e.target.value))}
              className="w-full cursor-pointer accent-[#F97316] h-2 bg-slate-100 rounded-lg disabled:opacity-50"
            />
          </div>

          {/* 4. TARGET AIRSPEED */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-[#374151]">
              <span className="flex items-center gap-1.5">
                <Wind className="w-3.5 h-3.5 text-[#F97316]" />
                <span>TARGET AIRSPEED (TAS)</span>
              </span>
              <span className="font-mono text-sm text-slate-900 font-black">
                {targetAirspeed} <span className="text-[11px] font-normal text-slate-500">km/h</span>
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={220}
              step={5}
              value={targetAirspeed}
              disabled={!engineOn || controls.navigationMode === 'WAYPOINT_ROUTE'}
              onChange={(e) => onChangeControl('targetAirspeed', Number(e.target.value))}
              className="w-full cursor-pointer accent-[#F97316] h-2 bg-slate-100 rounded-lg disabled:opacity-50"
            />
          </div>

          {/* 5. ENVIRONMENTAL WIND & TEMPERATURE */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            {/* Wind Speed */}
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-2.5 space-y-1">
              <div className="flex items-center justify-between text-[10.5px] font-bold text-[#475569]">
                <span>WIND SPEED</span>
                <span className="font-mono text-blue-600 font-black">{windSpeed} km/h</span>
              </div>
              <input
                type="range"
                min={0}
                max={60}
                step={1}
                value={windSpeed}
                onChange={(e) => onChangeControl('windSpeed', Number(e.target.value))}
                className="w-full cursor-pointer accent-blue-500 h-1.5"
              />
            </div>

            {/* Wind Direction */}
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-2.5 space-y-1">
              <div className="flex items-center justify-between text-[10.5px] font-bold text-[#475569]">
                <span>WIND DIRECTION</span>
                <span className="font-mono text-blue-600 font-black">{windDirection}°</span>
              </div>
              <input
                type="range"
                min={0}
                max={360}
                step={5}
                value={windDirection}
                onChange={(e) => onChangeControl('windDirection', Number(e.target.value))}
                className="w-full cursor-pointer accent-blue-500 h-1.5"
              />
            </div>
          </div>

          {/* 6. AMBIENT TEMP & ENGINE LOAD */}
          <div className="grid grid-cols-2 gap-3">
            {/* Ambient Temperature */}
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-2.5 space-y-1">
              <div className="flex items-center justify-between text-[10.5px] font-bold text-[#475569]">
                <span>AMBIENT TEMP</span>
                <span className="font-mono text-[#F97316] font-black">{controls.ambientTemp}°C</span>
              </div>
              <input
                type="range"
                min={-20}
                max={50}
                step={1}
                value={controls.ambientTemp}
                onChange={(e) => onChangeControl('ambientTemp', Number(e.target.value))}
                className="w-full cursor-pointer accent-[#F97316] h-1.5"
              />
            </div>

            {/* Engine Load */}
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-2.5 flex flex-col justify-between">
              <div className="text-[10.5px] font-bold text-[#475569]">ENGINE LOAD</div>
              <div className="text-base font-black font-mono text-slate-900">
                {engineOn ? (flight?.engineLoad ?? controls.engineLoad ?? 70) : 0}%
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* RIGHT COLUMN: CURRENT FLIGHT STATE (Requirement 24) */}
      <div className="col-span-12 lg:col-span-6 bg-white rounded-xl border border-[#E5E7EB] p-4 shadow-sm space-y-4">
        
        <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center text-[#F97316]">
              <Plane className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-[#1F2937] tracking-tight uppercase">
                CURRENT FLIGHT STATE
              </h2>
              <div className="text-[11px] text-[#6B7280]">
                Live Aerodynamic & Geospatial Telemetry
              </div>
            </div>
          </div>

          <span className="px-2.5 py-1 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            {flightPhase}
          </span>
        </div>

        {/* Live State Grid */}
        <div className="grid grid-cols-2 gap-3 font-mono text-xs">
          
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3">
            <div className="text-[10px] font-bold text-slate-500">HEADING (HDG)</div>
            <div className="text-xl font-black text-slate-900 mt-1">{currentHeading}°</div>
            <div className="text-[10px] text-slate-500 font-sans mt-0.5">{getHeadingLabel(currentHeading)} Vector</div>
          </div>

          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3">
            <div className="text-[10px] font-bold text-slate-500">GROUND TRACK (TRK)</div>
            <div className="text-xl font-black text-cyan-600 mt-1">{groundTrack}°</div>
            <div className="text-[10px] text-slate-500 font-sans mt-0.5">Wind Corrected Track</div>
          </div>

          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3">
            <div className="text-[10px] font-bold text-slate-500">ALTITUDE (MSL)</div>
            <div className="text-xl font-black text-[#F97316] mt-1">{currentAltitude.toLocaleString()} ft</div>
            <div className="text-[10px] text-slate-500 font-sans mt-0.5">Mean Sea Level</div>
          </div>

          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3">
            <div className="text-[10px] font-bold text-slate-500">VERTICAL SPEED (VSI)</div>
            <div className="text-xl font-black text-slate-900 mt-1">
              {Number(verticalSpeedMs) >= 0 ? `+${verticalSpeedMs}` : verticalSpeedMs} m/s
            </div>
            <div className="text-[10px] text-slate-500 font-sans mt-0.5">{verticalSpeedFpm} ft/min</div>
          </div>

          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3">
            <div className="text-[10px] font-bold text-slate-500">TRUE AIRSPEED (TAS)</div>
            <div className="text-xl font-black text-emerald-600 mt-1">{currentAirspeed} km/h</div>
            <div className="text-[10px] text-slate-500 font-sans mt-0.5">Dynamic Pitot Velocity</div>
          </div>

          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3">
            <div className="text-[10px] font-bold text-slate-500">GROUND SPEED (GS)</div>
            <div className="text-xl font-black text-blue-600 mt-1">{currentGroundSpeed} km/h</div>
            <div className="text-[10px] text-slate-500 font-sans mt-0.5">Earth Geodetic Velocity</div>
          </div>

          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3">
            <div className="text-[10px] font-bold text-slate-500">TURN RATE / BANK</div>
            <div className="text-base font-black text-slate-900 mt-1">{turnRate.toFixed(1)}°/s &bull; {bankAngle.toFixed(1)}°</div>
            <div className="text-[10px] text-slate-500 font-sans mt-0.5">Coordinated Turn Dynamics</div>
          </div>

          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3">
            <div className="text-[10px] font-bold text-slate-500">CURRENT POSITION</div>
            <div className="text-sm font-bold text-slate-900 mt-1 truncate">
              {flight?.latitude.toFixed(6)}°N
            </div>
            <div className="text-sm font-bold text-slate-900 truncate">
              {flight?.longitude.toFixed(6)}°E
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
