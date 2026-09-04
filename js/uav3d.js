/**
 * 3D Tactical UAV & Engine Visualizer using Three.js
 * Renders a military/tactical twin-boom pusher-prop UAV with dynamic attitude,
 * realistic propeller spin synced to RPM, exhaust heat particles, and HUD overlay.
 */

export class UAVVisualizer3D {
  constructor(containerElement) {
    this.container = containerElement;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.uavGroup = null;
    this.propellerMesh = null;
    this.propBlurDisc = null;
    this.exhaustParticles = null;
    this.cameraMode = 'chase'; // 'chase', 'orbit', 'engine', 'cockpit'
    this.isMouseDown = false;
    this.mouseX = 0;
    this.mouseY = 0;
    this.targetRotationY = 0;
    this.targetRotationX = 0;
    this.propellerAngle = 0;
    this.clock = null;

    this.init();
  }

  init() {
    if (!window.THREE) {
      console.warn('Three.js library not detected. Initializing 2D Tactical Avionics visualizer fallback.');
      this.init2DFallback();
      return;
    }

    try {
      const THREE = window.THREE;
      this.clock = new THREE.Clock();

      // Scene setup
      this.scene = new THREE.Scene();
      this.scene.fog = new THREE.FogExp2(0x060b13, 0.008);

      // Camera setup
      const width = this.container.clientWidth || 600;
      const height = this.container.clientHeight || 400;
      this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
      this.camera.position.set(0, 3, 10);

      // Renderer setup
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.2;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.container.appendChild(this.renderer.domElement);

      // Lighting
      this.setupLighting();

      // Environment (Skybox, Altitude Grid, Clouds)
      this.setupEnvironment();

      // UAV Model
      this.buildTacticalUAV();

      // Heat & Exhaust Particles
      this.setupExhaustParticles();

      // Event Listeners
      this.setupInteractions();

      // Resize handler
      window.addEventListener('resize', () => this.onWindowResize());
    } catch (err) {
      console.warn('WebGL initialization failed, falling back to 2D tactical canvas.', err);
      this.init2DFallback();
    }
  }

  init2DFallback() {
    this.is2DFallback = true;
    this.canvas2D = document.createElement('canvas');
    this.ctx2D = this.canvas2D.getContext('2d');
    this.container.appendChild(this.canvas2D);
    this.resize2D();
    window.addEventListener('resize', () => this.resize2D());
  }

  resize2D() {
    if (!this.canvas2D) return;
    const w = this.container.clientWidth || 600;
    const h = this.container.clientHeight || 300;
    const dpr = window.devicePixelRatio || 1;
    this.canvas2D.width = w * dpr;
    this.canvas2D.height = h * dpr;
    this.canvas2D.style.width = '100%';
    this.canvas2D.style.height = '100%';
    this.ctx2D.scale(dpr, dpr);
    this.w2D = w;
    this.h2D = h;
  }

    // Environment (Skybox, Altitude Grid, Clouds)
    this.setupEnvironment();

    // UAV Model
    this.buildTacticalUAV();

    // Heat & Exhaust Particles
    this.setupExhaustParticles();

    // Event Listeners
    this.setupInteractions();

    // Resize handler
    window.addEventListener('resize', () => this.onWindowResize());
  }

  setupLighting() {
    const THREE = window.THREE;

    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x40556f, 1.2);
    this.scene.add(ambientLight);

    // Main directional sunlight
    const sunLight = new THREE.DirectionalLight(0xe8f4ff, 2.0);
    sunLight.position.set(15, 25, 20);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 100;
    sunLight.shadow.bias = -0.0005;
    this.scene.add(sunLight);

    // Tactical blue rim light
    const rimLight = new THREE.DirectionalLight(0x00e5ff, 1.5);
    rimLight.position.set(-15, -5, -15);
    this.scene.add(rimLight);

    // Engine glow pointlight
    this.engineGlow = new THREE.PointLight(0xff6600, 0.8, 4);
    this.engineGlow.position.set(0, 0.2, -1.8);
    this.scene.add(this.engineGlow);
  }

  setupEnvironment() {
    const THREE = window.THREE;

    // Tactical altitude wireframe grid
    const gridHelper = new THREE.GridHelper(200, 50, 0x00f0ff, 0x11293d);
    gridHelper.position.y = -6;
    this.gridHelper = gridHelper;
    this.scene.add(gridHelper);

    // Atmospheric flight particle field (speed dust)
    const particleCount = 400;
    const particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 60;
      positions[i + 1] = (Math.random() - 0.5) * 40;
      positions[i + 2] = (Math.random() - 0.5) * 80;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x55ccff,
      size: 0.12,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending
    });
    this.speedParticles = new THREE.Points(particleGeo, particleMat);
    this.scene.add(this.speedParticles);
  }

  buildTacticalUAV() {
    const THREE = window.THREE;
    this.uavGroup = new THREE.Group();

    // High-tech aerospace materials
    const compositeMat = new THREE.MeshStandardMaterial({
      color: 0x1f2733,
      roughness: 0.35,
      metalness: 0.7,
    });

    const darkAccentMat = new THREE.MeshStandardMaterial({
      color: 0x0d131a,
      roughness: 0.5,
      metalness: 0.9,
    });

    const engineHousingMat = new THREE.MeshStandardMaterial({
      color: 0x2d3748,
      roughness: 0.25,
      metalness: 0.85,
    });

    const sensorGlassMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      roughness: 0.1,
      metalness: 0.9,
      emissive: 0x004455,
      emissiveIntensity: 0.5
    });

    const navLightRed = new THREE.MeshBasicMaterial({ color: 0xff0033 });
    const navLightGreen = new THREE.MeshBasicMaterial({ color: 0x00ff66 });
    const navLightStrobe = new THREE.MeshBasicMaterial({ color: 0xffffff });

    // 1. Main Fuselage
    const fuselageShape = new THREE.CylinderGeometry(0.35, 0.45, 3.8, 16);
    fuselageShape.rotateX(Math.PI / 2);
    fuselageShape.scale(1.1, 0.8, 1.0);
    const fuselage = new THREE.Mesh(fuselageShape, compositeMat);
    fuselage.castShadow = true;
    fuselage.receiveShadow = true;
    this.uavGroup.add(fuselage);

    // 2. Nose Cone / Sensor Dome
    const noseGeo = new THREE.SphereGeometry(0.38, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    noseGeo.rotateX(-Math.PI / 2);
    const nose = new THREE.Mesh(noseGeo, compositeMat);
    nose.position.set(0, 0, 1.9);
    this.uavGroup.add(nose);

    // 3. Electro-Optical Gimbal Turret (Under nose)
    const gimbalGeo = new THREE.SphereGeometry(0.22, 16, 16);
    const gimbal = new THREE.Mesh(gimbalGeo, darkAccentMat);
    gimbal.position.set(0, -0.3, 1.4);
    const lensGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.1, 12);
    lensGeo.rotateX(Math.PI / 2);
    const lens = new THREE.Mesh(lensGeo, sensorGlassMat);
    lens.position.set(0, 0, 0.18);
    gimbal.add(lens);
    this.uavGroup.add(gimbal);

    // 4. Main High-Aspect Ratio Wings
    const wingShape = new THREE.BoxGeometry(9.2, 0.06, 0.75);
    const wings = new THREE.Mesh(wingShape, compositeMat);
    wings.position.set(0, 0.1, 0.1);
    wings.castShadow = true;
    this.uavGroup.add(wings);

    // Wingtips / Winglets
    const wingletGeo = new THREE.BoxGeometry(0.05, 0.5, 0.45);
    const leftWinglet = new THREE.Mesh(wingletGeo, darkAccentMat);
    leftWinglet.position.set(-4.6, 0.25, 0.05);
    leftWinglet.rotation.z = -0.2;
    this.uavGroup.add(leftWinglet);

    const rightWinglet = new THREE.Mesh(wingletGeo, darkAccentMat);
    rightWinglet.position.set(4.6, 0.25, 0.05);
    rightWinglet.rotation.z = 0.2;
    this.uavGroup.add(rightWinglet);

    // Navigation Lights
    const leftNav = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), navLightRed);
    leftNav.position.set(-4.62, 0.35, 0.2);
    this.uavGroup.add(leftNav);

    const rightNav = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), navLightGreen);
    rightNav.position.set(4.62, 0.35, 0.2);
    this.uavGroup.add(rightNav);

    // 5. Twin Booms & Inverted V-Tail
    const boomGeo = new THREE.CylinderGeometry(0.07, 0.07, 3.2, 8);
    boomGeo.rotateX(Math.PI / 2);

    const leftBoom = new THREE.Mesh(boomGeo, compositeMat);
    leftBoom.position.set(-1.2, 0.05, -1.4);
    this.uavGroup.add(leftBoom);

    const rightBoom = new THREE.Mesh(boomGeo, compositeMat);
    rightBoom.position.set(1.2, 0.05, -1.4);
    this.uavGroup.add(rightBoom);

    // Tail Plane / Inverted V-Tail
    const vTailGeo = new THREE.BoxGeometry(2.8, 0.04, 0.45);
    const vTailLeft = new THREE.Mesh(vTailGeo, compositeMat);
    vTailLeft.position.set(-0.65, -0.4, -3.0);
    vTailLeft.rotation.z = 0.5;
    this.uavGroup.add(vTailLeft);

    const vTailRight = new THREE.Mesh(vTailGeo, compositeMat);
    vTailRight.position.set(0.65, -0.4, -3.0);
    vTailRight.rotation.z = -0.5;
    this.uavGroup.add(vTailRight);

    // Tail Strobe
    const tailStrobe = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), navLightStrobe);
    tailStrobe.position.set(0, -0.85, -3.0);
    this.uavGroup.add(tailStrobe);

    // 6. Engine Cowling & Pusher Piston Engine Compartment
    const engineCowl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.38, 1.2, 16),
      engineHousingMat
    );
    engineCowl.rotateX(Math.PI / 2);
    engineCowl.position.set(0, 0.15, -1.3);
    this.uavGroup.add(engineCowl);

    // Engine Ram-Air Cooling Scoop
    const scoopGeo = new THREE.BoxGeometry(0.25, 0.18, 0.6);
    const scoop = new THREE.Mesh(scoopGeo, darkAccentMat);
    scoop.position.set(0, 0.45, -1.1);
    this.uavGroup.add(scoop);

    // Exhaust Pipes (Left & Right)
    const exhaustMat = new THREE.MeshStandardMaterial({ color: 0x332211, metalness: 0.9, roughness: 0.4 });
    const exhaustL = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 8), exhaustMat);
    exhaustL.rotation.z = Math.PI / 3;
    exhaustL.position.set(-0.35, 0.0, -1.6);
    this.uavGroup.add(exhaustL);

    const exhaustR = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 8), exhaustMat);
    exhaustR.rotation.z = -Math.PI / 3;
    exhaustR.position.set(0.35, 0.0, -1.6);
    this.uavGroup.add(exhaustR);

    // 7. Pusher Propeller Assembly (At the rear of fuselage)
    this.propellerGroup = new THREE.Group();
    this.propellerGroup.position.set(0, 0.15, -1.95);

    // Propeller Spinner / Hub
    const spinnerGeo = new THREE.ConeGeometry(0.12, 0.28, 12);
    spinnerGeo.rotateX(-Math.PI / 2);
    const spinner = new THREE.Mesh(spinnerGeo, darkAccentMat);
    this.propellerGroup.add(spinner);

    // 3 Propeller Blades
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.3,
      metalness: 0.8
    });
    const tipMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 }); // Yellow tips

    for (let i = 0; i < 3; i++) {
      const bladeArm = new THREE.Group();
      bladeArm.rotation.z = (i * Math.PI * 2) / 3;

      const bladeGeo = new THREE.BoxGeometry(0.08, 0.85, 0.018);
      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      blade.position.y = 0.45;
      blade.rotation.y = 0.35; // Prop pitch
      bladeArm.add(blade);

      const tipGeo = new THREE.BoxGeometry(0.082, 0.1, 0.02);
      const tip = new THREE.Mesh(tipGeo, tipMat);
      tip.position.y = 0.83;
      bladeArm.add(tip);

      this.propellerGroup.add(bladeArm);
    }

    // Motion Blur Disc for High RPM
    const blurGeo = new THREE.RingGeometry(0.15, 0.9, 32);
    this.blurMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide
    });
    this.propBlurDisc = new THREE.Mesh(blurGeo, this.blurMat);
    this.propellerGroup.add(this.propBlurDisc);

    this.uavGroup.add(this.propellerGroup);

    // 8. Tactical Markings & Antennas
    const antennaMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const pitot = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.4, 6), antennaMat);
    pitot.rotateX(Math.PI / 2);
    pitot.position.set(-2.0, 0.1, 0.5);
    this.uavGroup.add(pitot);

    this.scene.add(this.uavGroup);
  }

  setupExhaustParticles() {
    const THREE = window.THREE;
    const count = 60;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const alphas = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 0.1;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 0.1;
      pos[i * 3 + 2] = -2.0 - Math.random() * 3.0;
      alphas[i] = Math.random();
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xff8833,
      size: 0.18,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    });

    this.exhaustParticles = new THREE.Points(geo, mat);
    this.uavGroup.add(this.exhaustParticles);
  }

  setupInteractions() {
    const dom = this.renderer.domElement;

    dom.addEventListener('mousedown', (e) => {
      this.isMouseDown = true;
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });

    window.addEventListener('mouseup', () => {
      this.isMouseDown = false;
    });

    dom.addEventListener('mousemove', (e) => {
      if (!this.isMouseDown) return;
      const dx = e.clientX - this.mouseX;
      const dy = e.clientY - this.mouseY;
      this.targetRotationY += dx * 0.006;
      this.targetRotationX = Math.max(-0.8, Math.min(0.8, this.targetRotationX + dy * 0.006));
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });

    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (this.camera) {
        this.camera.position.z = Math.max(4, Math.min(25, this.camera.position.z + e.deltaY * 0.01));
      }
    }, { passive: false });
  }

  setCameraView(mode) {
    this.cameraMode = mode;
    if (!this.camera) return;

    switch (mode) {
      case 'chase':
        this.camera.position.set(0, 2.5, 8.5);
        this.targetRotationX = 0.1;
        this.targetRotationY = 0;
        break;
      case 'engine':
        this.camera.position.set(1.5, 1.2, -4.5);
        this.camera.lookAt(0, 0.2, -1.8);
        this.targetRotationX = 0.2;
        this.targetRotationY = Math.PI;
        break;
      case 'orbit':
        this.camera.position.set(5.5, 3.5, 6.5);
        this.targetRotationX = 0.3;
        this.targetRotationY = 0.7;
        break;
      case 'cockpit':
        this.camera.position.set(0, 0.6, 2.2);
        this.targetRotationX = 0.0;
        this.targetRotationY = 0;
        break;
    }
  }

  onWindowResize() {
    if (!this.container || !this.camera || !this.renderer) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  /**
   * Main Render Frame
   * Syncs UAV visual model with physical simulation state
   */
  render(physicsState, physicsControls) {
    if (this.is2DFallback) {
      this.render2D(physicsState, physicsControls);
      return;
    }

    if (!this.renderer || !this.scene || !this.camera || !this.uavGroup) return;

    const dt = this.clock.getDelta();
    const rpm = physicsState.rpm || 0;
    const pitchDeg = physicsState.pitch || 0;
    const rollDeg = physicsState.roll || 0;
    const vibration = physicsState.vibration || 1.0;
    const airspeed = physicsControls.airspeed || 145;

    // 1. Propeller Spin synced to simulated RPM
    // (rpm / 60) * 2 * PI rad/sec
    const spinRadSec = (rpm / 60) * Math.PI * 2;
    this.propellerAngle += spinRadSec * dt;
    if (this.propellerGroup) {
      this.propellerGroup.rotation.z = this.propellerAngle;
    }

    // Propeller motion blur opacity based on RPM
    if (this.blurMat) {
      const blurOpacity = Math.max(0, Math.min(0.7, (rpm - 1500) / 3500));
      this.blurMat.opacity = blurOpacity;
    }

    // 2. UAV Attitude & Vibration Micro-Jitter
    const THREE = window.THREE;
    const pitchRad = (pitchDeg * Math.PI) / 180;
    const rollRad = (rollDeg * Math.PI) / 180;
    
    // High vibration causes physical airframe shaking
    const vibNoiseX = (Math.random() - 0.5) * (vibration / 15.0) * 0.03;
    const vibNoiseY = (Math.random() - 0.5) * (vibration / 15.0) * 0.03;

    this.uavGroup.rotation.x = pitchRad + vibNoiseX;
    this.uavGroup.rotation.z = rollRad + vibNoiseY;

    // Gentle aerodynamic flight float
    const simTime = physicsState.simTime || 0;
    this.uavGroup.position.y = Math.sin(simTime * 1.5) * 0.12;

    // 3. Speed particles animation (airspeed visual cue)
    if (this.speedParticles) {
      const positions = this.speedParticles.geometry.attributes.position.array;
      const speed = (airspeed / 100.0) * 45.0 * dt;
      for (let i = 2; i < positions.length; i += 3) {
        positions[i] += speed;
        if (positions[i] > 30) {
          positions[i] = -50;
        }
      }
      this.speedParticles.geometry.attributes.position.needsUpdate = true;
    }

    // 4. Ground grid motion
    if (this.gridHelper) {
      this.gridHelper.position.z = (this.gridHelper.position.z + (airspeed / 100.0) * 25.0 * dt) % 4;
    }

    // 5. Engine exhaust glow pulsing with throttle/EGT
    if (this.engineGlow) {
      const egtRatio = (physicsState.egt - 500) / 400;
      this.engineGlow.intensity = Math.max(0.2, egtRatio * 1.2 + Math.sin(simTime * 20.0) * 0.1);
    }

    // 6. Camera Orbit Damping
    if (this.cameraMode === 'chase' || this.cameraMode === 'orbit') {
      const radius = 9.0;
      const targetCamX = Math.sin(this.targetRotationY) * radius * Math.cos(this.targetRotationX);
      const targetCamZ = Math.cos(this.targetRotationY) * radius * Math.cos(this.targetRotationX);
      const targetCamY = Math.sin(this.targetRotationX) * radius + 2.0;

      this.camera.position.x += (targetCamX - this.camera.position.x) * 0.08;
      this.camera.position.y += (targetCamY - this.camera.position.y) * 0.08;
      this.camera.position.z += (targetCamZ - this.camera.position.z) * 0.08;
      this.camera.lookAt(this.uavGroup.position.x, this.uavGroup.position.y + 0.3, this.uavGroup.position.z);
    } else if (this.cameraMode === 'engine') {
      this.camera.lookAt(0, 0.2, -1.8);
    } else if (this.cameraMode === 'cockpit') {
      this.camera.lookAt(0, 0, 15);
    }

    this.renderer.render(this.scene, this.camera);
  }

  render2D(physicsState, physicsControls) {
    if (!this.ctx2D || !this.w2D || !this.h2D) return;
    const ctx = this.ctx2D;
    const w = this.w2D;
    const h = this.h2D;
    const pitch = physicsState.pitch || 0;
    const roll = physicsState.roll || 0;
    const rpm = physicsState.rpm || 0;

    ctx.clearRect(0, 0, w, h);

    // Artificial Horizon Sky / Ground
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate((roll * Math.PI) / 180);
    const pitchOffset = pitch * 4;

    // Sky
    ctx.fillStyle = '#0a1e36';
    ctx.fillRect(-w, -h - pitchOffset, w * 2, h);
    // Ground
    ctx.fillStyle = '#112217';
    ctx.fillRect(-w, -pitchOffset, w * 2, h);

    // Horizon line
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-w, -pitchOffset);
    ctx.lineTo(w, -pitchOffset);
    ctx.stroke();

    // Pitch ladder rungs
    for (let p = -20; p <= 20; p += 10) {
      if (p === 0) continue;
      const y = -pitchOffset - (p * 4);
      const rungWidth = 40;
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
      ctx.beginPath();
      ctx.moveTo(-rungWidth, y);
      ctx.lineTo(rungWidth, y);
      ctx.stroke();
    }

    ctx.restore();

    // Drone Silhouette Crosshair
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.strokeStyle = '#00ff9d';
    ctx.lineWidth = 2.5;

    // Fuselage
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.stroke();

    // Wings
    ctx.beginPath();
    ctx.moveTo(-70, 0);
    ctx.lineTo(-12, 0);
    ctx.moveTo(12, 0);
    ctx.lineTo(70, 0);
    // Tail
    ctx.moveTo(0, 10);
    ctx.lineTo(0, 30);
    ctx.moveTo(-20, 30);
    ctx.lineTo(20, 30);
    ctx.stroke();

    // Spinning propeller behind
    this.propellerAngle += (rpm / 60) * 0.1;
    ctx.rotate(this.propellerAngle);
    ctx.strokeStyle = 'rgba(255, 204, 0, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-25, 0);
    ctx.lineTo(25, 0);
    ctx.moveTo(0, -25);
    ctx.lineTo(0, 25);
    ctx.stroke();

    ctx.restore();
  }
}
