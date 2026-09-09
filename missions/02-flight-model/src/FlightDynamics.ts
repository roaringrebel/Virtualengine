import { MissionCommand, FlightState } from '../../shared/schemas/types';

export interface AirframeConfig {
  emptyWeightKg: number;
  maxTakeoffWeightKg: number;
  wingAreaM2: number;
  cd0: number;
  vStallKts: number;
  vCruiseKts: number;
  vNeKts: number;
}

export class FlightDynamics {
  private lat: number;
  private lng: number;
  private altitudeM: number;
  private indicatedAirspeedKts: number = 0;
  private headingDeg: number = 0;
  private pitchDeg: number = 0;
  private rollDeg: number = 0;
  private verticalSpeedFpm: number = 0;
  private gForce: number = 1.0;

  private config: AirframeConfig = {
    emptyWeightKg: 320,
    maxTakeoffWeightKg: 550,
    wingAreaM2: 9.2,
    cd0: 0.024,
    vStallKts: 48,
    vCruiseKts: 110,
    vNeKts: 165
  };

  constructor(initialLat: number = 13.0827, initialLng: number = 80.2707, initialAltM: number = 0) {
    this.lat = initialLat;
    this.lng = initialLng;
    this.altitudeM = initialAltM;
  }

  public update(cmd: MissionCommand, dtSec: number): FlightState {
    const isCompleted = cmd.currentPhase === 'COMPLETED';

    // 1. Atmosphere Calculation (ISA standard)
    const T0 = 288.15; // K
    const P0 = 101325; // Pa
    const rho0 = 1.225; // kg/m3
    const L = 0.0065; // K/m
    const g = 9.80665;
    const R = 287.05;

    const ambientTempK = Math.max(216.65, T0 - L * this.altitudeM);
    const ambientTempC = ambientTempK - 273.15;
    const ambientPressurePa = P0 * Math.pow(ambientTempK / T0, g / (R * L));
    const ambientPressureHpa = ambientPressurePa / 100.0;
    const airDensityKgM3 = ambientPressurePa / (R * ambientTempK);

    if (isCompleted) {
      this.indicatedAirspeedKts = Math.max(0, this.indicatedAirspeedKts - 15 * dtSec);
      this.verticalSpeedFpm = 0;
      this.altitudeM = 0;
      this.pitchDeg = 0;
      this.rollDeg = 0;
      this.gForce = 1.0;
    } else {
      // 2. Airspeed Dynamics
      const targetSpeed = cmd.targetSpeedKts;
      const speedRate = cmd.commandedThrottle > 0.5 ? 4.5 : 2.5;
      const speedError = targetSpeed - this.indicatedAirspeedKts;
      this.indicatedAirspeedKts += Math.sign(speedError) * Math.min(Math.abs(speedError), speedRate * dtSec);

      // 3. Altitude & Vertical Speed Dynamics
      const altError = cmd.targetAltitudeM - this.altitudeM;
      const targetVsFpm = Math.max(-3500, Math.min(3500, altError * 10.0));
      const vsError = targetVsFpm - this.verticalSpeedFpm;
      this.verticalSpeedFpm += Math.sign(vsError) * Math.min(Math.abs(vsError), 2000 * dtSec);

      const altChangeM = (this.verticalSpeedFpm / 196.85) * dtSec;
      this.altitudeM = Math.max(0, this.altitudeM + altChangeM);

      // 4. Heading & Attitude Dynamics
      let headingDiff = (cmd.targetHeadingDeg - this.headingDeg + 540) % 360 - 180;
      const maxTurnRateDegPerSec = 4.0;
      const headingStep = Math.sign(headingDiff) * Math.min(Math.abs(headingDiff), maxTurnRateDegPerSec * dtSec);
      this.headingDeg = (this.headingDeg + headingStep + 360) % 360;

      this.rollDeg = Math.max(-30, Math.min(30, headingDiff * 0.8));
      this.pitchDeg = Math.max(-12, Math.min(15, (this.verticalSpeedFpm / 100.0)));
      this.gForce = 1.0 + (this.verticalSpeedFpm > 800 ? 0.2 : (this.verticalSpeedFpm < -600 ? -0.15 : 0.0));

      // 5. Kinematic Great Circle Position Update
      const tasKts = this.indicatedAirspeedKts * Math.sqrt(rho0 / airDensityKgM3);
      const groundSpeedMps = (tasKts * 0.514444);
      const distanceMovedM = groundSpeedMps * dtSec;

      const headingRad = this.headingDeg * (Math.PI / 180.0);
      const latChangeDeg = (distanceMovedM * Math.cos(headingRad)) / 111139.0;
      const lngChangeDeg = (distanceMovedM * Math.sin(headingRad)) / (111139.0 * Math.cos(this.lat * Math.PI / 180.0));

      this.lat += latChangeDeg;
      this.lng += lngChangeDeg;
    }

    const tasKts = this.indicatedAirspeedKts * Math.sqrt(rho0 / airDensityKgM3);

    return {
      timestampMs: cmd.timestampMs,
      latitude: this.lat,
      longitude: this.lng,
      altitudeM: this.altitudeM,
      indicatedAirspeedKts: this.indicatedAirspeedKts,
      trueAirspeedKts: tasKts,
      groundSpeedKts: tasKts,
      verticalSpeedFpm: this.verticalSpeedFpm,
      headingDeg: this.headingDeg,
      pitchDeg: this.pitchDeg,
      rollDeg: this.rollDeg,
      yawDeg: this.headingDeg,
      angleOfAttackDeg: Math.max(0, 12 - (this.indicatedAirspeedKts / 10)),
      gForce: this.gForce,
      ambientTempC,
      ambientPressureHpa,
      airDensityKgM3
    };
  }

  public getPosition() {
    return { lat: this.lat, lng: this.lng, altMeters: this.altitudeM };
  }
}
