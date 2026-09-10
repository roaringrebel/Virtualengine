import React, { useEffect, useRef, useState } from 'react';
import { Header } from './components/Header';
import { Sidebar, SidebarTab } from './components/Sidebar';
import { MissionMap } from './components/MissionMap';
import { MissionSetupPanel } from './components/MissionSetupPanel';
import { MissionReliabilityCard } from './components/MissionReliabilityCard';
import { EnginePanel } from './components/EnginePanel';
import { FlightControls } from './components/FlightControls';
import { FaultSimulation } from './components/FaultSimulation';
import { RealtimeGraphs } from './components/RealtimeGraphs';
import { TelemetryStream } from './components/TelemetryStream';
import { MissionTimeline } from './components/MissionTimeline';
import { SettingsView } from './components/SettingsView';
import { IntroSplash } from './components/IntroSplash';

import { SimulationEngine } from './simulation/simulationEngine';
import { TelemetryClient } from './telemetry/telemetryClient';
import { FaultSeverity, FaultType, SimulationState } from './types/simulation';
import { TelemetryClientStatus, TelemetryPacket } from './types/telemetry';
import { LocationCoord, MissionEventLog, Waypoint } from './types/mission';
import { DEFAULT_MISSION_WAYPOINTS } from './simulation/flightDynamicsModel';
import { REAL_WORLD_MISSION_PRESETS } from './simulation/geoMath';

export const App: React.FC = () => {
  // Central Simulation & Telemetry instances
  const simRef = useRef<SimulationEngine>(new SimulationEngine());
  const telemetryRef = useRef<TelemetryClient>(new TelemetryClient());

  // UI state synchronized with simulation engine
  const [simState, setSimState] = useState<SimulationState>(simRef.current.state);
  const [uavPos, setUavPos] = useState(simRef.current.uavPosition);
  const [telemetryStatus, setTelemetryStatus] = useState<TelemetryClientStatus>({
    endpoint: telemetryRef.current.endpoint,
    isStreaming: true,
    status: 'LOCAL_SIMULATION_MODE',
    packetsSent: 0,
    packetsFailed: 0,
    lastTransmissionTime: null,
    lastHttpStatus: null,
    lastError: null,
    latencyMs: 0,
    transmissionRateHz: 1,
    simulationId: simRef.current.simulationId,
    sequenceNumber: 0,
  });
  const [latestPacket, setLatestPacket] = useState<TelemetryPacket | null>(null);

  // Active Geographic Mission State (VIT-AP Default)
  const [currentSource, setCurrentSource] = useState<LocationCoord>(REAL_WORLD_MISSION_PRESETS[0].source);
  const [currentDestination, setCurrentDestination] = useState<LocationCoord>(REAL_WORLD_MISSION_PRESETS[0].destination);
  const [activeWaypoints, setActiveWaypoints] = useState<Waypoint[]>(DEFAULT_MISSION_WAYPOINTS);

  // Active workspace tab (Exact 7 workspaces in order: mission, 3d, flight, engine, telemetry, log, settings)
  const [activeTab, setActiveTab] = useState<SidebarTab>('mission');

  // Mission event logs
  const [eventLogs, setEventLogs] = useState<MissionEventLog[]>([
    { id: '1', simTimestamp: '10:40:12', message: 'Simulation initialized: Reduced-Order Rotax 912 ULS Physics Engine', category: 'INFO' },
    { id: '2', simTimestamp: '10:40:13', message: 'Geographic Mission Route Loaded: VIT-AP University -> Vijayawada Int Airport', category: 'INFO' }
  ]);

  const [showIntro, setShowIntro] = useState(true);
  const logIdCounter = useRef(3);

  const addEventLog = (message: string, category: MissionEventLog['category'] = 'INFO') => {
    const timeStr = new Date().toLocaleTimeString('en-GB');
    logIdCounter.current += 1;
    setEventLogs(prev => [...prev, { id: `${logIdCounter.current}-${Date.now()}`, simTimestamp: timeStr, message, category }]);
  };

  // Main Physics Simulation Loop (30-60Hz physics with throttled 10Hz React UI publishing)
  useEffect(() => {
    let lastPhysicsTime = performance.now();
    let lastUiPublishTime = performance.now();
    let frameId: number;

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - lastPhysicsTime) / 1000);
      lastPhysicsTime = now;

      // 1. High-frequency physical integration step (30-60 Hz)
      simRef.current.update(dt);

      // 2. Throttled UI State Publication (10 Hz = 100ms interval)
      if (now - lastUiPublishTime >= 100) {
        lastUiPublishTime = now;
        setSimState({ ...simRef.current.state });
        setUavPos({ ...simRef.current.uavPosition });
      }

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, []);

  // Telemetry client subscription
  useEffect(() => {
    const client = telemetryRef.current;
    const unsub = client.subscribe(
      (status) => setTelemetryStatus(status),
      (packet) => setLatestPacket(packet)
    );

    client.startStreaming(() => simRef.current.getTelemetryPacket());

    return () => {
      unsub();
      client.stopStreaming();
    };
  }, []);

  const completionLoggedRef = useRef(false);
  const recoveryLoggedRef = useRef(false);
  const persistenceLoggedRef = useRef(false);
  const lastLoggedPhaseRef = useRef<string>('');

  // Comprehensive Mission Lifecycle & State Transition Event Logger
  useEffect(() => {
    const phase = simState.flightPhase;
    if (phase !== lastLoggedPhaseRef.current && phase !== 'PARKED' && phase !== 'STANDBY') {
      lastLoggedPhaseRef.current = phase;
      if (phase === 'STARTUP') {
        addEventLog('Engine startup sequence initiated: Cranking starter motor', 'ENGINE');
      } else if (phase === 'TAKEOFF') {
        addEventLog('Takeoff roll active: Ground speed accelerating along runway', 'FLIGHT');
      } else if (phase === 'CLIMB') {
        addEventLog('Positive climb established: Ascending to tactical cruise altitude', 'FLIGHT');
      } else if (phase === 'CRUISE') {
        addEventLog('UAV stabilized at cruise altitude (6,500 ft, 145 km/h TAS)', 'FLIGHT');
      } else if (phase === 'DESCENT') {
        addEventLog('Descent initiated: Controlled altitude stepdown toward destination corridor', 'FLIGHT');
      } else if (phase === 'APPROACH') {
        addEventLog(`Approach pattern active: Sequencing alignment with ${currentDestination.name}`, 'FLIGHT');
      } else if (phase === 'LANDING') {
        addEventLog('Terminal landing flare active: Airspeed reducing to touchdown threshold', 'FLIGHT');
      } else if (phase === 'EMERGENCY_DIVERT') {
        const elp = simState.reliability.emergencyRecovery?.selectedELP;
        addEventLog(`EMERGENCY RECOVERY: Original mission aborted. Diverting to ${elp ? elp.id + ' (' + elp.name + ')' : 'ELP'}`, 'FAULT');
      } else if (phase === 'RECOVERY_APPROACH') {
        addEventLog('Emergency approach sector active: Lining up for emergency touchdown', 'FLIGHT');
      }
    }

    // Critical Persistence Tracking Logs
    const critSec = simState.reliability.criticalPersistenceSeconds;
    if (critSec > 0 && !persistenceLoggedRef.current) {
      persistenceLoggedRef.current = true;
      addEventLog('Critical propulsion condition detected: In-flight persistence timer active (0/30s)', 'FAULT');
    } else if (critSec === 0 && persistenceLoggedRef.current && !simState.reliability.emergencyRecoveryTriggered) {
      persistenceLoggedRef.current = false;
      addEventLog('Critical condition cleared: Persistence timer reset to 0/30s', 'INFO');
    }

    // Emergency Recovery Triggered
    if (simState.reliability.emergencyRecoveryTriggered && !recoveryLoggedRef.current) {
      recoveryLoggedRef.current = true;
      addEventLog('CRITICAL PERSISTENCE (30/30 sec) EXCEEDED! Emergency Recovery Initiated.', 'FAULT');
      addEventLog('Evaluating pre-surveyed Emergency Landing Points (ELPs)...', 'MISSION');
    }

    // Mission Completed Normally
    if (simState.flightPhase === 'COMPLETED' && !completionLoggedRef.current) {
      completionLoggedRef.current = true;
      addEventLog(`Destination Reached: ${currentDestination.name}. Safe Landing Completed!`, 'MISSION');
    } else if (simState.flightPhase === 'RECOVERED' && !completionLoggedRef.current) {
      completionLoggedRef.current = true;
      const elp = simState.reliability.emergencyRecovery?.selectedELP;
      addEventLog(`MISSION RECOVERED: Safe emergency touchdown completed at ${elp ? elp.id + ' (' + elp.name + ')' : 'ELP'}!`, 'MISSION');
    } else if (!simState.isCompleted) {
      completionLoggedRef.current = false;
    }
  }, [simState.flightPhase, simState.isCompleted, simState.reliability, currentDestination.name]);

  // Route update handler
  const handleUpdateRoute = (source: LocationCoord, destination: LocationCoord, waypoints: Waypoint[]) => {
    setCurrentSource(source);
    setCurrentDestination(destination);
    setActiveWaypoints(waypoints);
    simRef.current.setMissionRoute(waypoints);
    setSimState({ ...simRef.current.state });
    setUavPos({ ...simRef.current.uavPosition });
    addEventLog(`Mission Route Updated: ${source.name} -> ${destination.name} (${waypoints.length} WPs)`, 'FLIGHT');
  };

  // Handlers for Engine & Simulation Controls
  const handleStartEngine = () => {
    simRef.current.setEngineOn(true);
    setSimState({ ...simRef.current.state });
    addEventLog('ENGINE START: Ignition ON, Rotax 912 ULS aero-piston running', 'ENGINE');
  };

  const handleStopEngine = () => {
    simRef.current.setEngineOn(false);
    setSimState({ ...simRef.current.state });
    addEventLog('ENGINE STOP: Ignition CUTOFF, engine spooled down to Standby (0 RPM)', 'ENGINE');
  };

  const handleTogglePause = () => {
    const nextPaused = !simState.isPaused;
    simRef.current.setPause(nextPaused);
    setSimState({ ...simRef.current.state });
    addEventLog(nextPaused ? 'Simulation PAUSED' : 'Simulation RESUMED', 'INFO');
  };

  const handleChangeSpeed = (speed: number) => {
    simRef.current.setSpeedMultiplier(speed);
    setSimState({ ...simRef.current.state });
    addEventLog(`Simulation Speed set to ${speed}x`, 'INFO');
  };

  const handleResetMission = () => {
    simRef.current.resetSimulation();
    setSimState({ ...simRef.current.state });
    setUavPos({ ...simRef.current.uavPosition });
    addEventLog('MISSION RESET: Aircraft returned to Base runway. State cleared.', 'INFO');
  };

  const handleChangeControl = <K extends keyof SimulationState['controls']>(key: K, value: SimulationState['controls'][K]) => {
    simRef.current.setControl(key, value);
    setSimState({ ...simRef.current.state });
  };

  const handleInjectFault = (fault: FaultType, severity: FaultSeverity) => {
    simRef.current.setFault(fault, severity);
    setSimState({ ...simRef.current.state });
    addEventLog(`Fault Injected: ${fault} (Severity: ${severity})`, 'FAULT');
  };

  const handleClearFault = () => {
    simRef.current.clearFault();
    setSimState({ ...simRef.current.state });
    addEventLog('Fault Cleared. System restored to NORMAL equilibrium.', 'INFO');
  };

  const handleTabSelect = (tab: SidebarTab) => {
    setActiveTab(tab);
  };

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex flex-col font-sans text-[#1F2937]">
      {/* Top Header with Clean Status Indicators & Time */}
      <Header 
        telemetryStatus={telemetryStatus} 
        engineOn={simState.engineOn}
        isPaused={simState.isPaused}
        isCompleted={simState.isCompleted}
        speedMultiplier={simState.speedMultiplier}
        onTogglePause={handleTogglePause}
        onChangeSpeed={handleChangeSpeed}
        onResetMission={handleResetMission}
        onShowIntro={() => setShowIntro(true)}
      />

      {/* Main Container: Left Sidebar + Exactly ONE Active Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Navigation Sidebar (Order: Mission, 3D View, Flight, Engine, Telemetry, Log, Settings) */}
        <Sidebar activeTab={activeTab} onSelectTab={handleTabSelect} />

        {/* Dashboard Workspace Content */}
        <main className="flex-1 p-3 overflow-y-auto max-w-[1780px] mx-auto space-y-3">
          
          {/* ============================================================== */}
          {/* 1. WORKSPACE: MISSION (PLANNING & RELIABILITY — NO MAP HERE)   */}
          {/* ============================================================== */}
          {activeTab === 'mission' && (
            <div className="grid grid-cols-12 gap-4">
              {/* Left Column: Mission Setup & Geodesic Route Planning */}
              <div className="col-span-12 lg:col-span-6">
                <MissionSetupPanel
                  currentSource={currentSource}
                  currentDestination={currentDestination}
                  activeWaypoints={activeWaypoints}
                  engineOn={simState.engineOn}
                  isPaused={simState.isPaused}
                  navigationMode={simState.controls.navigationMode}
                  onUpdateRoute={handleUpdateRoute}
                  onStartEngine={handleStartEngine}
                  onStopEngine={handleStopEngine}
                  onTogglePause={handleTogglePause}
                  onResetMission={handleResetMission}
                  onToggleAutopilot={(mode) => handleChangeControl('navigationMode', mode)}
                />
              </div>

              {/* Right Column: Mission Reliability, Health & Capability Margin */}
              <div className="col-span-12 lg:col-span-6">
                <MissionReliabilityCard
                  reliability={simState.reliability}
                  flight={simState.flight}
                  sensors={simState.sensors}
                  fault={simState.fault}
                  flightPhase={simState.flightPhase}
                  engineOn={simState.engineOn}
                  source={currentSource}
                  destination={currentDestination}
                  activeWaypoints={activeWaypoints}
                />
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* 2. WORKSPACE: MAP (GEOGRAPHIC FLIGHT MAP & TRACKING)           */}
          {/* ============================================================== */}
          {activeTab === 'map' && (
            <div className="w-full h-[calc(100vh-125px)] min-h-[580px]">
              <MissionMap
                uavPosition={uavPos}
                flightPhase={simState.flightPhase}
                engineOn={simState.engineOn}
                flight={simState.flight}
                reliability={simState.reliability}
                fault={simState.fault}
                waypoints={activeWaypoints}
                source={currentSource}
                destination={currentDestination}
              />
            </div>
          )}

          {/* ============================================================== */}
          {/* 3. WORKSPACE: FLIGHT (FLIGHT DYNAMICS & CONTROLS)              */}
          {/* ============================================================== */}
          {activeTab === 'flight' && (
            <div>
              <FlightControls
                controls={simState.controls}
                flight={simState.flight}
                onChangeControl={handleChangeControl}
                engineOn={simState.engineOn}
              />
            </div>
          )}

          {/* ============================================================== */}
          {/* 4. WORKSPACE: ENGINE (ENGINE HEALTH & FAULT SIMULATION)        */}
          {/* ============================================================== */}
          {activeTab === 'engine' && (
            <div className="space-y-4">
              {/* Top: Engine Status Banner, Live Vibration Oscilloscope & 10 Primary Sensor Cards */}
              <EnginePanel
                engine={simState.engine}
                sensors={simState.sensors}
                engineOn={simState.engineOn}
                liveWaveform={simState.liveWaveform}
                onStartEngine={handleStartEngine}
                onStopEngine={handleStopEngine}
              />

              {/* Bottom Row: Fault Simulation on Left, Real-Time Engine Trends on Right */}
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12 lg:col-span-5">
                  <FaultSimulation
                    faultState={simState.fault}
                    onInjectFault={handleInjectFault}
                    onClearFault={handleClearFault}
                    engineOn={simState.engineOn}
                  />
                </div>
                <div className="col-span-12 lg:col-span-7">
                  <RealtimeGraphs
                    sensors={simState.sensors}
                    engineOn={simState.engineOn}
                    airspeed={simState.flight.airspeed}
                    history={simState.history}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* 5. WORKSPACE: TELEMETRY (LIVE DATA & SYSTEM INTEGRATION)       */}
          {/* ============================================================== */}
          {activeTab === 'telemetry' && (
            <div className="space-y-4">
              <TelemetryStream
                telemetryStatus={telemetryStatus}
                latestPacket={latestPacket}
                onStartStreaming={() => telemetryRef.current.startStreaming(() => simRef.current.getTelemetryPacket())}
                onStopStreaming={() => telemetryRef.current.stopStreaming()}
                onUpdateEndpoint={(url) => telemetryRef.current.setEndpoint(url)}
              />
            </div>
          )}

          {/* ============================================================== */}
          {/* 6. WORKSPACE: LOG (MISSION & EVENT LOG)                        */}
          {/* ============================================================== */}
          {activeTab === 'log' && (
            <div>
              <MissionTimeline logs={eventLogs} currentFlightPhase={simState.flightPhase} />
            </div>
          )}

          {/* ============================================================== */}
          {/* 7. WORKSPACE: SETTINGS (SIMULATOR CONFIGURATION)               */}
          {/* ============================================================== */}
          {activeTab === 'settings' && (
            <div>
              <SettingsView
                apiEndpoint={telemetryStatus.endpoint}
                onUpdateEndpoint={(url) => telemetryRef.current.setEndpoint(url)}
                speedMultiplier={simState.speedMultiplier}
                onUpdateSpeed={(speed) => { simRef.current.setSpeedMultiplier(speed); }}
                sensorNoiseEnabled={simState.sensorNoiseEnabled}
                onToggleNoise={(enabled) => { simRef.current.state.sensorNoiseEnabled = enabled; }}
                flight={simState.flight}
                enginePowerHp={simState.engine.powerHp}
                efficiencyLossRatio={simState.engine.efficiencyLossRatio || 0}
                simTimeSeconds={simState.simTimeSeconds}
                navigationMode={simState.controls.navigationMode}
                engineOn={simState.engineOn}
              />
            </div>
          )}

        </main>
      </div>

      {/* Intro Animation Splash Screen on Startup */}
      {showIntro && <IntroSplash onComplete={() => setShowIntro(false)} />}
    </div>
  );
};

export default App;
