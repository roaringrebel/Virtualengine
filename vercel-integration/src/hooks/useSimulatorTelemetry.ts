import { useEffect, useRef, useState } from 'react';

export interface TelemetryPacket {
  timestamp: string;
  simulation_id?: string;
  sequence_number?: number;
  aircraft: string;
  engine: string;
  flight_phase: string;
  rpm: number;
  cht: number;
  egt: number;
  oil_pressure: number;
  oil_temperature: number;
  vibration: number;
  fuel_flow: number;
  fuel_pressure: number;
  map: number;
  altitude: number;
  airspeed: number;
  heading: number;
  throttle: number;
  engine_load: number;
  ambient_temperature?: number;
  ambient_temp?: number;
  fault: string;
  fault_severity: number | string;
}

export type SimulatorConnectionState = 'LIVE' | 'STALE' | 'OFFLINE' | 'WAITING_FOR_SIMULATOR';

export interface UseSimulatorTelemetryOptions {
  pollingIntervalMs?: number;
  apiEndpoint?: string;
  onTelemetryReceived?: (packet: TelemetryPacket) => void;
  onSessionReset?: (newSimulationId: string) => void;
}

export function useSimulatorTelemetry(options: UseSimulatorTelemetryOptions = {}) {
  const {
    pollingIntervalMs = 1000,
    apiEndpoint = '/api/telemetry',
    onTelemetryReceived,
    onSessionReset
  } = options;

  const [telemetry, setTelemetry] = useState<TelemetryPacket | null>(null);
  const [connectionState, setConnectionState] = useState<SimulatorConnectionState>('WAITING_FOR_SIMULATOR');
  const [lastReceivedAt, setLastReceivedAt] = useState<Date | null>(null);
  const [missedPackets, setMissedPackets] = useState<number>(0);
  const [secondsAgo, setSecondsAgo] = useState<number | null>(null);

  const prevSeqRef = useRef<number | null>(null);
  const prevSimIdRef = useRef<string | null>(null);
  const lastPacketTimeRef = useRef<number>(0);

  useEffect(() => {
    let isMounted = true;

    const pollTelemetry = async () => {
      try {
        const res = await fetch(apiEndpoint, {
          headers: { 'Accept': 'application/json' },
          cache: 'no-store'
        });

        if (!res.ok) {
          if (isMounted) setConnectionState('OFFLINE');
          return;
        }

        const data = await res.json();
        if (!isMounted) return;

        if (data.success && data.telemetry) {
          const packet: TelemetryPacket = data.telemetry;
          const packetTimestamp = new Date(packet.timestamp).getTime();
          const now = Date.now();
          const ageSec = Math.max(0, Math.floor((now - packetTimestamp) / 1000));

          lastPacketTimeRef.current = now;
          setLastReceivedAt(new Date());
          setSecondsAgo(ageSec);

          // Staleness assessment
          if (ageSec > 10) {
            setConnectionState('OFFLINE');
          } else if (ageSec > 5) {
            setConnectionState('STALE');
          } else {
            setConnectionState('LIVE');
          }

          // Detect Session Reset
          if (packet.simulation_id && prevSimIdRef.current && packet.simulation_id !== prevSimIdRef.current) {
            setMissedPackets(0);
            prevSeqRef.current = null;
            if (onSessionReset) onSessionReset(packet.simulation_id);
          }
          prevSimIdRef.current = packet.simulation_id || null;

          // Packet Loss Detection
          if (packet.sequence_number !== undefined) {
            if (prevSeqRef.current !== null && packet.sequence_number > prevSeqRef.current + 1) {
              const skipped = packet.sequence_number - prevSeqRef.current - 1;
              setMissedPackets(prev => prev + skipped);
            }
            prevSeqRef.current = packet.sequence_number;
          }

          setTelemetry(packet);
          if (onTelemetryReceived) onTelemetryReceived(packet);
        } else {
          setConnectionState('WAITING_FOR_SIMULATOR');
        }
      } catch (err) {
        if (isMounted) {
          const now = Date.now();
          if (lastPacketTimeRef.current && now - lastPacketTimeRef.current > 10000) {
            setConnectionState('OFFLINE');
          }
        }
      }
    };

    // Initial poll
    pollTelemetry();

    // Setup 1Hz interval
    const intervalId = window.setInterval(pollTelemetry, pollingIntervalMs);

    // Staleness ticker (every 1s)
    const tickerId = window.setInterval(() => {
      if (lastPacketTimeRef.current > 0) {
        const sec = Math.floor((Date.now() - lastPacketTimeRef.current) / 1000);
        setSecondsAgo(sec);
        if (sec > 10) {
          setConnectionState('OFFLINE');
        } else if (sec > 5) {
          setConnectionState('STALE');
        }
      }
    }, 1000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      clearInterval(tickerId);
    };
  }, [apiEndpoint, pollingIntervalMs]);

  return {
    telemetry,
    connectionState,
    isLive: connectionState === 'LIVE',
    isStale: connectionState === 'STALE',
    isOffline: connectionState === 'OFFLINE',
    lastReceivedAt,
    secondsAgo,
    missedPackets
  };
}
