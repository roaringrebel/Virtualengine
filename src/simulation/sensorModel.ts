import { Rotax912State, SensorSuiteState, ThermalState, VirtualSensorReading } from '../types/simulation';

export interface SensorConfig {
  unit: string;
  min: number;
  max: number;
  nominalRange: [number, number];
  warnRange: [number, number];
}

export const ROTAX_912_SENSOR_ENVELOPES: Record<keyof SensorSuiteState, SensorConfig> = {
  rpm: { unit: 'RPM', min: 0, max: 6500, nominalRange: [1400, 5500], warnRange: [1200, 5800] },
  cht: { unit: '°C', min: 20, max: 200, nominalRange: [60, 110], warnRange: [40, 128] },
  egt: { unit: '°C', min: 300, max: 1000, nominalRange: [650, 850], warnRange: [550, 880] },
  oilPressure: { unit: 'bar', min: 0, max: 8.0, nominalRange: [3.0, 5.5], warnRange: [2.0, 7.0] },
  oilTemperature: { unit: '°C', min: 20, max: 160, nominalRange: [75, 110], warnRange: [50, 130] },
  vibration: { unit: 'g', min: 0, max: 1.0, nominalRange: [0.010, 0.050], warnRange: [0, 0.080] },
  fuelFlow: { unit: 'L/h', min: 0, max: 40.0, nominalRange: [4.0, 26.0], warnRange: [2.0, 32.0] },
  fuelPressure: { unit: 'bar', min: 0, max: 6.0, nominalRange: [2.8, 4.2], warnRange: [2.0, 5.0] },
  map: { unit: 'inHg', min: 10, max: 40.0, nominalRange: [15, 32], warnRange: [12, 35] },
  engineLoad: { unit: '%', min: 0, max: 100, nominalRange: [20, 85], warnRange: [10, 95] }
};

export class SensorSuiteModel {
  private prevReadings: Partial<Record<keyof SensorSuiteState, number>> = {};

  public processReadings(
    engine: Rotax912State,
    thermal: ThermalState,
    noiseEnabled: boolean,
    simTime: number,
    engineLoadPct: number = 0
  ): SensorSuiteState {
    const rawValues: Record<keyof SensorSuiteState, number> = {
      rpm: engine.rpm,
      cht: thermal.cht,
      egt: thermal.egt,
      oilPressure: thermal.oilPressure,
      oilTemperature: thermal.oilTemperature,
      vibration: engine.vibration,
      fuelFlow: engine.fuelFlow,
      fuelPressure: engine.fuelPressure,
      map: engine.manifoldPressure,
      engineLoad: engine.engineOn ? engineLoadPct : 0
    };

    const sensors = {} as SensorSuiteState;

    (Object.keys(ROTAX_912_SENSOR_ENVELOPES) as Array<keyof SensorSuiteState>).forEach(key => {
      const cfg = ROTAX_912_SENSOR_ENVELOPES[key];
      let val = rawValues[key];

      // Add small bounded deterministic sensor noise if enabled and engine is running
      if (noiseEnabled && engine.engineOn && val > 0 && key !== 'vibration') {
        const noise = (Math.sin(simTime * 17.3 + key.length) * 0.004 + Math.cos(simTime * 31.7) * 0.003) * (cfg.max - cfg.min);
        val = Math.max(cfg.min, Math.min(cfg.max, val + noise));
      }

      // Determine Status
      let status: VirtualSensorReading['status'] = 'normal';
      if (engine.engineOn) {
        if (val < cfg.warnRange[0] || val > cfg.warnRange[1]) {
          status = 'critical';
        } else if (val < cfg.nominalRange[0] || val > cfg.nominalRange[1]) {
          status = 'warning';
        }
      }

      // Determine Trend
      const prev = this.prevReadings[key];
      let trend: VirtualSensorReading['trend'] = 'flat';
      if (prev !== undefined) {
        const diff = val - prev;
        const threshold = (cfg.max - cfg.min) * 0.002;
        if (diff > threshold) trend = 'up';
        else if (diff < -threshold) trend = 'down';
      }
      this.prevReadings[key] = val;

      sensors[key] = {
        value: Number(val.toFixed(key === 'rpm' || key === 'engineLoad' ? 0 : key === 'vibration' ? 3 : 1)),
        unit: cfg.unit,
        status,
        trend,
        min: cfg.min,
        max: cfg.max,
        nominalRange: cfg.nominalRange,
        warnRange: cfg.warnRange,
      };
    });

    return sensors;
  }
}
