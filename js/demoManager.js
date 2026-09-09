/**
 * Automated Demo Mode Orchestrator
 * Runs scripted simulation sequence demonstrating nominal flight, progressive engine loading,
 * fault injection, and live telemetry streaming to the Digital Twin.
 */

export class DemoManager {
  constructor(pipeline, telemetryService, onStateUpdate) {
    this.pipeline = pipeline;
    this.telemetry = telemetryService;
    this.onStateUpdate = onStateUpdate;
    this.isRunning = false;
    this.currentStep = 0;
    this.elapsedInStep = 0;
    this.timerId = null;
    this.timeScale = 1.0;

    this.steps = [
      {
        id: 1,
        name: 'STAGE 1: NOMINAL CRUISE FLIGHT',
        description: 'UAV at 8,000 ft cruise, 70% throttle, balanced temperatures, nominal vibration (~2.1 mm/s).',
        duration: 8, // seconds
        action: (controls) => {
          controls.flightPhase = 'CRUISE';
          controls.throttle = 70;
          controls.altitude = 8000;
          controls.airspeed = 145;
          controls.engineLoad = 50;
          controls.ambientTemp = 15;
          this.pipeline.state.faultState.mode = 'NORMAL';
        }
      },
      {
        id: 2,
        name: 'STAGE 2: GRADUAL ENGINE LOAD INCREASE',
        description: 'Increasing throttle to 95% and engine load to 85%. MAP increases, fuel flow surges to ~28 L/h, CHT warms.',
        duration: 10,
        action: (controls) => {
          controls.flightPhase = 'CLIMB';
          controls.throttle = 95;
          controls.altitude = 11500;
          controls.airspeed = 165;
          controls.engineLoad = 85;
        }
      },
      {
        id: 3,
        name: 'STAGE 3: FAULT INJECTION (EXCESSIVE VIBRATION)',
        description: 'Injecting mechanical imbalance fault. Vibration jumps to >10 mm/s, RPM develops harmonic jitter, oil temperature creeps upward.',
        duration: 12,
        action: (controls) => {
          this.pipeline.state.faultState.mode = 'EXCESSIVE VIBRATION';
          this.pipeline.state.faultState.elapsed = 0;
        }
      },
      {
        id: 4,
        name: 'STAGE 4: SENSOR VALUE ANOMALY PROPAGATION',
        description: 'Vibration and thermal degradation propagate across all virtual sensors. Telemetry stream continuously dispatches packets.',
        duration: 10,
        action: (controls) => {
          controls.engineLoad = 90;
        }
      },
      {
        id: 5,
        name: 'STAGE 5: DEMO COMPLETE (LIVE STREAMING)',
        description: 'Demonstration sequence complete. Virtual engine continues streaming live anomalous telemetry to Digital Twin receiver.',
        duration: 5,
        action: (controls) => {
          // Keep active
        }
      }
    ];
  }

  startDemo(controls) {
    this.stopDemo();
    this.isRunning = true;
    this.currentStep = 0;
    this.elapsedInStep = 0;
    this.controls = controls;

    // Ensure telemetry streaming is turned on during demo
    if (!this.telemetry.isStreaming) {
      this.telemetry.start(() => this.pipeline.state.telemetry.packet);
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
      step.action(this.controls);
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
