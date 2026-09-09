/**
 * Bharat-AeroTwin: Physics-Based 3-Axis Vibration Engine & FFT Signal Processor
 * Calibrated against: 01_raw_vibration_dataset_final.csv
 * 
 * Generates continuous 3-axis acceleration signals [accel_x_g, accel_y_g, accel_z_g]
 * based on RPM rotational harmonics (1X, 2X, 3X), engine load, structural baseline,
 * and specific fault physical excitation signatures.
 * Performs real-time rolling-window FFT and statistical feature extraction.
 */

import { FaultState, FaultType } from '../types/simulation';

export interface VibrationMetrics {
  rmsG: number;             // Root Mean Square acceleration (g)
  peakG: number;            // Peak absolute acceleration (g)
  peakToPeakG: number;      // Peak-to-Peak acceleration (g)
  crestFactor: number;      // Peak / RMS ratio
  kurtosis: number;         // 4th standardized statistical moment
  variance: number;         // Signal variance (g^2)
  dominantFreqHz: number;   // Dominant FFT frequency peak (Hz)
  freqAmplitudeG: number;   // Peak frequency spectral amplitude (g)
  spectralEnergy: number;   // Total sum of spectral bin powers
  harmonic1XEnergy: number; // 1X Shaft frequency energy (RPM/60)
  harmonic2XEnergy: number; // 2X Cylinder firing frequency energy
  harmonic3XEnergy: number; // 3X Harmonic energy
  bearingFaultEnergy: number;// High-frequency bearing defect energy
  accelXG: number;          // Current instantaneous X acceleration (g)
  accelYG: number;          // Current instantaneous Y acceleration (g)
  accelZG: number;          // Current instantaneous Z acceleration (g)
  resultantG: number;       // Current resultant sqrt(x^2 + y^2 + z^2)
}

export class VibrationEngine {
  public static readonly SAMPLE_RATE_HZ = 500;
  public static readonly WINDOW_SIZE = 256; // ~0.512s window at 500Hz for high-rate analysis
  public static readonly WAVEFORM_BUFFER_SIZE = 120; // Samples for live UI visualizer

  // Signal history buffers
  private timeBuffer: number[] = [];
  private xBuffer: number[] = [];
  private yBuffer: number[] = [];
  private zBuffer: number[] = [];
  private resultantBuffer: number[] = [];

  // Internal time accumulator for phase continuity
  private phaseTime: number = 0;

  // Latest calculated metrics
  public latestMetrics: VibrationMetrics = {
    rmsG: 0.001,
    peakG: 0.002,
    peakToPeakG: 0.003,
    crestFactor: 2.0,
    kurtosis: 3.0,
    variance: 0.000001,
    dominantFreqHz: 0,
    freqAmplitudeG: 0,
    spectralEnergy: 0.0001,
    harmonic1XEnergy: 0,
    harmonic2XEnergy: 0,
    harmonic3XEnergy: 0,
    bearingFaultEnergy: 0,
    accelXG: 0,
    accelYG: 0,
    accelZG: 0,
    resultantG: 0.001
  };

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.timeBuffer = [];
    this.xBuffer = [];
    this.yBuffer = [];
    this.zBuffer = [];
    this.resultantBuffer = [];
    this.phaseTime = 0;
    this.latestMetrics = {
      rmsG: 0.001,
      peakG: 0.002,
      peakToPeakG: 0.003,
      crestFactor: 2.0,
      kurtosis: 3.0,
      variance: 0.000001,
      dominantFreqHz: 0,
      freqAmplitudeG: 0,
      spectralEnergy: 0.0001,
      harmonic1XEnergy: 0,
      harmonic2XEnergy: 0,
      harmonic3XEnergy: 0,
      bearingFaultEnergy: 0,
      accelXG: 0,
      accelYG: 0,
      accelZG: 0,
      resultantG: 0.001
    };
  }

  /**
   * Generates a burst of vibration samples for the elapsed physics dt
   * and computes live metrics and FFT spectrum.
   */
  public update(
    dtSeconds: number,
    engineOn: boolean,
    rpm: number,
    engineLoadPct: number,
    fault: FaultState
  ): VibrationMetrics {
    // Determine sample count for this tick (dt at 500Hz)
    const samplesToGenerate = Math.max(1, Math.round(dtSeconds * VibrationEngine.SAMPLE_RATE_HZ));
    const sampleDt = 1.0 / VibrationEngine.SAMPLE_RATE_HZ;

    const loadNorm = Math.max(0, Math.min(100, engineLoadPct)) / 100.0;

    for (let s = 0; s < samplesToGenerate; s++) {
      this.phaseTime += sampleDt;
      const t = this.phaseTime;

      let ax = 0;
      let ay = 0;
      let az = 0;

      if (!engineOn || rpm <= 20) {
        // Engine OFF / Standby: Ambient sensor noise floor
        const noiseFloor = 0.0008; // ~0.0008 g noise floor
        ax = (Math.random() - 0.5) * noiseFloor;
        ay = (Math.random() - 0.5) * noiseFloor;
        az = (Math.random() - 0.5) * noiseFloor;
      } else {
        // 1. Fundamental Rotational Frequency f_rot = RPM / 60 (Hz)
        const f1 = rpm / 60.0;
        const f2 = 2.0 * f1; // 2X cylinder firing harmonic
        const f3 = 3.0 * f1; // 3X harmonic

        // 2. Base Mechanical Excitation Amplitude scaled by RPM and Engine Load
        // Calibrated from NORMAL dataset: Mean RPM ~2500, Load ~0.60 -> RMS ~0.023g, Peak ~0.056g
        const rpmFactor = 0.65 + 0.35 * Math.pow(rpm / 2500.0, 0.90);
        const loadFactor = 0.80 + 0.45 * Math.pow(loadNorm, 1.1);
        const baseAmp = 0.026 * rpmFactor * loadFactor;

        // Axis-specific structural transmission vectors
        const xHarmonic = baseAmp * (
          0.70 * Math.sin(2 * Math.PI * f1 * t) +
          0.35 * Math.sin(2 * Math.PI * f2 * t + 0.4) +
          0.15 * Math.sin(2 * Math.PI * f3 * t + 1.1)
        );

        const yHarmonic = baseAmp * (
          0.55 * Math.cos(2 * Math.PI * f1 * t + 0.8) +
          0.25 * Math.sin(2 * Math.PI * f2 * t + 1.6)
        );

        const zHarmonic = baseAmp * (
          0.45 * Math.sin(2 * Math.PI * f1 * t + 1.9) +
          0.20 * Math.cos(2 * Math.PI * f2 * t + 0.5)
        );

        // 3. Fault-Specific Physical Vibration Injection
        let faultX = 0;
        let faultY = 0;
        let faultZ = 0;

        const sevMult = fault.severity === 'HIGH' ? 1.4 : fault.severity === 'LOW' ? 0.6 : 1.0;
        const faultRamp = Math.min(1.0, fault.elapsedSeconds / 2.5);

        switch (fault.activeFault) {
          case 'EXCESSIVE_VIBRATION': {
            // Calibrated from EXCESSIVE_VIBRATION dataset: RMS ~0.090g, max axis X ~0.208g
            // Severe unbalance / structural resonance on X axis
            const unbalanceAmp = 0.075 * sevMult * faultRamp * rpmFactor;
            faultX = unbalanceAmp * (
              Math.sin(2 * Math.PI * f1 * t) * 1.8 +
              Math.sin(2 * Math.PI * f2 * t) * 0.6 +
              (Math.random() - 0.5) * 0.4
            );
            faultY = unbalanceAmp * 0.45 * Math.cos(2 * Math.PI * f1 * t);
            faultZ = unbalanceAmp * 0.70 * Math.sin(2 * Math.PI * (f1 * 1.5) * t);
            break;
          }

          case 'RPM_INSTABILITY': {
            // Speed hunting causes frequency jitter & sideband modulation
            const modFreq = 2.5; // 2.5 Hz hunting oscillation
            const modAmp = 0.015 * sevMult * faultRamp;
            const sideband = Math.sin(2 * Math.PI * modFreq * t);
            faultX = modAmp * Math.sin(2 * Math.PI * (f1 + sideband * 8.0) * t);
            faultY = modAmp * 0.6 * Math.cos(2 * Math.PI * (f1 + sideband * 8.0) * t);
            break;
          }

          case 'BEARING_FAULT': {
            // Bearing defect pass frequency (~3.2X shaft RPM or 160-220 Hz within Nyquist band)
            const fBearing = Math.min(220, Math.max(140, f1 * 3.4));
            const impactAmp = 0.060 * sevMult * faultRamp * Math.max(0.7, rpmFactor);
            // High kurtosis periodic impacts
            const impactPeriod = 1.0 / fBearing;
            const phaseInPeriod = (t % impactPeriod) / impactPeriod;
            const impulsiveEnvelope = Math.exp(-phaseInPeriod * 16.0); // sharp decay pulse
            const ringdown = Math.sin(2 * Math.PI * 185.0 * t); // high frequency resonance within Nyquist band

            faultX = impactAmp * impulsiveEnvelope * ringdown * 2.2;
            faultY = impactAmp * 0.50 * impulsiveEnvelope * ringdown;
            faultZ = impactAmp * 0.35 * impulsiveEnvelope;
            break;
          }

          case 'LOW_OIL_PRESSURE':
          case 'OVERHEATING': {
            // Increased friction baseline chatter
            const frictionAmp = 0.012 * sevMult * faultRamp;
            faultX = (Math.random() - 0.5) * frictionAmp * 1.5;
            faultY = (Math.random() - 0.5) * frictionAmp;
            faultZ = (Math.random() - 0.5) * frictionAmp;
            break;
          }

          case 'NORMAL':
          default:
            break;
        }

        // 4. Bounded Real Sensor Electronic Noise (calibrated Gaussian-like noise)
        const sensorNoiseAmp = 0.0035;
        const nx = (Math.random() - 0.5) * sensorNoiseAmp;
        const ny = (Math.random() - 0.5) * sensorNoiseAmp;
        const nz = (Math.random() - 0.5) * sensorNoiseAmp;

        ax = xHarmonic + faultX + nx;
        ay = yHarmonic + faultY + ny;
        az = zHarmonic + faultZ + nz;
      }

      const resultant = Math.sqrt(ax * ax + ay * ay + az * az);

      // Append to rolling buffers
      this.timeBuffer.push(t);
      this.xBuffer.push(ax);
      this.yBuffer.push(ay);
      this.zBuffer.push(az);
      this.resultantBuffer.push(resultant);

      if (this.resultantBuffer.length > VibrationEngine.WINDOW_SIZE) {
        this.timeBuffer.shift();
        this.xBuffer.shift();
        this.yBuffer.shift();
        this.zBuffer.shift();
        this.resultantBuffer.shift();
      }
    }

    // Compute live features from current buffer
    this.latestMetrics = this.computeFeatures(engineOn, rpm);
    return this.latestMetrics;
  }

  /**
   * Statistical & FFT Feature Extraction over rolling window
   */
  private computeFeatures(engineOn: boolean, currentRpm: number): VibrationMetrics {
    const N = this.resultantBuffer.length;
    if (N < 8 || !engineOn || currentRpm <= 20) {
      return {
        rmsG: 0.001,
        peakG: 0.002,
        peakToPeakG: 0.003,
        crestFactor: 2.0,
        kurtosis: 3.0,
        variance: 0.000001,
        dominantFreqHz: 0,
        freqAmplitudeG: 0,
        spectralEnergy: 0.0001,
        harmonic1XEnergy: 0,
        harmonic2XEnergy: 0,
        harmonic3XEnergy: 0,
        bearingFaultEnergy: 0,
        accelXG: this.xBuffer[N - 1] || 0,
        accelYG: this.yBuffer[N - 1] || 0,
        accelZG: this.zBuffer[N - 1] || 0,
        resultantG: 0.001
      };
    }

    // 1. Time-Domain Metrics
    let sum = 0;
    let sumSq = 0;
    let minVal = Infinity;
    let maxVal = -Infinity;

    for (let i = 0; i < N; i++) {
      const v = this.resultantBuffer[i];
      sum += v;
      sumSq += v * v;
      if (v < minVal) minVal = v;
      if (v > maxVal) maxVal = v;
    }

    const mean = sum / N;
    const rmsG = Math.sqrt(sumSq / N);
    const peakG = maxVal;
    const peakToPeakG = maxVal - minVal;
    const crestFactor = rmsG > 0 ? peakG / rmsG : 0;

    // Kurtosis & Variance
    let m4 = 0;
    let m2 = 0;
    for (let i = 0; i < N; i++) {
      const diff = this.resultantBuffer[i] - mean;
      m2 += diff * diff;
      m4 += Math.pow(diff, 4);
    }
    const variance = m2 / N;
    const kurtosis = variance > 0 ? (m4 / N) / Math.pow(variance, 2) : 3.0;

    // 2. Fast Fourier Transform (DFT on resultant buffer)
    const dftResolutionHz = VibrationEngine.SAMPLE_RATE_HZ / N;
    const numBins = Math.min(128, Math.floor(N / 2)); // Nyquist limit: 250 Hz with 500 Hz sample rate
    let maxBinPower = 0;
    let maxBinIndex = 0;
    let totalSpectralEnergy = 0;

    const fftBins: number[] = new Array(numBins).fill(0);

    for (let k = 1; k < numBins; k++) {
      let real = 0;
      let imag = 0;
      for (let n = 0; n < N; n++) {
        const angle = (2 * Math.PI * k * n) / N;
        const val = this.resultantBuffer[n];
        real += val * Math.cos(angle);
        imag -= val * Math.sin(angle);
      }
      const power = (2.0 * Math.sqrt(real * real + imag * imag)) / N;
      fftBins[k] = power;
      totalSpectralEnergy += power * power;

      if (power > maxBinPower) {
        maxBinPower = power;
        maxBinIndex = k;
      }
    }

    const dominantFreqHz = maxBinIndex * dftResolutionHz;
    const freqAmplitudeG = maxBinPower;

    // 3. Harmonic Energy Extraction
    const f1 = currentRpm / 60.0;
    const bin1X = Math.min(numBins - 1, Math.max(1, Math.round(f1 / dftResolutionHz)));
    const bin2X = Math.min(numBins - 1, Math.max(1, Math.round((2 * f1) / dftResolutionHz)));
    const bin3X = Math.min(numBins - 1, Math.max(1, Math.round((3 * f1) / dftResolutionHz)));

    const harmonic1XEnergy = fftBins[bin1X] || 0;
    const harmonic2XEnergy = fftBins[bin2X] || 0;
    const harmonic3XEnergy = fftBins[bin3X] || 0;

    // Bearing fault band energy (140Hz - 240Hz)
    let bearingSum = 0;
    const kStart = Math.min(numBins - 1, Math.max(1, Math.floor(140 / dftResolutionHz)));
    const kEnd = Math.min(numBins - 1, Math.ceil(240 / dftResolutionHz));
    for (let k = kStart; k <= kEnd; k++) {
      bearingSum += (fftBins[k] || 0) * (fftBins[k] || 0);
    }

    return {
      rmsG,
      peakG,
      peakToPeakG,
      crestFactor,
      kurtosis,
      variance,
      dominantFreqHz,
      freqAmplitudeG,
      spectralEnergy: totalSpectralEnergy,
      harmonic1XEnergy,
      harmonic2XEnergy,
      harmonic3XEnergy,
      bearingFaultEnergy: bearingSum,
      accelXG: this.xBuffer[N - 1] || 0,
      accelYG: this.yBuffer[N - 1] || 0,
      accelZG: this.zBuffer[N - 1] || 0,
      resultantG: this.resultantBuffer[N - 1] || 0
    };
  }

  /**
   * Returns recent waveform samples for real-time SVG waveform plotting
   */
  public getLiveWaveformSamples(count: number = VibrationEngine.WAVEFORM_BUFFER_SIZE): number[] {
    const N = this.resultantBuffer.length;
    if (N === 0) return new Array(count).fill(0.001);
    const sliceStart = Math.max(0, N - count);
    const slice = this.resultantBuffer.slice(sliceStart);
    if (slice.length < count) {
      const padding = new Array(count - slice.length).fill(slice[0] || 0.001);
      return [...padding, ...slice];
    }
    return slice;
  }
}
