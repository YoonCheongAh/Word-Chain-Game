const MUTE_KEY = "wordle_sound_muted";

let context = null;
let masterGain = null;
let muted = (() => {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
})();

async function getContext() {
  if (typeof window === "undefined") return null;
  if (!context) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    context = new AudioContextClass();
    masterGain = context.createGain();
    masterGain.gain.value = muted ? 0 : 0.42;
    masterGain.connect(context.destination);
  }
  if (context.state === "suspended") {
    try {
      await context.resume();
    } catch {
      return null;
    }
  }
  return context.state === "running" ? context : null;
}

function tone(ac, type, from, to, duration, volume, delay = 0) {
  if (!ac) return;
  const start = ac.currentTime + delay;
  const oscillator = ac.createOscillator();
  const gain = ac.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(from, start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(masterGain);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function chord(ac, frequencies, type = "triangle", volume = 0.14, step = 0.09, delay = 0) {
  frequencies.forEach((frequency, index) => {
    tone(ac, type, frequency, frequency * 1.01, 0.22, volume, delay + index * step);
  });
}

const SOUNDS = {
  click(ac, delay) {
    tone(ac, "triangle", 420, 540, 0.055, 0.09, delay);
  },
  key(ac, delay) {
    tone(ac, "sine", 420, 560, 0.045, 0.07, delay);
  },
  backspace(ac, delay) {
    tone(ac, "triangle", 460, 260, 0.07, 0.08, delay);
  },
  invalid(ac, delay) {
    tone(ac, "sawtooth", 190, 105, 0.24, 0.1, delay);
    tone(ac, "sine", 150, 90, 0.28, 0.08, delay + 0.08);
  },
  correct(ac, delay) {
    tone(ac, "sine", 660, 880, 0.13, 0.12, delay);
  },
  present(ac, delay) {
    tone(ac, "triangle", 520, 650, 0.12, 0.1, delay);
  },
  absent(ac, delay) {
    tone(ac, "sine", 220, 165, 0.11, 0.07, delay);
  },
  solved(ac, delay) {
    chord(ac, [523, 659, 784, 1047], "sine", 0.15, 0.08, delay);
    if (ac) tone(ac, "triangle", 1047, 1319, 0.32, 0.09, delay + 0.32);
  },
  round(ac, delay) {
    chord(ac, [392, 523, 784], "triangle", 0.11, 0.1, delay);
  },
  start(ac, delay) {
    chord(ac, [523, 659, 784, 1047], "triangle", 0.13, 0.11, delay);
  },
  join(ac, delay) {
    tone(ac, "sine", 659, 659, 0.13, 0.1, delay);
    tone(ac, "sine", 988, 988, 0.2, 0.09, delay + 0.1);
  },
  copy(ac, delay) {
    tone(ac, "sine", 740, 990, 0.11, 0.09, delay);
  },
  tick(ac, delay) {
    tone(ac, "square", 920, 920, 0.045, 0.045, delay);
  },
  timeout(ac, delay) {
    tone(ac, "triangle", 330, 165, 0.35, 0.12, delay);
    tone(ac, "sine", 220, 110, 0.42, 0.08, delay + 0.12);
  },
  win(ac, delay) {
    chord(ac, [523, 659, 784, 1047, 1319], "triangle", 0.13, 0.12, delay);
  },
  complete(ac, delay) {
    chord(ac, [523, 659, 784], "sine", 0.11, 0.14, delay);
  },
};

export async function playSfx(name, delay = 0) {
  if (muted) return;
  const sound = SOUNDS[name];
  if (!sound) return;
  try {
    const ac = await getContext();
    if (!ac || muted) return;
    sound(ac, Math.max(0, Number(delay) || 0));
  } catch {
    return;
  }
}

export function setMuted(value) {
  muted = Boolean(value);
  if (masterGain) masterGain.gain.setTargetAtTime(muted ? 0 : 0.42, context.currentTime, 0.02);
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    return;
  }
}

export function toggleMute() {
  setMuted(!muted);
  return muted;
}

export function isMuted() {
  return muted;
}
