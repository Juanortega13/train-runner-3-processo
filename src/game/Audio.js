/** Efectos de sonido sintetizados con Web Audio (sin archivos externos). */
export class GameAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.noiseBuffer = null;
  }

  /** Debe llamarse tras un gesto del usuario (clic o tecla). */
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.45;
        this.master.connect(this.ctx.destination);
        const len = this.ctx.sampleRate;
        this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (err) {
      console.warn('[Audio] No disponible:', err);
      this.ctx = null;
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  _ready() {
    return this.enabled && this.ctx && this.ctx.state === 'running';
  }

  _tone({ f1, f2 = f1, dur = 0.12, type = 'sine', vol = 0.3, delay = 0 }) {
    if (!this._ready()) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f1, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  _noise({ dur = 0.3, vol = 0.3, freq = 1200, freq2 = freq, type = 'lowpass' }) {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t);
    filter.frequency.exponentialRampToValueAtTime(freq2, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  coin() {
    this._tone({ f1: 988, dur: 0.07, type: 'square', vol: 0.12 });
    this._tone({ f1: 1319, dur: 0.16, type: 'square', vol: 0.12, delay: 0.06 });
  }
  jump() { this._tone({ f1: 260, f2: 560, dur: 0.18, type: 'triangle', vol: 0.25 }); }
  slide() { this._noise({ dur: 0.35, vol: 0.25, freq: 3000, freq2: 500, type: 'bandpass' }); }
  lane() { this._tone({ f1: 220, f2: 150, dur: 0.07, type: 'sine', vol: 0.12 }); }
  crash() {
    this._noise({ dur: 0.6, vol: 0.7, freq: 900, freq2: 80 });
    this._tone({ f1: 120, f2: 38, dur: 0.5, type: 'sawtooth', vol: 0.35 });
  }
}
