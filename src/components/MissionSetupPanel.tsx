import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Compass,
  Navigation,
  Play,
  Pause,
  RotateCcw,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle,
  Crosshair,
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
  isSelectingOnMap: boolean;
  selectedMapCoord: { lat: number; lon: number } | null;
  navigationMode: 'WAYPOINT_ROUTE' | 'MANUAL_PILOT';
  onUpdateRoute: (source: LocationCoord, destination: LocationCoord, waypoints: Waypoint[]) => void;
  onStartEngine: () => void;
  onStopEngine: () => void;
  onTogglePause: () => void;
  onResetMission: () => void;
  onToggleMapSelection: (active: boolean) => void;
  onToggleAutopilot: (mode: 'WAYPOINT_ROUTE' | 'MANUAL_PILOT') => void;
}

export const MissionSetupPanel: React.FC<MissionSetupPanelProps> = ({
  currentSource,
  currentDestination,
  activeWaypoints,
  engineOn,
  isPaused,
  isSelectingOnMap,
  selectedMapCoord,
  navigationMode,
  onUpdateRoute,
  onStartEngine,
  onStopEngine,
  onTogglePause,
  onResetMission,
  onToggleMapSelection,
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

  // Handle setting selected coordinate from map click
  const handleApplyMapClickAsSource = () => {
    if (!selectedMapCoord) return;
    setSourceLat(selectedMapCoord.lat.toFixed(6));
    setSourceLon(selectedMapCoord.lon.toFixed(6));
    setSourceName(`Map Pin (${selectedMapCoord.lat.toFixed(4)}, ${selectedMapCoord.lon.toFixed(4)})`);
    applyRoute({
      name: `Map Pin (${selectedMapCoord.lat.toFixed(4)}, ${selectedMapCoord.lon.toFixed(4)})`,
      lat: selectedMapCoord.lat,
      lon: selectedMapCoord.lon
    }, {
      name: destName,
      lat: parseFloat(destLat),
      lon: parseFloat(destLon)
    });
  };

  const handleApplyMapClickAsDest = () => {
    if (!selectedMapCoord) return;
    setDestLat(selectedMapCoord.lat.toFixed(6));
    setDestLon(selectedMapCoord.lon.toFixed(6));
    setDestName(`Map Pin (${selectedMapCoord.lat.toFixed(4)}, ${selectedMapCoord.lon.toFixed(4)})`);
    applyRoute({
      name: sourceName,
      lat: parseFloat(sourceLat),
      lon: parseFloat(sourceLon)
    }, {
      name: `Map Pin (${selectedMapCoord.lat.toFixed(4)}, ${selectedMapCoord.lon.toFixed(4)})`,
      lat: selectedMapCoord.lat,
      lon: selectedMapCoord.lon
    });
  };

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

  // Safe search using built-in local database with Nominatim fallback (with debouncing/button click)
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError(null);

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
      setDestName(match.name);
      setDestLat(match.lat.toFixed(6));
      setDestLon(match.lon.toFixed(6));
      setIsSearching(false);
      return;
    }

    // 2. OpenStreetMap Nominatim Search (Single request on button click, 4s timeout)
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
          setDestName(name);
          setDestLat(lat.toFixed(6));
          setDestLon(lon.toFixed(6));
          setIsSearching(false);
          return;
        }
      }
      setSearchError('Location not found. Try entering coordinates directly.');
    } catch {
      setSearchError('Search service timed out. Please enter coordinates manually.');
    } finally {
      setIsSearching(false);
    }
  };

  // Haversine calculations for active route
  const currentDistKm = haversineDistanceKm(
    parseFloat(sourceLat) || currentSource.lat,
    parseFloat(sourceLon) || currentSource.lon,
    parseFloat(destLat) || currentDestination.lat,
    parseFloat(destLon) || currentDestination.lon
  );

  const currentBearing = initialBearingDeg(
    parseFloat(sourceLat) || currentSource.lat,
    parseFloat(sourceLon) || currentSource.lon,
    parseFloat(destLat) || currentDestination.lat,
    parseFloat(destLon) || currentDestination.lon
  );

  const estimatedTimeMin = Math.round((currentDistKm / 145.0) * 60);

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-3.5 shadow-sm flex flex-col justify-between h-full space-y-3 overflow-y-auto">
      
      {/* 1. Header & Preset Selector */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-orange-50 border border-orange-200 flex items-center justify-center text-[#F97316]">
              <Plane className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-[#1F2937] uppercase tracking-tight">
                MISSION SETUP & FLIGHT PLAN
              </h2>
              <div className="text-[10px] text-[#6B7280]">
                Real-World Geodetic Coordinates (Lat/Lon)
              </div>
            </div>
          </div>

          <div className="text-[9px] font-mono font-bold bg-orange-100 text-orange-800 px-2 py-0.5 rounded border border-orange-300">
            MALE UAV
          </div>
        </div>

        {/* Preset Selector */}
        <div>
          <label className="text-[10px] font-bold text-[#4B5563] uppercase tracking-wider flex items-center gap-1 mb-1">
            <Sparkles className="w-3 h-3 text-[#F97316]" />
            <span>Mission Presets</span>
          </label>
          <select
            value={selectedPresetId}
            onChange={(e) => handleSelectPreset(e.target.value)}
            className="w-full text-xs font-semibold bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg p-2 text-[#1E293B] focus:outline-none focus:ring-1 focus:ring-[#F97316] transition-all cursor-pointer"
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
      <form onSubmit={handleSearch} className="space-y-1">
        <label className="text-[10px] font-bold text-[#4B5563] uppercase tracking-wider flex items-center gap-1">
          <Search className="w-3 h-3 text-[#64748B]" />
          <span>Search Destination (City / Landmark)</span>
        </label>
        <div className="flex gap-1.5">
          <input
            type="text"
            placeholder="e.g. Vijayawada Airport, Amaravati, Hyderabad..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 text-xs bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-2.5 py-1.5 text-[#1E293B] placeholder-[#94A3B8] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="px-3 py-1.5 bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1 shadow-xs disabled:opacity-50"
          >
            {isSearching ? '...' : 'Search'}
          </button>
        </div>
        {searchError && (
          <div className="text-[9.5px] text-amber-600 font-medium flex items-center gap-1 mt-0.5">
            <AlertCircle className="w-3 h-3" />
            <span>{searchError}</span>
          </div>
        )}
      </form>

      {/* 3. Coordinate Inputs: SOURCE & DESTINATION */}
      <div className="space-y-2.5">
        
        {/* SOURCE INPUT CARD */}
        <div className="bg-[#F0FDF4] border border-emerald-200 rounded-lg p-2.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-emerald-800 uppercase flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>SOURCE (TAKEOFF BASE)</span>
            </span>
            <span className="text-[9px] font-mono text-emerald-700">
              {formatCoordinateDisplay(parseFloat(sourceLat) || 0, parseFloat(sourceLon) || 0)}
            </span>
          </div>

          <input
            type="text"
            value={sourceName}
            onChange={(e) => setSourceName(e.target.value)}
            placeholder="Airbase / Runway Name"
            className="w-full text-xs font-bold bg-white border border-emerald-300 rounded px-2 py-1 text-emerald-900"
          />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] font-semibold text-emerald-700">Latitude (°N/S)</label>
              <input
                type="text"
                value={sourceLat}
                onChange={(e) => setSourceLat(e.target.value)}
                className="w-full text-xs font-mono font-semibold bg-white border border-emerald-300 rounded px-2 py-1 text-emerald-900"
                placeholder="16.494100"
              />
            </div>
            <div>
              <label className="text-[9px] font-semibold text-emerald-700">Longitude (°E/W)</label>
              <input
                type="text"
                value={sourceLon}
                onChange={(e) => setSourceLon(e.target.value)}
                className="w-full text-xs font-mono font-semibold bg-white border border-emerald-300 rounded px-2 py-1 text-emerald-900"
                placeholder="80.498200"
              />
            </div>
          </div>
        </div>

        {/* DESTINATION INPUT CARD */}
        <div className="bg-[#FEF2F2] border border-red-200 rounded-lg p-2.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-red-800 uppercase flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span>DESTINATION (TARGET/RECOVERY)</span>
            </span>
            <span className="text-[9px] font-mono text-red-700">
              {formatCoordinateDisplay(parseFloat(destLat) || 0, parseFloat(destLon) || 0)}
            </span>
          </div>

          <input
            type="text"
            value={destName}
            onChange={(e) => setDestName(e.target.value)}
            placeholder="Destination Target Name"
            className="w-full text-xs font-bold bg-white border border-red-300 rounded px-2 py-1 text-red-900"
          />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] font-semibold text-red-700">Latitude (°N/S)</label>
              <input
                type="text"
                value={destLat}
                onChange={(e) => setDestLat(e.target.value)}
                className="w-full text-xs font-mono font-semibold bg-white border border-red-300 rounded px-2 py-1 text-red-900"
                placeholder="16.530400"
              />
            </div>
            <div>
              <label className="text-[9px] font-semibold text-red-700">Longitude (°E/W)</label>
              <input
                type="text"
                value={destLon}
                onChange={(e) => setDestLon(e.target.value)}
                className="w-full text-xs font-mono font-semibold bg-white border border-red-300 rounded px-2 py-1 text-red-900"
                placeholder="80.796800"
              />
            </div>
          </div>
        </div>

        {/* 4. Map Click Selection Mode */}
        <div className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Crosshair className="w-3.5 h-3.5 text-[#F97316]" />
              <span className="text-[10px] font-bold text-[#334155] uppercase">Select on Map Mode</span>
            </div>
            <button
              onClick={() => onToggleMapSelection(!isSelectingOnMap)}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                isSelectingOnMap
                  ? 'bg-amber-500 text-white animate-pulse'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              {isSelectingOnMap ? 'SELECTING ACTIVE' : 'ENABLE MAP CLICK'}
            </button>
          </div>

          {selectedMapCoord ? (
            <div className="bg-white border border-slate-200 rounded p-1.5 flex items-center justify-between text-[9.5px] font-mono">
              <div>
                <span className="text-slate-500">Selected: </span>
                <span className="font-bold text-slate-800">
                  {selectedMapCoord.lat.toFixed(5)}°N, {selectedMapCoord.lon.toFixed(5)}°E
                </span>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={handleApplyMapClickAsSource}
                  className="px-1.5 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold rounded text-[9px]"
                >
                  Set Source
                </button>
                <button
                  onClick={handleApplyMapClickAsDest}
                  className="px-1.5 py-0.5 bg-red-100 hover:bg-red-200 text-red-800 font-bold rounded text-[9px]"
                >
                  Set Dest
                </button>
              </div>
            </div>
          ) : isSelectingOnMap ? (
            <div className="text-[9px] text-amber-700 italic">
              Click anywhere on the map to choose real coordinates.
            </div>
          ) : null}
        </div>
      </div>

      {/* 5. Mathematical Route Summary HUD */}
      <div className="bg-[#1E293B] rounded-lg p-2.5 text-white font-mono text-[10px] space-y-1.5">
        <div className="flex items-center justify-between border-b border-slate-700 pb-1">
          <span className="text-slate-400 font-bold uppercase text-[9px]">GEODESIC ROUTE METRICS</span>
          <span className="text-emerald-400 font-bold">{activeWaypoints.length} WAYPOINTS</span>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          <div>
            <span className="text-slate-400">TOTAL DISTANCE:</span>
            <div className="text-sm font-black text-[#F97316]">{currentDistKm} km</div>
          </div>
          <div>
            <span className="text-slate-400">INITIAL BEARING:</span>
            <div className="text-sm font-black text-cyan-300">{currentBearing}°</div>
          </div>
          <div>
            <span className="text-slate-400">EST. FLIGHT TIME:</span>
            <div className="font-bold text-white">~{estimatedTimeMin} min</div>
          </div>
          <div>
            <span className="text-slate-400">AUTOPILOT:</span>
            <div className="font-bold text-emerald-300">
              {navigationMode === 'WAYPOINT_ROUTE' ? 'WAYPOINT AUTO' : 'MANUAL PILOT'}
            </div>
          </div>
        </div>
      </div>

      {validationError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-[10px] p-2 rounded-lg flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-red-600" />
          <span>{validationError}</span>
        </div>
      )}

      {/* 6. Action Buttons Bar */}
      <div className="space-y-2 pt-1">
        
        {/* Set Route / Apply Button */}
        <button
          onClick={handleManualApply}
          className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-xs"
        >
          <Navigation className="w-3.5 h-3.5 text-[#F97316]" />
          <span>APPLY ROUTE COORDINATES</span>
        </button>

        {/* Autopilot Mode Toggle */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onToggleAutopilot(navigationMode === 'WAYPOINT_ROUTE' ? 'MANUAL_PILOT' : 'WAYPOINT_ROUTE')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all flex items-center justify-center gap-1.5 ${
              navigationMode === 'WAYPOINT_ROUTE'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-xs'
                : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>AUTOPILOT: {navigationMode === 'WAYPOINT_ROUTE' ? 'ON (AUTO)' : 'OFF (MANUAL)'}</span>
          </button>
        </div>

        {/* Primary Flight Controls */}
        <div className="grid grid-cols-3 gap-2">
          {/* Start Engine / Start Mission */}
          {!engineOn ? (
            <button
              onClick={onStartEngine}
              className="col-span-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1 shadow-xs"
            >
              <Power className="w-3.5 h-3.5" />
              <span>START</span>
            </button>
          ) : (
            <button
              onClick={onStopEngine}
              className="col-span-1 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1 shadow-xs"
            >
              <Power className="w-3.5 h-3.5" />
              <span>STOP</span>
            </button>
          )}

          {/* Pause / Resume */}
          <button
            onClick={onTogglePause}
            className="py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-lg border border-slate-300 transition-all flex items-center justify-center gap-1"
          >
            {isPaused ? <Play className="w-3.5 h-3.5 text-emerald-600" /> : <Pause className="w-3.5 h-3.5 text-amber-600" />}
            <span>{isPaused ? 'RESUME' : 'PAUSE'}</span>
          </button>

          {/* Reset Mission */}
          <button
            onClick={onResetMission}
            className="py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-lg border border-slate-300 transition-all flex items-center justify-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
            <span>RESET</span>
          </button>
        </div>
      </div>

    </div>
  );
};
