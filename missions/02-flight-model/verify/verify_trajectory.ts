import * as fs from 'fs';
import * as path from 'path';
import { FlightDynamics } from '../src/FlightDynamics';
import { MissionCommand, FlightPhase } from '../../shared/schemas/types';

export function runTrajectoryVerification(): { passed: boolean; report: string; rmse: number } {
  const csvPath = path.resolve(process.cwd(), 'tests/golden-trajectories/nominal_flight_baseline.csv');
  if (!fs.existsSync(csvPath)) {
    return { passed: false, report: `Golden CSV not found at ${csvPath}`, rmse: 999 };
  }

  const rawData = fs.readFileSync(csvPath, 'utf-8').trim().split('\n');
  const headers = rawData[0].split(',');
  const rows = rawData.slice(1).map(line => {
    const parts = line.split(',');
    return {
      time_s: parseFloat(parts[0]),
      phase: parts[1] as FlightPhase,
      lat: parseFloat(parts[2]),
      lng: parseFloat(parts[3]),
      alt_m: parseFloat(parts[4]),
      ias_kts: parseFloat(parts[5]),
      tas_kts: parseFloat(parts[6]),
      rpm: parseFloat(parts[7]),
    };
  });

  const flightModel = new FlightDynamics(rows[0].lat, rows[0].lng, rows[0].alt_m);
  let totalAltSqErr = 0;
  let totalSpeedSqErr = 0;
  let count = 0;

  const logs: string[] = [];
  logs.push(`=== Mission 02 Flight Dynamics Verification vs Golden CSV ===`);
  logs.push(`Time (s) | Phase      | Sim Alt (m) | Gold Alt (m) | Sim Speed | Gold Speed`);
  logs.push(`-------------------------------------------------------------------------`);

  let prevTime = 0;
  for (const target of rows) {
    const timeDelta = target.time_s - prevTime;
    
    // Sub-step simulate up to target timestamp
    const subSteps = Math.max(1, Math.round(timeDelta / 0.5));
    const subDt = timeDelta > 0 ? timeDelta / subSteps : 1.0;

    let state: any;
    for (let s = 0; s < subSteps; s++) {
      const curTime = prevTime + (s + 1) * subDt;
      const cmd: MissionCommand = {
        timestampMs: curTime * 1000,
        missionId: 'GOLDEN-TEST',
        currentPhase: target.phase,
        activeWaypointIndex: 0,
        targetAltitudeM: target.alt_m,
        targetSpeedKts: target.ias_kts,
        targetHeadingDeg: 45,
        commandedThrottle: target.phase === 'COMPLETED' ? 0 : 0.85,
        distanceToTargetKm: 5,
        missionProgressPct: 50,
        isCompleted: target.phase === 'COMPLETED'
      };
      state = flightModel.update(cmd, subDt);
    }

    prevTime = target.time_s;

    const altErr = state.altitudeM - target.alt_m;
    const speedErr = state.indicatedAirspeedKts - target.ias_kts;

    totalAltSqErr += altErr * altErr;
    totalSpeedSqErr += speedErr * speedErr;
    count++;

    logs.push(
      `${target.time_s.toString().padEnd(8)} | ${target.phase.padEnd(10)} | ${state.altitudeM.toFixed(1).padEnd(11)} | ${target.alt_m.toFixed(1).padEnd(12)} | ${state.indicatedAirspeedKts.toFixed(1).padEnd(9)} | ${target.ias_kts.toFixed(1)}`
    );
  }

  const altRmse = Math.sqrt(totalAltSqErr / count);
  const speedRmse = Math.sqrt(totalSpeedSqErr / count);
  const normalizedRmse = (altRmse / 1500 + speedRmse / 110) / 2 * 100;

  logs.push(`-------------------------------------------------------------------------`);
  logs.push(`Altitude RMSE: ${altRmse.toFixed(2)} m`);
  logs.push(`Speed RMSE: ${speedRmse.toFixed(2)} kts`);
  logs.push(`Normalized Total Error: ${normalizedRmse.toFixed(2)}%`);

  const passed = normalizedRmse < 5.0; // within 5% normalized tolerance
  logs.push(`Trajectory Verification: ${passed ? 'PASSED ✅' : 'FAILED ❌'}`);

  return { passed, report: logs.join('\n'), rmse: normalizedRmse };
}

