/**
 * Real-Time Telemetry Oscilloscope Charts
 * High-performance Canvas 2D rolling graph renderer with threshold bands and glow aesthetics.
 */

export class TelemetryOscilloscope {
  constructor(canvasElement, options = {}) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.title = options.title || 'Parameter';
    this.unit = options.unit || '';
    this.color = options.color || '#00f0ff';
    this.minVal = options.minVal !== undefined ? options.minVal : 0;
    this.maxVal = options.maxVal !== undefined ? options.maxVal : 100;
    this.warnLow = options.warnLow;
    this.warnHigh = options.warnHigh;
    this.critLow = options.critLow;
    this.critHigh = options.critHigh;
    this.maxHistory = options.maxHistory || 90; // ~45-90 seconds at typical update rates

    this.history = [];
    this.lastValue = 0;
    this.status = 'normal';

    this.setupCanvasDpi();
    window.addEventListener('resize', () => this.setupCanvasDpi());
  }

  setupCanvasDpi() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.width = rect.width || 300;
    this.height = rect.height || 120;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.scale(dpr, dpr);
  }

  pushValue(value, status = 'normal') {
    this.lastValue = value;
    this.status = status;
    this.history.push({
      val: value,
      time: Date.now(),
      status: status
    });
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  render() {
    if (!this.ctx || !this.width || !this.height) return;

    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Clear background
    ctx.clearRect(0, 0, w, h);

    // Dark grid background
    ctx.fillStyle = 'rgba(8, 14, 23, 0.75)';
    ctx.fillRect(0, 0, w, h);

    // Draw grid lines
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Horizontal grid lines (4 divisions)
    for (let i = 1; i < 4; i++) {
      const y = (h / 4) * i;
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    // Vertical grid lines (6 divisions)
    for (let i = 1; i < 6; i++) {
      const x = (w / 6) * i;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    ctx.stroke();

    // Warning / Critical Threshold Zones
    const valToY = (val) => {
      const clamped = Math.max(this.minVal, Math.min(this.maxVal, val));
      const normalized = (clamped - this.minVal) / (this.maxVal - this.minVal);
      return h - normalized * (h - 16) - 8;
    };

    if (this.critHigh !== undefined) {
      const yCrit = valToY(this.critHigh);
      ctx.fillStyle = 'rgba(255, 51, 102, 0.1)';
      ctx.fillRect(0, 0, w, yCrit);
      
      ctx.strokeStyle = 'rgba(255, 51, 102, 0.35)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, yCrit);
      ctx.lineTo(w, yCrit);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (this.history.length < 2) return;

    // Select color based on current status
    let traceColor = this.color;
    if (this.status === 'warning') traceColor = '#ffb700';
    if (this.status === 'critical') traceColor = '#ff3366';

    const stepX = w / (this.maxHistory - 1);
    const startIndex = this.maxHistory - this.history.length;

    // Draw area gradient under trace
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, traceColor.replace(')', ', 0.35)').replace('rgb', 'rgba').replace('#', 'rgba('));
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');

    ctx.beginPath();
    this.history.forEach((pt, idx) => {
      const x = (startIndex + idx) * stepX;
      const y = valToY(pt.val);
      if (idx === 0) {
        ctx.moveTo(x, h);
        ctx.lineTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.lineTo((startIndex + this.history.length - 1) * stepX, h);
    ctx.closePath();
    ctx.fillStyle = `rgba(${this.hexToRgb(traceColor)}, 0.12)`;
    ctx.fill();

    // Draw glowing trace line
    ctx.shadowColor = traceColor;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = traceColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    this.history.forEach((pt, idx) => {
      const x = (startIndex + idx) * stepX;
      const y = valToY(pt.val);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Draw active leading point
    const lastX = (startIndex + this.history.length - 1) * stepX;
    const lastY = valToY(this.lastValue);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = traceColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Corner Value Display
    ctx.fillStyle = traceColor;
    ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    const textVal = typeof this.lastValue === 'number' ? this.lastValue.toFixed(1) : this.lastValue;
    ctx.fillText(`${textVal} ${this.unit}`, w - 6, 14);
  }

  hexToRgb(hex) {
    if (hex.startsWith('rgba') || hex.startsWith('rgb')) return '0, 240, 255';
    let c = hex.substring(1);
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
  }
}

export class TelemetryGraphsManager {
  constructor() {
    this.graphs = {};
  }

  registerGraph(id, canvasElement, options) {
    this.graphs[id] = new TelemetryOscilloscope(canvasElement, options);
  }

  update(physicsState, physicsEngine) {
    if (this.graphs.rpm) {
      const status = physicsEngine.getSensorStatus('rpm', physicsState.rpm);
      this.graphs.rpm.pushValue(physicsState.rpm, status);
      this.graphs.rpm.render();
    }
    if (this.graphs.cht) {
      const status = physicsEngine.getSensorStatus('cht', physicsState.cht);
      this.graphs.cht.pushValue(physicsState.cht, status);
      this.graphs.cht.render();
    }
    if (this.graphs.egt) {
      const status = physicsEngine.getSensorStatus('egt', physicsState.egt);
      this.graphs.egt.pushValue(physicsState.egt, status);
      this.graphs.egt.render();
    }
    if (this.graphs.oilPressure) {
      const status = physicsEngine.getSensorStatus('oilPressure', physicsState.oilPressure);
      this.graphs.oilPressure.pushValue(physicsState.oilPressure, status);
      this.graphs.oilPressure.render();
    }
    if (this.graphs.vibration) {
      const status = physicsEngine.getSensorStatus('vibration', physicsState.vibration);
      this.graphs.vibration.pushValue(physicsState.vibration, status);
      this.graphs.vibration.render();
    }
    if (this.graphs.fuelFlow) {
      const status = physicsEngine.getSensorStatus('fuelFlow', physicsState.fuelFlow);
      this.graphs.fuelFlow.pushValue(physicsState.fuelFlow, status);
      this.graphs.fuelFlow.render();
    }
  }
}
