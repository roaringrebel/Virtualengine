import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { 
  MapPin, 
  Plus, 
  Minus, 
  Plane, 
  Eye, 
  Layers, 
  Crosshair, 
  Video, 
  RotateCcw, 
  Radio, 
  Navigation,
  Compass
} from 'lucide-react';
import { FlightPhase } from '../types/simulation';
import { UAVPosition } from '../types/mission';
import { MISSION_WAYPOINTS } from '../simulation/simulationEngine';

interface MissionMapProps {
  uavPosition: UAVPosition;
  flightPhase: FlightPhase;
  engineOn: boolean;
}

export const MissionMap: React.FC<MissionMapProps> = ({ uavPosition, flightPhase, engineOn }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Camera & View modes
  const [viewMode, setViewMode] = useState<'chase' | 'flir' | 'terrain' | 'top'>('chase');
  const [mapStyle, setMapStyle] = useState<'satellite' | 'flir' | 'wireframe'>('satellite');
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);

  // Three.js object references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const uavGroupRef = useRef<THREE.Group | null>(null);
  const propellerRef = useRef<THREE.Group | null>(null);
  const propBlurDiscRef = useRef<THREE.Mesh | null>(null);
  const groundMeshRef = useRef<THREE.Mesh | null>(null);
  const shadowMeshRef = useRef<THREE.Mesh | null>(null);
  const historyPathLineRef = useRef<THREE.Line | null>(null);
  const forwardVectorLineRef = useRef<THREE.Line | null>(null);
  const waypointCorridorLineRef = useRef<THREE.Line | null>(null);
  const satelliteTextureRef = useRef<THREE.Texture | null>(null);

  // Interactive camera orbit state
  const isMouseDownRef = useRef(false);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const orbitAngleRef = useRef({ theta: 0.05, phi: 0.35, distance: 58 });
  const zoomFactorRef = useRef(1.0);

  // Flight history breadcrumbs buffer
  const historyPointsRef = useRef<THREE.Vector3[]>([]);
  const lastHeadingRef = useRef<number>(uavPosition.heading);
  const currentBankRef = useRef<number>(0);
  const currentPitchRef = useRef<number>(0);

  // Coordinate mapper: Converts GPS (Lat, Lon, Alt) to 3D Space Coordinates (X, Y, Z)
  const gpsTo3D = (lat: number, lon: number, altFt: number): THREE.Vector3 => {
    const centerLat = 32.5450;
    const centerLon = 77.2150;
    const x = (lon - centerLon) * 11500;
    const z = -(lat - centerLat) * 11500;
    const y = Math.max(3.0, (altFt / 8000) * 48 + 6.0);
    return new THREE.Vector3(x, y, z);
  };

  // Synchronize zoom factor ref
  useEffect(() => {
    zoomFactorRef.current = zoomLevel;
  }, [zoomLevel]);

  // Handle Zoom In / Out / Reset
  const handleZoomIn = () => {
    setZoomLevel(prev => Math.max(0.4, +(prev - 0.15).toFixed(2)));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.min(2.4, +(prev + 0.15).toFixed(2)));
  };

  const handleResetCamera = () => {
    orbitAngleRef.current = { theta: 0.05, phi: 0.35, distance: 58 };
    setZoomLevel(1.0);
    setViewMode('chase');
  };

  // =========================================================================
  // Initialize 3D Photorealistic Satellite Scene with Rotax 912 MALE UAV Drone
  // =========================================================================
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth || 750;
    const height = container.clientHeight || 350;

    // 1. Scene & Clean Atmospheric Daylight Fog
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0e1726);
    scene.fog = new THREE.FogExp2(0x1a283e, 0.0012);
    sceneRef.current = scene;

    // 2. Camera Setup
    const camera = new THREE.PerspectiveCamera(46, width / height, 1, 6000);
    camera.position.set(0, 30, 65);
    cameraRef.current = camera;

    // 3. WebGL Renderer with High Dynamic Range & Anisotropic Filtering
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Photorealistic Atmospheric Natural Daylight
    const ambientLight = new THREE.AmbientLight(0xdce7f5, 1.4);
    scene.add(ambientLight);

    // Main Sun Directional Light casting realistic shadows
    const sunLight = new THREE.DirectionalLight(0xfffaed, 2.8);
    sunLight.position.set(220, 450, 180);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 1800;
    sunLight.shadow.camera.left = -400;
    sunLight.shadow.camera.right = 400;
    sunLight.shadow.camera.top = 400;
    sunLight.shadow.camera.bottom = -400;
    sunLight.shadow.bias = -0.0002;
    scene.add(sunLight);

    // Sky Fill Light
    const skyFill = new THREE.DirectionalLight(0x7dd3fc, 0.9);
    skyFill.position.set(-200, 200, -200);
    scene.add(skyFill);

    // =========================================================================
    // 5. HIGH-RESOLUTION AERIAL SATELLITE TERRAIN GROUND PLANE
    // =========================================================================
    const textureLoader = new THREE.TextureLoader();
    
    // Load the uploaded satellite image texture
    const satTexture = textureLoader.load(
      '/terrain_satellite.jpg',
      (tex) => {
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.generateMipmaps = true;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        if (renderer.capabilities.getMaxAnisotropy) {
          tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        }
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
      }
    );
    satelliteTextureRef.current = satTexture;

    // Create 3D Ground Terrain with elevation contours
    const groundGeo = new THREE.PlaneGeometry(1200, 1200, 128, 128);
    groundGeo.rotateX(-Math.PI / 2);

    const posAttr = groundGeo.attributes.position;
    const v3 = new THREE.Vector3();
    for (let i = 0; i < posAttr.count; i++) {
      v3.fromBufferAttribute(posAttr, i);
      const distFromCenter = Math.sqrt(v3.x * v3.x + v3.z * v3.z);
      const riverDepression = Math.sin(v3.x * 0.008 + 0.5) * Math.cos(v3.z * 0.006) * 8;
      const hills = Math.sin(v3.x * 0.015) * Math.cos(v3.z * 0.012) * 12;
      const falloff = Math.max(0, 1 - (distFromCenter / 700));
      posAttr.setY(i, (riverDepression + hills) * falloff);
    }
    groundGeo.computeVertexNormals();

    const groundMat = new THREE.MeshStandardMaterial({
      map: satTexture,
      roughness: 0.85,
      metalness: 0.1,
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.position.y = 0;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);
    groundMeshRef.current = groundMesh;

    // Soft UAV Ground Shadow
    const shadowGeo = new THREE.PlaneGeometry(28, 18);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x050c17,
      transparent: true,
      opacity: 0.38,
      depthWrite: false
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.position.y = 1.2;
    scene.add(shadowMesh);
    shadowMeshRef.current = shadowMesh;

    // =========================================================================
    // 6. TACTICAL WAYPOINT MISSION CORRIDOR (Actual Waypoints)
    // =========================================================================
    const wp3DPoints = MISSION_WAYPOINTS.map(wp => gpsTo3D(wp.lat, wp.lon, wp.altitudeFt));
    const wpGeo = new THREE.BufferGeometry().setFromPoints(wp3DPoints);
    const wpMat = new THREE.LineDashedMaterial({
      color: 0x38bdf8,
      dashSize: 8,
      gapSize: 4,
      linewidth: 2,
      transparent: true,
      opacity: 0.6
    });
    const wpLine = new THREE.Line(wpGeo, wpMat);
    wpLine.computeLineDistances();
    scene.add(wpLine);
    waypointCorridorLineRef.current = wpLine;

    // Actual Traveled Flight History Line (Dynamic Ribbon)
    const historyGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)]);
    const historyMat = new THREE.LineBasicMaterial({
      color: 0xf97316,
      linewidth: 3,
      transparent: true,
      opacity: 0.9
    });
    const historyLine = new THREE.Line(historyGeo, historyMat);
    scene.add(historyLine);
    historyPathLineRef.current = historyLine;

    // Projected Forward Heading Vector Line
    const forwardGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -40)]);
    const forwardMat = new THREE.LineDashedMaterial({
      color: 0x22c55e,
      dashSize: 4,
      gapSize: 2,
      linewidth: 2
    });
    const forwardLine = new THREE.Line(forwardGeo, forwardMat);
    scene.add(forwardLine);
    forwardVectorLineRef.current = forwardLine;

    // =========================================================================
    // 7. REALISTIC ROTAX 912 MALE UAV DRONE 3D MODEL
    // =========================================================================
    const uavGroup = new THREE.Group();

    // Material definitions
    const militaryGrayMat = new THREE.MeshStandardMaterial({
      color: 0xecf0f5,
      roughness: 0.28,
      metalness: 0.72,
    });
    const darkCompositeMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.35,
      metalness: 0.85,
    });
    const orangeAccentsMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      roughness: 0.2,
      metalness: 0.7,
    });

    // A. Main Sleek Drone Aerodynamic Fuselage
    const fuseGeo = new THREE.CylinderGeometry(1.3, 1.7, 19, 18);
    fuseGeo.rotateX(Math.PI / 2);
    const fuselage = new THREE.Mesh(fuseGeo, militaryGrayMat);
    fuselage.castShadow = true;
    uavGroup.add(fuselage);

    // B. Bulbous SATCOM Satellite Communications Dome on Dorsal Forebody
    const satcomGeo = new THREE.SphereGeometry(1.7, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    satcomGeo.rotateX(-Math.PI / 2);
    const satcomDome = new THREE.Mesh(satcomGeo, militaryGrayMat);
    satcomDome.position.set(0, 1.0, 4.8);
    satcomDome.scale.set(0.9, 0.75, 1.9);
    satcomDome.castShadow = true;
    uavGroup.add(satcomDome);

    // C. Streamlined Nose Radome Cone
    const noseGeo = new THREE.ConeGeometry(1.3, 3.8, 16);
    noseGeo.rotateX(Math.PI / 2);
    const nose = new THREE.Mesh(noseGeo, militaryGrayMat);
    nose.position.set(0, 0, 11.4);
    nose.castShadow = true;
    uavGroup.add(nose);

    // D. Ventral Electro-Optical / Infrared (EO/IR) FLIR Camera Turret (Under Nose)
    const turretBaseGeo = new THREE.CylinderGeometry(0.85, 0.85, 0.5, 12);
    const turretBase = new THREE.Mesh(turretBaseGeo, darkCompositeMat);
    turretBase.position.set(0, -1.4, 8.2);
    uavGroup.add(turretBase);

    const turretBallGeo = new THREE.SphereGeometry(0.8, 16, 16);
    const turretBall = new THREE.Mesh(turretBallGeo, darkCompositeMat);
    turretBall.position.set(0, -1.9, 8.2);
    turretBall.castShadow = true;
    uavGroup.add(turretBall);

    // Optical Lens Window (Glossy Blue-Reflective Glass)
    const lensGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.25, 12);
    lensGeo.rotateX(Math.PI / 2);
    const lensMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.08, metalness: 0.95 });
    const lens = new THREE.Mesh(lensGeo, lensMat);
    lens.position.set(0, -1.9, 8.95);
    uavGroup.add(lens);

    // E. Slender High-Aspect-Ratio MALE Carbon Fiber Wings (Span ~58 units)
    const wingGeo = new THREE.BoxGeometry(58, 0.38, 3.6);
    const wings = new THREE.Mesh(wingGeo, militaryGrayMat);
    wings.position.set(0, 0.5, 0.6);
    wings.castShadow = true;
    uavGroup.add(wings);

    // Wing High-Visibility Orange Safety Tips
    const tipLGeo = new THREE.BoxGeometry(4.0, 0.39, 3.62);
    const tipL = new THREE.Mesh(tipLGeo, orangeAccentsMat);
    tipL.position.set(-27.0, 0.5, 0.6);
    const tipR = new THREE.Mesh(tipLGeo, orangeAccentsMat);
    tipR.position.set(27.0, 0.5, 0.6);
    uavGroup.add(tipL);
    uavGroup.add(tipR);

    // Upturned Aerodynamic Winglets
    const wingletGeo = new THREE.BoxGeometry(0.28, 2.8, 2.4);
    const wingletL = new THREE.Mesh(wingletGeo, orangeAccentsMat);
    wingletL.position.set(-29.0, 1.5, 0.6);
    wingletL.rotation.z = -0.22;
    const wingletR = new THREE.Mesh(wingletGeo, orangeAccentsMat);
    wingletR.position.set(29.0, 1.5, 0.6);
    wingletR.rotation.z = 0.22;
    uavGroup.add(wingletL);
    uavGroup.add(wingletR);

    // Wingtip Pitot Tubes
    const pitotGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.0, 8);
    pitotGeo.rotateX(Math.PI / 2);
    const pitotL = new THREE.Mesh(pitotGeo, darkCompositeMat);
    pitotL.position.set(-29.0, 0.5, 2.4);
    const pitotR = new THREE.Mesh(pitotGeo, darkCompositeMat);
    pitotR.position.set(29.0, 0.5, 2.4);
    uavGroup.add(pitotL);
    uavGroup.add(pitotR);

    // Underwing Sensor / Hardpoint Pylons
    const pylonGeo = new THREE.BoxGeometry(0.4, 0.9, 2.8);
    const pylonL = new THREE.Mesh(pylonGeo, darkCompositeMat);
    pylonL.position.set(-14.0, -0.1, 0.6);
    const pylonR = new THREE.Mesh(pylonGeo, darkCompositeMat);
    pylonR.position.set(14.0, -0.1, 0.6);
    uavGroup.add(pylonL);
    uavGroup.add(pylonR);

    // F. Twin Carbon Fiber Tail Booms
    const boomGeo = new THREE.CylinderGeometry(0.32, 0.32, 17, 8);
    boomGeo.rotateX(Math.PI / 2);
    const boomL = new THREE.Mesh(boomGeo, militaryGrayMat);
    boomL.position.set(-6.6, 0.4, -8.0);
    const boomR = new THREE.Mesh(boomGeo, militaryGrayMat);
    boomR.position.set(6.6, 0.4, -8.0);
    uavGroup.add(boomL);
    uavGroup.add(boomR);

    // G. Inverted V-Tail Stabilizers
    const vTailGeo = new THREE.BoxGeometry(11.5, 0.28, 2.8);
    const vTailL = new THREE.Mesh(vTailGeo, militaryGrayMat);
    vTailL.position.set(-3.4, -1.9, -16.5);
    vTailL.rotation.z = 0.58;
    const vTailR = new THREE.Mesh(vTailGeo, militaryGrayMat);
    vTailR.position.set(3.4, -1.9, -16.5);
    vTailR.rotation.z = -0.58;
    uavGroup.add(vTailL);
    uavGroup.add(vTailR);

    // V-Tail Orange Rudder Trim Tips
    const vTipGeo = new THREE.BoxGeometry(2.8, 0.29, 2.82);
    const vTipL = new THREE.Mesh(vTipGeo, orangeAccentsMat);
    vTipL.position.set(-6.8, -3.4, -16.5);
    vTipL.rotation.z = 0.58;
    const vTipR = new THREE.Mesh(vTipGeo, orangeAccentsMat);
    vTipR.position.set(6.8, -3.4, -16.5);
    vTipR.rotation.z = -0.58;
    uavGroup.add(vTipL);
    uavGroup.add(vTipR);

    // H. ROTAX 912 ULS Piston Engine Nacelle (Mid-Rear Fuselage)
    const engineCowlGeo = new THREE.CylinderGeometry(1.35, 1.5, 4.6, 16);
    engineCowlGeo.rotateX(Math.PI / 2);
    const engineCowl = new THREE.Mesh(engineCowlGeo, darkCompositeMat);
    engineCowl.position.set(0, 0.55, -9.0);
    engineCowl.castShadow = true;
    uavGroup.add(engineCowl);

    // Rotax Engine Air Cooling Scoop on Top
    const airScoopGeo = new THREE.BoxGeometry(0.95, 0.65, 2.4);
    const airScoop = new THREE.Mesh(airScoopGeo, darkCompositeMat);
    airScoop.position.set(0, 2.05, -8.6);
    uavGroup.add(airScoop);

    // Dual Stainless Exhaust Stub Pipes
    const exhaustGeo = new THREE.CylinderGeometry(0.14, 0.14, 1.0, 8);
    const exhaustMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.2, metalness: 0.95 });
    const exhaustL = new THREE.Mesh(exhaustGeo, exhaustMat);
    exhaustL.position.set(-1.15, -0.65, -10.4);
    exhaustL.rotation.x = 0.45;
    const exhaustR = new THREE.Mesh(exhaustGeo, exhaustMat);
    exhaustR.position.set(1.15, -0.65, -10.4);
    exhaustR.rotation.x = 0.45;
    uavGroup.add(exhaustL);
    uavGroup.add(exhaustR);

    // I. High-Performance 3-Blade Rear Pusher Propeller
    const propGroup = new THREE.Group();
    propGroup.position.set(0, 0.55, -11.5);

    // Propeller Spinner Center Hub
    const spinnerGeo = new THREE.ConeGeometry(0.6, 1.2, 12);
    spinnerGeo.rotateX(-Math.PI / 2);
    const spinnerMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2 });
    const spinner = new THREE.Mesh(spinnerGeo, spinnerMat);
    propGroup.add(spinner);

    // 3 Aerodynamic Blades with High-Visibility Orange Tips
    const bladeGeo = new THREE.BoxGeometry(0.35, 4.4, 0.08);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3 });
    const pTipGeo = new THREE.BoxGeometry(0.36, 0.85, 0.09);

    for (let b = 0; b < 3; b++) {
      const bladeContainer = new THREE.Group();
      bladeContainer.rotation.z = (b * Math.PI * 2) / 3;

      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      blade.position.y = 2.2;
      bladeContainer.add(blade);

      const propTip = new THREE.Mesh(pTipGeo, orangeAccentsMat);
      propTip.position.y = 4.0;
      bladeContainer.add(propTip);

      propGroup.add(bladeContainer);
    }
    uavGroup.add(propGroup);
    propellerRef.current = propGroup;

    // Translucent High-Speed Propeller Motion Blur Disc
    const blurGeo = new THREE.RingGeometry(0.8, 4.5, 32);
    const blurMat = new THREE.MeshBasicMaterial({
      color: 0xe2e8f0,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const blurDisc = new THREE.Mesh(blurGeo, blurMat);
    blurDisc.position.set(0, 0.55, -11.6);
    uavGroup.add(blurDisc);
    propBlurDiscRef.current = blurDisc;

    // J. Active Navigation & Strobe Lights
    const navRed = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 8), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
    navRed.position.set(-29.2, 2.6, 0.6);
    uavGroup.add(navRed);

    const navGreen = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 8), new THREE.MeshBasicMaterial({ color: 0x10b981 }));
    navGreen.position.set(29.2, 2.6, 0.6);
    uavGroup.add(navGreen);

    const tailStrobe = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    tailStrobe.position.set(0, -3.6, -16.8);
    uavGroup.add(tailStrobe);

    // Blade Antennas
    const antGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.8, 6);
    const ant = new THREE.Mesh(antGeo, darkCompositeMat);
    ant.position.set(0, 2.2, 1.4);
    uavGroup.add(ant);

    scene.add(uavGroup);
    uavGroupRef.current = uavGroup;

    // =========================================================================
    // Mouse Drag Controls for 3D Camera Orbit & Inspection
    // =========================================================================
    const onMouseDown = (e: MouseEvent) => {
      isMouseDownRef.current = true;
      mousePosRef.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isMouseDownRef.current) return;
      const dx = e.clientX - mousePosRef.current.x;
      const dy = e.clientY - mousePosRef.current.y;
      
      orbitAngleRef.current.theta -= dx * 0.0055;
      orbitAngleRef.current.phi = Math.max(0.06, Math.min(1.35, orbitAngleRef.current.phi + dy * 0.0055));
      mousePosRef.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isMouseDownRef.current = false;
    };

    // Mouse Wheel Zoom
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomDelta = e.deltaY * 0.0012;
      setZoomLevel(prev => Math.max(0.4, Math.min(2.4, +(prev + zoomDelta).toFixed(2))));
    };

    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // Handle Window Resize
    const onResize = () => {
      if (!containerRef.current || !renderer || !camera) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      container.removeEventListener('mousedown', onMouseDown);
      container.removeEventListener('wheel', onWheel);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    };
  }, []);

  // Update Terrain Styles (Satellite vs FLIR Thermal vs Wireframe)
  useEffect(() => {
    if (!groundMeshRef.current || !sceneRef.current) return;
    const groundMat = groundMeshRef.current.material as THREE.MeshStandardMaterial;

    if (mapStyle === 'wireframe') {
      groundMat.wireframe = true;
      groundMat.map = null;
      groundMat.color.setHex(0x0ea5e9);
      sceneRef.current.background = new THREE.Color(0x040d1a);
      if (sceneRef.current.fog) sceneRef.current.fog.color.setHex(0x040d1a);
    } else if (mapStyle === 'flir') {
      groundMat.wireframe = false;
      groundMat.map = satelliteTextureRef.current;
      groundMat.color.setHex(0x34d399); // FLIR Night Thermal Green tint
      sceneRef.current.background = new THREE.Color(0x022c22);
      if (sceneRef.current.fog) sceneRef.current.fog.color.setHex(0x022c22);
    } else {
      // Photorealistic Satellite
      groundMat.wireframe = false;
      groundMat.map = satelliteTextureRef.current;
      groundMat.color.setHex(0xffffff);
      sceneRef.current.background = new THREE.Color(0x0e1726);
      if (sceneRef.current.fog) sceneRef.current.fog.color.setHex(0x1a283e);
    }
    groundMat.needsUpdate = true;
  }, [mapStyle]);

  // =========================================================================
  // CONTINUOUS 60FPS FLIGHT MOTION, REAL GPS MAPPING & DYNAMIC STEERING
  // =========================================================================
  useEffect(() => {
    let animId: number;
    let propSpin = 0;
    let lastTime = performance.now();

    const animate = (now: number) => {
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      // 1. Calculate Exact 3D Position from True GPS Coordinates
      const current3DPos = gpsTo3D(uavPosition.lat, uavPosition.lon, engineOn ? uavPosition.altitude : 0);

      // 2. Propeller Spin & Motion Blur
      if (propellerRef.current) {
        if (engineOn) {
          propSpin += 0.85;
          propellerRef.current.rotation.z = propSpin;
          if (propBlurDiscRef.current) {
            (propBlurDiscRef.current.material as THREE.MeshBasicMaterial).opacity = 0.28;
          }
        } else {
          if (propBlurDiscRef.current) {
            (propBlurDiscRef.current.material as THREE.MeshBasicMaterial).opacity = 0.0;
          }
        }
      }

      // 3. Position & Orient UAV Drone in 3D Space
      if (uavGroupRef.current) {
        if (engineOn) {
          // Subtle atmospheric micro-turbulence float
          const turbulenceY = Math.sin(now * 0.004) * 0.35 + Math.cos(now * 0.007) * 0.2;
          const turbulenceRoll = Math.sin(now * 0.003) * 0.02;

          // Smooth position update
          uavGroupRef.current.position.lerp(
            new THREE.Vector3(current3DPos.x, current3DPos.y + turbulenceY, current3DPos.z),
            0.2
          );

          // Calculate Dynamic Heading Angle (in radians)
          const targetHeadingRad = -(uavPosition.heading * Math.PI) / 180 + Math.PI;

          // Calculate Dynamic Banking based on Heading change rate (dHeading/dt)
          let headingDelta = uavPosition.heading - lastHeadingRef.current;
          if (headingDelta > 180) headingDelta -= 360;
          if (headingDelta < -180) headingDelta += 360;
          lastHeadingRef.current = uavPosition.heading;

          const targetBank = THREE.MathUtils.clamp(-headingDelta * 0.35, -0.45, 0.45);
          currentBankRef.current = THREE.MathUtils.lerp(currentBankRef.current, targetBank, 0.1);

          // Apply full 3D rotations
          uavGroupRef.current.rotation.set(0, 0, 0);
          uavGroupRef.current.rotation.y = targetHeadingRad;
          uavGroupRef.current.rotation.z = currentBankRef.current + turbulenceRoll;

          // Update Ground Shadow directly beneath UAV
          if (shadowMeshRef.current) {
            shadowMeshRef.current.position.set(current3DPos.x, 1.2, current3DPos.z);
            shadowMeshRef.current.rotation.y = targetHeadingRad;
            shadowMeshRef.current.scale.setScalar(1 + (current3DPos.y / 80));
          }

          // Record Flight History Breadcrumb trail
          if (historyPointsRef.current.length === 0 || historyPointsRef.current[historyPointsRef.current.length - 1].distanceTo(current3DPos) > 4.0) {
            historyPointsRef.current.push(current3DPos.clone());
            if (historyPointsRef.current.length > 250) {
              historyPointsRef.current.shift();
            }
            if (historyPathLineRef.current && historyPointsRef.current.length >= 2) {
              historyPathLineRef.current.geometry.setFromPoints(historyPointsRef.current);
              historyPathLineRef.current.computeLineDistances();
            }
          }

          // Update Forward Heading Vector Line
          if (forwardVectorLineRef.current) {
            const forwardLen = 60;
            const headingRad = (uavPosition.heading * Math.PI) / 180;
            const forwardTarget = current3DPos.clone().add(new THREE.Vector3(
              Math.sin(headingRad) * forwardLen,
              0,
              -Math.cos(headingRad) * forwardLen
            ));
            forwardVectorLineRef.current.geometry.setFromPoints([current3DPos, forwardTarget]);
            forwardVectorLineRef.current.computeLineDistances();
          }

        } else {
          // Stationary in Standby
          uavGroupRef.current.position.lerp(current3DPos, 0.2);
          uavGroupRef.current.rotation.set(0, -(uavPosition.heading * Math.PI) / 180 + Math.PI, 0);
          if (shadowMeshRef.current) {
            shadowMeshRef.current.position.set(current3DPos.x, 1.2, current3DPos.z);
          }
        }

        // 4. Dynamic Camera Tracking Modes
        if (cameraRef.current) {
          const uavPos = uavGroupRef.current.position;
          const currentZoom = zoomFactorRef.current;

          if (viewMode === 'chase') {
            // Over-the-shoulder chase view locked behind and above the UAV drone along heading
            const chaseDist = (engineOn ? 62 : 52) * currentZoom;
            const chaseHeight = (engineOn ? 24 : 18) * currentZoom;
            
            const camTarget = uavPos.clone().add(new THREE.Vector3(
              Math.sin(orbitAngleRef.current.theta) * chaseDist,
              chaseHeight + Math.sin(orbitAngleRef.current.phi) * (20 * currentZoom),
              Math.cos(orbitAngleRef.current.theta) * chaseDist
            ));

            cameraRef.current.position.lerp(camTarget, 0.1);
            cameraRef.current.lookAt(uavPos.x, uavPos.y + 3, uavPos.z);
          } else if (viewMode === 'flir') {
            // First-person EO/IR Nose Gimbal Camera looking forward along heading
            const headingRad = uavGroupRef.current.rotation.y;
            const noseOffset = new THREE.Vector3(0, -1.5, 9.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), headingRad);
            cameraRef.current.position.copy(uavPos).add(noseOffset);
            
            const forwardLook = uavPos.clone().add(
              new THREE.Vector3(
                -Math.sin(headingRad) * 200,
                -30,
                -Math.cos(headingRad) * 200
              )
            );
            cameraRef.current.lookAt(forwardLook);
          } else if (viewMode === 'terrain') {
            // 3D Orbital Flyover Cam tracking the drone smoothly across the terrain
            const orbitRadius = 190 * currentZoom;
            const camX = uavPos.x + Math.sin(orbitAngleRef.current.theta) * orbitRadius;
            const camZ = uavPos.z + Math.cos(orbitAngleRef.current.theta) * orbitRadius;
            const camY = Math.max(40, uavPos.y + Math.sin(orbitAngleRef.current.phi) * orbitRadius + 45);

            cameraRef.current.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.09);
            cameraRef.current.lookAt(uavPos.x, uavPos.y + 4, uavPos.z);
          } else if (viewMode === 'top') {
            // Overhead Satellite Tactical Radar View
            const topHeight = 380 * currentZoom;
            cameraRef.current.position.lerp(new THREE.Vector3(uavPos.x, topHeight, uavPos.z), 0.12);
            cameraRef.current.lookAt(uavPos.x, 0, uavPos.z);
          }
        }
      }

      // Render Three.js Scene
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }

      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [engineOn, uavPosition.lat, uavPosition.lon, uavPosition.altitude, uavPosition.heading, viewMode]);

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-3 shadow-sm relative overflow-hidden flex flex-col h-full select-none">
      
      {/* Header Bar */}
      <div className="flex items-center justify-between mb-2 z-10 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-orange-50 border border-orange-200 flex items-center justify-center text-[#F97316]">
            <MapPin className="w-3.5 h-3.5" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-[#1F2937] tracking-tight uppercase">MISSION MAP (3D UAV SATELLITE TERRAIN FLIGHT)</h2>
            <div className="text-[10px] text-[#6B7280]">Rotax 912 MALE UAV Drone | Live GPS Coordinates & Heading Steering</div>
          </div>
        </div>

        {/* View Mode Switcher (Chase 3D, FLIR Nose, Terrain 3D, Top Down) */}
        <div className="flex items-center gap-1 bg-[#F9FAFB] border border-[#E5E7EB] p-0.5 rounded-lg text-[9px] font-bold">
          <button
            onClick={() => setViewMode('chase')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded transition-all ${
              viewMode === 'chase' ? 'bg-[#F97316] text-white shadow-xs' : 'text-[#4B5563] hover:text-black'
            }`}
          >
            <Video className="w-3 h-3" />
            <span>Chase 3D</span>
          </button>
          <button
            onClick={() => setViewMode('flir')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded transition-all ${
              viewMode === 'flir' ? 'bg-[#F97316] text-white shadow-xs' : 'text-[#4B5563] hover:text-black'
            }`}
          >
            <Crosshair className="w-3 h-3" />
            <span>Cockpit FLIR</span>
          </button>
          <button
            onClick={() => setViewMode('terrain')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded transition-all ${
              viewMode === 'terrain' ? 'bg-[#F97316] text-white shadow-xs' : 'text-[#4B5563] hover:text-black'
            }`}
          >
            <Eye className="w-3 h-3" />
            <span>Terrain 3D</span>
          </button>
          <button
            onClick={() => setViewMode('top')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded transition-all ${
              viewMode === 'top' ? 'bg-[#F97316] text-white shadow-xs' : 'text-[#4B5563] hover:text-black'
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>Top Down</span>
          </button>
        </div>
      </div>

      {/* 3D WebGL Canvas Viewport Area */}
      <div className="relative flex-1 w-full min-h-[330px] rounded-lg overflow-hidden border border-[#CBD5E1] bg-[#0E1726]">
        
        {/* 3D Canvas Element */}
        <div ref={containerRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

        {/* 1. TOP MILITARY COMPASS TAPE (Matches the Reference Image PUBG / Defense Style) */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-slate-900/85 backdrop-blur-md border border-slate-700/70 rounded px-3 py-0.5 text-white font-mono text-[9px] shadow-lg z-20 flex items-center gap-3 pointer-events-none">
          <span className="text-slate-400">S</span>
          <span className="text-slate-500">195</span>
          <span className="text-slate-400">210</span>
          <span className="text-slate-400">SW</span>
          <span className="text-slate-500">240</span>
          <div className="flex flex-col items-center">
            <span className="text-[#F97316] font-bold text-xs">▼ {uavPosition.heading}° W</span>
          </div>
          <span className="text-slate-500">285</span>
          <span className="text-slate-400">300</span>
          <span className="text-slate-400">NW</span>
          <span className="text-slate-500">330</span>
          <span className="text-slate-400">N</span>
        </div>

        {/* 2. TOP-RIGHT TACTICAL BADGE (Matching Reference '97 ALIVE' Style) */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-2 z-20">
          <div className="bg-slate-900/85 backdrop-blur-md border border-slate-700/70 rounded px-2.5 py-1 text-white font-mono flex items-center gap-2 shadow-lg">
            <div className="flex flex-col items-end">
              <span className="text-[7.5px] text-slate-400 font-bold uppercase tracking-wider">DRONE TELEMETRY</span>
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                <Radio className="w-2.5 h-2.5 animate-pulse text-emerald-400" />
                {engineOn ? 'ACTIVE 100%' : 'STANDBY'}
              </span>
            </div>
            <div className="border-l border-slate-700 pl-2 text-center">
              <span className="text-[7.5px] text-slate-400 block font-mono">UAV-01</span>
              <span className="text-xs font-extrabold text-[#F97316]">97 ALIVE</span>
            </div>
          </div>
        </div>

        {/* 3. TOP-LEFT TACTICAL HUD TELEMETRY BOX */}
        <div className="absolute top-2.5 left-2.5 bg-slate-900/90 backdrop-blur-md border border-slate-700/70 rounded p-2 text-white font-mono text-[9px] space-y-0.5 shadow-xl z-20 pointer-events-none">
          <div className="flex justify-between gap-3 text-slate-400">
            <span>AIRCRAFT</span>
            <strong className="text-[#F97316]">ROTAX 912 MALE UAV</strong>
          </div>
          <div className="flex justify-between gap-3 text-slate-400">
            <span>LAT / LON</span>
            <strong className="text-white">{uavPosition.lat.toFixed(4)}°N, {uavPosition.lon.toFixed(4)}°E</strong>
          </div>
          <div className="flex justify-between gap-3 text-slate-400">
            <span>ALTITUDE</span>
            <strong className="text-[#F97316]">{engineOn ? uavPosition.altitude.toLocaleString() : 0} ft</strong>
          </div>
          <div className="flex justify-between gap-3 text-slate-400">
            <span>AIRSPEED</span>
            <strong className="text-emerald-400">{engineOn ? uavPosition.airspeed : 0} km/h</strong>
          </div>
          <div className="flex justify-between gap-3 text-slate-400">
            <span>HEADING</span>
            <strong className="text-cyan-400">{uavPosition.heading}°</strong>
          </div>
        </div>

        {/* 4. LEFT FLOATING ZOOM & CAMERA CONTROL DOCK */}
        <div className="absolute left-2.5 bottom-12 flex flex-col gap-1.5 z-20">
          <button
            onClick={handleZoomIn}
            title="Zoom In"
            className="w-7 h-7 rounded bg-slate-900/85 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700 flex items-center justify-center shadow-md transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleZoomOut}
            title="Zoom Out"
            className="w-7 h-7 rounded bg-slate-900/85 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700 flex items-center justify-center shadow-md transition-all active:scale-95"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleResetCamera}
            title="Reset Camera View"
            className="w-7 h-7 rounded bg-slate-900/85 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700 flex items-center justify-center shadow-md transition-all active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 5. RIGHT FLOATING TERRAIN STYLE SWITCHER */}
        <div className="absolute right-2.5 top-12 flex flex-col items-end gap-1 z-20">
          <div className="flex bg-slate-900/85 border border-slate-700/70 rounded p-0.5 text-[8.5px] font-semibold text-slate-200 backdrop-blur-md">
            <button
              onClick={() => setMapStyle('satellite')}
              className={`px-2 py-0.5 rounded transition-all ${mapStyle === 'satellite' ? 'bg-[#F97316] text-white font-bold' : 'hover:text-white'}`}
            >
              Satellite
            </button>
            <button
              onClick={() => setMapStyle('flir')}
              className={`px-2 py-0.5 rounded transition-all ${mapStyle === 'flir' ? 'bg-[#F97316] text-white font-bold' : 'hover:text-white'}`}
            >
              FLIR Thermal
            </button>
            <button
              onClick={() => setMapStyle('wireframe')}
              className={`px-2 py-0.5 rounded transition-all ${mapStyle === 'wireframe' ? 'bg-[#F97316] text-white font-bold' : 'hover:text-white'}`}
            >
              Wireframe
            </button>
          </div>
        </div>

        {/* 6. BOTTOM-RIGHT SECTOR GRID MINI-MAP (Maps True Lat/Lon Coordinates) */}
        <div className="absolute bottom-2.5 right-2.5 bg-slate-900/90 backdrop-blur-md border border-cyan-500/50 rounded p-1.5 text-white font-mono text-[8px] shadow-xl z-20 pointer-events-none">
          <div className="flex justify-between items-center text-[7px] text-cyan-400 font-bold mb-1">
            <span>SECTOR GRID</span>
            <span className="text-slate-400">H6 - H9</span>
          </div>
          
          <div className="w-24 h-20 border border-cyan-500/40 grid grid-cols-4 grid-rows-4 relative bg-[#06182a]/70 overflow-hidden">
            {/* Sector Grid Coordinates */}
            <div className="border-r border-b border-cyan-500/20 text-[6px] text-slate-500 pl-0.5">K3</div>
            <div className="border-r border-b border-cyan-500/20 text-[6px] text-slate-500 pl-0.5">K4</div>
            <div className="border-r border-b border-cyan-500/20 text-[6px] text-slate-500 pl-0.5">K5</div>
            <div className="border-b border-cyan-500/20 text-[6px] text-slate-500 pl-0.5">K6</div>
            
            <div className="border-r border-b border-cyan-500/20"></div>
            <div className="border-r border-b border-cyan-500/20"></div>
            <div className="border-r border-b border-cyan-500/20"></div>
            <div className="border-b border-cyan-500/20"></div>
            
            <div className="border-r border-b border-cyan-500/20"></div>
            <div className="border-r border-b border-cyan-500/20"></div>
            <div className="border-r border-b border-cyan-500/20"></div>
            <div className="border-b border-cyan-500/20"></div>
            
            <div className="border-r border-cyan-500/20"></div>
            <div className="border-r border-cyan-500/20"></div>
            <div className="border-r border-cyan-500/20"></div>
            <div></div>

            {/* River Indicator on Mini-Map */}
            <div className="absolute top-0 bottom-0 left-1/3 w-2.5 bg-cyan-950/40 border-r border-l border-cyan-500/20 -skew-x-12 pointer-events-none" />

            {/* Live Moving UAV Blip on Mini-Map (Mapped directly to Lat & Lon) */}
            <div
              className="w-2 h-2 rounded-full bg-[#F97316] border border-white shadow-[0_0_8px_#f97316] absolute transition-all duration-200"
              style={{
                left: `${Math.min(92, Math.max(8, ((uavPosition.lon - 77.160) / (77.270 - 77.160)) * 100))}%`,
                top: `${Math.min(92, Math.max(8, (1 - (uavPosition.lat - 32.500) / (32.590 - 32.500)) * 100))}%`,
                transform: 'translate(-50%, -50%)'
              }}
            />
          </div>
        </div>

        {/* 7. BOTTOM-CENTER MISSION PROGRESS & FLIGHT PHASE BADGE */}
        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md border border-slate-700/70 rounded-lg px-3 py-1 min-w-[200px] text-white shadow-xl z-20 pointer-events-none">
          <div className="flex items-center justify-between text-xs mb-0.5">
            <div className="flex items-center gap-1 text-slate-400 text-[8.5px] font-medium uppercase">
              <Plane className="w-2.5 h-2.5 text-[#F97316]" />
              <span>Flight Phase</span>
            </div>
            <span className="font-bold text-[10px] tracking-wider text-emerald-400">{flightPhase}</span>
          </div>

          <div className="space-y-0.5">
            <div className="flex justify-between text-[8px] font-mono text-slate-300">
              <span>Flight Track Progress</span>
              <strong className="text-[#F97316]">{Math.round(uavPosition.missionProgressPercent)}%</strong>
            </div>
            <div className="w-full bg-slate-700 h-1 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-orange-400 to-[#F97316] h-full rounded-full transition-all duration-300"
                style={{ width: `${uavPosition.missionProgressPercent}%` }}
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
