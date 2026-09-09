import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { 
  Navigation,
  Crosshair,
  LocateFixed,
  Plus,
  Minus,
  Maximize2,
  Layers,
  ShieldCheck,
  Compass,
  Gauge,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Zap,
  MapPin
} from 'lucide-react';
import { FaultState, FlightPhase, FlightState, MissionReliabilityState } from '../types/simulation';
import { LocationCoord, UAVPosition, Waypoint, ELPCandidate } from '../types/mission';
import { formatCoordinateDisplay, haversineDistanceKm } from '../simulation/geoMath';

interface MissionMapProps {
  uavPosition: UAVPosition;
  flightPhase: FlightPhase;
  engineOn: boolean;
  flight?: FlightState;
  reliability?: MissionReliabilityState;
  fault?: FaultState;
  waypoints?: Waypoint[];
  source?: LocationCoord;
  destination?: LocationCoord;
  isSelectingOnMap?: boolean;
  onMapClick?: (coord: { lat: number; lon: number }) => void;
}

const TILE_LAYERS = {
  street: {
    name: 'Street (OSM)',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  },
  terrain: {
    name: 'Terrain (Topo)',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenTopoMap (&copy; OSM contributors)',
    maxZoom: 17
  },
  satellite: {
    name: 'Satellite (Esri)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri &mdash; Maxar, Earthstar Geographics',
    maxZoom: 19
  }
};

export const MissionMap: React.FC<MissionMapProps> = ({ 
  uavPosition, 
  flightPhase, 
  engineOn, 
  flight,
  reliability,
  fault,
  waypoints = [],
  source,
  destination,
  isSelectingOnMap = false,
  onMapClick
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const [mapStyle, setMapStyle] = useState<'street' | 'terrain' | 'satellite'>('street');
  const [followUav, setFollowUav] = useState<boolean>(true);

  // Leaflet references
  const mapInstanceRef = useRef<L.Map | null>(null);
  const uavMarkerRef = useRef<L.Marker | null>(null);
  const plannedRouteLineRef = useRef<L.Polyline | null>(null);
  const actualTrackLineRef = useRef<L.Polyline | null>(null);
  const emergencyDivertLineRef = useRef<L.Polyline | null>(null);
  const waypointMarkersRef = useRef<L.Marker[]>([]);
  const elpMarkersRef = useRef<L.Marker[]>([]);
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const actualTrackPointsRef = useRef<[number, number][]>([]);
  const lastTrackAppendPosRef = useRef<[number, number]>([uavPosition.lat, uavPosition.lon]);

  const stateRef = useRef({
    uavPosition,
    flightPhase,
    engineOn,
    flight,
    reliability,
    followUav,
    isSelectingOnMap,
    waypoints
  });

  useEffect(() => {
    stateRef.current = {
      uavPosition,
      flightPhase,
      engineOn,
      flight,
      reliability,
      followUav,
      isSelectingOnMap,
      waypoints
    };
  });

  const isRecovered = flightPhase === 'RECOVERED';
  const isCompleted = flightPhase === 'COMPLETED' || flight?.isCompleted || reliability?.isCompleted;
  const isEmergencyDivert = flightPhase === 'EMERGENCY_DIVERT' || flightPhase === 'RECOVERY_APPROACH' || isRecovered || (reliability?.emergencyRecoveryTriggered ?? false);
  const emergencyRecovery = reliability?.emergencyRecovery;
  const selectedELP = emergencyRecovery?.selectedELP;

  const currentAlt = flight?.altitude ?? uavPosition.altitude;
  const currentAirspeed = flight?.airspeed ?? uavPosition.airspeed;
  const currentGroundSpeed = flight?.groundSpeed ?? 0;
  const currentHeading = flight?.heading ?? uavPosition.heading;
  const distRemaining = (isCompleted || isRecovered) ? 0 : (reliability?.distanceRemainingKm ?? uavPosition.distanceToNextKm);

  // --------------------------------------------------------------------------
  // 1. INITIALIZE 2D LEAFLET MAP
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialLat = uavPosition.lat || 16.4941;
    const initialLon = uavPosition.lon || 80.4982;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLon],
      zoom: 12,
      zoomControl: false,
      attributionControl: true
    });

    const cfg = TILE_LAYERS[mapStyle];
    const tileLayer = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: cfg.maxZoom
    }).addTo(map);
    baseTileLayerRef.current = tileLayer;

    // Planned Route Polyline (dashed cyan line)
    const plannedLine = L.polyline([], {
      color: '#0284C7',
      weight: 3.5,
      dashArray: '8, 6',
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map);
    plannedRouteLineRef.current = plannedLine;

    // Emergency Diversion Polyline (dashed rose/red line)
    const divertLine = L.polyline([], {
      color: '#E11D48',
      weight: 4,
      dashArray: '6, 6',
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map);
    emergencyDivertLineRef.current = divertLine;

    // Actual Flight Track Polyline (solid orange line)
    const actualLine = L.polyline([], {
      color: '#F97316',
      weight: 4,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map);
    actualTrackLineRef.current = actualLine;

    // UAV Marker Icon
    const uavIcon = L.divIcon({
      className: 'custom-uav-marker',
      html: `
        <div id="uav-map-icon-wrapper" style="
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          filter: drop-shadow(0 3px 6px rgba(0,0,0,0.45));
          cursor: pointer;
        ">
          <svg style="
            width: 38px;
            height: 38px;
            transform: rotate(${uavPosition.heading || 0}deg);
            transform-origin: center center;
            transition: transform 0.15s ease-out;
          " viewBox="0 0 24 24" fill="none">
            <path d="M12 2L15 9L22 13L15 14.5L13.5 21L12 22L10.5 21L9 14.5L2 13L9 9L12 2Z" fill="#F97316" stroke="#FFFFFF" stroke-width="1.6" stroke-linejoin="round"/>
            <circle cx="12" cy="11" r="2.2" fill="#0F172A" stroke="#FFFFFF" stroke-width="0.8"/>
            <circle cx="12" cy="3" r="1.5" fill="#EF4444"/>
          </svg>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22]
    });

    const uavMarker = L.marker([initialLat, initialLon], {
      icon: uavIcon,
      zIndexOffset: 1000
    }).addTo(map);
    uavMarkerRef.current = uavMarker;

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (stateRef.current.isSelectingOnMap && onMapClick) {
        onMapClick({ lat: e.latlng.lat, lon: e.latlng.lng });
      }
    });

    mapInstanceRef.current = map;

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // --------------------------------------------------------------------------
  // 2. UPDATE GEOGRAPHIC WAYPOINTS & ELP MARKERS
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // 1. Remove old waypoint & ELP markers
    waypointMarkersRef.current.forEach(m => m.remove());
    waypointMarkersRef.current = [];
    elpMarkersRef.current.forEach(m => m.remove());
    elpMarkersRef.current = [];

    // 2. Normal Planned Route Polyline
    if (waypoints && waypoints.length > 0) {
      const routeCoords: [number, number][] = waypoints.map(w => [w.lat, w.lon]);
      if (plannedRouteLineRef.current) {
        plannedRouteLineRef.current.setLatLngs(routeCoords);
        if (isEmergencyDivert) {
          plannedRouteLineRef.current.setStyle({ color: '#64748B', opacity: 0.35, dashArray: '4, 4' });
        } else {
          plannedRouteLineRef.current.setStyle({ color: '#0284C7', opacity: 0.9, dashArray: '8, 6' });
        }
      }

      // Add Waypoint Markers
      waypoints.forEach((wp, idx) => {
        const isSource = wp.type === 'SOURCE' || idx === 0;
        const isDest = wp.type === 'DESTINATION' || idx === waypoints.length - 1;
        
        let bgColor = isSource ? '#10B981' : isDest ? '#EF4444' : '#F97316';
        let labelBadge = isSource ? 'SRC' : isDest ? (isEmergencyDivert ? 'DEST (ABORTED)' : 'DST') : `WP${idx}`;
        if (isEmergencyDivert && isDest) {
          bgColor = '#64748B';
        }

        const wpIcon = L.divIcon({
          className: 'custom-wp-icon',
          html: `
            <div style="
              display: flex;
              flex-direction: column;
              align-items: center;
              transform: translate(-50%, -50%);
              pointer-events: auto;
              opacity: ${isEmergencyDivert && !isSource ? 0.45 : 1.0};
            ">
              <div style="
                width: 24px;
                height: 24px;
                border-radius: 50%;
                background: ${bgColor};
                border: 2px solid #FFFFFF;
                box-shadow: 0 2px 6px rgba(0,0,0,0.45);
                display: flex;
                align-items: center;
                justify-content: center;
                color: #FFFFFF;
                font-family: ui-monospace, monospace;
                font-size: 10px;
                font-weight: 800;
              ">
                ${isSource ? 'S' : isDest ? (isEmergencyDivert ? '✕' : 'D') : idx}
              </div>
              <div style="
                background: rgba(15, 23, 42, 0.90);
                color: #F8FAFC;
                padding: 2px 6px;
                border-radius: 4px;
                font-family: system-ui, sans-serif;
                font-size: 9px;
                font-weight: 700;
                white-space: nowrap;
                margin-top: 2px;
                border: 1px solid rgba(255,255,255,0.2);
                box-shadow: 0 2px 4px rgba(0,0,0,0.35);
              ">
                ${labelBadge} &bull; ${wp.name.split('—')[0]}
              </div>
            </div>
          `,
          iconSize: [26, 26],
          iconAnchor: [13, 13]
        });

        const marker = L.marker([wp.lat, wp.lon], { icon: wpIcon }).addTo(map);
        waypointMarkersRef.current.push(marker);
      });
    }

    // 3. Emergency Landing Points (ELPs) Rendering (When Emergency Divert Active)
    if (isEmergencyDivert && emergencyRecovery && emergencyRecovery.candidates) {
      emergencyRecovery.candidates.forEach((elp) => {
        const isSelected = elp.isSelected;
        const iconColor = isSelected ? '#10B981' : elp.reachable ? '#F59E0B' : '#EF4444';

        const elpIcon = L.divIcon({
          className: 'custom-elp-icon',
          html: `
            <div style="
              display: flex;
              flex-direction: column;
              align-items: center;
              transform: translate(-50%, -50%);
              pointer-events: auto;
              z-index: ${isSelected ? 500 : 300};
            ">
              <div style="
                width: ${isSelected ? '32px' : '26px'};
                height: ${isSelected ? '32px' : '26px'};
                border-radius: 50%;
                background: ${iconColor};
                border: 2.5px solid #FFFFFF;
                box-shadow: 0 0 ${isSelected ? '12px #10B981' : '6px rgba(0,0,0,0.5)'};
                display: flex;
                align-items: center;
                justify-content: center;
                color: #FFFFFF;
                font-family: ui-monospace, monospace;
                font-size: 11px;
                font-weight: 900;
              ">
                ${isSelected ? '★' : 'E'}
              </div>
              <div style="
                background: ${isSelected ? '#064E3B' : 'rgba(15, 23, 42, 0.95)'};
                color: #FFFFFF;
                padding: 2px 7px;
                border-radius: 4px;
                font-family: system-ui, sans-serif;
                font-size: 9.5px;
                font-weight: 800;
                white-space: nowrap;
                margin-top: 3px;
                border: 1px solid ${isSelected ? '#10B981' : 'rgba(255,255,255,0.2)'};
                box-shadow: 0 2px 6px rgba(0,0,0,0.45);
              ">
                ${elp.id}: ${elp.name} ${isSelected ? ' (RECOVERY TARGET)' : ''}
              </div>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });

        const marker = L.marker([elp.lat, elp.lon], { icon: elpIcon }).addTo(map);
        marker.bindPopup(`
          <div style="font-family: system-ui, sans-serif; font-size: 11px; padding: 2px;">
            <strong style="color: ${iconColor}; font-size: 12px;">${elp.id} &bull; ${elp.name}</strong><br/>
            <div style="margin-top: 4px; color: #475569;">
              <span>Distance:</span> <b style="color: #0F172A;">${elp.distanceFromUavKm} km</b><br/>
              <span>Reachability:</span> <b style="color: ${elp.reachable ? '#10B981' : '#EF4444'};">${elp.reachable ? 'REACHABLE' : 'UNREACHABLE'}</b><br/>
              <span>Suitability:</span> <b style="color: #0F172A;">${elp.landingSuitability.replace(/_/g, ' ')}</b><br/>
              <span>Risk:</span> <b style="color: #0F172A;">${elp.overallRisk}</b>
            </div>
          </div>
        `);
        elpMarkersRef.current.push(marker);
      });

      // Update Emergency Diversion Polyline to Selected ELP
      if (selectedELP && emergencyDivertLineRef.current) {
        emergencyDivertLineRef.current.setLatLngs([
          [uavPosition.lat, uavPosition.lon],
          [selectedELP.lat, selectedELP.lon]
        ]);
      }
    } else {
      if (emergencyDivertLineRef.current) {
        emergencyDivertLineRef.current.setLatLngs([]);
      }
    }
  }, [waypoints, isEmergencyDivert, emergencyRecovery, selectedELP, uavPosition.lat, uavPosition.lon]);

  // --------------------------------------------------------------------------
  // 3. SWITCH MAP TILE STYLE
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!mapInstanceRef.current || !baseTileLayerRef.current) return;
    const cfg = TILE_LAYERS[mapStyle];
    baseTileLayerRef.current.setUrl(cfg.url);
  }, [mapStyle]);

  // --------------------------------------------------------------------------
  // 4. CONTINUOUS SMOOTH MARKER & TRACK UPDATE
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!mapInstanceRef.current || !uavMarkerRef.current) return;

    const currentLat = uavPosition.lat;
    const currentLon = uavPosition.lon;
    const currentHdg = uavPosition.heading;

    // Update marker position
    uavMarkerRef.current.setLatLng([currentLat, currentLon]);

    // Update heading rotation smoothly on SVG DOM element
    const iconWrapper = document.getElementById('uav-map-icon-wrapper');
    if (iconWrapper && iconWrapper.firstElementChild) {
      (iconWrapper.firstElementChild as HTMLElement).style.transform = `rotate(${currentHdg}deg)`;
    }

    // Append to actual flight track polyline
    const lastPos = lastTrackAppendPosRef.current;
    const dLatM = (currentLat - lastPos[0]) * 111320;
    const dLonM = (currentLon - lastPos[1]) * 111320 * Math.cos((currentLat * Math.PI) / 180);
    const distMovedM = Math.hypot(dLatM, dLonM);

    if (distMovedM >= 10 && engineOn && !isCompleted && !isRecovered) {
      lastTrackAppendPosRef.current = [currentLat, currentLon];
      actualTrackPointsRef.current.push([currentLat, currentLon]);
      if (actualTrackPointsRef.current.length > 1500) {
        actualTrackPointsRef.current.shift();
      }
      if (actualTrackLineRef.current) {
        actualTrackLineRef.current.setLatLngs(actualTrackPointsRef.current);
      }
    }

    // Update Emergency Diversion Line Vector dynamically
    if (isEmergencyDivert && selectedELP && emergencyDivertLineRef.current) {
      emergencyDivertLineRef.current.setLatLngs([
        [currentLat, currentLon],
        [selectedELP.lat, selectedELP.lon]
      ]);
    }

    // Smooth Deadband Camera Tracking
    if (followUav && mapInstanceRef.current && !isCompleted && !isRecovered) {
      const map = mapInstanceRef.current;
      const mapCenter = map.getCenter();
      const distFromCenterM = haversineDistanceKm(mapCenter.lat, mapCenter.lng, currentLat, currentLon) * 1000;
      
      if (distFromCenterM > 500) {
        map.panTo([currentLat, currentLon], { animate: true, duration: 0.8 });
      }
    }
  }, [uavPosition, followUav, engineOn, isCompleted, isRecovered, isEmergencyDivert, selectedELP]);

  const handleCenterOnUAV = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([uavPosition.lat, uavPosition.lon], 14, { animate: true });
    }
  };

  const handleFitRouteBounds = () => {
    if (mapInstanceRef.current) {
      const points: [number, number][] = waypoints.map(w => [w.lat, w.lon]);
      points.push([uavPosition.lat, uavPosition.lon]);
      if (selectedELP) {
        points.push([selectedELP.lat, selectedELP.lon]);
      }
      if (points.length > 1) {
        const bounds = L.latLngBounds(points);
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], animate: true });
      }
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-125px)] bg-slate-900 rounded-xl overflow-hidden border border-[#E5E7EB] shadow-sm select-none">
      
      {/* 1. Real Geographic Leaflet Map */}
      <div 
        ref={mapContainerRef} 
        className="w-full h-full z-0"
      />

      {/* 2. Top-Left: Map Header Bar & Status */}
      <div className="absolute top-4 left-4 z-[400] flex flex-col gap-2 pointer-events-none">
        <div className="bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-lg border border-[#E5E7EB] shadow-md pointer-events-auto flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${isEmergencyDivert ? 'bg-rose-600 animate-ping' : 'bg-[#F97316] animate-pulse'}`} />
          <div>
            <div className="text-xs font-black text-[#1F2937] tracking-tight uppercase flex items-center gap-1.5">
              <span>GEOGRAPHIC FLIGHT MAP</span>
              {isEmergencyDivert && (
                <span className="bg-rose-600 text-white text-[9px] px-1.5 py-0.2 rounded font-mono font-bold">
                  EMERGENCY DIVERT ACTIVE
                </span>
              )}
            </div>
            <div className="text-[10px] text-[#6B7280]">
              {isEmergencyDivert ? 'Diverting to Safest Emergency Landing Point (ELP)' : 'Real-World 2D Map • Geodesic Navigation • Virtual UAV'}
            </div>
          </div>
        </div>

        {isSelectingOnMap && (
          <div className="bg-amber-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-md animate-bounce flex items-center gap-2 pointer-events-auto">
            <Crosshair className="w-4 h-4 animate-spin" />
            <span>CLICK ON MAP TO SELECT COORDINATES</span>
          </div>
        )}
      </div>

      {/* 3. Top-Right: Map Tile Controls & Navigation Buttons */}
      <div className="absolute top-4 right-4 z-[400] flex items-center gap-2">
        {/* Layer Switcher */}
        <div className="bg-white/95 backdrop-blur-md rounded-lg border border-[#E5E7EB] shadow-md p-1 flex items-center gap-1">
          <button
            onClick={() => setMapStyle('street')}
            className={`px-2.5 py-1 text-[11px] font-bold rounded transition-all ${
              mapStyle === 'street'
                ? 'bg-[#F97316] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Street
          </button>
          <button
            onClick={() => setMapStyle('terrain')}
            className={`px-2.5 py-1 text-[11px] font-bold rounded transition-all ${
              mapStyle === 'terrain'
                ? 'bg-[#F97316] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Terrain
          </button>
          <button
            onClick={() => setMapStyle('satellite')}
            className={`px-2.5 py-1 text-[11px] font-bold rounded transition-all ${
              mapStyle === 'satellite'
                ? 'bg-[#F97316] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Satellite
          </button>
        </div>

        {/* Follow UAV Toggle */}
        <button
          onClick={() => setFollowUav(!followUav)}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg border shadow-md flex items-center gap-1.5 transition-all ${
            followUav 
              ? 'bg-emerald-600 text-white border-emerald-700' 
              : 'bg-white/95 text-slate-700 border-slate-200 hover:bg-slate-100'
          }`}
          title="Smooth follow UAV on movement"
        >
          <LocateFixed className="w-3.5 h-3.5" />
          <span>Follow: {followUav ? 'ON' : 'OFF'}</span>
        </button>

        {/* Center / Fit Bounds / Zoom Controls */}
        <div className="bg-white/95 backdrop-blur-md rounded-lg border border-[#E5E7EB] shadow-md flex items-center p-1 gap-1">
          <button
            onClick={handleCenterOnUAV}
            className="p-1.5 text-slate-700 hover:bg-slate-100 rounded"
            title="Center on UAV"
          >
            <Crosshair className="w-4 h-4" />
          </button>
          <button
            onClick={handleFitRouteBounds}
            className="p-1.5 text-slate-700 hover:bg-slate-100 rounded"
            title="Fit Entire Route"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <div className="w-[1px] h-4 bg-slate-200 mx-0.5" />
          <button
            onClick={() => mapInstanceRef.current?.zoomIn()}
            className="p-1.5 text-slate-700 hover:bg-slate-100 rounded"
            title="Zoom In"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={() => mapInstanceRef.current?.zoomOut()}
            className="p-1.5 text-slate-700 hover:bg-slate-100 rounded"
            title="Zoom Out"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 4. Bottom-Right: Tactical Information & Flight Status Panel */}
      <div className="absolute bottom-4 right-4 z-[400] max-w-sm">
        {isRecovered ? (
          <div className="bg-emerald-600 text-white rounded-xl p-4 shadow-xl border border-emerald-500 space-y-2 animate-in fade-in duration-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-100" />
              <div>
                <div className="text-xs font-black tracking-wider uppercase">
                  MISSION RECOVERED
                </div>
                <div className="text-[11px] text-emerald-100 font-medium">
                  Safe Emergency Touchdown Completed
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-500/50 text-[11px] font-mono">
              <div>
                <span className="text-emerald-200">LANDING SITE:</span> <b className="text-white">{selectedELP?.id || 'ELP-01'}</b>
              </div>
              <div>
                <span className="text-emerald-200">STATUS:</span> <b className="text-white">RECOVERED</b>
              </div>
              <div className="col-span-2 truncate">
                <span className="text-emerald-200">LOCATION:</span> <b className="text-white">{selectedELP?.name || 'Emergency Strip'}</b>
              </div>
            </div>
          </div>
        ) : isCompleted ? (
          <div className="bg-emerald-600 text-white rounded-xl p-4 shadow-xl border border-emerald-500 space-y-2 animate-in fade-in duration-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-100" />
              <div>
                <div className="text-xs font-black tracking-wider uppercase">
                  DESTINATION REACHED
                </div>
                <div className="text-[11px] text-emerald-100 font-medium">
                  Mission Completed Successfully
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-500/50 text-[11px] font-mono">
              <div>
                <span className="text-emerald-200">MISSION:</span> <b className="text-white">COMPLETED</b>
              </div>
              <div>
                <span className="text-emerald-200">FINAL DIST:</span> <b className="text-white">0.00 km</b>
              </div>
              <div>
                <span className="text-emerald-200">POSITION:</span> <b className="text-white">{uavPosition.lat.toFixed(4)}°N</b>
              </div>
              <div>
                <span className="text-emerald-200">TOUCHDOWN:</span> <b className="text-white">{destination?.name || 'RUNWAY'}</b>
              </div>
            </div>
          </div>
        ) : (
          <div className={`backdrop-blur-md text-white rounded-xl p-3.5 shadow-xl border space-y-2 min-w-[260px] ${
            isEmergencyDivert
              ? 'bg-slate-950/95 border-rose-500/80 shadow-rose-950/40'
              : 'bg-slate-900/90 border-slate-700/80'
          }`}>
            <div className="flex items-center justify-between border-b border-slate-700/70 pb-2">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  isEmergencyDivert ? 'bg-rose-500 animate-ping' : engineOn ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                }`} />
                <span className="text-[11px] font-black tracking-wider text-slate-200">
                  {isEmergencyDivert ? 'EMERGENCY DIVERT' : engineOn ? 'MISSION: IN PROGRESS' : 'MISSION: STANDBY'}
                </span>
              </div>
              <span className={`text-[9.5px] font-mono font-bold px-2 py-0.5 rounded border ${
                isEmergencyDivert
                  ? 'bg-rose-900/80 text-rose-300 border-rose-600'
                  : 'bg-slate-800 text-orange-400 border-slate-700'
              }`}>
                {flightPhase}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">ALTITUDE:</span>
                <span className="font-bold text-white">{currentAlt.toLocaleString()} ft</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">AIRSPEED:</span>
                <span className="font-bold text-sky-400">{currentAirspeed} km/h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">HEADING:</span>
                <span className="font-bold text-amber-400">{currentHeading}°</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{isEmergencyDivert ? 'ELP DIST:' : 'REM DIST:'}</span>
                <span className={`font-bold ${isEmergencyDivert ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {distRemaining.toFixed(1)} km
                </span>
              </div>
            </div>

            <div className="pt-1.5 border-t border-slate-700/60 text-[10px] font-mono text-slate-400 flex items-center justify-between">
              <span>{isEmergencyDivert && selectedELP ? `TARGET: ${selectedELP.id}` : 'COORDS:'}</span>
              <span className="text-slate-200">{uavPosition.lat.toFixed(4)}°N, {uavPosition.lon.toFixed(4)}°E</span>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
