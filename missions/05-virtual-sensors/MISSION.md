# Mission 05: Virtual Sensors (Noise, Quantization & Latency)

## 1. Overview
Emulates physical sensor transducers, analog-to-digital converters (ADC), quantization steps, thermal Johnson noise, drift, and transmission latency across all instrumentation channels (Hall-effect RPM, Type-K Thermocouple CHT/EGT, Piezoresistive Oil Pressure, Turbine Fuel Flowmeter, MEMS Accelerometer).

## 2. Input / Output Contracts
- **Input**: Ground-truth `EnginePhysicalState` and `FlightState`.
- **Output**: `VirtualSensorReadings` with synthetic noise and discretization.

## 3. Verification Criteria
1. **Signal-to-Noise Ratio (SNR)**:
   - RPM SNR strictly $> 30\text{ dB}$.
   - Temperature SNR strictly $> 25\text{ dB}$.
   - Vibration SNR strictly $> 18\text{ dB}$.
2. **Quantization Integrity**: Output values adhere to sensor ADC resolution (e.g. RPM quantized to integer, temperature to $0.1^\circ\text{C}$).
3. **Artifact**: Generates a Signal-to-Noise Ratio (SNR) verification report.
