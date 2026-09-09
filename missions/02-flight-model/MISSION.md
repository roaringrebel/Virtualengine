# Mission 02: Flight Dynamics & Kinematics Model

## 1. Overview
Simulates the aerodynamic response, 6-DOF/3-DOF translation and rotation, lift/drag polar, ISA atmosphere calculation, and geographic position tracking of the UAV airframe.

## 2. Input / Output Contracts
- **Input**: `MissionCommand` (commanded throttle, target speed/alt/heading), wind vector $(w_x, w_y, w_z)$, timestep $dt$.
- **Output**: `FlightState` (lat, lng, alt, indicated & true airspeed, vertical speed, attitude angles, g-force, ambient temp & pressure).

## 3. Verification Criteria
1. **Golden CSV Regression**: Trajectory altitude, airspeed, and ground track must match `tests/golden-trajectories/nominal_flight_baseline.csv` with Normalized RMSE $< 2.5\%$.
2. **Aerodynamic Bounds**: G-force bounded in $[-1.5, +3.8]\text{ G}$, stall speed enforced ($V_{\text{stall}} = 48\text{ kts}$).
3. **Artifact**: Generates a numerical trajectory comparison table and RMSE score report.
