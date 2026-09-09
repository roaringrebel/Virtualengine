import { EnginePhysicalState, FlightState, FlightPhase, LowRateTelemetryStream } from '../../../shared/schemas/types';

export class LowRateProcessor {
  private sequenceId: number = 0;
  private rpmWindow: number[] = [];
  private readonly windowSize: number = 25; // ~1-2 seconds window

  public process(
    engine: EnginePhysicalState,
    flight: FlightState,
    phase: FlightPhase,
    timestampMs: number
  ): LowRateTelemetryStream {
    this.sequenceId++;

    // Rolling RPM buffer
    this.rpmWindow.push(engine.rpm);
    if (this.rpmWindow.length > this.windowSize) {
      this.rpmWindow.shift();
    }
    const rpmMean5s = this.rpmWindow.reduce((a, b) => a + b, 0) / this.rpmWindow.length;

    const maxCht = Math.max(...engine.chtC);
    const maxEgt = Math.max(...engine.egtC);

    // Compute Capability Margin Pct (100% = optimal nominal, 0% = limit excursion)
    let margin = 100.0;
    if (maxCht > 115) margin -= (maxCht - 115) * 2.5;
    if (maxEgt > 800) margin -= (maxEgt - 800) * 0.5;
    if (engine.oilTempC > 110) margin -= (engine.oilTempC - 110) * 2.0;
    if (engine.oilPressureBar < 2.0) margin -= (2.0 - engine.oilPressureBar) * 25.0;
    if (engine.rpm > 5500) margin -= (engine.rpm - 5500) * 0.1;
    const capabilityMarginPct = Math.max(0, Math.min(100, margin));

    // Anomaly score & health status
    let anomalyScore = (100.0 - capabilityMarginPct) / 100.0;
    let healthStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
    if (capabilityMarginPct < 40 || maxCht > 135 || engine.oilPressureBar < 1.2) {
      healthStatus = 'CRITICAL';
    } else if (capabilityMarginPct < 70 || maxCht > 120 || maxEgt > 850) {
      healthStatus = 'WARNING';
    }

    return {
      timestampMs,
      sequenceId: this.sequenceId,
      flightPhase: phase,
      // 22 parameter aviation stream
      rpm: engine.rpm,
      rpmMean5s,
      manifoldPressure: engine.manifoldPressureInHg,
      cht1: engine.chtC[0],
      cht2: engine.chtC[1],
      cht3: engine.chtC[2],
      cht4: engine.chtC[3],
      chtMax: maxCht,
      egt1: engine.egtC[0],
      egt2: engine.egtC[1],
      egt3: engine.egtC[2],
      egt4: engine.egtC[3],
      egtMax: maxEgt,
      oilTemp: engine.oilTempC,
      oilPressure: engine.oilPressureBar,
      fuelFlow: engine.fuelFlowLitersPerHour,
      fuelPressure: engine.fuelPressureBar,
      coolantTemp: engine.coolantTempC,
      airspeed: flight.indicatedAirspeedKts,
      altitude: flight.altitudeM,
      heading: flight.headingDeg,
      gForce: flight.gForce,
      capabilityMarginPct,
      anomalyScore,
      healthStatus
    };
  }
}
