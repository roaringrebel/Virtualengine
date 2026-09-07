import React, { useState } from 'react';
import { 
  Terminal, 
  ChevronDown, 
  ChevronUp, 
  Navigation, 
  Compass, 
  Gauge, 
  MoveUp, 
  Wind, 
  MapPin, 
  Clock, 
  Activity, 
  Zap,
  CheckCircle2
} from 'lucide-react';
import { FlightState, NavigationMode } from '../types/simulation';

interface FlightDebugPanelProps {
  flight: FlightState;
  enginePowerHp: number;
  efficiencyLossRatio: number;
  speedMultiplier: number;
  simTimeSeconds: number;
  navigationMode: NavigationMode;
  engineOn: boolean;
}

export const FlightDebugPanel: React.FC<FlightDebugPanelProps> = ({
  flight,
  enginePowerHp,
  efficiencyLossRatio,
  speedMultiplier,
  simTimeSeconds,
  navigationMode,
  engineOn,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden select-none transition-all">
      {/* Header Bar / Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 bg-gradient-to-r from-slate-900 to-slate-800 text-white hover:bg-slate-800 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-5 rounded bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-[#F97316]">
            <Terminal className="w-3 h-3" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold font-mono tracking-wider text-orange-400">FLIGHT MODEL DEBUG</span>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                PHYSICS ACTIVE (30Hz)
              </span>
            </div>
            <div className="text-[9px] text-slate-400 font-mono">
              Live kinematic states, geodesic vectors, and reduced-order aerodynamics
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 font-mono text-[9.5px] text-slate-300">
            <span>HDG: <strong className="text-white">{flight.heading}°</strong></span>
            <span className="text-slate-500">|</span>
            <span>ALT: <strong className="text-orange-400">{engineOn ? flight.altitude.toLocaleString() : 0} ft</strong></span>
            <span className="text-slate-500">|</span>
            <span>GS: <strong className="text-emerald-400">{engineOn ? flight.groundSpeed : 0} km/h</strong></span>
          </div>

          <div className="w-6 h-6 rounded bg-slate-700/60 flex items-center justify-center text-slate-300">
            {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </div>
        </div>
      </button>

      {/* Expanded Debug Content */}
      {isOpen && (
        <div className="p-3 bg-slate-950 text-slate-200 font-mono text-[10px] space-y-3">
          
          {/* Row 1: Kinematic Position & Attitudes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
            {/* Box 1: Geodesic Coordinates */}
            <div className="bg-slate-900/80 border border-slate-800 p-2 rounded-lg space-y-1">
              <div className="flex items-center gap-1 text-slate-400 text-[9px] font-bold uppercase tracking-wider">
                <MapPin className="w-3 h-3 text-[#F97316]" />
                <span>Geodetic Position</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Latitude:</span>
                <strong className="text-white">{flight.latitude.toFixed(4)}°N</strong>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Longitude:</span>
                <strong className="text-white">{flight.longitude.toFixed(4)}°E</strong>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Altitude:</span>
                <strong className="text-orange-400">{flight.altitude} ft</strong>
              </div>
            </div>

            {/* Box 2: Heading & Steering Dynamics */}
            <div className="bg-slate-900/80 border border-slate-800 p-2 rounded-lg space-y-1">
              <div className="flex items-center gap-1 text-slate-400 text-[9px] font-bold uppercase tracking-wider">
                <Compass className="w-3 h-3 text-cyan-400" />
                <span>Heading Dynamics</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Current Heading:</span>
                <strong className="text-cyan-300">{flight.heading}°</strong>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Commanded Target:</span>
                <strong className="text-white">{flight.targetHeading}°</strong>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Turn Rate / Bank:</span>
                <strong className="text-orange-300">{flight.turnRateDegPerSec}°/s ({flight.bankAngleDeg}°)</strong>
              </div>
            </div>

            {/* Box 3: Speed & Velocity Vectors */}
            <div className="bg-slate-900/80 border border-slate-800 p-2 rounded-lg space-y-1">
              <div className="flex items-center gap-1 text-slate-400 text-[9px] font-bold uppercase tracking-wider">
                <Gauge className="w-3 h-3 text-emerald-400" />
                <span>Speed & Vectors</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>True Airspeed (TAS):</span>
                <strong className="text-emerald-400">{flight.airspeed} km/h</strong>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Ground Speed (GS):</span>
                <strong className="text-emerald-300">{flight.groundSpeed} km/h</strong>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Ground Track (TRK):</span>
                <strong className="text-cyan-400">{flight.groundTrack}°</strong>
              </div>
            </div>

            {/* Box 4: Vertical Dynamics & Climb Rate */}
            <div className="bg-slate-900/80 border border-slate-800 p-2 rounded-lg space-y-1">
              <div className="flex items-center gap-1 text-slate-400 text-[9px] font-bold uppercase tracking-wider">
                <MoveUp className="w-3 h-3 text-purple-400" />
                <span>Vertical Dynamics</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Vertical Speed (VSI):</span>
                <strong className={flight.verticalSpeed >= 0 ? 'text-emerald-400' : 'text-amber-400'}>
                  {flight.verticalSpeed > 0 ? `+${flight.verticalSpeed}` : flight.verticalSpeed} ft/min
                </strong>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Target Altitude:</span>
                <strong className="text-white">{flight.targetAltitude} ft</strong>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Flight Phase:</span>
                <strong className="text-orange-400">{flight.flightPhase}</strong>
              </div>
            </div>
          </div>

          {/* Row 2: Wind, Autopilot & Engine Coupling */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {/* Box 5: Environmental Wind */}
            <div className="bg-slate-900/80 border border-slate-800 p-2 rounded-lg space-y-1">
              <div className="flex items-center gap-1 text-slate-400 text-[9px] font-bold uppercase tracking-wider">
                <Wind className="w-3 h-3 text-blue-400" />
                <span>Atmospheric Wind Vector</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Wind Speed:</span>
                <strong className="text-white">{flight.windSpeed} km/h</strong>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Wind Direction:</span>
                <strong className="text-blue-300">{flight.windDirection}° (From)</strong>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Drift Angle:</span>
                <strong className="text-orange-300">
                  {Math.abs(flight.groundTrack - flight.heading)}° {flight.groundTrack >= flight.heading ? 'R' : 'L'}
                </strong>
              </div>
            </div>

            {/* Box 6: Autopilot Route Status */}
            <div className="bg-slate-900/80 border border-slate-800 p-2 rounded-lg space-y-1">
              <div className="flex items-center gap-1 text-slate-400 text-[9px] font-bold uppercase tracking-wider">
                <Navigation className="w-3 h-3 text-amber-400" />
                <span>Waypoint Autopilot</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Active Waypoint:</span>
                <strong className="text-amber-300 truncate max-w-[150px]">{flight.currentWaypointName}</strong>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Distance / Bearing:</span>
                <strong className="text-white">{flight.distanceToWaypointKm} km @ {flight.bearingToWaypointDeg}°</strong>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Mission Mode / Progress:</span>
                <strong className="text-emerald-400">{navigationMode} ({flight.missionProgressPercent}%)</strong>
              </div>
            </div>

            {/* Box 7: Engine Power & Simulation Clock */}
            <div className="bg-slate-900/80 border border-slate-800 p-2 rounded-lg space-y-1">
              <div className="flex items-center gap-1 text-slate-400 text-[9px] font-bold uppercase tracking-wider">
                <Zap className="w-3 h-3 text-orange-400" />
                <span>Engine & Sim Telemetry</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Engine Shaft Power:</span>
                <strong className="text-orange-300">{enginePowerHp.toFixed(1)} hp</strong>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Engine Health / Derate:</span>
                <strong className={efficiencyLossRatio > 0 ? 'text-red-400' : 'text-emerald-400'}>
                  {((1 - efficiencyLossRatio) * 100).toFixed(0)}% ({(efficiencyLossRatio * 100).toFixed(0)}% loss)
                </strong>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Sim Clock / Rate:</span>
                <strong className="text-cyan-300">{formatTime(simTimeSeconds)} ({speedMultiplier}x)</strong>
              </div>
            </div>
          </div>

          {/* Model Basis Engineering Note */}
          <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 text-[9.5px] text-slate-400 space-y-1">
            <div className="text-orange-400 font-bold uppercase tracking-wide">MODEL BASIS & ENGINEERING ASSUMPTIONS</div>
            <p className="leading-relaxed text-slate-300">
              This prototype uses a reduced-order physics model combining simplified UAV flight dynamics, atmospheric relationships, propulsion relationships and engine thermal/sensor models.
            </p>
            <p className="leading-relaxed text-slate-400">
              Simulation parameters are prototype assumptions and should be calibrated using measured UAV/engine data for production deployment.
            </p>
          </div>

          <div className="text-[8.5px] text-slate-500 text-right pt-1 border-t border-slate-800">
            BHARAT AEROTWIN FLIGHT-DYNAMICS & ROTAX 912 ULS PHYSICS INTEGRATION • NO RANDOM STEPS • DETERMINISTIC
          </div>
        </div>
      )}
    </div>
  );
};
