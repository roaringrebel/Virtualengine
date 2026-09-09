# Mission 04: Fault Injector (Dynamic Feedback Edge Engine)

## 1. Overview
Instead of simple static post-processing offsets, the Fault Injector models progressive physical degradation over time and feeds dynamic physical modifiers (`FaultFeedbackModifier`) into `03-engine-physics`.
- **Bearing Wear**: Friction torque $\tau_{\text{fric}}(t)$ increases nonlinearly with time, increasing rotational resistance, RPM jitter, vibration energy, and oil temperature.
- **Cooling System Leak**: Thermal dissipation factor decays continuously ($1.0 \to 0.2$), triggering progressive coolant and CHT runaway.
- **Fuel Injector Clogging**: Fuel flow bias drops on specific cylinders, causing power loss and EGT imbalance.

## 2. Input / Output Contracts
- **Input**: Fault trigger command (`activeFault`, `targetSeverity`), timestep $dt$.
- **Output**: `FaultFeedbackModifier` fed backward into `03-engine-physics` state integration.

## 3. Verification Criteria
1. **Dynamic Time Evolution**: State deviation must strictly increase across $> 60\text{ s}$ of continuous fault injection rather than snapping instantly.
2. **Confusion Matrix Check**: Injected fault mode matches physical signature (e.g. Bearing fault $\implies$ high vibration + friction; Cooling leak $\implies$ CHT divergence).
3. **Artifact**: Generates a time-series state deviation trace and fault classification report.
