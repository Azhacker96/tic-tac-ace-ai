/** Synthesised WebAudio sounds + mobile vibration — no asset downloads, works offline. */

let ctx: AudioContext | null = null;
let enabled = true;
const HAPTIC_KEY = "ttt.haptics";
let haptics = typeof window !== "undefined" ? localStorage.getItem(HAPTIC_KEY) !== "0" : true;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor({ latencyHint: "interactive" });
  }
  return ctx;
}

export function setSfxEnabled(value: boolean) {
  enabled = value;
}

export function getHapticsEnabled() {
  return haptics;
}

export function setHapticsEnabled(value: boolean) {
  haptics = value;
  try {
    localStorage.setItem(HAPTIC_KEY, value ? "1" : "0");
  } catch {
    /* storage optional */
  }
}

export function vibrate(pattern: number | number[]) {
  if (!haptics || typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* unsupported */
  }
}

interface ToneOpts {
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  slideTo?: number;
}

function tone(freq: number, duration: number, opts: ToneOpts = {}) {
  if (!enabled) return;
  const ac = audio();
  if (!ac) return;
  if (ac.state === "suspended") void ac.resume();
  const { type = "triangle", gain = 0.07, delay = 0, slideTo } = opts;
  const t = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const vol = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
  vol.gain.setValueAtTime(0.0001, t);
  vol.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  vol.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(vol).connect(ac.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

export const sfx = {
  tap: () => {
    tone(600, 0.06, { type: "square", gain: 0.04 });
    vibrate(8);
  },
  /** My own move: punchy pop. */
  place: () => {
    tone(880, 0.09, { type: "sine", gain: 0.12, slideTo: 440 });
    tone(1320, 0.04, { type: "triangle", gain: 0.03 });
    vibrate(15);
  },
  /** Opponent / computer move: softer, lower pop. */
  opponent: () => {
    tone(520, 0.1, { type: "sine", gain: 0.09, slideTo: 300 });
    vibrate(10);
  },
  /** It's your turn now (online). */
  turn: () => {
    tone(784, 0.12, { type: "sine", gain: 0.1 });
    tone(1175, 0.18, { type: "sine", gain: 0.09, delay: 0.11 });
    vibrate([35, 50, 35]);
  },
  win: () => {
    [523, 659, 784, 1046].forEach((f, i) =>
      tone(f, 0.22, { type: "triangle", gain: 0.09, delay: i * 0.09 }),
    );
    tone(1568, 0.4, { type: "sine", gain: 0.05, delay: 0.36 });
    vibrate([40, 60, 40, 60, 90]);
  },
  lose: () => {
    [392, 330, 262].forEach((f, i) =>
      tone(f, 0.24, { type: "sawtooth", gain: 0.04, delay: i * 0.12 }),
    );
    vibrate([120, 80, 60]);
  },
  draw: () => {
    tone(440, 0.16, { gain: 0.07 });
    tone(440, 0.16, { gain: 0.07, delay: 0.16 });
    vibrate([40, 80, 40]);
  },
  /** Coins earned / bonus claimed: shimmering clink. */
  coin: () => {
    tone(1319, 0.08, { type: "square", gain: 0.04 });
    tone(1976, 0.3, { type: "sine", gain: 0.07, delay: 0.07 });
    tone(2637, 0.25, { type: "sine", gain: 0.03, delay: 0.12 });
    vibrate([20, 40, 20]);
  },
  error: () => {
    tone(180, 0.18, { type: "sawtooth", gain: 0.05 });
    vibrate([50, 40, 50]);
  },
  tick: () => {
    tone(880, 0.05, { type: "square", gain: 0.03 });
    vibrate(6);
  },
};
