import { FlightState, EnginePhysicalState, VirtualSensorReadings } from '../../shared/schemas/types';

export class VirtualSensors {
  // Gaussian random noise helper (Box-Muller transform)
  private gaussianRandom(mean: number = 0, stdDev: number = 1): number {
    let u1 = 0, u2 = 0;
    while (u1 === 0) u1 = Math.random();
    while (u2 === 0) u2 = Math.random();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return mean + z0 * stdDev;
  }

  // Quantization helper
  private quantize(val: number, step: number): number {
    return Math.round(val / step) * step;
  }

  public read(
    engine: EnginePhysicalState,
    flight: FlightState,
    timestampMs: number
  ): VirtualSensorReadings {
    // 1. RPM: Optical/magnetic pickup (stdDev = 4.0 RPM, quantized to 1 RPM)
    const rawRpm = engine.rpm + this.gaussianRandom(0, 4.0);
    const rpm = this.quantize(Math.max(0, rawRpm), 1.0);

    // 2. CHT & EGT: Type-K Thermocouple (stdDev = 0.6 C, quantized to 0.1 C)
    const maxChtTrue = Math.max(...engine.chtC);
    const rawCht = maxChtTrue + this.gaussianRandom(0, 0.6);
    const chtMaxC = this.quantize(rawCht, 0.1);

    const maxEgtTrue = Math.max(...engine.egtC);
    const rawEgt = maxEgtTrue + this.gaussianRandom(0, 1.8);
    const egtMaxC = this.quantize(rawEgt, 0.5);

    // 3. Oil Temp & Pressure
    const rawOilTemp = engine.oilTempC + this.gaussianRandom(0, 0.4);
    const oilTempC = this.quantize(rawOilTemp, 0.1);

    const rawOilPress = engine.oilPressureBar + this.gaussianRandom(0, 0.03);
    const oilPressureBar = this.quantize(Math.max(0, rawOilPress), 0.01);

    // 4. Fuel Flow: Turbine sensor
    const rawFuelFlow = engine.fuelFlowLitersPerHour + this.gaussianRandom(0, 0.12);
    const fuelFlowLph = this.quantize(Math.max(0, rawFuelFlow), 0.05);

    // 5. Vibration: MEMS Accelerometer (scaled in G)
    const baseAccG = (engine.vibrationDisplacementUm / 10.0);
    const rawVib = baseAccG + this.gaussianRandom(0, 0.02);
    const vibrationAccG = this.quantize(Math.max(0, rawVib), 0.001);

    // Calculate overall SNR (dB)
    const signalPower = Math.pow(engine.rpm, 2) + Math.pow(maxChtTrue, 2);
    const noisePower = Math.pow(4.0, 2) + Math.pow(0.6, 2);
    const snrDb = 10 * Math.log10(signalPower / noisePower);

    return {
      timestampMs,
      rpm,
      chtMaxC,
      egtMaxC,
      oilTempC,
      oilPressureBar,
      fuelFlowLph,
      coolantTempC: this.quantize(engine.coolantTempC + this.gaussianRandom(0, 0.5), 0.1),
      airspeedKts: this.quantize(flight.indicatedAirspeedKts + this.gaussianRandom(0, 0.3), 0.1),
      altitudeM: this.quantize(flight.altitudeM + this.gaussianRandom(0, 0.8), 0.5),
      headingDeg: this.quantize(flight.headingDeg + this.gaussianRandom(0, 0.2), 0.1),
      vibrationAccG,
      snrDb
    };
  }
}
