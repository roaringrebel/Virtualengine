import React, { useEffect, useRef, useState } from 'react';
import { Header } from './components/Header';
import { Sidebar, SidebarTab } from './components/Sidebar';
import { MissionMap } from './components/MissionMap';
import { EnginePanel } from './components/EnginePanel';
import { FlightControls } from './components/FlightControls';
import { FaultSimulation } from './components/FaultSimulation';
import { RealtimeGraphs } from './components/RealtimeGraphs';
import { TelemetryStream } from './components/TelemetryStream';
import { MissionTimeline } from './components/MissionTimeline';
import { DemoMode, DEMO_STAGES } from './components/DemoMode';
import { SystemArchitecture } from './components/SystemArchitecture';
import { FlightDebugPanel } from './components/FlightDebugPanel';
import { SettingsModal } from './components/SettingsModal';
import { MissionLogModal } from './components/MissionLogModal';
import { TelemetryModal } from './components/TelemetryModal';
import { EngineDiagnosticsModal } from './components/EngineDiagnosticsModal';

import { SimulationEngine } from './simulation/simulationEngine';
import { TelemetryClient } from './telemetry/telemetryClient';
import { FaultSeverity, FaultType, SimulationState } from './types/simulation';
import { TelemetryClientStatus, TelemetryPacket } from './types/telemetry';
import { MissionEventLog } from './types/mission';

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

  // Active tab & modal states
  const [activeTab, setActiveTab] = useState<SidebarTab>('mission');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [isTelemetryModalOpen, setIsTelemetryModalOpen] = useState(false);
  const [isEngineModalOpen, setIsEngineModalOpen] = useState(false);

  // Mission event logs
  const [eventLogs, setEventLogs] = useState<MissionEventLog[]>([
    { id: '1', simTimestamp: '10:40:12', message: 'Simulation initialized: Reduced-Order Rotax 912 ULS Physics Engine', category: 'INFO' },
  ]);

  // Demo mode state
  const [isDemoRunning, setIsDemoRunning] = useState(false);
  const [demoStep, setDemoStep] = useState(1);
  const [demoStepRemaining, setDemoStepRemaining] = useState(8);

  const addEventLog = (message: string, category: MissionEventLog['category'] = 'INFO') => {
    const timeStr = new Date().toLocaleTimeString('en-GB');
    setEventLogs(prev => [...prev, { id: `${Date.now()}-${Math.random()}`, simTimestamp: timeStr, message, category }]);
  };

  // Main 30Hz Simulation Loop
  useEffect(() => {
    let lastTime = performance.now();
    let frameId: number;

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      simRef.current.update(dt);
      setSimState({ ...simRef.current.state });
      setUavPos({ ...simRef.current.uavPosition });

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

  // 8-Stage Deterministic Demo Sequence Orchestrator
  useEffect(() => {
    if (!isDemoRunning) return;

    const timer = setInterval(() => {
      setDemoStepRemaining(prev => {
        if (prev <= 1) {
          // Advance to next stage
          const nextStep = demoStep + 1;
          if (nextStep === 2) {
            // Stage 2: Takeoff & Climb
            setDemoStep(2);
            simRef.current.setControl('throttle', 92);
            simRef.current.setControl('targetAltitude', 4500);
            simRef.current.setControl('targetAirspeed', 135);
            addEventLog('Demo Stage 2: Takeoff thrust applied (92%), climbing to 4,500 ft', 'FLIGHT');
            return 8;
          } else if (nextStep === 3) {
            // Stage 3: Waypoint Auto Cruise
            setDemoStep(3);
            simRef.current.setControl('navigationMode', 'WAYPOINT_ROUTE');
            simRef.current.setControl('targetAltitude', 8000);
            simRef.current.setControl('targetAirspeed', 145);
            addEventLog('Demo Stage 3: Waypoint Autopilot engaged along tactical route corridor', 'FLIGHT');
            return 8;
          } else if (nextStep === 4) {
            // Stage 4: High Engine Load
            setDemoStep(4);
            simRef.current.setControl('throttle', 85);
            simRef.current.setControl('engineLoad', 85);
            addEventLog('Demo Stage 4: Engine load increased to 85% for payload surveillance', 'ENGINE');
            return 6;
          } else if (nextStep === 5) {
            // Stage 5: Inject Excessive Vibration
            setDemoStep(5);
            simRef.current.setFault('EXCESSIVE_VIBRATION', 'HIGH');
            addEventLog('Demo Stage 5: FAULT INJECTED — Excessive Vibration (HIGH, > 6.5 mm/s RMS)', 'FAULT');
            return 8;
          } else if (nextStep === 6) {
            // Stage 6: Power Sag & Airspeed Decay
            setDemoStep(6);
            addEventLog('Demo Stage 6: Engine power derated by 18%. RPM instability and airspeed decay observed.', 'ENGINE');
            return 8;
          } else if (nextStep === 7) {
            // Stage 7: Telemetry Streaming
            setDemoStep(7);
            addEventLog('Demo Stage 7: Live telemetry dispatched to Digital Twin (Website 2) with anomaly alerts.', 'TELEMETRY');
            return 8;
          } else if (nextStep === 8) {
            // Stage 8: Fault Clearance & RTB
            setDemoStep(8);
            simRef.current.clearFault();
            simRef.current.setControl('navigationMode', 'MANUAL_PILOT');
            simRef.current.setControl('targetAltitude', 3500);
            simRef.current.setControl('throttle', 70);
            simRef.current.setControl('engineLoad', 70);
            addEventLog('Demo Stage 8: Fault CLEARED. Normal engine thermodynamics restored. Vectoring RTB.', 'INFO');
            return 8;
          } else {
            // Finish Demo
            setIsDemoRunning(false);
            setDemoStep(1);
            simRef.current.clearFault();
            addEventLog('Demo Scenario Finished: All 8 judging stages completed successfully.', 'INFO');
            return 8;
          }
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isDemoRunning, demoStep]);

  // Handlers for Engine & Simulation Controls
  const handleStartEngine = () => {
    simRef.current.setEngineOn(true);
    addEventLog('ENGINE START: Ignition ON, Rotax 912 ULS aero-piston running', 'ENGINE');
  };

  const handleStopEngine = () => {
    simRef.current.setEngineOn(false);
    if (isDemoRunning) setIsDemoRunning(false);
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
  };

  const handleInjectFault = (fault: FaultType, severity: FaultSeverity) => {
    simRef.current.setFault(fault, severity);
    addEventLog(`Fault Injected: ${fault} (Severity: ${severity})`, 'FAULT');
  };

  const handleClearFault = () => {
    simRef.current.clearFault();
    addEventLog('Fault Cleared. System restored to NORMAL equilibrium.', 'INFO');
  };

  const handleStartDemo = () => {
    setIsDemoRunning(true);
    setDemoStep(1);
    setDemoStepRemaining(8);
    simRef.current.setEngineOn(true);
    simRef.current.setControl('throttle', 40);
    simRef.current.setControl('engineLoad', 50);
    simRef.current.clearFault();
    addEventLog('Demo Scenario Started: Stage 1 — Engine Startup & Systems Check', 'INFO');
  };

  const handleStopDemo = () => {
    setIsDemoRunning(false);
    setDemoStep(1);
    simRef.current.clearFault();
    addEventLog('Demo Scenario Aborted.', 'INFO');
  };

  const handleTabSelect = (tab: SidebarTab) => {
    setActiveTab(tab);
    if (tab === 'settings') {
      setIsSettingsOpen(true);
    } else if (tab === 'log') {
      setIsLogOpen(true);
    } else if (tab === 'telemetry') {
      setIsTelemetryModalOpen(true);
    } else if (tab === 'engine') {
      setIsEngineModalOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col font-sans">
      {/* Top Header with Simulation Speed, Pause & Notices */}
      <Header 
        telemetryStatus={telemetryStatus} 
        engineOn={simState.engineOn}
        isPaused={simState.isPaused}
        speedMultiplier={simState.speedMultiplier}
        onTogglePause={handleTogglePause}
        onChangeSpeed={handleChangeSpeed}
        onResetMission={handleResetMission}
      />

      {/* Main Container: Sidebar + Dashboard Grid */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Navigation Sidebar */}
        <Sidebar activeTab={activeTab} onSelectTab={handleTabSelect} />

        {/* Dashboard Grid Content */}
        <main className="flex-1 p-3 overflow-y-auto max-w-[1700px] mx-auto space-y-3">
          
          {/* Row 1: Mission Map (3D Continuous Left) + Rotax 912 Engine Panel (Right) */}
          <div className="grid grid-cols-12 gap-3 min-h-[380px]">
            <div className="col-span-12 lg:col-span-7">
              <MissionMap
                uavPosition={uavPos}
                flightPhase={simState.flightPhase}
                engineOn={simState.engineOn}
                flight={simState.flight}
              />
            </div>
            <div className="col-span-12 lg:col-span-5">
              <EnginePanel
                engine={simState.engine}
                sensors={simState.sensors}
                engineOn={simState.engineOn}
                onStartEngine={handleStartEngine}
                onStopEngine={handleStopEngine}
              />
            </div>
          </div>

          {/* Collapsible Flight Model Debug Panel */}
          <FlightDebugPanel
            flight={simState.flight}
            enginePowerHp={simState.engine.powerHp}
            efficiencyLossRatio={simState.engine.efficiencyLossRatio || 0}
            speedMultiplier={simState.speedMultiplier}
            simTimeSeconds={simState.simTimeSeconds}
            navigationMode={simState.controls.navigationMode}
            engineOn={simState.engineOn}
          />

          {/* Row 2: Flight Controls + Fault Simulation + Real-time Graphs (3 Cards) */}
          <div className="grid grid-cols-12 gap-3 min-h-[200px]">
            <div className="col-span-12 md:col-span-4">
              <FlightControls
                controls={simState.controls}
                flight={simState.flight}
                onChangeControl={handleChangeControl}
                engineOn={simState.engineOn}
              />
            </div>
            <div className="col-span-12 md:col-span-4">
              <FaultSimulation
                faultState={simState.fault}
                onInjectFault={handleInjectFault}
                onClearFault={handleClearFault}
                engineOn={simState.engineOn}
              />
            </div>
            <div className="col-span-12 md:col-span-4">
              <RealtimeGraphs
                sensors={simState.sensors}
                engineOn={simState.engineOn}
                airspeed={simState.flight.airspeed}
              />
            </div>
          </div>

          {/* Row 3: Telemetry Stream + Mission Timeline + Demo Mode + System Architecture (4 Cards) */}
          <div className="grid grid-cols-12 gap-3 min-h-[175px]">
            <div className="col-span-12 md:col-span-4">
              <TelemetryStream
                telemetryStatus={telemetryStatus}
                latestPacket={latestPacket}
                onStartStreaming={() => telemetryRef.current.startStreaming(() => simRef.current.getTelemetryPacket())}
                onStopStreaming={() => telemetryRef.current.stopStreaming()}
                onUpdateEndpoint={(url) => telemetryRef.current.setEndpoint(url)}
              />
            </div>
            <div className="col-span-12 sm:col-span-4 md:col-span-3">
              <MissionTimeline logs={eventLogs} />
            </div>
            <div className="col-span-12 sm:col-span-4 md:col-span-2">
              <DemoMode
                isDemoRunning={isDemoRunning}
                demoStep={demoStep}
                demoStepRemaining={demoStepRemaining}
                onStartDemo={handleStartDemo}
                onStopDemo={handleStopDemo}
              />
            </div>
            <div className="col-span-12 sm:col-span-4 md:col-span-3">
              <SystemArchitecture />
            </div>
          </div>

        </main>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        apiEndpoint={telemetryStatus.endpoint}
        onUpdateEndpoint={(url) => telemetryRef.current.setEndpoint(url)}
        speedMultiplier={simState.speedMultiplier}
        onUpdateSpeed={(speed) => { simRef.current.setSpeedMultiplier(speed); }}
        sensorNoiseEnabled={simState.sensorNoiseEnabled}
        onToggleNoise={(enabled) => { simRef.current.state.sensorNoiseEnabled = enabled; }}
      />

      {/* Mission Log Modal */}
      <MissionLogModal
        isOpen={isLogOpen}
        onClose={() => setIsLogOpen(false)}
        logs={eventLogs}
      />

      {/* Telemetry Inspector Modal */}
      <TelemetryModal
        isOpen={isTelemetryModalOpen}
        onClose={() => setIsTelemetryModalOpen(false)}
        telemetryStatus={telemetryStatus}
        latestPacket={latestPacket}
        onTransmitManual={() => telemetryRef.current.transmit(simRef.current.getTelemetryPacket())}
      />

      {/* Engine Diagnostics Modal */}
      <EngineDiagnosticsModal
        isOpen={isEngineModalOpen}
        onClose={() => setIsEngineModalOpen(false)}
        engine={simState.engine}
        thermal={simState.thermal}
        sensors={simState.sensors}
        engineOn={simState.engineOn}
      />
    </div>
  );
};

export default App;
