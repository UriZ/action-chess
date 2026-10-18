/** Synthesised battlefield audio — no asset files, everything generated live. */

let ac: AudioContext | null = null;
let noiseBuf: AudioBuffer | null = null;
let muted = false;

function ctx(): AudioContext {
  if (!ac) {
    ac = new AudioContext();
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ac.state === 'suspended') void ac.resume();
  return ac;
}

function noise(dur: number, type: BiquadFilterType, f0: number, f1: number, vol: number, t0 = 0) {
  if (muted) return;
  const c = ctx(), t = c.currentTime + t0;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const flt = c.createBiquadFilter();
  flt.type = type;
  flt.frequency.setValueAtTime(f0, t);
  flt.frequency.exponentialRampToValueAtTime(Math.max(f1, 30), t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(flt).connect(g).connect(c.destination);
  src.start(t);
  src.stop(t + dur + 0.05);
}

function tone(dur: number, type: OscillatorType, f0: number, f1: number, vol: number, t0 = 0) {
  if (muted) return;
  const c = ctx(), t = c.currentTime + t0;
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export const sfx = {
  setMuted(m: boolean) { muted = m; },
  isMuted() { return muted; },
  /** unlock audio on first user gesture */
  prime() { ctx(); },

  step(heavy = false) {
    noise(0.1, 'lowpass', heavy ? 330 : 430, 95, 0.14);
    tone(0.08, 'sine', heavy ? 62 : 76, 42, 0.09);
  },
  whoosh(dur = 0.22, vol = 0.22) { noise(dur, 'bandpass', 2400, 300, vol); },
  clang() {
    [740, 1180, 1870].forEach((f, i) => tone(0.28 - i * 0.05, 'triangle', f, f * 0.96, 0.09));
    noise(0.05, 'highpass', 4000, 3000, 0.14);
  },
  thud() { tone(0.16, 'sine', 120, 45, 0.36); noise(0.08, 'lowpass', 300, 90, 0.22); },
  bodyfall() { tone(0.22, 'sine', 95, 38, 0.42); noise(0.14, 'lowpass', 260, 70, 0.28); },
  death() { tone(0.9, 'sine', 160, 38, 0.22); noise(0.7, 'lowpass', 800, 60, 0.11, 0.1); },
  select() { tone(0.07, 'triangle', 620, 760, 0.05); },
  check() { tone(0.5, 'sawtooth', 180, 120, 0.09); noise(0.4, 'bandpass', 1400, 500, 0.08); },
  promote() {
    [523, 659, 784, 1047].forEach((f, i) => tone(0.5, 'triangle', f, f, 0.07, i * 0.08));
    noise(0.6, 'highpass', 2000, 6000, 0.08);
  },
  victory() {
    [392, 523, 659, 784].forEach((f, i) => tone(0.9, 'triangle', f, f, 0.08, i * 0.14));
  },
};
