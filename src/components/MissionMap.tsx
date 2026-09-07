import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import * as THREE from 'three';
import { 
  Navigation,
  Crosshair,
  LocateFixed,
  Plus,
  Minus,
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  Mountain,
  Route,
  Activity,
  Compass,
  Gauge,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { FaultState, FlightPhase, FlightState, MissionReliabilityState } from '../types/simulation';
import { UAVPosition } from '../types/mission';
import { MISSION_WAYPOINTS } from '../simulation/simulationEngine';

interface MissionMapProps {
  uavPosition: UAVPosition;
  flightPhase: FlightPhase;
  engineOn: boolean;
  flight?: FlightState;
  reliability?: MissionReliabilityState;
  fault?: FaultState;
}

export const MissionMap: React.FC<MissionMapProps> = ({ 
  uavPosition, 
  flightPhase, 
  engineOn, 
  flight,
  reliability,
  fault
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const threeContainerRef = useRef<HTMLDivElement>(null);

  // View Mode: 'map' (Leaflet Geographic Map) | '3d' (3D Tactical UAV View)
  const [activeView, setActiveView] = useState<'map' | '3d'>('map');
  // Map styles: 'geographic' (OSM) | 'terrain' (OpenTopoMap) | 'satellite' (Esri)
  const [mapStyle, setMapStyle] = useState<'geographic' | 'terrain' | 'satellite'>('geographic');
  const [followUav, setFollowUav] = useState<boolean>(true);

  // Leaflet references
  const mapInstanceRef = useRef<L.Map | null>(null);
  const uavMarkerRef = useRef<L.Marker | null>(null);
  const plannedRouteLineRef = useRef<L.Polyline | null>(null);
  const actualTrackLineRef = useRef<L.Polyline | null>(null);
  const completedRouteLineRef = useRef<L.Polyline | null>(null);
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

  // Persistent ref to latest state for animation loops
  const stateRef = useRef({
    uavPosition,
    flightPhase,
    engineOn,
    flight,
    reliability,
    followUav
  });

  useEffect(() => {
    stateRef.current = {
      uavPosition,
      flightPhase,
      engineOn,
      flight,
      reliability,
      followUav
    };
  }, [uavPosition, flightPhase, engineOn, flight, reliability, followUav]);

  // Free Open Tile Layer Providers — Zero Paid API Keys Required
  const TILE_LAYERS = {
    geographic: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      maxZoom: 19
    },
    terrain: {
      url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
      maxZoom: 17
    },
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
      maxZoom: 18
    }
  };

  // --------------------------------------------------------------------------
  // 1. INITIALIZE LEAFLET GEOGRAPHIC MAP (Runs ONCE on mount)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return; // Prevent recreation

    const centerLat = 32.5550;
    const centerLon = 77.2600;

    // Create Leaflet Map instance
    const map = L.map(mapContainerRef.current, {
      center: [centerLat, centerLon],
      zoom: 12,
      zoomControl: false,
      attributionControl: false
    });
    mapInstanceRef.current = map;

    // Add Base Tile Layer
    const currentLayerCfg = TILE_LAYERS[mapStyle];
    const tileLayer = L.tileLayer(currentLayerCfg.url, {
      maxZoom: currentLayerCfg.maxZoom,
      subdomains: 'abc'
    }).addTo(map);
    baseTileLayerRef.current = tileLayer;

    // Create Planned Route Polyline (HOME -> WP1 -> WP2 -> WP3 -> WP4 -> HOME)
    const routeCoords: [number, number][] = MISSION_WAYPOINTS.map(wp => [wp.lat, wp.lon]);
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

    // Create Completed Route Polyline (Green Solid)
    const completedLine = L.polyline([[MISSION_WAYPOINTS[0].lat, MISSION_WAYPOINTS[0].lon]], {
      color: '#10B981',
      weight: 3.5,
      opacity: 0.9,
      lineCap: 'round'
    }).addTo(map);
    completedRouteLineRef.current = completedLine;

    // Create Actual Travelled Track Polyline (Cyan Solid)
    actualTrackPointsRef.current = [[uavPosition.lat, uavPosition.lon]];
    const actualLine = L.polyline(actualTrackPointsRef.current, {
      color: '#06B6D4',
      weight: 3.5,
      opacity: 0.95,
      lineCap: 'round'
    }).addTo(map);
    actualTrackLineRef.current = actualLine;

    // Add Geographic Waypoint Markers
    MISSION_WAYPOINTS.forEach((wp, idx) => {
      const isBase = wp.type === 'BASE';
      const label = isBase ? 'HOME' : `WP${idx}`;
      
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
              width: 24px;
              height: 24px;
              border-radius: 50%;
              background: ${isBase ? '#10B981' : '#F97316'};
              border: 2.5px solid #FFFFFF;
              box-shadow: 0 2px 6px rgba(0,0,0,0.5);
              display: flex;
              align-items: center;
              justify-content: center;
              color: #FFFFFF;
              font-family: ui-monospace, SFMono-Regular, monospace;
              font-size: 10px;
              font-weight: 800;
            ">
              ${isBase ? 'H' : idx}
            </div>
            <div style="
              background: rgba(15, 23, 42, 0.90);
              color: #F8FAFC;
              padding: 1.5px 6px;
              border-radius: 4px;
              font-family: system-ui, -apple-system, sans-serif;
              font-size: 9px;
              font-weight: 700;
              white-space: nowrap;
              margin-top: 3px;
              border: 1px solid rgba(255,255,255,0.2);
              box-shadow: 0 2px 4px rgba(0,0,0,0.4);
            ">
              ${label} &bull; ${wp.altitudeFt}ft
            </div>
          </div>
        `,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });

      const marker = L.marker([wp.lat, wp.lon], { icon: wpIcon }).addTo(map);
      marker.bindPopup(`
        <div style="font-family: system-ui, sans-serif; font-size: 11px; padding: 2px;">
          <strong style="color: #EA580C; font-size: 12px;">${wp.name}</strong><br/>
          <div style="margin-top: 4px; color: #475569;">
            <span>Target Altitude:</span> <b style="color: #0F172A;">${wp.altitudeFt} ft</b><br/>
            <span>Target Airspeed:</span> <b style="color: #0F172A;">${wp.targetAirspeedKmh} km/h</b><br/>
            <span>Coordinates:</span> <code style="color: #0284C7;">${wp.lat.toFixed(4)}°N, ${wp.lon.toFixed(4)}°E</code><br/>
          </div>
          <div style="color: #64748B; font-size: 9.5px; margin-top: 4px; border-top: 1px solid #E2E8F0; pt-1;">
            ${wp.description}
          </div>
        </div>
      `);
      waypointMarkersRef.current.push(marker);
    });

    // Create Rotax 912 Powered MALE UAV Marker
    const createUavIconHtml = (hdg: number) => `
      <div id="uav-map-icon-wrapper" style="
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        transform: translate(-50%, -50%);
        pointer-events: none;
      ">
        <div style="
          width: 40px;
          height: 40px;
          transform: rotate(${hdg}deg);
          transition: transform 0.12s linear;
          filter: drop-shadow(0 3px 8px rgba(0,0,0,0.65));
        ">
          <svg viewBox="0 0 100 100" style="width: 100%; height: 100%;">
            <!-- Main Wings -->
            <polygon points="50,16 6,66 18,74 50,48 82,74 94,66" fill="#F97316" stroke="#FFFFFF" stroke-width="2.5" />
            <!-- Fuselage -->
            <ellipse cx="50" cy="50" rx="9" ry="38" fill="#0F172A" stroke="#F97316" stroke-width="2.5" />
            <!-- Nose Cone / Pitot -->
            <polygon points="50,8 44,24 56,24" fill="#EA580C" stroke="#FFFFFF" stroke-width="1" />
            <!-- V-Tail Stabilizers -->
            <polygon points="50,74 34,92 66,92" fill="#334155" stroke="#FFFFFF" stroke-width="1.5" />
            <!-- Engine Center Hub / Avionics Beacon -->
            <circle cx="50" cy="46" r="4.5" fill="#06B6D4" stroke="#FFFFFF" stroke-width="1.5" />
          </svg>
        </div>
      </div>
    `;

    const uavIcon = L.divIcon({
      className: 'custom-uav-marker',
      html: createUavIconHtml(uavPosition.heading),
      iconSize: [48, 48],
      iconAnchor: [24, 24]
    });

    const uavMarker = L.marker([uavPosition.lat, uavPosition.lon], {
      icon: uavIcon,
      zIndexOffset: 1000
    }).addTo(map);
    uavMarkerRef.current = uavMarker;

    // Handle container resizing with ResizeObserver to prevent grey tiles
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // --------------------------------------------------------------------------
  // 2. SWITCH MAP TILE STYLE
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!mapInstanceRef.current || !baseTileLayerRef.current) return;
    const cfg = TILE_LAYERS[mapStyle];
    baseTileLayerRef.current.setUrl(cfg.url);
  }, [mapStyle]);

  // Invalidate size when switching active tabs
  useEffect(() => {
    if (activeView === 'map' && mapInstanceRef.current) {
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 50);
    }
  }, [activeView]);

  // --------------------------------------------------------------------------
  // 3. CONTINUOUS SMOOTH MARKER & TRACK UPDATE (Zero Shaking Physics Link)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!mapInstanceRef.current || !uavMarkerRef.current) return;

    const currentLat = uavPosition.lat;
    const currentLon = uavPosition.lon;
    const currentHdg = uavPosition.heading;

    // Update marker position directly without re-initializing Leaflet
    uavMarkerRef.current.setLatLng([currentLat, currentLon]);

    // Update heading rotation smoothly on SVG DOM element
    const iconWrapper = document.getElementById('uav-map-icon-wrapper');
    if (iconWrapper && iconWrapper.firstElementChild) {
      (iconWrapper.firstElementChild as HTMLElement).style.transform = `rotate(${currentHdg}deg)`;
    }

    // Append to actual flight track polyline if moved >= 15 meters
    const lastPos = lastTrackAppendPosRef.current;
    const dLatM = (currentLat - lastPos[0]) * 111320;
    const dLonM = (currentLon - lastPos[1]) * 111320 * Math.cos((currentLat * Math.PI) / 180);
    const distMovedM = Math.hypot(dLatM, dLonM);

    if (distMovedM >= 15 && engineOn) {
      lastTrackAppendPosRef.current = [currentLat, currentLon];
      actualTrackPointsRef.current.push([currentLat, currentLon]);
      if (actualTrackPointsRef.current.length > 1000) {
        actualTrackPointsRef.current.shift();
      }
      if (actualTrackLineRef.current) {
        actualTrackLineRef.current.setLatLngs(actualTrackPointsRef.current);
      }

      // Update completed route line
      if (completedRouteLineRef.current && uavPosition.currentWaypointIndex > 0) {
        const completedCoords = MISSION_WAYPOINTS.slice(0, uavPosition.currentWaypointIndex + 1).map(w => [w.lat, w.lon] as [number, number]);
        completedCoords.push([currentLat, currentLon]);
        completedRouteLineRef.current.setLatLngs(completedCoords);
      }
    }

    // Reset track if at home airfield and flight phase is STANDBY
    if (!engineOn && uavPosition.airspeed === 0 && Math.abs(currentLat - 32.5450) < 0.0005 && Math.abs(currentLon - 77.2150) < 0.0005) {
      if (actualTrackPointsRef.current.length > 2) {
        actualTrackPointsRef.current = [[currentLat, currentLon]];
        lastTrackAppendPosRef.current = [currentLat, currentLon];
        if (actualTrackLineRef.current) {
          actualTrackLineRef.current.setLatLngs(actualTrackPointsRef.current);
        }
        if (completedRouteLineRef.current) {
          completedRouteLineRef.current.setLatLngs([[MISSION_WAYPOINTS[0].lat, MISSION_WAYPOINTS[0].lon]]);
        }
      }
    }

    // Smooth Deadband Camera Tracking (Only pans when UAV drifts > 450m from center)
    if (followUav && mapInstanceRef.current) {
      const map = mapInstanceRef.current;
      const center = map.getCenter();
      const centerDistM = Math.hypot(
        (currentLat - center.lat) * 111320,
        (currentLon - center.lng) * 111320 * Math.cos((center.lat * Math.PI) / 180)
      );
      
      // Gentle smooth pan without camera shaking
      if (centerDistM > 450) {
        map.panTo([currentLat, currentLon], { animate: true, duration: 0.9 });
      }
    }
  }, [uavPosition.lat, uavPosition.lon, uavPosition.heading, uavPosition.currentWaypointIndex, engineOn, followUav]);

  // --------------------------------------------------------------------------
  // 4. THREE.JS 3D TACTICAL VIEW INITIALIZATION (Separate Clean 3D Mode)
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

    // Terrain elevation grid
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

        // Bank angle
        const bank = (stateRef.current.flight?.bankAngleDeg || 0) * (Math.PI / 180);
        uavGroupRef.current.rotation.z = bank;

        // Smooth chase camera
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

  const handleZoomIn = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut();
    }
  };

  const currentWp = MISSION_WAYPOINTS[uavPosition.currentWaypointIndex] || MISSION_WAYPOINTS[0];
  const nextWp = MISSION_WAYPOINTS[(uavPosition.currentWaypointIndex + 1) % MISSION_WAYPOINTS.length];
  const verticalSpeedFpm = flight?.verticalSpeed ?? 0;
  const verticalSpeedMs = (verticalSpeedFpm * 0.00508).toFixed(1);
  const groundTrackDeg = flight?.groundTrack ?? uavPosition.heading;
  const groundSpeedKmh = flight?.groundSpeed ?? uavPosition.airspeed;

  // Reliability & Terrain data
  const relScore = reliability?.reliabilityScore ?? (engineOn ? 92 : 98);
  const riskLevel = reliability?.riskLevel ?? 'LOW';
  const decision = reliability?.decision ?? 'GO';
  const engineSOH = reliability?.engineSOH ?? 94;
  const rulHours = reliability?.rulHours ?? 236;
  const faultRisk = reliability?.faultRiskPercent ?? 3;
  const missionMargin = reliability?.missionMarginHours ?? 4.2;
  const anomalyScore = reliability?.anomalyScore ?? 0.08;
  const terrainElevFt = reliability?.terrainElevationFt ?? 4200;
  const aglFt = reliability?.aglAltitudeFt ?? (engineOn ? Math.max(0, 3850 + uavPosition.altitude - terrainElevFt) : 0);
  const routeDevKm = reliability?.routeDeviationKm ?? 0.2;
  const distRemKm = reliability?.distanceRemainingKm ?? 18.2;
  const estTimeRem = reliability?.timeRemainingFormatted ?? '07:35';
  const missionTime = reliability?.missionTimeFormatted ?? '04:12';

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-3.5 shadow-sm flex flex-col justify-between h-full select-none overflow-hidden space-y-2">
      
      {/* 1. Header Controls Bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-orange-50 border border-orange-200 flex items-center justify-center text-[#F97316]">
            <Navigation className="w-3.5 h-3.5" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-[#1F2937] tracking-tight uppercase flex items-center gap-2">
              <span>MISSION VIEW &mdash; GEOGRAPHIC & TERRAIN MAP</span>
              <span className="text-[8px] font-mono font-bold bg-orange-100 text-orange-800 px-1.5 py-0.2 rounded border border-orange-300">
                VIRTUAL MALE UAV
              </span>
            </h2>
            <div className="text-[10px] text-[#6B7280]">
              Reduced-Order Rotax 912 ULS Flight Dynamics &bull; Digital Twin Link
            </div>
          </div>
        </div>

        {/* View Mode & Map Controls */}
        <div className="flex items-center gap-1.5 text-xs flex-wrap">
          {/* Mode Switcher: Geographic vs 3D */}
          <div className="flex items-center bg-[#F3F4F6] p-0.5 rounded-lg border border-[#E5E7EB] text-[10px] font-bold">
            <button
              onClick={() => setActiveView('map')}
              className={`px-2 py-1 rounded-md transition-all ${
                activeView === 'map'
                  ? 'bg-white text-[#F97316] shadow-xs'
                  : 'text-[#6B7280] hover:text-[#1F2937]'
              }`}
            >
              2D Map
            </button>
            <button
              onClick={() => setActiveView('3d')}
              className={`px-2 py-1 rounded-md transition-all ${
                activeView === '3d'
                  ? 'bg-white text-[#F97316] shadow-xs'
                  : 'text-[#6B7280] hover:text-[#1F2937]'
              }`}
            >
              3D Tactical
            </button>
          </div>

          {/* Map Layer Style (When in Map View) */}
          {activeView === 'map' && (
            <div className="flex items-center bg-[#F3F4F6] p-0.5 rounded-lg border border-[#E5E7EB] text-[10px] font-semibold">
              <button
                onClick={() => setMapStyle('geographic')}
                className={`px-2 py-1 rounded-md transition-all ${
                  mapStyle === 'geographic' ? 'bg-[#F97316] text-white font-bold' : 'text-[#6B7280] hover:text-[#1F2937]'
                }`}
                title="Geographic Map (OpenStreetMap: Roads, Towns, Boundaries)"
              >
                Geographic
              </button>
              <button
                onClick={() => setMapStyle('terrain')}
                className={`px-2 py-1 rounded-md transition-all ${
                  mapStyle === 'terrain' ? 'bg-[#F97316] text-white font-bold' : 'text-[#6B7280] hover:text-[#1F2937]'
                }`}
                title="Terrain Topographic Elevation Contours (OpenTopoMap)"
              >
                Terrain
              </button>
              <button
                onClick={() => setMapStyle('satellite')}
                className={`px-2 py-1 rounded-md transition-all ${
                  mapStyle === 'satellite' ? 'bg-[#1E293B] text-white font-bold' : 'text-[#6B7280] hover:text-[#1F2937]'
                }`}
                title="Satellite Aerial Imagery (Free Esri World Imagery)"
              >
                Satellite
              </button>
            </div>
          )}

          {/* Follow UAV Toggle */}
          <button
            onClick={() => setFollowUav(!followUav)}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
              followUav
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'
            }`}
            title="Auto-pan map smoothly with UAV"
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
      <div className="relative w-full h-[360px] rounded-xl overflow-hidden border border-[#E5E7EB] bg-[#E2E8F0]">
        
        {/* Leaflet 2D Map Container */}
        <div
          ref={mapContainerRef}
          className={`w-full h-full ${activeView === 'map' ? 'block' : 'hidden'}`}
          style={{ background: '#E2E8F0' }}
        />

        {/* Three.js 3D Container */}
        {activeView === '3d' && (
          <div
            ref={threeContainerRef}
            className="w-full h-full block bg-[#0A111E]"
          />
        )}

        {/* Zoom In / Out Overlay Controls (For Leaflet Map) */}
        {activeView === 'map' && (
          <div className="absolute right-3 top-28 flex flex-col gap-1 z-[500]">
            <button
              onClick={handleZoomIn}
              className="w-7 h-7 rounded-lg bg-white/95 backdrop-blur-xs border border-gray-300 shadow-md flex items-center justify-center text-gray-700 hover:bg-gray-100 hover:text-black transition-all"
              title="Zoom In"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={handleZoomOut}
              className="w-7 h-7 rounded-lg bg-white/95 backdrop-blur-xs border border-gray-300 shadow-md flex items-center justify-center text-gray-700 hover:bg-gray-100 hover:text-black transition-all"
              title="Zoom Out"
            >
              <Minus className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TOP-LEFT: FLIGHT DYNAMICS & TERRAIN ELEVATION HUD             */}
        {/* ------------------------------------------------------------- */}
        <div className="absolute top-2 left-2 bg-slate-950/85 backdrop-blur-md border border-slate-700/60 rounded-lg p-2.5 text-white font-mono text-[9.5px] shadow-lg pointer-events-none z-[500] space-y-1 w-[190px]">
          <div className="text-[10px] font-bold text-[#F97316] uppercase tracking-wider flex items-center justify-between border-b border-slate-800 pb-1">
            <span>VIRTUAL MALE UAV</span>
            <span className="text-[8.5px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              {flightPhase}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 pt-0.5">
            <div className="text-slate-400">POSITION:</div>
            <div className="text-right text-cyan-300 font-bold truncate">
              {uavPosition.lat.toFixed(4)}°N, {uavPosition.lon.toFixed(4)}°E
            </div>

            <div className="text-slate-400">ALTITUDE (MSL):</div>
            <div className="text-right text-orange-400 font-bold">
              {engineOn ? (3850 + uavPosition.altitude).toLocaleString() : terrainElevFt} ft
            </div>

            <div className="text-slate-400">TERRAIN ELEV:</div>
            <div className="text-right text-amber-300 font-bold">
              {terrainElevFt.toLocaleString()} ft
            </div>

            <div className="text-slate-400">AGL HEIGHT:</div>
            <div className="text-right text-emerald-400 font-bold">
              {aglFt.toLocaleString()} ft
            </div>

            <div className="text-slate-400">AIRSPEED:</div>
            <div className="text-right text-emerald-300 font-bold">
              {engineOn ? uavPosition.airspeed : 0} km/h
            </div>

            <div className="text-slate-400">GROUND SPEED:</div>
            <div className="text-right text-cyan-300 font-bold">
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
          <div className="text-[7.5px] text-slate-500 border-t border-slate-800/80 pt-0.5 text-right font-sans italic">
            *Simulated terrain elevation
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* TOP-RIGHT: PROMINENT MISSION RELIABILITY & DECISION (GO/CAUTION/NO-GO) */}
        {/* ------------------------------------------------------------- */}
        <div className="absolute top-2 right-2 bg-slate-950/90 backdrop-blur-md border border-slate-700/70 rounded-lg p-2.5 text-white font-mono shadow-xl pointer-events-none z-[500] w-[215px] space-y-1.5">
          
          {/* Header & Big Decision Badge */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <div>
              <div className="text-[9px] text-slate-400 uppercase font-semibold">MISSION DECISION</div>
              <div className="text-[12px] font-black tracking-wide text-white">
                RELIABILITY: <span className="text-[#F97316]">{relScore}%</span>
              </div>
            </div>

            {/* Decision Pill */}
            <div className={`px-2.5 py-0.5 rounded-md font-extrabold text-[11px] shadow-sm flex items-center gap-1 ${
              decision === 'GO'
                ? 'bg-emerald-500 text-white shadow-emerald-500/30'
                : decision === 'CAUTION'
                ? 'bg-amber-500 text-slate-950 animate-pulse'
                : 'bg-red-600 text-white animate-pulse'
            }`}>
              {decision === 'GO' && <ShieldCheck className="w-3.5 h-3.5" />}
              {decision === 'CAUTION' && <AlertTriangle className="w-3.5 h-3.5" />}
              {decision === 'NO-GO' && <AlertOctagon className="w-3.5 h-3.5" />}
              <span>{decision}</span>
            </div>
          </div>

          {/* Sub-Metrics Breakdown */}
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9px]">
            <div className="text-slate-400">ENGINE SOH:</div>
            <div className="text-right text-emerald-400 font-bold">{engineSOH}%</div>

            <div className="text-slate-400">RUL (HOURS):</div>
            <div className="text-right text-cyan-300 font-bold">{rulHours} h</div>

            <div className="text-slate-400">FAULT RISK:</div>
            <div className={`text-right font-bold ${faultRisk > 30 ? 'text-amber-400' : 'text-slate-200'}`}>
              {faultRisk}%
            </div>

            <div className="text-slate-400">MISSION MARGIN:</div>
            <div className="text-right text-white font-bold">{missionMargin} h</div>

            <div className="text-slate-400">ANOMALY SCORE:</div>
            <div className="text-right text-purple-300 font-bold">{anomalyScore}</div>

            <div className="text-slate-400">MISSION RISK:</div>
            <div className={`text-right font-bold ${
              riskLevel === 'LOW' ? 'text-emerald-400' : riskLevel === 'MEDIUM' ? 'text-amber-400' : 'text-red-400'
            }`}>
              {riskLevel}
            </div>
          </div>

          <div className="text-[8px] text-slate-400 bg-slate-900/90 border border-slate-800 p-1 rounded font-sans leading-tight">
            {reliability?.decisionReason || 'Mission can safely continue under nominal parameters.'}
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* BOTTOM-RIGHT: MISSION ROUTE STATUS HUD                        */}
        {/* ------------------------------------------------------------- */}
        <div className="absolute bottom-2 right-2 bg-slate-950/85 backdrop-blur-md border border-slate-700/60 rounded-lg p-2 text-white font-mono text-[9px] shadow-lg pointer-events-none z-[500] space-y-0.5 w-[190px]">
          <div className="text-[9.5px] font-bold text-cyan-400 uppercase tracking-wider border-b border-slate-800 pb-0.5 flex items-center justify-between">
            <span>MISSION STATUS</span>
            <span className="text-orange-400">{uavPosition.missionProgressPercent}%</span>
          </div>

          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 pt-0.5 text-[8.5px]">
            <div className="text-slate-400">CURRENT WP:</div>
            <div className="text-right text-amber-300 font-bold truncate">
              {currentWp.name.split('—')[0]}
            </div>

            <div className="text-slate-400">NEXT WP:</div>
            <div className="text-right text-cyan-300 font-bold truncate">
              {nextWp.name.split('—')[0]}
            </div>

            <div className="text-slate-400">DIST REMAINING:</div>
            <div className="text-right text-white font-bold">{distRemKm} km</div>

            <div className="text-slate-400">EST. TIME REM:</div>
            <div className="text-right text-emerald-400 font-bold">{estTimeRem}</div>

            <div className="text-slate-400">ROUTE DEVIATION:</div>
            <div className={`text-right font-bold ${routeDevKm > 0.8 ? 'text-red-400 animate-pulse' : 'text-slate-200'}`}>
              {routeDevKm} km
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* BOTTOM-LEFT: LEGEND & SIMULATION DISCLAIMER                   */}
        {/* ------------------------------------------------------------- */}
        <div className="absolute bottom-2 left-2 bg-slate-950/85 backdrop-blur-xs border border-slate-800 px-2.5 py-1 rounded-md text-[8.5px] font-mono text-slate-300 flex items-center gap-3 z-[500] flex-wrap">
          <div className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-[#F97316] inline-block border-t border-dashed border-[#F97316]" />
            <span>Planned</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-1 bg-[#06B6D4] inline-block rounded-full" />
            <span>Actual Track</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-1 bg-[#10B981] inline-block rounded-full" />
            <span>Completed</span>
          </div>
          <div className="text-[8px] text-slate-400 border-l border-slate-700 pl-2">
            SIMULATED UAV FLIGHT &bull; PHYSICS-BASED MODEL
          </div>
        </div>

        {/* Attribution watermark */}
        {activeView === 'map' && (
          <div className="absolute bottom-1 right-2 bg-white/70 backdrop-blur-xs px-1.5 py-0.2 rounded text-[8px] text-gray-700 z-[500] pointer-events-auto hidden sm:block">
            &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline hover:text-black">OpenStreetMap</a> contributors
          </div>
        )}
      </div>
    </div>
  );
};
