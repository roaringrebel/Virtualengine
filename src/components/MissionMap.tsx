import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import * as THREE from 'three';
import { 
  MapPin, 
  Plus, 
  Minus, 
  Plane, 
  Layers, 
  Crosshair, 
  Navigation,
  Compass,
  Wind,
  RotateCcw,
  LocateFixed
} from 'lucide-react';
import { FlightPhase, FlightState } from '../types/simulation';
import { UAVPosition } from '../types/mission';
import { MISSION_WAYPOINTS } from '../simulation/simulationEngine';

interface MissionMapProps {
  uavPosition: UAVPosition;
  flightPhase: FlightPhase;
  engineOn: boolean;
  flight?: FlightState;
}

export const MissionMap: React.FC<MissionMapProps> = ({ uavPosition, flightPhase, engineOn, flight }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const threeContainerRef = useRef<HTMLDivElement>(null);

  // View Mode: 'map' (Leaflet Geographic Map) | '3d' (3D Tactical UAV View)
  const [activeView, setActiveView] = useState<'map' | '3d'>('map');
  const [mapStyle, setMapStyle] = useState<'osm' | 'satellite' | 'dark'>('dark');
  const [followUav, setFollowUav] = useState<boolean>(true);

  // Leaflet references
  const mapInstanceRef = useRef<L.Map | null>(null);
  const uavMarkerRef = useRef<L.Marker | null>(null);
  const plannedRouteLineRef = useRef<L.Polyline | null>(null);
  const actualTrackLineRef = useRef<L.Polyline | null>(null);
  const waypointMarkersRef = useRef<L.Marker[]>([]);
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const actualTrackPointsRef = useRef<[number, number][]>([]);
  const lastTrackAppendPosRef = useRef<[number, number]>([uavPosition.lat, uavPosition.lon]);

  // Three.js references (for 3D Tactical Mode)
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const uavGroupRef = useRef<THREE.Group | null>(null);
  const propellerRef = useRef<THREE.Group | null>(null);

  // Keep a persistent ref to the latest state so high-frequency animations do not re-render React
  const stateRef = useRef({
    uavPosition,
    flightPhase,
    engineOn,
    flight,
    followUav
  });

  useEffect(() => {
    stateRef.current = {
      uavPosition,
      flightPhase,
      engineOn,
      flight,
      followUav
    };
  }, [uavPosition, flightPhase, engineOn, flight, followUav]);

  // Tile layer URLs
  const TILE_LAYERS = {
    dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    osm: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
  };

  // --------------------------------------------------------------------------
  // 1. INITIALIZE LEAFLET GEOGRAPHIC MAP (Runs ONCE on mount)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return; // Prevent recreation

    const centerLat = 32.5550;
    const centerLon = 77.2600;

    // Create Map
    const map = L.map(mapContainerRef.current, {
      center: [centerLat, centerLon],
      zoom: 12,
      zoomControl: false,
      attributionControl: false
    });
    mapInstanceRef.current = map;

    // Add Base Tile Layer
    const tileLayer = L.tileLayer(TILE_LAYERS[mapStyle], {
      maxZoom: 18,
      subdomains: 'abcd'
    }).addTo(map);
    baseTileLayerRef.current = tileLayer;

    // Create Planned Route Polyline
    const routeCoords: [number, number][] = MISSION_WAYPOINTS.map(wp => [wp.lat, wp.lon]);
    // Connect back to home base to close loop
    if (routeCoords.length > 0) {
      routeCoords.push([MISSION_WAYPOINTS[0].lat, MISSION_WAYPOINTS[0].lon]);
    }

    const plannedLine = L.polyline(routeCoords, {
      color: '#F97316',
      weight: 2.5,
      opacity: 0.85,
      dashArray: '6, 6',
      lineCap: 'round'
    }).addTo(map);
    plannedRouteLineRef.current = plannedLine;

    // Create Actual Travelled Track Polyline
    actualTrackPointsRef.current = [[uavPosition.lat, uavPosition.lon]];
    const actualLine = L.polyline(actualTrackPointsRef.current, {
      color: '#06B6D4',
      weight: 3.5,
      opacity: 0.95,
      lineCap: 'round'
    }).addTo(map);
    actualTrackLineRef.current = actualLine;

    // Add Waypoint Markers
    MISSION_WAYPOINTS.forEach((wp, idx) => {
      const isBase = wp.type === 'BASE';
      const wpIcon = L.divIcon({
        className: 'custom-wp-icon',
        html: `
          <div style="
            display: flex;
            flex-direction: column;
            align-items: center;
            transform: translate(-50%, -50%);
            pointer-events: auto;
          ">
            <div style="
              width: 22px;
              height: 22px;
              border-radius: 50%;
              background: ${isBase ? '#10B981' : '#F97316'};
              border: 2px solid #FFFFFF;
              box-shadow: 0 2px 6px rgba(0,0,0,0.4);
              display: flex;
              align-items: center;
              justify-content: center;
              color: #FFFFFF;
              font-family: monospace;
              font-size: 10px;
              font-weight: 800;
            ">
              ${isBase ? 'H' : idx}
            </div>
            <div style="
              background: rgba(15, 23, 42, 0.85);
              color: #F8FAFC;
              padding: 1px 5px;
              border-radius: 4px;
              font-family: sans-serif;
              font-size: 8.5px;
              font-weight: bold;
              white-space: nowrap;
              margin-top: 2px;
              border: 1px solid rgba(255,255,255,0.15);
            ">
              ${wp.name.split('—')[0].trim()} (${wp.altitudeFt}ft)
            </div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const marker = L.marker([wp.lat, wp.lon], { icon: wpIcon }).addTo(map);
      marker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 11px;">
          <strong style="color: #F97316;">${wp.name}</strong><br/>
          <span style="color: #64748B;">Target Alt:</span> <b>${wp.altitudeFt} ft</b><br/>
          <span style="color: #64748B;">Target Speed:</span> <b>${wp.targetAirspeedKmh} km/h</b><br/>
          <span style="color: #94A3B8; font-size: 9.5px;">${wp.description}</span>
        </div>
      `);
      waypointMarkersRef.current.push(marker);
    });

    // Create UAV Marker (Custom SVG MALE UAV with smooth heading rotation)
    const createUavIconHtml = (hdg: number) => `
      <div id="uav-map-icon-wrapper" style="
        width: 44px;
        height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        transform: translate(-50%, -50%);
        pointer-events: none;
      ">
        <div style="
          width: 36px;
          height: 36px;
          transform: rotate(${hdg}deg);
          transition: transform 0.15s ease-out;
          filter: drop-shadow(0 3px 6px rgba(0,0,0,0.6));
        ">
          <svg viewBox="0 0 100 100" style="width: 100%; height: 100%;">
            <!-- Wings -->
            <polygon points="50,15 10,65 20,72 50,48 80,72 90,65" fill="#F97316" stroke="#FFFFFF" stroke-width="2.5" />
            <!-- Fuselage -->
            <ellipse cx="50" cy="50" rx="9" ry="38" fill="#1E293B" stroke="#F97316" stroke-width="2.5" />
            <!-- Nose Cone -->
            <polygon points="50,10 43,26 57,26" fill="#EA580C" />
            <!-- Tail Wing -->
            <polygon points="50,75 35,92 65,92" fill="#334155" stroke="#FFFFFF" stroke-width="1.5" />
            <!-- Center Engine/Antenna Dot -->
            <circle cx="50" cy="45" r="4" fill="#06B6D4" stroke="#FFFFFF" stroke-width="1" />
          </svg>
        </div>
      </div>
    `;

    const uavIcon = L.divIcon({
      className: 'custom-uav-marker',
      html: createUavIconHtml(uavPosition.heading),
      iconSize: [44, 44],
      iconAnchor: [22, 22]
    });

    const uavMarker = L.marker([uavPosition.lat, uavPosition.lon], {
      icon: uavIcon,
      zIndexOffset: 1000
    }).addTo(map);
    uavMarkerRef.current = uavMarker;

    // Invalidate map size to ensure full bounds render cleanly
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // --------------------------------------------------------------------------
  // 2. SWITCH MAP TILE STYLE
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!mapInstanceRef.current || !baseTileLayerRef.current) return;
    baseTileLayerRef.current.setUrl(TILE_LAYERS[mapStyle]);
  }, [mapStyle]);

  // --------------------------------------------------------------------------
  // 3. CONTINUOUS SMOOTH MARKER & TRACK UPDATE (Zero Shaking Interpolation)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!mapInstanceRef.current || !uavMarkerRef.current) return;

    const currentLat = uavPosition.lat;
    const currentLon = uavPosition.lon;
    const currentHdg = uavPosition.heading;

    // Update marker position
    uavMarkerRef.current.setLatLng([currentLat, currentLon]);

    // Update heading rotation cleanly on DOM element
    const iconWrapper = document.getElementById('uav-map-icon-wrapper');
    if (iconWrapper && iconWrapper.firstElementChild) {
      (iconWrapper.firstElementChild as HTMLElement).style.transform = `rotate(${currentHdg}deg)`;
    }

    // Append to actual track polyline if moved >= 15 meters
    const lastPos = lastTrackAppendPosRef.current;
    const dLatM = (currentLat - lastPos[0]) * 111139;
    const dLonM = (currentLon - lastPos[1]) * 111139 * Math.cos((currentLat * Math.PI) / 180);
    const distMovedM = Math.hypot(dLatM, dLonM);

    if (distMovedM >= 15 && engineOn) {
      lastTrackAppendPosRef.current = [currentLat, currentLon];
      actualTrackPointsRef.current.push([currentLat, currentLon]);
      if (actualTrackPointsRef.current.length > 800) {
        actualTrackPointsRef.current.shift();
      }
      if (actualTrackLineRef.current) {
        actualTrackLineRef.current.setLatLngs(actualTrackPointsRef.current);
      }
    }

    // Smooth camera panning (Only when follow UAV is enabled and aircraft leaves center region)
    if (followUav && mapInstanceRef.current) {
      const map = mapInstanceRef.current;
      const center = map.getCenter();
      const centerDistM = Math.hypot((currentLat - center.lat) * 111139, (currentLon - center.lng) * 111139 * Math.cos((center.lat * Math.PI) / 180));
      
      // Pan gently only when UAV drifts > 600m from viewport center to prevent jitter
      if (centerDistM > 600) {
        map.panTo([currentLat, currentLon], { animate: true, duration: 0.8 });
      }
    }
  }, [uavPosition.lat, uavPosition.lon, uavPosition.heading, engineOn, followUav]);

  // --------------------------------------------------------------------------
  // 4. THREE.JS 3D TACTICAL VIEW INITIALIZATION (For 3D View Mode)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (activeView !== '3d' || !threeContainerRef.current) return;
    const container = threeContainerRef.current;
    const width = container.clientWidth || 750;
    const height = container.clientHeight || 350;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a111e);
    scene.fog = new THREE.FogExp2(0x0a111e, 0.0015);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(46, width / height, 1, 3000);
    camera.position.set(0, 22, 48);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffecd2, 2.4);
    sunLight.position.set(100, 200, 100);
    scene.add(sunLight);

    // Terrain grid
    const grid = new THREE.GridHelper(1000, 50, 0x06b6d4, 0x1e293b);
    grid.position.y = 0;
    scene.add(grid);

    // Build 3D MALE UAV Model
    const uavGroup = new THREE.Group();

    // Fuselage
    const fuseGeo = new THREE.ConeGeometry(2.4, 22, 16);
    fuseGeo.rotateX(Math.PI / 2);
    const fuseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3, metalness: 0.7 });
    const fuselage = new THREE.Mesh(fuseGeo, fuseMat);
    uavGroup.add(fuselage);

    // Wings
    const wingGeo = new THREE.BoxGeometry(38, 0.4, 3.8);
    const wingMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.4, metalness: 0.6 });
    const wings = new THREE.Mesh(wingGeo, wingMat);
    wings.position.set(0, 0.6, -1.0);
    uavGroup.add(wings);

    // V-Tail
    const tailLGeo = new THREE.BoxGeometry(1.2, 7, 0.3);
    tailLGeo.rotateZ(Math.PI / 4);
    const tailMat = new THREE.MeshStandardMaterial({ color: 0x334155 });
    const tailL = new THREE.Mesh(tailLGeo, tailMat);
    tailL.position.set(-2.5, 3.2, 9.5);
    uavGroup.add(tailL);

    const tailRGeo = new THREE.BoxGeometry(1.2, 7, 0.3);
    tailRGeo.rotateZ(-Math.PI / 4);
    const tailR = new THREE.Mesh(tailRGeo, tailMat);
    tailR.position.set(2.5, 3.2, 9.5);
    uavGroup.add(tailR);

    // Pusher Propeller
    const propGroup = new THREE.Group();
    const bladeGeo = new THREE.BoxGeometry(0.3, 5.2, 0.15);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b });
    const blade1 = new THREE.Mesh(bladeGeo, bladeMat);
    const blade2 = new THREE.Mesh(bladeGeo, bladeMat);
    blade2.rotation.z = Math.PI / 2;
    propGroup.add(blade1, blade2);
    propGroup.position.set(0, 0, 11.2);
    uavGroup.add(propGroup);
    propellerRef.current = propGroup;

    uavGroup.position.set(0, 12, 0);
    scene.add(uavGroup);
    uavGroupRef.current = uavGroup;

    // 3D Animation Loop
    let animId: number;
    const animate3D = () => {
      animId = requestAnimationFrame(animate3D);
      const isEngineRunning = stateRef.current.engineOn;

      if (propellerRef.current && isEngineRunning) {
        propellerRef.current.rotation.z += 0.45;
      }

      if (uavGroupRef.current && cameraRef.current) {
        const hdgRad = ((stateRef.current.uavPosition.heading) * Math.PI) / 180;
        uavGroupRef.current.rotation.y = -hdgRad + Math.PI;

        // Smooth bank
        const bank = (stateRef.current.flight?.bankAngleDeg || 0) * (Math.PI / 180);
        uavGroupRef.current.rotation.z = bank;

        // Chase camera behind UAV
        const camDistance = 38;
        const camHeight = 16;
        const targetX = uavGroupRef.current.position.x + Math.sin(hdgRad) * camDistance;
        const targetZ = uavGroupRef.current.position.z + Math.cos(hdgRad) * camDistance;
        cameraRef.current.position.set(targetX, camHeight, targetZ);
        cameraRef.current.lookAt(uavGroupRef.current.position);
      }

      renderer.render(scene, camera);
    };

    animate3D();

    const handleResize = () => {
      if (!container || !cameraRef.current || !rendererRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, [activeView]);

  // Recenter map on UAV
  const handleRecenter = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([uavPosition.lat, uavPosition.lon], 13, { animate: true });
    }
  };

  const currentWp = MISSION_WAYPOINTS[uavPosition.currentWaypointIndex] || MISSION_WAYPOINTS[0];
  const verticalSpeedFpm = flight?.verticalSpeed ?? 0;
  const verticalSpeedMs = (verticalSpeedFpm * 0.00508).toFixed(1);
  const groundTrackDeg = flight?.groundTrack ?? uavPosition.heading;
  const groundSpeedKmh = flight?.groundSpeed ?? uavPosition.airspeed;

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-3.5 shadow-sm flex flex-col justify-between h-full select-none overflow-hidden">
      
      {/* 1. Header Bar */}
      <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-orange-50 border border-orange-200 flex items-center justify-center text-[#F97316]">
            <Navigation className="w-3.5 h-3.5" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-[#1F2937] tracking-tight uppercase">
              MISSION MAP — VIRTUAL MALE UAV
            </h2>
            <div className="text-[10px] text-[#6B7280]">
              Simulated Geographic Position & Mission Track
            </div>
          </div>
        </div>

        {/* View Mode & Map Controls */}
        <div className="flex items-center gap-1.5 text-xs">
          {/* Mode Switcher: Geographic Map vs 3D View */}
          <div className="flex items-center bg-[#F3F4F6] p-0.5 rounded-lg border border-[#E5E7EB] text-[10px] font-bold">
            <button
              onClick={() => setActiveView('map')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                activeView === 'map'
                  ? 'bg-white text-[#F97316] shadow-xs'
                  : 'text-[#6B7280] hover:text-[#1F2937]'
              }`}
            >
              Geographic Map
            </button>
            <button
              onClick={() => setActiveView('3d')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                activeView === '3d'
                  ? 'bg-white text-[#F97316] shadow-xs'
                  : 'text-[#6B7280] hover:text-[#1F2937]'
              }`}
            >
              3D Tactical View
            </button>
          </div>

          {/* Map Layer Style (When in Map View) */}
          {activeView === 'map' && (
            <div className="flex items-center bg-[#F3F4F6] p-0.5 rounded-lg border border-[#E5E7EB] text-[10px] font-semibold">
              <button
                onClick={() => setMapStyle('dark')}
                className={`px-2 py-1 rounded-md ${mapStyle === 'dark' ? 'bg-[#1E293B] text-white' : 'text-[#6B7280]'}`}
              >
                Tactical Dark
              </button>
              <button
                onClick={() => setMapStyle('satellite')}
                className={`px-2 py-1 rounded-md ${mapStyle === 'satellite' ? 'bg-[#1E293B] text-white' : 'text-[#6B7280]'}`}
              >
                Satellite
              </button>
              <button
                onClick={() => setMapStyle('osm')}
                className={`px-2 py-1 rounded-md ${mapStyle === 'osm' ? 'bg-[#1E293B] text-white' : 'text-[#6B7280]'}`}
              >
                Street
              </button>
            </div>
          )}

          {/* Follow UAV Toggle */}
          <button
            onClick={() => setFollowUav(!followUav)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
              followUav
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'
            }`}
            title="Auto-pan map with UAV"
          >
            <LocateFixed className="w-3 h-3" />
            <span>Follow UAV: {followUav ? 'ON' : 'OFF'}</span>
          </button>

          {/* Recenter Button */}
          <button
            onClick={handleRecenter}
            className="p-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300"
            title="Recenter map on UAV position"
          >
            <Crosshair className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Main Map / 3D Canvas Area */}
      <div className="relative w-full h-[330px] rounded-xl overflow-hidden border border-[#E5E7EB] bg-[#0F172A]">
        
        {/* Leaflet 2D Map Container */}
        <div
          ref={mapContainerRef}
          className={`w-full h-full ${activeView === 'map' ? 'block' : 'hidden'}`}
          style={{ background: '#0F172A' }}
        />

        {/* Three.js 3D Container */}
        {activeView === '3d' && (
          <div
            ref={threeContainerRef}
            className="w-full h-full block"
          />
        )}

        {/* Top-Left Telemetry Overlay HUD (Truthful, Aerospace Engineering Readouts) */}
        <div className="absolute top-2.5 left-2.5 bg-slate-950/85 backdrop-blur-md border border-slate-700/60 rounded-lg p-2.5 text-white font-mono text-[9.5px] shadow-lg pointer-events-none z-[500] space-y-1">
          <div className="text-[10px] font-bold text-[#F97316] uppercase tracking-wider flex items-center justify-between gap-4 border-b border-slate-800 pb-1">
            <span>VIRTUAL MALE UAV</span>
            <span className="text-[8.5px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              {flightPhase}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 pt-0.5">
            <div className="text-slate-400">POSITION:</div>
            <div className="text-right text-cyan-300 font-bold">
              {uavPosition.lat.toFixed(4)}°N, {uavPosition.lon.toFixed(4)}°E
            </div>

            <div className="text-slate-400">ALTITUDE:</div>
            <div className="text-right text-orange-400 font-bold">
              {engineOn ? uavPosition.altitude.toLocaleString() : 0} ft
            </div>

            <div className="text-slate-400">AIRSPEED:</div>
            <div className="text-right text-emerald-400 font-bold">
              {engineOn ? uavPosition.airspeed : 0} km/h
            </div>

            <div className="text-slate-400">GROUND SPEED:</div>
            <div className="text-right text-emerald-300 font-bold">
              {engineOn ? groundSpeedKmh : 0} km/h
            </div>

            <div className="text-slate-400">HEADING / TRK:</div>
            <div className="text-right text-white font-bold">
              {uavPosition.heading}° / {groundTrackDeg}°
            </div>

            <div className="text-slate-400">VSI:</div>
            <div className="text-right text-slate-200">
              {Number(verticalSpeedMs) >= 0 ? `+${verticalSpeedMs}` : verticalSpeedMs} m/s
            </div>
          </div>
        </div>

        {/* Top-Right Waypoint & Route Info Overlay */}
        <div className="absolute top-2.5 right-2.5 bg-slate-950/85 backdrop-blur-md border border-slate-700/60 rounded-lg p-2.5 text-white font-mono text-[9.5px] shadow-lg pointer-events-none z-[500] space-y-1">
          <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider border-b border-slate-800 pb-1 flex items-center justify-between gap-3">
            <span>MISSION ROUTE</span>
            <span className="text-orange-400">{uavPosition.missionProgressPercent}%</span>
          </div>

          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 pt-0.5 text-[9px]">
            <div className="text-slate-400">TARGET WP:</div>
            <div className="text-right text-amber-300 font-bold truncate max-w-[120px]">
              {currentWp.name.split('—')[0]}
            </div>

            <div className="text-slate-400">DISTANCE:</div>
            <div className="text-right text-white font-bold">
              {uavPosition.distanceToNextKm} km
            </div>

            <div className="text-slate-400">BEARING:</div>
            <div className="text-right text-cyan-300 font-bold">
              {flight?.bearingToWaypointDeg ?? uavPosition.heading}°
            </div>
          </div>
        </div>

        {/* Bottom Legend */}
        <div className="absolute bottom-2 left-2 bg-slate-950/80 backdrop-blur-xs border border-slate-800 px-2.5 py-1 rounded-md text-[8.5px] font-mono text-slate-300 flex items-center gap-3 z-[500]">
          <div className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-[#F97316] inline-block border-t border-dashed border-[#F97316]" />
            <span>Planned Route</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-1 bg-[#06B6D4] inline-block rounded-full" />
            <span>Travelled Track</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#10B981] inline-block" />
            <span>Home Base</span>
          </div>
        </div>
      </div>
    </div>
  );
};
