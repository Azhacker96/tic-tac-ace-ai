/** Tiny WebAudio blips — no asset downloads, works offline. */

let ctx: AudioContext | null = null;
let enabled = true;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

export function setSfxEnabled(value: boolean) {
  enabled = value;
}

function tone(freq: number, duration: number, type: OscillatorType = "triangle", gain = 0.07) {
  if (!enabled) return;
  const ac = audio();
  if (!ac) return;
  if (ac.state === "suspended") void ac.resume();
  const osc = ac.createOscillator();
  const vol = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  vol.gain.setValueAtTime(gain, ac.currentTime);
  vol.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);
  osc.connect(vol).connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + duration);
}

export const sfx = {
  tap: () => tone(520, 0.08, "square", 0.05),
  place: () => tone(660, 0.12),
  opponent: () => tone(420, 0.12),
  win: () => {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.18), i * 90));
  },
  lose: () => {
    [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.22, "sawtooth", 0.05), i * 110));
  },
  draw: () => {
    [440, 440].forEach((f, i) => setTimeout(() => tone(f, 0.16), i * 160));
  },
  error: () => tone(180, 0.18, "sawtooth", 0.05),
  tick: () => tone(880, 0.05, "square", 0.03),
};
