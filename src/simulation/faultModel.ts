import { FaultSeverity, FaultState, FaultType } from '../types/simulation';

export const FAULT_DEFINITIONS: Record<FaultType, { name: string; description: string; propagation: string[] }> = {
  NORMAL: {
    name: 'Normal Operation',
    description: 'Nominal aero-piston operating state. All sensor thermodynamics and harmonic orders balanced.',
    propagation: [
      'Engine parameters in nominal operational envelope',
      'Balanced combustion and thermal equilibrium',
      'Stable telemetry output'
    ]
  },
  LOW_OIL_PRESSURE: {
    name: 'Low Oil Pressure',
    description: 'Oil pump bypass or line pressure failure causing critical lubrication pressure drop.',
    propagation: [
      'Oil delivery pressure drops (< 2.0 bar)',
      'Hydrodynamic boundary lubrication decreases',
      'Bearing friction increases → gradual Oil Temp rise',
      'Mechanical wear alerts propagate to telemetry'
    ]
  },
  HIGH_CHT: {
    name: 'High CHT',
    description: 'Cylinder head temperature elevation due to cooling duct baffling failure or lean mixture.',
    propagation: [
      'Cooling baffle airflow restriction',
      'Combustion chamber heat retention',
      'CHT exceeds 110°C warning threshold',
      'EGT elevation follows'
    ]
  },
  OVERHEATING: {
    name: 'Overheating',
    description: 'Dual thermal runaway across cylinder heads and oil lubrication loop with power sag.',
    propagation: [
      'Severe thermal dissipation failure',
      'CHT & Oil Temp simultaneous surge',
      'Volumetric efficiency decreases → Engine power drops',
      'Critical alarms triggered across all temperature channels'
    ]
  },
  EXCESSIVE_VIBRATION: {
    name: 'Excessive Vibration',
    description: 'Mechanical rotational imbalance (propeller blade damage / engine mount fatigue).',
    propagation: [
      'Mechanical imbalance on rotating assembly',
      'High-order harmonic vibration spikes (> 0.080 g RMS)',
      'RPM develops high-frequency instability',
      'Structural stress telemetry dispatched'
    ]
  },
  RPM_INSTABILITY: {
    name: 'RPM Instability',
    description: 'Fuel governor hunting and intermittent spark irregularities causing cyclic power surging.',
    propagation: [
      'Governor control loop hunting / ignition misfire',
      'Cyclic RPM surging (± 300 RPM oscillation)',
      'Fuel flow fluctuations match surge cycle',
      'Vibration bursts accompany RPM peaks'
    ]
  },
  FUEL_PRESSURE_DROP: {
    name: 'Fuel Pressure Drop',
    description: 'Fuel supply pump restriction or filter clogging leading to lean fuel starvation.',
    propagation: [
      'Fuel rail delivery pressure falls below 2.0 bar',
      'Air-fuel mixture turns excessively lean',
      'Combustion stumble and RPM power loss',
      'EGT transient rise followed by engine hesitation'
    ]
  },
  COOLING_PROBLEM: {
    name: 'Cooling Problem',
    description: 'Ram-air cooling cowl obstruction impairs convective heat dissipation.',
    propagation: [
      'Ram-air convective heat rejection drops by 75%',
      'Cylinder head temperature climbs progressively',
      'Oil radiator heat accumulation elevates Oil Temp',
      'Thermal creep propagates to Digital Twin'
    ]
  },
  BEARING_FAULT: {
    name: 'Bearing Raceway Fatigue',
    description: 'Bearing spalling and micro-pitting creating high-frequency impulse impacts and friction.',
    propagation: [
      'Bearing race micro-defect impacts (~3.4X shaft RPM)',
      'High kurtosis & periodic high-frequency vibration spikes',
      'Friction torque buildup increases oil temperature',
      'Degradation severity accelerates over time'
    ]
  },
  MECHANICAL_FAULT: {
    name: 'Mechanical Structural Looseness',
    description: 'Engine mount degradation and crankshaft harmonic distortion generating 2X & 3X energy.',
    propagation: [
      'Mount stiffness loss causes structural asymmetric looseness',
      'Strong 2X & 3X rotational harmonic generation',
      'Broadband acoustic vibration excitation',
      'Power delivery efficiency loss'
    ]
  }
};

export function createInitialFaultState(): FaultState {
  return {
    activeFault: 'NORMAL',
    severity: 'LOW',
    elapsedSeconds: 0,
    description: FAULT_DEFINITIONS.NORMAL.description,
    propagationPath: FAULT_DEFINITIONS.NORMAL.propagation
  };
}
