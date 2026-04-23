import { DroneState } from './types';

export class Audio {
  private ctx: AudioContext | null = null;
  private motorOscillators: OscillatorNode[] = [];
  private motorGains: GainNode[] = [];
  private windGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private initialized = false;
  private unlocked = false;

  constructor() {
    // Unlock on first interaction
    const unlock = (): void => {
      this.initAudio();
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
    };
    window.addEventListener('keydown', unlock);
    window.addEventListener('click', unlock);
    window.addEventListener('touchstart', unlock);
  }

  private initAudio(): void {
    if (this.initialized) return;
    this.initialized = true;

    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.4;
      this.masterGain.connect(this.ctx.destination);

      this.createMotors();
      this.createWind();
      this.unlocked = true;
    } catch {
      // Audio not available
    }
  }

  private createMotors(): void {
    if (!this.ctx || !this.masterGain) return;

    // 4 motor oscillators (slightly detuned for richness)
    const detuneOffsets = [0, 3, -2, 5];

    for (let i = 0; i < 4; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.value = 80 + detuneOffsets[i];
      gain.gain.value = 0;

      // Add some distortion for realism
      const waveshaper = this.ctx.createWaveShaper();
      waveshaper.curve = this.makeDistortionCurve(50);
      waveshaper.oversample = '2x';

      // Filter to soften
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1200;
      filter.Q.value = 0.8;

      osc.connect(waveshaper);
      waveshaper.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start();

      this.motorOscillators.push(osc);
      this.motorGains.push(gain);
    }
  }

  private makeDistortionCurve(amount: number): Float32Array<ArrayBuffer> {
    const samples = 256;
    const buf = new ArrayBuffer(samples * 4);
    const curve = new Float32Array(buf);
    const deg = Math.PI / 180;
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }
    return curve as Float32Array<ArrayBuffer>;
  }

  private createWind(): void {
    if (!this.ctx || !this.masterGain) return;

    // White noise buffer for wind
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const windGain = this.ctx.createGain();
    windGain.gain.value = 0;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 600;
    filter.Q.value = 0.5;

    source.connect(filter);
    filter.connect(windGain);
    windGain.connect(this.masterGain);
    source.start();

    this.windGain = windGain;
    void source; // keep reference via closure (source is started and looping)
  }

  update(state: DroneState): void {
    if (!this.unlocked || !this.ctx) return;

    const t = this.ctx.currentTime;
    const smoothing = 0.05;

    if (state.armed && !state.crashed) {
      const freq = 80 + state.throttle * 420;
      const motorVol = 0.06 + state.throttle * 0.12;

      for (let i = 0; i < 4; i++) {
        const osc = this.motorOscillators[i];
        const gain = this.motorGains[i];
        // Slight variation per motor
        osc.frequency.setTargetAtTime(freq + i * 3, t, smoothing);
        gain.gain.setTargetAtTime(motorVol, t, smoothing);
      }
    } else {
      for (const gain of this.motorGains) {
        gain.gain.setTargetAtTime(0, t, 0.1);
      }
    }

    // Wind sound based on speed
    if (this.windGain) {
      const speed = state.velocity.length();
      const windVol = Math.min(0.3, speed * 0.012);
      this.windGain.gain.setTargetAtTime(windVol, t, 0.15);
    }
  }

  playCrash(): void {
    if (!this.unlocked || !this.ctx || !this.masterGain) return;

    // Noise burst
    const bufferSize = this.ctx.sampleRate * 0.5;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 0.5);
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const gain = this.ctx.createGain();
    gain.gain.value = 0.6;
    gain.gain.setTargetAtTime(0, this.ctx.currentTime + 0.1, 0.1);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    filter.frequency.setTargetAtTime(80, this.ctx.currentTime, 0.15);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start();

    // Pitch drop on motors
    for (const osc of this.motorOscillators) {
      osc.frequency.setTargetAtTime(30, this.ctx.currentTime, 0.3);
    }
    for (const g of this.motorGains) {
      g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
    }
  }

  dispose(): void {
    this.ctx?.close();
  }
}
