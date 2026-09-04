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
import { DemoMode } from './components/DemoMode';
import { SystemArchitecture } from './components/SystemArchitecture';
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
    packetsSent: 1248,
    packetsFailed: 0,
    lastTransmissionTime: '10:42:18',
    latencyMs: 14,
    transmissionRateHz: 1,
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
    { id: '1', simTimestamp: '10:40:12', message: 'Simulation initialized in Standby mode', category: 'INFO' },
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

  // Demo Sequence Orchestrator
  useEffect(() => {
    if (!isDemoRunning) return;

    const timer = setInterval(() => {
      setDemoStepRemaining(prev => {
        if (prev <= 1) {
          // Advance demo step
          if (demoStep === 1) {
            setDemoStep(2);
            simRef.current.setControl('throttle', 95);
            simRef.current.setControl('engineLoad', 85);
            addEventLog('Demo Step 2: Increasing engine load to 85%', 'ENGINE');
            return 10;
          } else if (demoStep === 2) {
            setDemoStep(3);
            simRef.current.setFault('EXCESSIVE_VIBRATION', 'HIGH');
            addEventLog('Demo Step 3: Injected Excessive Vibration fault (HIGH)', 'FAULT');
            return 12;
          } else if (demoStep === 3) {
            setDemoStep(4);
            addEventLog('Demo Step 4: Live sensor values changing & streaming to Digital Twin', 'TELEMETRY');
            return 8;
          } else {
            // Finish demo
            setIsDemoRunning(false);
            setDemoStep(1);
            simRef.current.clearFault();
            addEventLog('Demo Scenario completed. Returned to nominal cruise.', 'INFO');
            return 8;
          }
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isDemoRunning, demoStep]);

  // Handlers for Starting and Stopping Engine
  const handleStartEngine = () => {
    simRef.current.setEngineOn(true);
    addEventLog('ENGINE START: Ignition ON, starting Rotax 912 ULS aero-piston engine', 'ENGINE');
  };

  const handleStopEngine = () => {
    simRef.current.setEngineOn(false);
    if (isDemoRunning) setIsDemoRunning(false);
    addEventLog('ENGINE STOP: Ignition CUTOFF, engine spooled down to Standby (0 RPM)', 'ENGINE');
  };

  const handleChangeControl = <K extends keyof SimulationState['controls']>(key: K, value: number) => {
    simRef.current.setControl(key, value);
  };

  const handleInjectFault = (fault: FaultType, severity: FaultSeverity) => {
    simRef.current.setFault(fault, severity);
    addEventLog(`Fault Injected: ${fault} (Severity: ${severity})`, 'FAULT');
  };

  const handleClearFault = () => {
    simRef.current.clearFault();
    addEventLog('Fault Cleared. System restored to NORMAL.', 'INFO');
  };

  const handleStartDemo = () => {
    setIsDemoRunning(true);
    setDemoStep(1);
    setDemoStepRemaining(8);
    simRef.current.setEngineOn(true);
    simRef.current.setControl('throttle', 70);
    simRef.current.setControl('engineLoad', 70);
    simRef.current.clearFault();
    addEventLog('Demo Scenario Started: Stage 1 (Nominal Flight)', 'INFO');
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
      {/* Top Header */}
      <Header telemetryStatus={telemetryStatus} engineOn={simState.engineOn} />

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

          {/* Row 2: Flight Controls + Fault Simulation + Real-time Graphs (3 Cards) */}
          <div className="grid grid-cols-12 gap-3 min-h-[200px]">
            <div className="col-span-12 md:col-span-4">
              <FlightControls
                controls={simState.controls}
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
        onUpdateSpeed={(speed) => { simRef.current.state.speedMultiplier = speed; }}
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
