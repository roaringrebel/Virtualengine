export const simulationState = {
  uavMission: {
    uavId: 'UAV-01',
    engineId: 'ROT-912-01',
    source: 'Base A',
    destination: 'Point B',
    distance: 120, // km
    bearing: 270,
    plannedDuration: 3600, // sec
    missionStatus: 'PLANNING', // PLANNING, ACTIVE, COMPLETED, DIVERTED, LANDED
    remainingDistance: 120,
    remainingTime: 3600
  },
  flightModel: {
    phase: 'CRUISE',
    altitude: 8000,
    airspeed: 145,
    heading: 270,
    throttle: 70,
    engineLoad: 50,
    wind: { speed: 10, direction: 180 },
    ambientTemp: 15,
    pitch: 0,
    roll: 0,
    yaw: 270
  },
  engineModel: {
    simTime: 0,
    rpm: 5100,
    cht: 90.0,
    egt: 790.0,
    oilPressure: 5.1,
    oilTemperature: 85.0,
    vibration: 2.1,
    fuelFlow: 18.2,
    fuelPressure: 3.4,
    map: 28.0,
    torque: 0,
    power: 0,
    heatGen: 0,
    coolingRate: 0,
    oilBehavior: {},
    vibrationBehavior: {}
  },
  sensors: {
    rpm: { value: 5100, noise: 0 },
    cht: { value: 90, noise: 0 },
    egt: { value: 790, noise: 0 },
    oilPressure: { value: 5.1, noise: 0 },
    oilTemperature: { value: 85, noise: 0 },
    fuelFlow: { value: 18.2, noise: 0 },
    fuelPressure: { value: 3.4, noise: 0 },
    map: { value: 28, noise: 0 },
    vibration: { value: 2.1, noise: 0 }
  },
  faultState: {
    mode: 'NORMAL',
    intensity: 0,
    startTime: null,
    elapsed: 0,
    perturbations: {}
  },
  telemetry: {
    packet: {},
    sequenceNumber: 0,
    timestamp: null,
    apiStatus: 'DISCONNECTED'
  },
  digitalTwin: {
    expectedState: {},
    modelVersion: '1.0'
  },
  deviations: {
    rpm: 0,
    cht: 0,
    egt: 0,
    oilPressure: 0,
    oilTemperature: 0,
    fuelFlow: 0,
    fuelPressure: 0,
    map: 0,
    vibration: 0
  },
  aiOutputs: {
    faultDetected: 'NORMAL',
    anomalyScore: 0,
    soh: 1.0,
    rul: 3600
  },
  missionReliability: {
    score: 1.0,
    riskLevel: 'LOW',
    criticalFactors: []
  },
  missionDecision: {
    status: 'GO', // GO, CAUTION, NO-GO
    reason: 'Nominal'
  },
  recovery: {
    status: 'NONE', // NONE, RTB, DIVERT
    targetELP: null,
    distanceToTarget: 0
  }
};
