/**
 * ludoSound.js — Web Audio API sound module for Cờ Cá Ngựa
 * No external files needed — all sounds are synthesized.
 *
 * Usage:
 *   import { playSound, setMuted } from "./ludoSound";
 *
 *   playSound("dice");      // tung xúc xắc
 *   playSound("move");      // di chuyển quân
 *   playSound("capture");   // bắt quân đối thủ
 *   playSound("enter");     // đưa quân vào bàn
 *   playSound("home");      // quân về nhà (hoàn thành)
 *   playSound("win");       // chiến thắng
 *   playSound("turn");      // đến lượt mình
 *   playSound("pass");      // bỏ lượt / không có nước đi
 *   playSound("click");     // bấm nút thông thường
 */

let ctx = null;
let muted = false;

function getCtx() {
    if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
}

/** Master volume envelope helper */
function gain(ac, value) {
    const g = ac.createGain();
    g.gain.value = value;
    g.connect(ac.destination);
    return g;
}

function osc(ac, type, freq, start, dur, vol = 0.25, dest = null) {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g);
    g.connect(dest || ac.destination);
    o.start(start);
    o.stop(start + dur + 0.01);
    return { o, g };
}

/** Noise burst (for dice rattle) */
function noise(ac, start, dur, vol = 0.15) {
    const bufLen = ac.sampleRate * dur;
    const buf = ac.createBuffer(1, bufLen, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buf;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    const filter = ac.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 800;
    filter.Q.value = 0.8;
    src.connect(filter);
    filter.connect(g);
    g.connect(ac.destination);
    src.start(start);
    src.stop(start + dur + 0.01);
}

const SOUNDS = {
    /** Dice roll: multiple noise bursts + descending pitch */
    dice(ac) {
        const t = ac.currentTime;
        for (let i = 0; i < 5; i++) {
            noise(ac, t + i * 0.07, 0.06, 0.18 - i * 0.02);
            osc(ac, "square", 220 - i * 20, t + i * 0.07, 0.05, 0.06);
        }
        osc(ac, "triangle", 180, t + 0.38, 0.12, 0.12);
    },

    /** Pawn move: bright pluck */
    move(ac) {
        const t = ac.currentTime;
        osc(ac, "triangle", 660, t, 0.18, 0.22);
        osc(ac, "sine", 880, t + 0.04, 0.12, 0.10);
    },

    /** Capture: dramatic impact + low hit */
    capture(ac) {
        const t = ac.currentTime;
        noise(ac, t, 0.08, 0.30);
        osc(ac, "sawtooth", 120, t, 0.22, 0.25);
        osc(ac, "square", 80, t + 0.05, 0.18, 0.20);
        osc(ac, "triangle", 440, t, 0.10, 0.12);
        osc(ac, "sine", 220, t + 0.10, 0.20, 0.15);
    },

    /** Enter board: rising tone */
    enter(ac) {
        const t = ac.currentTime;
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = "triangle";
        o.frequency.setValueAtTime(300, t);
        o.frequency.linearRampToValueAtTime(600, t + 0.25);
        g.gain.setValueAtTime(0.22, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.30);
        o.connect(g); g.connect(ac.destination);
        o.start(t); o.stop(t + 0.32);
    },

    /** Home (complete): cheerful 3-note ding */
    home(ac) {
        const t = ac.currentTime;
        const notes = [523, 659, 784];
        notes.forEach((freq, i) => {
            osc(ac, "sine", freq, t + i * 0.13, 0.25, 0.22);
            osc(ac, "triangle", freq * 2, t + i * 0.13, 0.15, 0.08);
        });
    },

    /** Win: ascending fanfare */
    win(ac) {
        const t = ac.currentTime;
        const melody = [
            [523, 0.00], [659, 0.12], [784, 0.24],
            [1047, 0.38], [1047, 0.52], [1047, 0.64],
            [880, 0.78], [1047, 0.92],
        ];
        melody.forEach(([freq, delay]) => {
            osc(ac, "sine", freq, t + delay, 0.18, 0.22);
            osc(ac, "triangle", freq * 1.5, t + delay, 0.12, 0.07);
        });
        noise(ac, t + 0.90, 0.35, 0.08);
    },

    /** Your turn: gentle ping */
    turn(ac) {
        const t = ac.currentTime;
        osc(ac, "sine", 880, t, 0.08, 0.18);
        osc(ac, "sine", 1108, t + 0.09, 0.14, 0.14);
    },

    /** Pass turn: low descending tone */
    pass(ac) {
        const t = ac.currentTime;
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(440, t);
        o.frequency.linearRampToValueAtTime(220, t + 0.28);
        g.gain.setValueAtTime(0.15, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.30);
        o.connect(g); g.connect(ac.destination);
        o.start(t); o.stop(t + 0.32);
    },

    /** UI click: short tick */
    click(ac) {
        const t = ac.currentTime;
        noise(ac, t, 0.025, 0.12);
        osc(ac, "square", 1200, t, 0.02, 0.06);
    },
};

/**
 * Play a sound by name.
 * @param {"dice"|"move"|"capture"|"enter"|"home"|"win"|"turn"|"pass"|"click"} name
 */
export function playSound(name) {
    if (muted) return;
    const fn = SOUNDS[name];
    if (!fn) return;
    try {
        fn(getCtx());
    } catch (e) {
        console.warn("[ludoSound] playSound error:", e);
    }
}

/**
 * Toggle mute state.
 * @param {boolean} value
 */
export function setMuted(value) {
    muted = value;
}

export function isMuted() {
    return muted;
}