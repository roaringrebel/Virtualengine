import React, { useState, useEffect } from 'react';
import {
  Compass,
  Navigation,
  Play,
  Pause,
  RotateCcw,
  Search,
  CheckCircle2,
  AlertCircle,
  Sliders,
  Sparkles,
  Plane,
  Power
} from 'lucide-react';
import { LocationCoord, Waypoint } from '../types/mission';
import {
  haversineDistanceKm,
  initialBearingDeg,
  formatCoordinateDisplay,
  validateCoordinates,
  generateMissionRoute,
  REAL_WORLD_MISSION_PRESETS
} from '../simulation/geoMath';

interface MissionSetupPanelProps {
  currentSource: LocationCoord;
  currentDestination: LocationCoord;
  activeWaypoints: Waypoint[];
  engineOn: boolean;
  isPaused: boolean;
  navigationMode: 'WAYPOINT_ROUTE' | 'MANUAL_PILOT';
  onUpdateRoute: (source: LocationCoord, destination: LocationCoord, waypoints: Waypoint[]) => void;
  onStartEngine: () => void;
  onStopEngine: () => void;
  onTogglePause: () => void;
  onResetMission: () => void;
  onToggleAutopilot: (mode: 'WAYPOINT_ROUTE' | 'MANUAL_PILOT') => void;
}

export const MissionSetupPanel: React.FC<MissionSetupPanelProps> = ({
  currentSource,
  currentDestination,
  activeWaypoints,
  engineOn,
  isPaused,
  navigationMode,
  onUpdateRoute,
  onStartEngine,
  onStopEngine,
  onTogglePause,
  onResetMission,
  onToggleAutopilot
}) => {
  // Source inputs
  const [sourceName, setSourceName] = useState(currentSource.name);
  const [sourceLat, setSourceLat] = useState(currentSource.lat.toString());
  const [sourceLon, setSourceLon] = useState(currentSource.lon.toString());

  // Destination inputs
  const [destName, setDestName] = useState(currentDestination.name);
  const [destLat, setDestLat] = useState(currentDestination.lat.toString());
  const [destLon, setDestLon] = useState(currentDestination.lon.toString());

  // Search & Preset state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<{ name: string; lat: number; lon: number } | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('vitap_to_vja_airport');

  // Sync inputs when props change externally
  useEffect(() => {
    setSourceName(currentSource.name);
    setSourceLat(currentSource.lat.toFixed(6));
    setSourceLon(currentSource.lon.toFixed(6));
  }, [currentSource]);

  useEffect(() => {
    setDestName(currentDestination.name);
    setDestLat(currentDestination.lat.toFixed(6));
    setDestLon(currentDestination.lon.toFixed(6));
  }, [currentDestination]);

  // Preset Mission selection
  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = REAL_WORLD_MISSION_PRESETS.find(p => p.id === presetId);
    if (!preset) return;

    setSourceName(preset.source.name);
    setSourceLat(preset.source.lat.toFixed(6));
    setSourceLon(preset.source.lon.toFixed(6));

    setDestName(preset.destination.name);
    setDestLat(preset.destination.lat.toFixed(6));
    setDestLon(preset.destination.lon.toFixed(6));

    applyRoute(preset.source, preset.destination, preset.targetAltitudeFt);
  };

  // Apply route with validation
  const applyRoute = (source: LocationCoord, dest: LocationCoord, altitudeFt: number = 6500) => {
    setValidationError(null);

    const validSource = validateCoordinates(source.lat, source.lon);
    if (!validSource.valid) {
      setValidationError(`Invalid Source: ${validSource.error}`);
      return;
    }

    const validDest = validateCoordinates(dest.lat, dest.lon);
    if (!validDest.valid) {
      setValidationError(`Invalid Destination: ${validDest.error}`);
      return;
    }

    const waypoints = generateMissionRoute(source, dest, altitudeFt);
    onUpdateRoute(source, dest, waypoints);
  };

  const handleManualApply = () => {
    const sLat = parseFloat(sourceLat);
    const sLon = parseFloat(sourceLon);
    const dLat = parseFloat(destLat);
    const dLon = parseFloat(destLon);

    if (isNaN(sLat) || isNaN(sLon) || isNaN(dLat) || isNaN(dLon)) {
      setValidationError('Please enter valid numeric latitude and longitude values.');
      return;
    }

    applyRoute(
      { name: sourceName || 'Custom Source', lat: sLat, lon: sLon },
      { name: destName || 'Custom Destination', lat: dLat, lon: dLon }
    );
  };

  // Safe search using built-in local dictionary with Nominatim fallback
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    setSearchResult(null);

    // 1. Local common landmark dictionary
    const qLower = searchQuery.toLowerCase().trim();
    const localDict: Record<string, { name: string; lat: number; lon: number }> = {
      'vit-ap': { name: 'VIT-AP University, Inavolu', lat: 16.4941, lon: 80.4982 },
      'vit ap': { name: 'VIT-AP University, Inavolu', lat: 16.4941, lon: 80.4982 },
      'vijayawada': { name: 'Vijayawada City Center', lat: 16.5062, lon: 80.6480 },
      'vijayawada airport': { name: 'Vijayawada Int Airport (VGA)', lat: 16.5304, lon: 80.7968 },
      'gannavaram': { name: 'Gannavaram Airport Hub', lat: 16.5304, lon: 80.7968 },
      'amaravati': { name: 'Amaravati Capital Secretariat', lat: 16.5131, lon: 80.5165 },
      'guntur': { name: 'Guntur City Airfield Sector', lat: 16.3067, lon: 80.4365 },
      'hyderabad': { name: 'Hyderabad RGIA Corridor', lat: 17.2403, lon: 78.4294 },
      'bengaluru': { name: 'Bengaluru HAL Tactical Airbase', lat: 12.9500, lon: 77.6680 },
      'delhi': { name: 'New Delhi Palam Airbase', lat: 28.5833, lon: 77.1167 },
      'kullu': { name: 'Kullu Manali Airfield', lat: 31.8767, lon: 77.1544 }
    };

    if (localDict[qLower]) {
      const match = localDict[qLower];
      setSearchResult(match);
      setIsSearching(false);
      return;
    }

    // 2. OpenStreetMap Nominatim Search
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`,
        {
          headers: { 'Accept-Language': 'en' },
          signal: controller.signal
        }
      );
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          const item = data[0];
          const lat = parseFloat(item.lat);
          const lon = parseFloat(item.lon);
          const name = item.display_name.split(',')[0] || searchQuery;
          setSearchResult({ name, lat, lon });
          setIsSearching(false);
          return;
        }
      }
      setSearchError('Location not found. Please enter coordinates directly.');
    } catch {
      setSearchError('Search service timed out. Please enter coordinates manually.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleApplySearchResult = (asSource: boolean) => {
    if (!searchResult) return;
    if (asSource) {
      setSourceName(searchResult.name);
      setSourceLat(searchResult.lat.toFixed(6));
      setSourceLon(searchResult.lon.toFixed(6));
    } else {
      setDestName(searchResult.name);
      setDestLat(searchResult.lat.toFixed(6));
      setDestLon(searchResult.lon.toFixed(6));
    }
    setSearchResult(null);
  };

  // Calculate authoritative route distance across all active waypoints
  let totalRouteDistKm = 0;
  if (activeWaypoints && activeWaypoints.length > 1) {
    for (let i = 0; i < activeWaypoints.length - 1; i++) {
      totalRouteDistKm += haversineDistanceKm(
        activeWaypoints[i].lat,
        activeWaypoints[i].lon,
        activeWaypoints[i + 1].lat,
        activeWaypoints[i + 1].lon
      );
    }
  } else {
    totalRouteDistKm = haversineDistanceKm(
      parseFloat(sourceLat) || currentSource.lat,
      parseFloat(sourceLon) || currentSource.lon,
      parseFloat(destLat) || currentDestination.lat,
      parseFloat(destLon) || currentDestination.lon
    );
  }
  totalRouteDistKm = Number(Math.max(1.0, totalRouteDistKm).toFixed(2));

  const currentDistKm = totalRouteDistKm;

  const currentBearing = initialBearingDeg(
    parseFloat(sourceLat) || currentSource.lat,
    parseFloat(sourceLon) || currentSource.lon,
    parseFloat(destLat) || currentDestination.lat,
    parseFloat(destLon) || currentDestination.lon
  );

  const estimatedTimeMin = Math.max(1, Math.round((currentDistKm / 145.0) * 60));
  const missionDemandHours = Number((estimatedTimeMin / 60.0).toFixed(2));

  const routeStatus = engineOn ? 'ACTIVE' : activeWaypoints.length > 0 ? 'READY' : 'STANDBY';

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 shadow-sm flex flex-col justify-between space-y-4">
      
      {/* 1. Header & Preset Selector */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center text-[#F97316]">
              <Plane className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-[#1F2937] uppercase tracking-tight">
                MISSION SETUP
              </h2>
              <div className="text-[11px] text-[#6B7280]">
                Real-World Geodetic Mission Planning
              </div>
            </div>
          </div>

          <div className="text-[9.5px] font-mono font-bold bg-orange-100 text-orange-800 px-2.5 py-1 rounded border border-orange-300">
            MALE UAV &bull; ROTAX 912
          </div>
        </div>

        {/* Preset Selector */}
        <div>
          <label className="text-[10.5px] font-bold text-[#4B5563] uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#F97316]" />
            <span>Preset Real-World Mission Routes</span>
          </label>
          <select
            value={selectedPresetId}
            onChange={(e) => handleSelectPreset(e.target.value)}
            className="w-full text-xs font-semibold bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg p-2.5 text-[#1E293B] focus:outline-none focus:ring-1 focus:ring-[#F97316] transition-all cursor-pointer"
          >
            {REAL_WORLD_MISSION_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. Location Search Bar */}
      <form onSubmit={handleSearch} className="space-y-1.5">
        <label className="text-[10.5px] font-bold text-[#4B5563] uppercase tracking-wider flex items-center gap-1.5">
          <Search className="w-3.5 h-3.5 text-[#64748B]" />
          <span>Search Destination (City / Landmark)</span>
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. Vijayawada Airport, Amaravati, Hyderabad..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 text-xs bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2 text-[#1E293B] placeholder-[#94A3B8] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="px-4 py-2 bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1 shadow-xs disabled:opacity-50"
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>
        
        {searchResult && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 flex items-center justify-between text-xs">
            <div>
              <div className="font-bold text-emerald-900">{searchResult.name}</div>
              <div className="text-[10px] font-mono text-emerald-700">
                {formatCoordinateDisplay(searchResult.lat, searchResult.lon)}
              </div>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => handleApplySearchResult(true)}
                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-[10px]"
              >
                Set as Source
              </button>
              <button
                type="button"
                onClick={() => handleApplySearchResult(false)}
                className="px-2 py-1 bg-[#F97316] hover:bg-[#EA580C] text-white font-bold rounded text-[10px]"
              >
                Set as Dest
              </button>
            </div>
          </div>
        )}

        {searchError && (
          <div className="text-[10px] text-amber-600 font-medium flex items-center gap-1 mt-0.5">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{searchError}</span>
          </div>
        )}
      </form>

      {/* 3. Coordinate Inputs: SOURCE & DESTINATION */}
      <div className="space-y-3">
        
        {/* SOURCE INPUT CARD */}
        <div className="bg-[#F0FDF4] border border-emerald-200 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-800 uppercase flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>SOURCE LOCATION</span>
            </span>
            <span className="text-[10px] font-mono font-bold text-emerald-700">
              {formatCoordinateDisplay(parseFloat(sourceLat) || 0, parseFloat(sourceLon) || 0)}
            </span>
          </div>

          <input
            type="text"
            value={sourceName}
            onChange={(e) => setSourceName(e.target.value)}
            placeholder="Airbase / Runway Name"
            className="w-full text-xs font-bold bg-white border border-emerald-300 rounded-lg px-2.5 py-1.5 text-emerald-900"
          />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9.5px] font-semibold text-emerald-700">Latitude (°N/S)</label>
              <input
                type="text"
                value={sourceLat}
                onChange={(e) => setSourceLat(e.target.value)}
                className="w-full text-xs font-mono font-semibold bg-white border border-emerald-300 rounded-lg px-2.5 py-1.5 text-emerald-900"
                placeholder="16.494100"
              />
            </div>
            <div>
              <label className="text-[9.5px] font-semibold text-emerald-700">Longitude (°E/W)</label>
              <input
                type="text"
                value={sourceLon}
                onChange={(e) => setSourceLon(e.target.value)}
                className="w-full text-xs font-mono font-semibold bg-white border border-emerald-300 rounded-lg px-2.5 py-1.5 text-emerald-900"
                placeholder="80.498200"
              />
            </div>
          </div>
        </div>

        {/* DESTINATION INPUT CARD */}
        <div className="bg-[#FEF2F2] border border-red-200 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-red-800 uppercase flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span>DESTINATION LOCATION</span>
            </span>
            <span className="text-[10px] font-mono font-bold text-red-700">
              {formatCoordinateDisplay(parseFloat(destLat) || 0, parseFloat(destLon) || 0)}
            </span>
          </div>

          <input
            type="text"
            value={destName}
            onChange={(e) => setDestName(e.target.value)}
            placeholder="Destination Target Name"
            className="w-full text-xs font-bold bg-white border border-red-300 rounded-lg px-2.5 py-1.5 text-red-900"
          />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9.5px] font-semibold text-red-700">Latitude (°N/S)</label>
              <input
                type="text"
                value={destLat}
                onChange={(e) => setDestLat(e.target.value)}
                className="w-full text-xs font-mono font-semibold bg-white border border-red-300 rounded-lg px-2.5 py-1.5 text-red-900"
                placeholder="16.530400"
              />
            </div>
            <div>
              <label className="text-[9.5px] font-semibold text-red-700">Longitude (°E/W)</label>
              <input
                type="text"
                value={destLon}
                onChange={(e) => setDestLon(e.target.value)}
                className="w-full text-xs font-mono font-semibold bg-white border border-red-300 rounded-lg px-2.5 py-1.5 text-red-900"
                placeholder="80.796800"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4. GEODESIC ROUTE SUMMARY (Requirement 7) */}
      <div className="bg-[#1E293B] rounded-xl p-3.5 text-white font-mono text-xs space-y-2">
        <div className="flex items-center justify-between border-b border-slate-700 pb-2">
          <span className="text-slate-400 font-bold uppercase text-[10px]">GEODESIC ROUTE SUMMARY</span>
          <span className={`px-2 py-0.5 rounded text-[9.5px] font-bold ${
            routeStatus === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse' : 'bg-slate-800 text-slate-300'
          }`}>
            STATUS: {routeStatus}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          <div>
            <span className="text-slate-400 text-[10px]">TOTAL DISTANCE:</span>
            <div className="text-lg font-black text-[#F97316]">{currentDistKm} km</div>
          </div>
          <div>
            <span className="text-slate-400 text-[10px]">INITIAL BEARING:</span>
            <div className="text-lg font-black text-cyan-300">{currentBearing}°</div>
          </div>
          <div>
            <span className="text-slate-400 text-[10px]">EST. FLIGHT TIME / DEMAND:</span>
            <div className="font-bold text-white">~{estimatedTimeMin} min <span className="text-amber-300 font-mono text-[11px]">({missionDemandHours} h)</span></div>
          </div>
          <div>
            <span className="text-slate-400 text-[10px]">WAYPOINTS:</span>
            <div className="font-bold text-emerald-400">{activeWaypoints.length} Points</div>
          </div>
        </div>
      </div>

      {validationError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-2.5 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
          <span>{validationError}</span>
        </div>
      )}

      {/* 5. MISSION CONTROLS (Requirement 8) */}
      <div className="space-y-2.5 pt-1">
        
        {/* Set Route / Apply Button */}
        <button
          onClick={handleManualApply}
          className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 shadow-xs"
        >
          <Navigation className="w-4 h-4 text-[#F97316]" />
          <span>APPLY ROUTE</span>
        </button>

        {/* Autopilot Mode Toggle */}
        <button
          onClick={() => onToggleAutopilot(navigationMode === 'WAYPOINT_ROUTE' ? 'MANUAL_PILOT' : 'WAYPOINT_ROUTE')}
          className={`w-full py-2 text-xs font-bold rounded-xl border transition-all flex items-center justify-center gap-2 ${
            navigationMode === 'WAYPOINT_ROUTE'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-xs'
              : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>AUTOPILOT: {navigationMode === 'WAYPOINT_ROUTE' ? 'ON (AUTO)' : 'OFF (MANUAL)'}</span>
        </button>

        {/* Primary Mission Action Buttons */}
        <div className="grid grid-cols-3 gap-2">
          {!engineOn ? (
            <button
              onClick={onStartEngine}
              className="col-span-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-xs"
            >
              <Power className="w-4 h-4" />
              <span>START</span>
            </button>
          ) : (
            <button
              onClick={onStopEngine}
              className="col-span-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-xs"
            >
              <Power className="w-4 h-4" />
              <span>STOP</span>
            </button>
          )}

          <button
            onClick={onTogglePause}
            className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 transition-all flex items-center justify-center gap-1.5"
          >
            {isPaused ? <Play className="w-4 h-4 text-emerald-600" /> : <Pause className="w-4 h-4 text-amber-600" />}
            <span>{isPaused ? 'RESUME' : 'PAUSE'}</span>
          </button>

          <button
            onClick={onResetMission}
            className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 transition-all flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-4 h-4 text-slate-600" />
            <span>RESET</span>
          </button>
        </div>
      </div>

    </div>
  );
};
