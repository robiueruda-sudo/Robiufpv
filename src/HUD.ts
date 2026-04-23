import { DroneState } from './types';

export class HUD {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private battery = 100; // percent
  private batteryDrainRate = 1.5; // percent per minute

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot get 2D context for HUD');
    this.ctx = ctx;
    this.resize();
    window.addEventListener('resize', this.resize.bind(this));
  }

  resize(): void {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  update(state: DroneState, dt: number): void {
    // Drain battery when armed
    if (state.armed && !state.crashed) {
      this.battery = Math.max(0, this.battery - (this.batteryDrainRate / 60) * dt);
    }
  }

  resetBattery(): void {
    this.battery = 100;
  }

  draw(state: DroneState): void {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const cx = W / 2;
    const cy = H / 2;

    ctx.clearRect(0, 0, W, H);

    if (state.crashed) {
      this.drawCrashScreen(W, H);
      return;
    }

    // -- Crosshair --
    this.drawCrosshair(cx, cy);

    // -- Artificial horizon --
    this.drawHorizon(cx, cy, state);

    // -- Speed top-left --
    const speed = state.velocity.length() * 3.6; // m/s to km/h
    this.drawLabel(20, 20, `SPD: ${speed.toFixed(1)} km/h`);

    // -- Altitude top-right --
    const alt = Math.max(0, state.position.y);
    this.drawLabel(W - 20, 20, `ALT: ${alt.toFixed(1)} m`, 'right');

    // -- Battery top-center --
    this.drawBattery(cx, 20);

    // -- Throttle bar left --
    this.drawThrottleBar(30, H * 0.25, H * 0.5, state.throttle);

    // -- Armed indicator bottom-center --
    this.drawArmedIndicator(cx, H - 30, state.armed);

    // -- G-force / tilt indicator --
    this.drawTiltIndicator(W - 80, H - 80, state);

    // -- FPV frame overlay --
    this.drawFPVFrame(W, H);
  }

  private drawCrosshair(cx: number, cy: number): void {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 1.5;

    const len = 12;
    const gap = 4;

    // Center dot
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.beginPath();
    ctx.arc(cx, cy, 2, 0, Math.PI * 2);
    ctx.fill();

    // Cross lines
    ctx.beginPath();
    ctx.moveTo(cx - len - gap, cy);
    ctx.lineTo(cx - gap, cy);
    ctx.moveTo(cx + gap, cy);
    ctx.lineTo(cx + len + gap, cy);
    ctx.moveTo(cx, cy - len - gap);
    ctx.lineTo(cx, cy - gap);
    ctx.moveTo(cx, cy + gap);
    ctx.lineTo(cx, cy + len + gap);
    ctx.stroke();
  }

  private drawHorizon(cx: number, cy: number, state: DroneState): void {
    const ctx = this.ctx;
    const roll  = state.rotation.z;
    const pitch = state.rotation.x;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-roll);

    const pitchPixels = pitch * (180 / Math.PI) * 2.5; // px per degree

    // Horizon line
    ctx.strokeStyle = 'rgba(255, 200, 50, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-70, pitchPixels);
    ctx.lineTo(-20, pitchPixels);
    ctx.moveTo( 20, pitchPixels);
    ctx.lineTo( 70, pitchPixels);
    ctx.stroke();

    // Pitch ladder marks
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.textAlign = 'right';

    for (let deg = -30; deg <= 30; deg += 10) {
      if (deg === 0) continue;
      const y = pitchPixels - deg * 2.5;
      const len = deg % 20 === 0 ? 30 : 15;
      ctx.beginPath();
      ctx.moveTo(-len, y);
      ctx.lineTo( len, y);
      ctx.stroke();
      ctx.fillText(`${deg}`, -len - 4, y + 4);
    }

    ctx.restore();
  }

  private drawLabel(
    x: number,
    y: number,
    text: string,
    align: CanvasTextAlign = 'left'
  ): void {
    const ctx = this.ctx;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = align;
    ctx.textBaseline = 'top';

    const metrics = ctx.measureText(text);
    const padX = 6, padY = 3;
    const bx = align === 'right' ? x - metrics.width - padX : x - padX;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(bx, y - padY, metrics.width + padX * 2, 20 + padY * 2);

    ctx.fillStyle = '#00ff88';
    ctx.fillText(text, x, y);
  }

  private drawBattery(cx: number, y: number): void {
    const ctx = this.ctx;
    const bw = 80, bh = 20;
    const bx = cx - bw / 2;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(bx - 4, y - 3, bw + 12, bh + 6);

    // Battery body
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx, y, bw, bh);

    // Battery tip
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillRect(bx + bw + 2, y + 5, 4, bh - 10);

    // Fill level
    const fillPct = this.battery / 100;
    const fillColor = this.battery > 50 ? '#00ff88'
      : this.battery > 20 ? '#ffaa00'
      : '#ff2200';
    ctx.fillStyle = fillColor;
    ctx.fillRect(bx + 1, y + 1, (bw - 2) * fillPct, bh - 2);

    // Text
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${Math.round(this.battery)}%`, cx, y + bh / 2);
  }

  private drawThrottleBar(x: number, y: number, barH: number, throttle: number): void {
    const ctx = this.ctx;
    const barW = 12;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(x - 4, y - 4, barW + 8 + 30, barH + 8);

    // Track
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, barW, barH);

    // Fill (bottom to top)
    const fillH = barH * throttle;
    ctx.fillStyle = '#00aaff';
    ctx.fillRect(x + 1, y + barH - fillH + 1, barW - 2, fillH - 2);

    // Label
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText('THR', x + barW + 5, y);
    ctx.fillText(`${Math.round(throttle * 100)}%`, x + barW + 5, y + 12);
  }

  private drawArmedIndicator(cx: number, y: number, armed: boolean): void {
    const ctx = this.ctx;
    const text = armed ? 'ARMED' : 'DISARMED';
    const color = armed ? '#00ff00' : '#ff2200';

    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    const metrics = ctx.measureText(text);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(cx - metrics.width / 2 - 8, y - 22, metrics.width + 16, 26);

    ctx.fillStyle = color;
    ctx.fillText(text, cx, y);

    if (!armed) {
      ctx.font = '11px monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.fillText('Press SPACE to arm', cx, y + 16);
    }
  }

  private drawTiltIndicator(cx: number, cy: number, state: DroneState): void {
    const ctx = this.ctx;
    const r = 30;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    // Ball position based on roll/pitch
    const ballX = cx + (state.rotation.z / (Math.PI / 2)) * r;
    const ballY = cy + (state.rotation.x / (Math.PI / 2)) * r;

    ctx.fillStyle = '#00ff88';
    ctx.beginPath();
    ctx.arc(ballX, ballY, 5, 0, Math.PI * 2);
    ctx.fill();

    // Center crosshair
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.moveTo(cx - r, cy);
    ctx.lineTo(cx + r, cy);
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx, cy + r);
    ctx.stroke();
  }

  private drawFPVFrame(W: number, H: number): void {
    const ctx = this.ctx;
    // Corner brackets for FPV look
    const blen = 30, bthick = 2;
    const margin = 15;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = bthick;

    const corners = [
      { x: margin, y: margin, dx: 1, dy: 1 },
      { x: W - margin, y: margin, dx: -1, dy: 1 },
      { x: margin, y: H - margin, dx: 1, dy: -1 },
      { x: W - margin, y: H - margin, dx: -1, dy: -1 },
    ];

    for (const c of corners) {
      ctx.beginPath();
      ctx.moveTo(c.x + c.dx * blen, c.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(c.x, c.y + c.dy * blen);
      ctx.stroke();
    }
  }

  private drawCrashScreen(W: number, H: number): void {
    const ctx = this.ctx;

    ctx.fillStyle = 'rgba(180, 0, 0, 0.35)';
    ctx.fillRect(0, 0, W, H);

    ctx.font = 'bold 52px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ff2222';
    ctx.fillText('CRASHED', W / 2, H / 2 - 30);

    ctx.font = '22px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Press R to reset', W / 2, H / 2 + 20);

    // Draw crash debris effect
    ctx.strokeStyle = 'rgba(255, 50, 50, 0.6)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const len = 20 + Math.sin(i * 1.7) * 15;
      const sx = W / 2 + Math.cos(angle) * 80;
      const sy = H / 2 - 30 + Math.sin(angle) * 40;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(angle) * len, sy + Math.sin(angle) * len);
      ctx.stroke();
    }
  }
}
