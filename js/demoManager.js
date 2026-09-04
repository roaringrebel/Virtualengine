/**
 * Automated Demo Mode Orchestrator
 * Runs scripted simulation sequence demonstrating nominal flight, progressive engine loading,
 * fault injection (Excessive Vibration), and live telemetry streaming to the Digital Twin.
 */

export class DemoManager {
  constructor(physicsEngine, telemetryService, onStateUpdate) {
    this.physics = physicsEngine;
    this.telemetry = telemetryService;
    this.onStateUpdate = onStateUpdate;
    this.isRunning = false;
    this.currentStep = 0;
    this.elapsedInStep = 0;
    this.timerId = null;

    this.steps = [
      {
        id: 1,
        name: 'STAGE 1: NOMINAL CRUISE FLIGHT',
        description: 'UAV at 8,000 ft cruise, 70% throttle, balanced temperatures, nominal vibration (~2.1 mm/s).',
        duration: 8, // seconds
        action: () => {
          this.physics.setControl('flightPhase', 'CRUISE');
          this.physics.setControl('throttle', 70);
          this.physics.setControl('altitude', 8000);
          this.physics.setControl('airspeed', 145);
          this.physics.setControl('engineLoad', 50);
          this.physics.setControl('ambientTemp', 15);
          this.physics.setFault('NORMAL');
        }
      },
      {
        id: 2,
        name: 'STAGE 2: GRADUAL ENGINE LOAD INCREASE',
        description: 'Increasing throttle to 95% and engine load to 85%. MAP increases, fuel flow surges to ~28 L/h, CHT warms.',
        duration: 10,
        action: () => {
          this.physics.setControl('flightPhase', 'CLIMB');
          this.physics.setControl('throttle', 95);
          this.physics.setControl('altitude', 11500);
          this.physics.setControl('airspeed', 165);
          this.physics.setControl('engineLoad', 85);
        }
      },
      {
        id: 3,
        name: 'STAGE 3: FAULT INJECTION (EXCESSIVE VIBRATION)',
        description: 'Injecting mechanical imbalance fault. Vibration jumps to >10 mm/s, RPM develops harmonic jitter, oil temperature creeps upward.',
        duration: 12,
        action: () => {
          this.physics.setFault('EXCESSIVE VIBRATION');
        }
      },
      {
        id: 4,
        name: 'STAGE 4: SENSOR VALUE ANOMALY PROPAGATION',
        description: 'Vibration and thermal degradation propagate across all virtual sensors. Telemetry stream continuously dispatches packets.',
        duration: 10,
        action: () => {
          // Keep vibration fault active, increase load
          this.physics.setControl('engineLoad', 90);
        }
      },
      {
        id: 5,
        name: 'STAGE 5: DEMO COMPLETE (LIVE STREAMING)',
        description: 'Demonstration sequence complete. Virtual engine continues streaming live anomalous telemetry to Digital Twin receiver.',
        duration: 5,
        action: () => {
          // Keep active
        }
      }
    ];
  }

  startDemo() {
    this.stopDemo();
    this.isRunning = true;
    this.currentStep = 0;
    this.elapsedInStep = 0;

    // Ensure telemetry streaming is turned on during demo
    if (!this.telemetry.isStreaming) {
      this.telemetry.start(() => this.physics.getTelemetryPacket());
    }

    this._executeCurrentStep();
    this.timerId = setInterval(() => this._tick(), 1000);
    this._notify();
  }

  stopDemo() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.isRunning = false;
    this._notify();
  }

  _tick() {
    if (!this.isRunning) return;

    this.elapsedInStep++;
    const step = this.steps[this.currentStep];

    if (this.elapsedInStep >= step.duration) {
      if (this.currentStep < this.steps.length - 1) {
        this.currentStep++;
        this.elapsedInStep = 0;
        this._executeCurrentStep();
      } else {
        // Finished all steps
        this.stopDemo();
      }
    }
    this._notify();
  }

  _executeCurrentStep() {
    const step = this.steps[this.currentStep];
    if (step && step.action) {
      step.action();
    }
  }

  _notify() {
    if (this.onStateUpdate) {
      const step = this.steps[this.currentStep];
      this.onStateUpdate({
        isRunning: this.isRunning,
        stepIndex: this.currentStep,
        totalSteps: this.steps.length,
        stepName: step ? step.name : '',
        stepDescription: step ? step.description : '',
        remainingInStep: step ? Math.max(0, step.duration - this.elapsedInStep) : 0,
        duration: step ? step.duration : 0
      });
    }
  }
}
