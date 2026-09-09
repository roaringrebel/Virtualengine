# Mission 03: Engine Physics (Rotax 912 Reduced-Order Model)

## 1. Overview
Models the thermodynamic, combustion, mechanical, and lubrication physics of the Rotax 912 4-cylinder engine. Computes RPM dynamics, Cylinder Head Temperature (CHT per cylinder), Exhaust Gas Temperature (EGT per cylinder), oil temperature/pressure, fuel flow, and mechanical power.

## 2. Input / Output Contracts
- **Input**: `MissionCommand` (commanded throttle), `FlightState` (airspeed, density, ambient temperature), and `FaultFeedbackModifier` (feedback edge from Fault Injector).
- **Output**: `EnginePhysicalState` (RPM, CHT[4], EGT[4], oil pressure/temperature, fuel flow, power, torque).

## 3. Verification Criteria
1. **Physics Boundary Invariants**:
   - RPM strictly $\in [0, 5800]\text{ RPM}$.
   - CHT strictly $\in [20, 150]^\circ\text{C}$.
   - EGT strictly $\in [200, 950]^\circ\text{C}$.
   - Oil Pressure strictly $> 0.5\text{ bar}$.
2. **Thermal Equilibrium**: Engine temperatures must stabilize under steady cruise conditions without divergence.
3. **Artifact**: Generates a physical bounds assertion table and thermal stability trace.
