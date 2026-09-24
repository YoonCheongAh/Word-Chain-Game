/**
 * ScribbleSound.js — Web Audio API sound module for Scribble It!
 * No external files needed — all sounds are synthesized.
 * Vẫn giữ phong cách "crayon" vui tươi, nhẹ nhàng:
 *   - đầu bút chạm giấy lục xục nhẹ khi vẽ
 *   - tick đếm ngược giây cuối
 *   - chime reo khi có người đoán đúng / người chơi vào phòng
 *   - fanfare khi thắng, trombone buồn khi thua
 *
 * Usage:
 *   import { playSfx, toggleMute, isMuted } from "./ScribbleSound";
 *   playSfx("correct");
 *   toggleMute();
 *   if (isMuted()) ...
 *
 * Trạng thái muted được lưu localStorage để nhớ giữa các lần chơi.
 */

const MUTE_KEY = "scribble_sound_muted";

let ctx = null;
let masterGain = null;
let muted = (() => {
  try { return localStorage.getItem(MUTE_KEY) === "1"; } catch { return false; }
})();

function getCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : 0.6;
    masterGain.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

/** Oscillator node: tần số cố định với envelope giảm dần. */
function osc(ac, type, freq, start, dur, vol = 0.2, dest = null) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(vol, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g);
  g.connect(dest || masterGain);
  o.start(start);
  o.stop(start + dur + 0.02);
  return { o, g };
}

/** Oscillator tần số biến đổi tuyến tính (dùng cho sweep). */
function sweep(ac, type, from, to, start, dur, vol = 0.2) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(from, start);
  o.frequency.linearRampToValueAtTime(to, start + dur);
  g.gain.setValueAtTime(vol, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g);
  g.connect(masterGain);
  o.start(start);
  o.stop(start + dur + 0.02);
}

/** Noise burst có bộ lọc (bandpass rung, highpass "current".). */
function noise(ac, start, dur, vol = 0.12, filterType = "bandpass", filterFreq = 800, q = 0.8) {
  const bufLen = Math.max(1, Math.floor(ac.sampleRate * dur));
  const buf = ac.createBuffer(1, bufLen, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const f = ac.createBiquadFilter();
  f.type = filterType;
  f.frequency.value = filterFreq;
  f.Q.value = q;
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(f);
  f.connect(g);
  g.connect(masterGain);
  src.start(start);
  src.stop(start + dur + 0.02);
}

/** Phát một chuỗi nốt (dùng cho chime/fanfare). */
function notes(ac, list, type = "sine", vol = 0.2) {
  list.forEach(([freq, delay, dur = 0.18]) => {
    osc(ac, type, freq, ac.currentTime + delay, dur, vol);
  });
}

const SOUNDS = {
  /** Nút bấm UI: tick ngắn. */
  click(ac) {
    const t = ac.currentTime;
    noise(ac, t, 0.025, 0.1);
    osc(ac, "square", 1200, t, 0.025, 0.06);
  },

  /** Bút chì chạm giấy: tiếng "lục sục" nhẹ, không gắt. */
  pencil(ac) {
    const t = ac.currentTime;
    noise(ac, t, 0.05, 0.07, "bandpass", 1800, 1.2);
    osc(ac, "triangle", 320, t, 0.05, 0.05);
  },

  /** Tẩy: tiếng "xoạt" mềm, cao hơn bút. */
  eraser(ac) {
    const t = ac.currentTime;
    noise(ac, t, 0.06, 0.08, "bandpass", 2600, 1.6);
    osc(ac, "sine", 240, t, 0.06, 0.04);
  },

  /** Đổ màu: tiếng "róc" tràn + giọt màu. */
  fill(ac) {
    const t = ac.currentTime;
    noise(ac, t, 0.22, 0.12, "lowpass", 500, 0.6);
    osc(ac, "triangle", 500, t + 0.02, 0.1, 0.1);
    osc(ac, "sine", 880, t + 0.06, 0.14, 0.08);
  },

  /** Vẽ xong hình cơ bản: một "pop" gọn. */
  shape(ac) {
    const t = ac.currentTime;
    osc(ac, "triangle", 420, t, 0.09, 0.12);
    osc(ac, "sine", 630, t + 0.02, 0.1, 0.08);
  },

  /** Undo: blip nhỏ đi xuống. */
  undo(ac) {
    const t = ac.currentTime;
    sweep(ac, "triangle", 660, 330, t, 0.1, 0.1);
  },

  /** Redo: blip nhỏ đi lên. */
  redo(ac) {
    const t = ac.currentTime;
    sweep(ac, "triangle", 330, 660, t, 0.1, 0.1);
  },

  /** Xoá toàn bộ: "vuốt" rất nhanh. */
  clear(ac) {
    const t = ac.currentTime;
    noise(ac, t, 0.3, 0.1, "highpass", 900, 0.5);
    sweep(ac, "sine", 500, 150, t, 0.25, 0.08);
  },

  /** Có người đoán đúng: chime reo vang C–E–G–C. */
  correct(ac) {
    const t = ac.currentTime;
    notes(ac, [[523, 0], [659, 0.09], [784, 0.18], [1047, 0.28], [1319, 0.38]], "sine", 0.2);
    noise(ac, t + 0.45, 0.2, 0.05, "highpass", 4000, 1);
  },

  /** Gần đúng (-1 tim): hai nốt "dang dở" đi xuống. */
  close(ac) {
    const t = ac.currentTime;
    osc(ac, "triangle", 622, t, 0.16, 0.16);
    osc(ac, "triangle", 494, t + 0.14, 0.2, 0.16);
  },

  /** Sai hẳn (-1 tim): "buzzer" ngắn. */
  wrong(ac) {
    const t = ac.currentTime;
    sweep(ac, "sawtooth", 200, 100, t, 0.25, 0.14);
    noise(ac, t, 0.1, 0.08, "lowpass", 800, 0.8);
  },

  /** Hết tim: tiếng "thunk" trầm. */
  lockout(ac) {
    const t = ac.currentTime;
    osc(ac, "sine", 130, t, 0.22, 0.2);
    osc(ac, "sine", 98, t + 0.08, 0.28, 0.14);
  },

  /** Chọn xong từ để vẽ: "pop" 3 nốt vui. */
  selectWord(ac) {
    notes(ac, [[587, 0, 0.09], [880, 0.06, 0.14], [1109, 0.13, 0.2]], "triangle", 0.14);
  },

  /** Đến lượt mình vẽ: ping-ping dịu. */
  turn(ac) {
    const t = ac.currentTime;
    osc(ac, "sine", 880, t, 0.1, 0.15);
    osc(ac, "sine", 1175, t + 0.11, 0.2, 0.12);
  },

  /** Lượt mới bắt đầu (vòng mới / từ mới): motif ngắn. */
  round(ac) {
    notes(ac, [[392, 0, 0.14], [523, 0.13, 0.14], [784, 0.26, 0.24]], "triangle", 0.16);
  },

  /** Mở gợi ý chữ cái: "blip" nhẹ. */
  hint(ac) {
    const t = ac.currentTime;
    sweep(ac, "sine", 660, 990, t, 0.12, 0.08);
  },

  /** Tick đếm ngược 10 giây cuối. */
  tick(ac) {
    const t = ac.currentTime;
    osc(ac, "square", 1046, t, 0.045, 0.05);
  },

  /** Chat mới đến: "pock" kín đáo. */
  chat(ac) {
    const t = ac.currentTime;
    osc(ac, "triangle", 660, t, 0.07, 0.1);
    osc(ac, "triangle", 990, t + 0.05, 0.08, 0.08);
  },

  /** Có người chơi mới vào phòng: "ding" vui. */
  join(ac) {
    notes(ac, [[659, 0, 0.14], [988, 0.1, 0.22]], "sine", 0.14);
  },

  /** Game bắt đầu: fanfare ngắn. */
  start(ac) {
    const t = ac.currentTime;
    notes(ac, [[523, 0, 0.12], [659, 0.1, 0.12], [784, 0.2, 0.12], [1047, 0.3, 0.3]], "triangle", 0.18);
    noise(ac, t + 0.32, 0.25, 0.04, "highpass", 4000, 1);
  },

  /** Đoán đúng rồi hiện đáp án sau hết lượt: chime nhẹ. */
  reveal(ac) {
    notes(ac, [[784, 0, 0.2], [988, 0.12, 0.2], [1319, 0.24, 0.34]], "sine", 0.18);
  },

  /** Thắng game: fanfare chiến thắng. */
  win(ac) {
    const t = ac.currentTime;
    [[523, 0], [659, 0.13], [784, 0.26], [1047, 0.42]].forEach(([f, d]) => {
      osc(ac, "square", f, t + d, 0.4, 0.12);
      osc(ac, "sine", f * 2, t + d, 0.35, 0.06);
    });
    for (let i = 0; i < 8; i++) {
      const freq = 1046 + Math.random() * 1200;
      osc(ac, "sine", freq, t + 0.5 + i * 0.06, 0.2, 0.06);
    }
    noise(ac, t + 0.55, 0.35, 0.05, "highpass", 3000, 1);
  },

  /** Thua game: trombone buồn + "phụt". */
  lose(ac) {
    const t = ac.currentTime;
    sweep(ac, "sawtooth", 300, 90, t, 0.7, 0.18);
    notes(ac, [[196, 0.15, 0.3], [147, 0.35, 0.34], [98, 0.55, 0.4]], "sine", 0.12);
    noise(ac, t + 0.1, 0.2, 0.06, "lowpass", 500, 0.7);
  },
};

/**
 * Phát hiệu ứng âm thanh theo tên.
 * Safe-call: mọi lỗi Web Audio (chưa tương tác, tab ẩn…) đều nuốt im lặng.
 */
export function playSfx(name) {
  if (muted) return;
  const fn = SOUNDS[name];
  if (!fn) return;
  try {
    fn(getCtx());
  } catch {
    /* Web Audio có thể ném lỗi khi chưa có user gesture — bỏ qua. */
  }
}

export function setMuted(value) {
  muted = !!value;
  try { localStorage.setItem(MUTE_KEY, muted ? "1" : "0"); } catch { /* ignore */ }
  if (masterGain) masterGain.gain.value = muted ? 0 : 0.6;
}

export function toggleMute() {
  setMuted(!muted);
  return muted;
}

export function isMuted() {
  return muted;
}