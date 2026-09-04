/**
 * Main Application Bootstrap
 * Orchestrates Aero-Piston Physics, 3D UAV Visualizer, Real-Time Oscilloscopes,
 * Fault Injection Matrix, and REST Telemetry API Streaming.
 */

import { AeroEnginePhysics } from './physicsEngine.js';
import { UAVVisualizer3D } from './uav3d.js';
import { TelemetryGraphsManager } from './charts.js';
import { TelemetryService } from './telemetryService.js';
import { DemoManager } from './demoManager.js';

class VirtualUAVSimulatorApp {
  constructor() {
    this.physics = new AeroEnginePhysics();
    this.graphs = new TelemetryGraphsManager();
    this.telemetry = null;
    this.uav3d = null;
    this.demo = null;

    // Previous sensor readings for trend arrows
    this.prevSensorValues = {};
    this.lastGraphUpdateTime = 0;
    this.lastUiUpdateTime = 0;

    // Fault descriptions
    this.faultDescriptions = {
      'NORMAL': 'Nominal aero-piston operating state. All sensor thermodynamics and harmonic orders balanced.',
      'LOW OIL PRESSURE': 'Critical oil line pressure drop. Oil film degradation causes gradual oil temperature elevation and friction wear.',
      'HIGH CHT': 'Cylinder head temperature surge due to cooling duct baffling failure or extreme lean mixture. EGT elevated.',
      'OVERHEATING': 'Severe dual thermal runaway across cylinder heads and oil circuit. Power output sag and thermal fatigue.',
      'EXCESSIVE VIBRATION': 'High-order rotational imbalance (propeller damage / mount failure). Severe structural vibration and RPM jitter.',
      'RPM INSTABILITY': 'Fuel injection governor hunting and intermittent spark irregularities causing cyclic RPM surging.',
      'FUEL PRESSURE DROP': 'Fuel rail delivery pump failure. Lean mixture initially spikes EGT before inducing engine stumble.',
      'COOLING PROBLEM': 'Ram-air cooling cowl obstruction. Convective heat dissipation impaired; progressive CHT & Oil Temp climb.'
    };
  }

  init() {
    console.log('[Simulator] Initializing Virtual UAV Aero-Piston Engine Platform...');

    // 1. Initialize 3D UAV Visualizer
    const canvasContainer = document.getElementById('uavCanvasContainer');
    if (canvasContainer) {
      this.uav3d = new UAVVisualizer3D(canvasContainer);
    }

    // 2. Initialize Real-Time Oscilloscopes
    this.initGraphs();

    // 3. Initialize Telemetry Service
    this.initTelemetry();

    // 4. Initialize Demo Manager
    this.demo = new DemoManager(
      this.physics,
      this.telemetry,
      (demoState) => this.updateDemoBanner(demoState)
    );

    // 5. Bind User Controls and Events
    this.bindFlightControls();
    this.bindFaultMatrix();
    this.bindTelemetryControls();
    this.bindCameraButtons();
    this.bindGlobalActions();

    // 6. Start Main 60Hz Physics & Visual Render Loop
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.mainLoop(t));

    console.log('[Simulator] Simulation active in LOCAL SIMULATION MODE. Ready for telemetry stream.');
  }

  initGraphs() {
    const chartsConfig = [
      { id: 'rpm', canvasId: 'chartRPM', title: 'RPM', unit: 'RPM', color: '#00f0ff', minVal: 0, maxVal: 6500, warnHigh: 5800, critHigh: 6200 },
      { id: 'cht', canvasId: 'chartCHT', title: 'CHT', unit: '°C', color: '#ffb700', minVal: 20, maxVal: 200, warnHigh: 120, critHigh: 145 },
      { id: 'egt', canvasId: 'chartEGT', title: 'EGT', unit: '°C', color: '#ff7733', minVal: 400, maxVal: 1000, warnHigh: 860, critHigh: 920 },
      { id: 'oilPressure', canvasId: 'chartOilPres', title: 'Oil Pres', unit: 'bar', color: '#00ff9d', minVal: 0, maxVal: 8.0, warnLow: 3.5, critLow: 2.5 },
      { id: 'vibration', canvasId: 'chartVibration', title: 'Vibration', unit: 'mm/s', color: '#ff3366', minVal: 0, maxVal: 20.0, warnHigh: 4.5, critHigh: 8.0 },
      { id: 'fuelFlow', canvasId: 'chartFuelFlow', title: 'Fuel Flow', unit: 'L/h', color: '#33bbff', minVal: 0, maxVal: 45.0, warnHigh: 32.0, critHigh: 38.0 }
    ];

    chartsConfig.forEach(cfg => {
      const el = document.getElementById(cfg.canvasId);
      if (el) {
        this.graphs.registerGraph(cfg.id, el, cfg);
      }
    });
  }

  initTelemetry() {
    const inputEndpoint = document.getElementById('inputEndpoint');
    const endpointUrl = inputEndpoint ? inputEndpoint.value : 'http://localhost:8000/api/telemetry';

    this.telemetry = new TelemetryService({
      endpointUrl: endpointUrl,
      intervalMs: 1000,
      onStatusChange: (statusData) => this.handleTelemetryStatusChange(statusData),
      onPacketSent: (packet, status, latency) => this.handlePacketTransmitted(packet, status, latency)
    });
  }

  bindFlightControls() {
    // Throttle Slider
    const sliderThrottle = document.getElementById('sliderThrottle');
    sliderThrottle.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      this.physics.setControl('throttle', val);
      document.getElementById('valThrottle').textContent = val;
    });

    // Engine Load Slider
    const sliderLoad = document.getElementById('sliderLoad');
    sliderLoad.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      this.physics.setControl('engineLoad', val);
      document.getElementById('valLoad').textContent = val;
    });

    // Altitude Slider
    const sliderAltitude = document.getElementById('sliderAltitude');
    sliderAltitude.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      this.physics.setControl('altitude', val);
      document.getElementById('valAltitude').textContent = val;
    });

    // Airspeed Slider
    const sliderAirspeed = document.getElementById('sliderAirspeed');
    sliderAirspeed.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      this.physics.setControl('airspeed', val);
      document.getElementById('valAirspeed').textContent = val;
    });

    // Ambient Temp Slider
    const sliderAmbient = document.getElementById('sliderAmbient');
    sliderAmbient.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      this.physics.setControl('ambientTemp', val);
      document.getElementById('valAmbient').textContent = val;
    });

    // Heading Slider
    const sliderHeading = document.getElementById('sliderHeading');
    sliderHeading.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      this.physics.setControl('heading', val);
      document.getElementById('valHeading').textContent = val;
    });

    // Flight Phase Preset Buttons
    const phaseBtns = document.querySelectorAll('.phase-btn');
    phaseBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        phaseBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const phase = btn.getAttribute('data-phase');
        this.physics.setControl('flightPhase', phase);
        this.syncControlSliders();
      });
    });
  }

  syncControlSliders() {
    const c = this.physics.controls;
    document.getElementById('sliderThrottle').value = c.throttle;
    document.getElementById('valThrottle').textContent = c.throttle;
    document.getElementById('sliderLoad').value = c.engineLoad;
    document.getElementById('valLoad').textContent = c.engineLoad;
    document.getElementById('sliderAltitude').value = c.altitude;
    document.getElementById('valAltitude').textContent = c.altitude;
    document.getElementById('sliderAirspeed').value = c.airspeed;
    document.getElementById('valAirspeed').textContent = c.airspeed;
    document.getElementById('sliderAmbient').value = c.ambientTemp;
    document.getElementById('valAmbient').textContent = c.ambientTemp;
    document.getElementById('sliderHeading').value = c.heading;
    document.getElementById('valHeading').textContent = c.heading;
  }

  bindFaultMatrix() {
    const faultBtns = document.querySelectorAll('.fault-btn');
    faultBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const fault = btn.getAttribute('data-fault');
        this.setFault(fault);
      });
    });
  }

  setFault(faultName) {
    this.physics.setFault(faultName);

    // Update active button state
    const faultBtns = document.querySelectorAll('.fault-btn');
    faultBtns.forEach(btn => {
      if (btn.getAttribute('data-fault') === faultName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update Fault Description Banner
    const banner = document.getElementById('faultStatusBanner');
    const tag = document.getElementById('faultTagText');
    const details = document.getElementById('faultDetailsText');

    tag.textContent = faultName;
    details.textContent = this.faultDescriptions[faultName] || 'Active engine fault injected.';

    if (faultName === 'NORMAL') {
      banner.classList.remove('anomaly');
    } else {
      banner.classList.add('anomaly');
    }
  }

  bindTelemetryControls() {
    const btnToggle = document.getElementById('btnToggleTelemetry');
    btnToggle.addEventListener('click', () => {
      if (this.telemetry.isStreaming) {
        this.telemetry.stop();
      } else {
        this.telemetry.start(() => this.physics.getTelemetryPacket());
      }
    });

    // Endpoint input update
    const inputEndpoint = document.getElementById('inputEndpoint');
    inputEndpoint.addEventListener('change', (e) => {
      this.telemetry.setEndpoint(e.target.value);
    });

    // Rate selector
    const selectRate = document.getElementById('selectStreamRate');
    selectRate.addEventListener('change', (e) => {
      this.telemetry.setInterval(parseInt(e.target.value));
    });

    // Manual Ping
    const btnPing = document.getElementById('btnManualPing');
    btnPing.addEventListener('click', async () => {
      const packet = this.physics.getTelemetryPacket();
      await this.telemetry.transmit(packet);
    });

    // Copy JSON
    const btnCopy = document.getElementById('btnCopyJson');
    btnCopy.addEventListener('click', () => {
      const packet = this.physics.getTelemetryPacket();
      navigator.clipboard.writeText(JSON.stringify(packet, null, 2)).then(() => {
        const notice = document.getElementById('packetCopyNotice');
        notice.textContent = 'COPIED TO CLIPBOARD ✓';
        setTimeout(() => { notice.textContent = ''; }, 2000);
      });
    });
  }

  bindCameraButtons() {
    const hudBtns = document.querySelectorAll('.hud-btn');
    hudBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        hudBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const view = btn.getAttribute('data-view');
        if (this.uav3d) {
          this.uav3d.setCameraView(view);
        }
      });
    });
  }

  bindGlobalActions() {
    // Run Demo
    const btnRunDemo = document.getElementById('btnRunDemo');
    btnRunDemo.addEventListener('click', () => {
      this.demo.startDemo();
    });

    // Cancel Demo
    const btnCancelDemo = document.getElementById('btnCancelDemo');
    btnCancelDemo.addEventListener('click', () => {
      this.demo.stopDemo();
    });

    // Reset Sim
    const btnReset = document.getElementById('btnResetSim');
    btnReset.addEventListener('click', () => {
      if (this.demo.isRunning) this.demo.stopDemo();
      this.physics.setControl('flightPhase', 'CRUISE');
      this.physics.setControl('throttle', 70);
      this.physics.setControl('altitude', 8000);
      this.physics.setControl('airspeed', 145);
      this.physics.setControl('heading', 270);
      this.physics.setControl('ambientTemp', 15);
      this.physics.setControl('engineLoad', 50);
      this.setFault('NORMAL');
      this.syncControlSliders();
    });
  }

  handleTelemetryStatusChange(data) {
    const pill = document.getElementById('telemetryStatusPill');
    const pillText = document.getElementById('telemetryStatusText');
    const btnIcon = document.getElementById('telemetryBtnIcon');
    const btnLabel = document.getElementById('telemetryBtnLabel');
    const metricLink = document.getElementById('metricLinkStatus');
    const metricPackets = document.getElementById('metricPacketsSent');
    const metricLatency = document.getElementById('metricLatency');

    metricPackets.textContent = data.packetsSent;
    metricLatency.textContent = data.latency > 0 ? `${data.latency} ms` : '-- ms';

    if (data.isStreaming) {
      btnIcon.textContent = '⏹';
      btnLabel.textContent = 'STOP STREAM';
    } else {
      btnIcon.textContent = '⚡';
      btnLabel.textContent = 'START TELEMETRY';
    }

    if (data.status === 'CONNECTED') {
      pill.className = 'status-pill streaming-active';
      pillText.textContent = 'LIVE STREAM: CONNECTED';
      metricLink.textContent = 'CONNECTED';
      metricLink.style.color = 'var(--emerald-nominal)';
    } else if (data.status === 'CONNECTING') {
      pill.className = 'status-pill';
      pillText.textContent = 'CONNECTING...';
      metricLink.textContent = 'CONNECTING';
      metricLink.style.color = 'var(--cyan-primary)';
    } else {
      // Local simulation mode fallback
      pill.className = 'status-pill local-mode';
      pillText.textContent = 'LOCAL SIMULATION MODE';
      metricLink.textContent = 'LOCAL SIM';
      metricLink.style.color = 'var(--amber-warning)';
    }
  }

  handlePacketTransmitted(packet, status, latency) {
    const lastDispatch = document.getElementById('metricLastDispatch');
    const d = new Date(packet.timestamp);
    lastDispatch.textContent = d.toLocaleTimeString();

    // Update JSON viewer display
    const jsonDisplay = document.getElementById('jsonPacketDisplay');
    jsonDisplay.textContent = JSON.stringify(packet, null, 2);
  }

  updateDemoBanner(demoState) {
    const banner = document.getElementById('demoActiveBanner');
    const title = document.getElementById('demoBannerTitle');
    const desc = document.getElementById('demoBannerDesc');
    const timer = document.getElementById('demoStepTimer');

    if (demoState.isRunning) {
      banner.style.display = 'flex';
      title.textContent = demoState.stepName;
      desc.textContent = demoState.stepDescription;
      timer.textContent = `${demoState.remainingInStep}s`;
      this.syncControlSliders();
    } else {
      banner.style.display = 'none';
    }
  }

  /**
   * Main 60Hz Physics & Rendering Loop
   */
  mainLoop(timestamp) {
    const dt = Math.min(0.1, (timestamp - this.lastTime) / 1000);
    this.lastTime = timestamp;

    // 1. Advance Physics Engine
    this.physics.update(dt);

    // 2. Render 3D UAV
    if (this.uav3d) {
      this.uav3d.render(this.physics.state, this.physics.controls);
    }

    // 3. Update HUD & UI (at 30-60Hz)
    this.updateHUD();
    this.updateSensorCards();

    // 4. Update Oscilloscope Graphs (throttled to 10Hz to save CPU)
    if (timestamp - this.lastGraphUpdateTime > 100) {
      this.graphs.update(this.physics.state, this.physics);
      this.lastGraphUpdateTime = timestamp;

      // Update JSON preview if not streaming
      if (!this.telemetry.isStreaming) {
        const jsonDisplay = document.getElementById('jsonPacketDisplay');
        if (jsonDisplay) {
          jsonDisplay.textContent = JSON.stringify(this.physics.getTelemetryPacket(), null, 2);
        }
      }
    }

    requestAnimationFrame((t) => this.mainLoop(t));
  }

  updateHUD() {
    const state = this.physics.state;
    const controls = this.physics.controls;

    document.getElementById('hudAirspeed').textContent = Math.round(controls.airspeed);
    document.getElementById('hudAltitude').textContent = Math.round(controls.altitude).toLocaleString();
    document.getElementById('hudHeading').textContent = Math.round(controls.heading);
    document.getElementById('hudThrottle').textContent = Math.round(controls.throttle);
    document.getElementById('hudRPM').textContent = Math.round(state.rpm);
    document.getElementById('hudFlightPhase').textContent = controls.flightPhase;
    document.getElementById('hudPitchAngle').textContent = `${state.pitch >= 0 ? '+' : ''}${state.pitch.toFixed(1)}°`;
  }

  updateSensorCards() {
    const state = this.physics.state;
    const envs = this.physics.sensorEnvelopes;

    const sensorKeys = [
      { key: 'rpm', val: Math.round(state.rpm), formatted: Math.round(state.rpm) },
      { key: 'cht', val: state.cht, formatted: state.cht.toFixed(1) },
      { key: 'egt', val: state.egt, formatted: state.egt.toFixed(1) },
      { key: 'oilPressure', val: state.oilPressure, formatted: state.oilPressure.toFixed(1) },
      { key: 'oilTemperature', val: state.oilTemperature, formatted: state.oilTemperature.toFixed(1) },
      { key: 'vibration', val: state.vibration, formatted: state.vibration.toFixed(1) },
      { key: 'fuelFlow', val: state.fuelFlow, formatted: state.fuelFlow.toFixed(1) },
      { key: 'fuelPressure', val: state.fuelPressure, formatted: state.fuelPressure.toFixed(1) },
      { key: 'map', val: state.map, formatted: state.map.toFixed(1) }
    ];

    sensorKeys.forEach(item => {
      const card = document.getElementById(`card_${item.key}`);
      const valEl = document.getElementById(`val_${item.key}`);
      const statusEl = document.getElementById(`status_${item.key}`);
      const barEl = document.getElementById(`bar_${item.key}`);
      const trendEl = document.getElementById(`trend_${item.key}`);

      if (!card || !valEl) return;

      // Value
      valEl.textContent = item.formatted;

      // Status
      const status = this.physics.getSensorStatus(item.key, item.val);
      card.className = `sensor-card ${status}`;
      if (statusEl) statusEl.textContent = status.toUpperCase();

      // Gauge Bar %
      const env = envs[item.key];
      if (env && barEl) {
        const pct = Math.max(0, Math.min(100, ((item.val - env.min) / (env.max - env.min)) * 100));
        barEl.style.width = `${pct}%`;
      }

      // Trend arrow
      if (trendEl) {
        const prev = this.prevSensorValues[item.key];
        if (prev !== undefined) {
          const delta = item.val - prev;
          const threshold = (env.max - env.min) * 0.003;
          if (delta > threshold) {
            trendEl.textContent = '↑';
            trendEl.className = 'sensor-trend trend-up';
          } else if (delta < -threshold) {
            trendEl.textContent = '↓';
            trendEl.className = 'sensor-trend trend-down';
          } else {
            trendEl.textContent = '→';
            trendEl.className = 'sensor-trend trend-flat';
          }
        }
        this.prevSensorValues[item.key] = item.val;
      }
    });
  }
}

// Instantiate and start when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  const app = new VirtualUAVSimulatorApp();
  app.init();
});
