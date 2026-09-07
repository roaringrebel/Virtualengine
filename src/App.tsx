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
import { SystemArchitecture } from './components/SystemArchitecture';
import { SettingsView } from './components/SettingsView';

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

  // Demo mode state
  const [isDemoRunning, setIsDemoRunning] = useState(false);
  const [demoStep, setDemoStep] = useState(1);
  const [demoStepRemaining, setDemoStepRemaining] = useState(8);

  const addEventLog = (message: string, category: MissionEventLog['category'] = 'INFO') => {
    const timeStr = new Date().toLocaleTimeString('en-GB');
    setEventLogs(prev => [...prev, { id: `${Date.now()}-${Math.random()}`, simTimestamp: timeStr, message, category }]);
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

  // 12-Stage Deterministic SIH Demo Sequence Orchestrator
  useEffect(() => {
    if (!isDemoRunning) return;

    const timer = setInterval(() => {
      setDemoStepRemaining(prev => {
        if (prev <= 1) {
          const nextStep = demoStep + 1;
          if (nextStep === 2) {
            setDemoStep(2);
            simRef.current.setEngineOn(true);
            simRef.current.setControl('throttle', 30);
            addEventLog('Demo Stage 2: Ignition ON, Rotax 912 spooling to Idle (1,600 RPM)', 'ENGINE');
            return 7;
          } else if (nextStep === 3) {
            setDemoStep(3);
            simRef.current.setControl('throttle', 70);
            addEventLog('Demo Stage 3: Throttle advanced to 70%, ground roll initiated', 'FLIGHT');
            return 7;
          } else if (nextStep === 4) {
            setDemoStep(4);
            simRef.current.setControl('throttle', 90);
            simRef.current.setControl('targetAltitude', 4500);
            simRef.current.setControl('targetAirspeed', 135);
            addEventLog('Demo Stage 4: Takeoff achieved! Positive VSI climb vectoring to 4,500 ft', 'FLIGHT');
            return 8;
          } else if (nextStep === 5) {
            setDemoStep(5);
            simRef.current.setControl('navigationMode', 'WAYPOINT_ROUTE');
            simRef.current.setControl('targetAltitude', 6500);
            simRef.current.setControl('targetAirspeed', 145);
            addEventLog('Demo Stage 5: Waypoint Autopilot engaged along tactical mission corridor (VIT-AP -> VGA)', 'FLIGHT');
            return 8;
          } else if (nextStep === 6) {
            setDemoStep(6);
            addEventLog('Demo Stage 6: Aircraft at CRUISE (6,500 ft, 145 km/h TAS)', 'FLIGHT');
            return 8;
          } else if (nextStep === 7) {
            setDemoStep(7);
            simRef.current.setFault('EXCESSIVE_VIBRATION', 'MEDIUM');
            addEventLog('Demo Stage 7: FAULT INJECTED — Excessive Vibration (> 6.5 mm/s RMS)', 'FAULT');
            return 8;
          } else if (nextStep === 8) {
            setDemoStep(8);
            addEventLog('Demo Stage 8: Vibration elevated, power sag observed. Decision: CAUTION', 'ENGINE');
            return 8;
          } else if (nextStep === 9) {
            setDemoStep(9);
            simRef.current.setFault('OVERHEATING', 'HIGH');
            addEventLog('Demo Stage 9: SEVERE OVERHEATING injected (CHT > 175°C, RUL < 5h). Decision: NO-GO!', 'FAULT');
            return 8;
          } else if (nextStep === 10) {
            setDemoStep(10);
            simRef.current.clearFault();
            addEventLog('Demo Stage 10: Fault CLEARED. Thermodynamics cooling, SOH recovering (92%), Decision: GO', 'INFO');
            return 8;
          } else if (nextStep === 11) {
            setDemoStep(11);
            simRef.current.setControl('navigationMode', 'WAYPOINT_ROUTE');
            simRef.current.setControl('targetAltitude', 3000);
            simRef.current.setControl('throttle', 75);
            addEventLog('Demo Stage 11: Route progression active towards Destination approach', 'FLIGHT');
            return 8;
          } else if (nextStep === 12) {
            setDemoStep(12);
            simRef.current.setControl('targetAltitude', 0);
            simRef.current.setControl('targetAirspeed', 80);
            simRef.current.setControl('throttle', 40);
            addEventLog('Demo Stage 12: Recovery approach vector to destination runway. Mission completed.', 'INFO');
            return 8;
          } else {
            setIsDemoRunning(false);
            setDemoStep(1);
            simRef.current.clearFault();
            addEventLog('Demo Scenario Finished: All 12 judging stages completed successfully.', 'INFO');
            return 8;
          }
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isDemoRunning, demoStep]);

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
    if (isDemoRunning) setIsDemoRunning(false);
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
    if (isDemoRunning) setIsDemoRunning(false);
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

  const handleStartDemo = () => {
    setIsDemoRunning(true);
    setDemoStep(1);
    setDemoStepRemaining(7);
    simRef.current.setEngineOn(false);
    simRef.current.clearFault();
    addEventLog('Demo Scenario Started: Stage 1 — Base Airfield Standby (Decision: GO)', 'INFO');
  };

  const handleStopDemo = () => {
    setIsDemoRunning(false);
    setDemoStep(1);
    simRef.current.clearFault();
    addEventLog('Demo Scenario Aborted.', 'INFO');
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
        speedMultiplier={simState.speedMultiplier}
        onTogglePause={handleTogglePause}
        onChangeSpeed={handleChangeSpeed}
        onResetMission={handleResetMission}
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
          {/* 2. WORKSPACE: 3D VIEW (GEOGRAPHIC FLIGHT VISUALIZATION & MAP)   */}
          {/* ============================================================== */}
          {activeTab === '3d' && (
            <div className="w-full h-[calc(100vh-80px)] min-h-[620px]">
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
              {/* Top: Engine Status Banner & 9 Sensor Grid */}
              <EnginePanel
                engine={simState.engine}
                sensors={simState.sensors}
                engineOn={simState.engineOn}
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

              <SystemArchitecture />
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
                isDemoRunning={isDemoRunning}
                demoStep={demoStep}
                demoStepRemaining={demoStepRemaining}
                onStartDemo={handleStartDemo}
                onStopDemo={handleStopDemo}
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

    </div>
  );
};

export default App;
