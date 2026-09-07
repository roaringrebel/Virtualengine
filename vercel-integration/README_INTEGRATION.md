# Bharat AeroTwin — Website 1 & Website 2 System Integration Guide

This guide details how the **Local UAV / Rotax 912 Simulator (Website 1)** and the **Main Digital Twin & Prognostics System (Website 2 - `sihaimodel.vercel.app`)** are integrated into a single unified telemetry pipeline.

---

## 1. System Architecture

```
                  WEBSITE 1 (LOCAL SIMULATOR)
                   http://localhost:5173
                            │
                     Physics Engine
                    (Rotax 912 Model)
                            │
                            ▼
                     Virtual Sensors
                            │
                            ▼
                    Telemetry Object
              (1Hz Single Source of Truth)
                            │
                            │ HTTPS POST /api/telemetry
                            ▼
       ───────────────────────────────────────────
              VERCEL SERVERLESS TELEMETRY API
          https://sihaimodel.vercel.app/api/telemetry
       ───────────────────────────────────────────
                            │
                            │ GET /api/telemetry (1Hz polling)
                            ▼
                  WEBSITE 2 (DIGITAL TWIN)
                https://sihaimodel.vercel.app/
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
      Sensor Cards     Fault Detection     SOH / RUL
     (Actual State)   (Simulated Fault)  (Prognostics)
            │               │               │
            └───────────────┼───────────────┘
                            ▼
                    Mission Risk &
                 Maintenance Advisory
```

---

## 2. Telemetry JSON Schema Contract

Both websites communicate using this exact payload schema:

```json
{
  "timestamp": "2026-09-04T12:30:00.000Z",
  "simulation_id": "SIM-ROTAX-001",
  "sequence_number": 1284,
  "aircraft": "MALE_UAV",
  "engine": "ROTAX_912_ULS",
  "flight_phase": "CRUISE",
  "engine_on": true,
  "rpm": 5120,
  "cht": 92.438,
  "egt": 788.215,
  "oil_pressure": 5.124,
  "oil_temperature": 88.102,
  "vibration": 2.315,
  "fuel_flow": 18.521,
  "fuel_pressure": 3.412,
  "map": 28.05,
  "altitude": 8000,
  "airspeed": 145,
  "heading": 270,
  "throttle": 70,
  "engine_load": 70,
  "ambient_temperature": 30.0,
  "fault": "NORMAL",
  "fault_severity": 0
}
```

---

## 3. How to Deploy the Integration to Website 2 (`sihaimodel`)

### Step 1: Add the Serverless API Endpoint to Website 2 Repo
Copy [`api/telemetry.ts`](./api/telemetry.ts) into the root `api/` directory of the `sihaimodel` project repository:
```
sihaimodel/
└── api/
    └── telemetry.ts
```
*(Vercel automatically detects files in `/api` and deploys them as Serverless Functions).*

### Step 2: Use the Hook in Website 2
Copy [`src/hooks/useSimulatorTelemetry.ts`](./src/hooks/useSimulatorTelemetry.ts) and [`src/components/SimulatorLiveBadge.tsx`](./src/components/SimulatorLiveBadge.tsx) into `sihaimodel/src/`.

In Website 2's root component or Zustand store initializer:
```tsx
import { useSimulatorTelemetry } from './hooks/useSimulatorTelemetry';
import { useEngineStore } from './store/engineStore'; // or your Zustand store

export function App() {
  const setTelemetryFromSimulator = useEngineStore((state) => state.setTelemetry);
  
  const { connectionState, secondsAgo, missedPackets } = useSimulatorTelemetry({
    apiEndpoint: '/api/telemetry',
    onTelemetryReceived: (packet) => {
      // Feed Website 1's live telemetry into Website 2's diagnosis & digital twin engine
      setTelemetryFromSimulator({
        rpm: packet.rpm,
        cht: packet.cht,
        egt: packet.egt,
        oil_pressure: packet.oil_pressure,
        oil_temp: packet.oil_temperature,
        vibration: packet.vibration,
        fuel_flow: packet.fuel_flow,
        fuel_pressure: packet.fuel_pressure,
        map: packet.map,
        engineLoad: packet.engine_load,
        altitude: packet.altitude,
        airspeed: packet.airspeed,
        simulated_fault: packet.fault,
        simulated_fault_severity: packet.fault_severity
      });
    },
    onSessionReset: (newSimId) => {
      console.log('Simulation reset detected:', newSimId);
      // Clear rolling chart history
    }
  });

  return (
    <div>
      <Header>
        <SimulatorLiveBadge connectionState={connectionState} secondsAgo={secondsAgo} missedPackets={missedPackets} />
      </Header>
      ...
    </div>
  );
}
```

### Step 3: Deploy to Vercel
Push the changes to GitHub or run `vercel --prod`.

---

## 4. Local Testing & Demonstration Workflow

1. Start Website 1 locally on `http://localhost:5173`.
2. Notice the **TELEMETRY SENDER & SYNC** panel on Website 1:
   - Click **Vercel API** to stream directly to `https://sihaimodel.vercel.app/api/telemetry`.
   - Or click **Local Vite** to test against the built-in `http://localhost:5173/api/telemetry` endpoint.
3. Start the UAV Engine on Website 1 (Click **START ENGINE**).
4. On Website 1, inject **EXCESSIVE VIBRATION** or **LOW OIL PRESSURE**:
   - The physics model computes thermodynamic and mechanical effects.
   - Telemetry payload updates within 1 second.
   - Website 2 receives the exact values and updates sensor gauges, SOH, RUL, and maintenance alerts in real-time.
