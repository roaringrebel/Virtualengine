# Mission 01: Mission Manager & Flight Phase FSM

## 1. Overview
The Mission Manager acts as the strategic supervisor of the UAV flight profile. It maintains the finite state machine (FSM) across operational flight phases, calculates great-circle navigation vectors to sequential waypoints, and dispatches target airspeed, altitude, and commanded throttle to downstream flight dynamics.

## 2. Input / Output Contracts
- **Input**: Waypoint plan (`Waypoint[]`), current UAV position (`GeoCoordinate`), current ground speed.
- **Output**: `MissionCommand` containing `activeWaypointIndex`, `currentPhase`, `targetAltitudeM`, `targetSpeedKts`, `commandedThrottle`, `distanceToTargetKm`, and `missionProgressPct`.

## 3. Verification Criteria
1. **FSM Sequence**: State must transition deterministically: `PRE_FLIGHT` → `TAKEOFF` → `CLIMB` → `CRUISE` → `DESCENT` → `APPROACH` → `LANDING` → `COMPLETED`.
2. **Terminal Stop**: When final destination is reached (distance $< 0.05\text{ km}$), throttle drops to $0.0$, speed decays to $0$, and phase transitions to `COMPLETED`.
3. **Artifact**: Generates a phase transition log and waypoint arrival report.
