import { HighRateVibrationPacket } from '../../../shared/schemas/types';

export class HighRateVibrationProcessor {
  private readonly sampleRateHz: number = 1000;
  private readonly windowSize: number = 256;

  public processWindow(
    rawTimeBuffer: number[],
    shaftRpm: number,
    timestampMs: number
  ): HighRateVibrationPacket {
    const N = Math.min(rawTimeBuffer.length, this.windowSize);
    if (N === 0) {
      return {
        timestampMs,
        sampleRateHz: this.sampleRateHz,
        windowSizeSamples: 0,
        rmsAccG: 0,
        peakToPeakAccG: 0,
        crestFactor: 0,
        kurtosis: 0,
        harmonic1XEnergy: 0,
        harmonic2XEnergy: 0,
        bearingFaultBandEnergy: 0,
        spectralDominantFreqHz: 0,
        fftSpectrumBins: []
      };
    }

    const buffer = rawTimeBuffer.slice(0, N);

    // 1. Time-Domain Metrics
    let sumSq = 0;
    let minVal = Infinity;
    let maxVal = -Infinity;
    let sum = 0;

    for (let i = 0; i < N; i++) {
      const v = buffer[i];
      sum += v;
      sumSq += v * v;
      if (v < minVal) minVal = v;
      if (v > maxVal) maxVal = v;
    }

    const mean = sum / N;
    const rmsAccG = Math.sqrt(sumSq / N);
    const peakToPeakAccG = maxVal - minVal;
    const peak = Math.max(Math.abs(minVal), Math.abs(maxVal));
    const crestFactor = rmsAccG > 0 ? peak / rmsAccG : 0;

    // Kurtosis (4th standardized moment)
    let m4 = 0;
    let m2 = 0;
    for (let i = 0; i < N; i++) {
      const diff = buffer[i] - mean;
      m2 += diff * diff;
      m4 += Math.pow(diff, 4);
    }
    const variance = m2 / N;
    const kurtosis = variance > 0 ? (m4 / N) / Math.pow(variance, 2) : 3.0;

    const dftResolutionHz = this.sampleRateHz / N; // ~3.906 Hz per bin
    const numBins = 64; // up to ~250 Hz (or higher)
    const fftBins: number[] = new Array(numBins).fill(0);
    let maxBinPower = 0;
    let maxBinIndex = 0;

    for (let k = 1; k < numBins; k++) {
      let real = 0;
      let imag = 0;
      for (let n = 0; n < N; n++) {
        const angle = (2 * Math.PI * k * n) / N;
        real += buffer[n] * Math.cos(angle);
        imag -= buffer[n] * Math.sin(angle);
      }
      const power = (2 * Math.sqrt(real * real + imag * imag)) / N;
      fftBins[k] = power;

      if (power > maxBinPower) {
        maxBinPower = power;
        maxBinIndex = k;
      }
    }

    const spectralDominantFreqHz = maxBinIndex * dftResolutionHz;

    // 3. Extract Harmonic Energy Bands
    const shaftFreqHz = shaftRpm / 60.0;
    const bin1X = Math.min(numBins - 1, Math.round(shaftFreqHz / dftResolutionHz));
    const bin2X = Math.min(numBins - 1, Math.round((2 * shaftFreqHz) / dftResolutionHz));

    const harmonic1XEnergy = fftBins[bin1X] || 0;
    const harmonic2XEnergy = fftBins[bin2X] || 0;

    // Bearing fault band (e.g. 200Hz - 400Hz)
    let bearingBandSum = 0;
    for (let k = Math.floor(200 / dftResolutionHz); k < Math.min(numBins, Math.ceil(400 / dftResolutionHz)); k++) {
      bearingBandSum += fftBins[k] || 0;
    }

    return {
      timestampMs,
      sampleRateHz: this.sampleRateHz,
      windowSizeSamples: N,
      rmsAccG,
      peakToPeakAccG,
      crestFactor,
      kurtosis,
      harmonic1XEnergy,
      harmonic2XEnergy,
      bearingFaultBandEnergy: bearingBandSum,
      spectralDominantFreqHz,
      fftSpectrumBins: fftBins
    };
  }

  // Synthesizer helper to generate raw high-rate accelerometer sample window for simulation
  public generateSyntheticBuffer(shaftRpm: number, vibrationEnergyMultiplier: number = 1.0): number[] {
    const N = this.windowSize;
    const buffer: number[] = new Array(N);
    const dt = 1.0 / this.sampleRateHz;
    const f1 = shaftRpm / 60.0; // 1X shaft frequency (e.g. 76.6 Hz at 4600 RPM)
    const f2 = 2 * f1; // 2X harmonics
    const fBearing = 320.0; // Bearing defect pass frequency

    for (let n = 0; n < N; n++) {
      const t = n * dt;
      // 1X fundamental + 2X blade harmonic + defect impact bursts + broadband noise
      const sig1 = 0.50 * Math.sin(2 * Math.PI * f1 * t);
      const sig2 = 0.12 * Math.sin(2 * Math.PI * f2 * t);
      const sigDefect = (vibrationEnergyMultiplier > 2.0) ? 0.35 * (vibrationEnergyMultiplier - 1.0) * Math.sin(2 * Math.PI * fBearing * t) : 0;
      const noise = (Math.random() - 0.5) * 0.02;

      buffer[n] = (sig1 + sig2 + sigDefect + noise) * vibrationEnergyMultiplier;
    }
    return buffer;
  }
}
