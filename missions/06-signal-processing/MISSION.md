# Mission 06: Signal Processing (Dual-Rate Subagents)

## 1. Overview
Rather than an ambiguous single signal processing block, Mission 06 is strictly partitioned into two specialized subagents corresponding to distinct physical sampling contracts:

1. **Subagent A: Low-Rate Stream Processor (10Hz–50Hz)**
   - Inputs: 22-parameter flight & engine telemetry stream (RPM, CHT[4], EGT[4], Oil, Fuel, Airspeed, Altitude, Heading).
   - Tasks: Rolling window statistics ($5\text{s}$ mean), outlier rejection, capability margin score, anomaly classification (`HEALTHY`, `WARNING`, `CRITICAL`).

2. **Subagent B: High-Rate Vibration Processor (500Hz–1kHz)**
   - Inputs: High-bandwidth accelerometer / acoustic time-series window.
   - Tasks: Time-domain statistical feature extraction ($\text{RMS}$, Peak-to-Peak, Crest Factor, Kurtosis) and Fast Fourier Transform (FFT) harmonic spectral power extraction ($1\times$ shaft RPM, $2\times$ blade pass, and bearing defect frequencies).

## 2. Verification Criteria
1. **Dual-Rate Sampling Contract**: Low-rate operates at $20\text{ Hz}$, high-rate processes $512$-sample buffers at $1\text{ kHz}$.
2. **Harmonic Peak Identification**: Injected vibration frequency (e.g. $76.6\text{ Hz}$ shaft rotational speed at $4600\text{ RPM}$) correctly identified in FFT spectral bin.
3. **Artifact**: Generates a dual-rate processing benchmark and FFT spectral bin analysis report.
