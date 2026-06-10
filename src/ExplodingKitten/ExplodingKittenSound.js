/**
 * ExplodingCatSound.js
 * Sound manager for Exploding Kittens — all sounds synthesized via Web Audio API.
 * No external audio files needed.
 *
 * Usage:
 *   import { SoundManager } from './ExplodingCatSound';
 *   SoundManager.play('draw');
 *   SoundManager.play('explode');
 *   SoundManager.setVolume(0.5); // 0.0 – 1.0
 *   SoundManager.mute();
 *   SoundManager.unmute();
 */

// ─── Audio context (lazy init — browsers require user gesture first) ──────────

let _ctx = null;
let _masterGain = null;
let _muted = false;
let _volume = 0.7;

function getCtx() {
  if (!_ctx) {
    _ctx = new (window.AudioContext || window.webkitAudioContext)();
    _masterGain = _ctx.createGain();
    _masterGain.gain.value = _volume;
    _masterGain.connect(_ctx.destination);
  }
  if (_ctx.state === 'suspended') _ctx.resume();
  return { ctx: _ctx, master: _masterGain };
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

function ramp(param, ctx, from, to, startAt, duration) {
  param.setValueAtTime(from, startAt);
  param.linearRampToValueAtTime(to, startAt + duration);
}

function expRamp(param, ctx, from, to, startAt, duration) {
  param.setValueAtTime(Math.max(from, 0.0001), startAt);
  param.exponentialRampToValueAtTime(Math.max(to, 0.0001), startAt + duration);
}

function makeOsc(ctx, type, freq, startAt, stopAt) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startAt);
  osc.start(startAt);
  osc.stop(stopAt);
  return osc;
}

function makeGain(ctx, value) {
  const g = ctx.createGain();
  g.gain.value = value;
  return g;
}

function makeFilter(ctx, type, freq, q = 1) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

// ─── Sound definitions ────────────────────────────────────────────────────────

const sounds = {

  /**
   * draw — soft card whoosh + subtle thud
   */
  draw() {
    const { ctx, master } = getCtx();
    const now = ctx.currentTime;

    // Whoosh: noise burst with high-pass sweep
    const bufLen = ctx.sampleRate * 0.18;
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1);

    const noise = ctx.createBufferSource();
    noise.buffer = buf;

    const hp = makeFilter(ctx, 'highpass', 1200, 0.8);
    const noiseGain = makeGain(ctx, 0);
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(0.22, now + 0.02);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    noise.connect(hp);
    hp.connect(noiseGain);
    noiseGain.connect(master);
    noise.start(now);
    noise.stop(now + 0.2);

    // Soft thud
    const thud = makeOsc(ctx, 'sine', 180, now + 0.05, now + 0.2);
    const thudG = makeGain(ctx, 0);
    thudG.gain.setValueAtTime(0.18, now + 0.05);
    thudG.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    thud.connect(thudG);
    thudG.connect(master);
  },

  /**
   * play — bright card snap
   */
  play() {
    const { ctx, master } = getCtx();
    const now = ctx.currentTime;

    // Click transient
    const click = makeOsc(ctx, 'triangle', 900, now, now + 0.08);
    const cg = makeGain(ctx, 0);
    cg.gain.setValueAtTime(0.3, now);
    cg.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    click.connect(cg);
    cg.connect(master);

    // Tonal tail
    const tone = makeOsc(ctx, 'sine', 440, now, now + 0.12);
    const tg = makeGain(ctx, 0);
    tg.gain.setValueAtTime(0.12, now);
    tg.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    tone.connect(tg);
    tg.connect(master);
  },

  /**
   * nope — buzzy "bzzzt" rejection sting
   */
  nope() {
    const { ctx, master } = getCtx();
    const now = ctx.currentTime;

    const buzz = makeOsc(ctx, 'sawtooth', 220, now, now + 0.28);
    buzz.frequency.setValueAtTime(220, now);
    buzz.frequency.linearRampToValueAtTime(110, now + 0.28);

    const lp = makeFilter(ctx, 'lowpass', 600, 2);
    const bg = makeGain(ctx, 0);
    bg.gain.setValueAtTime(0.28, now);
    bg.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    buzz.connect(lp);
    lp.connect(bg);
    bg.connect(master);

    // Short noise burst
    const bufLen = ctx.sampleRate * 0.12;
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) d[i] = (Math.random() * 2 - 1) * 0.4;
    const ns = ctx.createBufferSource();
    ns.buffer = buf;
    const ng = makeGain(ctx, 0);
    ng.gain.setValueAtTime(0.15, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    ns.connect(ng);
    ng.connect(master);
    ns.start(now);
    ns.stop(now + 0.14);
  },

  /**
   * explode — dramatic boom with rumble and debris
   */
  explode() {
    const { ctx, master } = getCtx();
    const now = ctx.currentTime;

    // Sub boom
    const sub = makeOsc(ctx, 'sine', 60, now, now + 1.2);
    sub.frequency.setValueAtTime(60, now);
    sub.frequency.exponentialRampToValueAtTime(18, now + 0.8);
    const subG = makeGain(ctx, 0);
    subG.gain.setValueAtTime(0.6, now);
    subG.gain.linearRampToValueAtTime(0.7, now + 0.04);
    subG.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
    sub.connect(subG);
    subG.connect(master);

    // Mid crunch
    const mid = makeOsc(ctx, 'sawtooth', 140, now, now + 0.5);
    const lp = makeFilter(ctx, 'lowpass', 400, 1.5);
    const mG = makeGain(ctx, 0);
    mG.gain.setValueAtTime(0.35, now);
    mG.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    mid.connect(lp);
    lp.connect(mG);
    mG.connect(master);

    // Noise debris (long)
    const bufLen = Math.floor(ctx.sampleRate * 1.4);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;

    const hp = makeFilter(ctx, 'highpass', 200, 0.5);
    const noiseG = makeGain(ctx, 0);
    noiseG.gain.setValueAtTime(0.45, now);
    noiseG.gain.linearRampToValueAtTime(0.5, now + 0.05);
    noiseG.gain.exponentialRampToValueAtTime(0.001, now + 1.3);

    noise.connect(hp);
    hp.connect(noiseG);
    noiseG.connect(master);
    noise.start(now);
    noise.stop(now + 1.5);

    // High crackle
    [0, 0.06, 0.13, 0.22].forEach(offset => {
      const bufS = Math.floor(ctx.sampleRate * 0.04);
      const b = ctx.createBuffer(1, bufS, ctx.sampleRate);
      const dd = b.getChannelData(0);
      for (let i = 0; i < bufS; i++) dd[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = b;
      const hpC = makeFilter(ctx, 'highpass', 3000, 1);
      const gC = makeGain(ctx, 0.25 - offset * 0.5);
      src.connect(hpC);
      hpC.connect(gC);
      gC.connect(master);
      src.start(now + offset);
      src.stop(now + offset + 0.05);
    });

    // Meow shriek (cat got exploded 😿)
    const shriek = makeOsc(ctx, 'sine', 800, now + 0.02, now + 0.38);
    shriek.frequency.setValueAtTime(800, now + 0.02);
    shriek.frequency.exponentialRampToValueAtTime(2200, now + 0.12);
    shriek.frequency.exponentialRampToValueAtTime(300, now + 0.38);
    const sG = makeGain(ctx, 0);
    sG.gain.setValueAtTime(0.18, now + 0.02);
    sG.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    shriek.connect(sG);
    sG.connect(master);

    // Vibrato on shriek
    const lfo = makeOsc(ctx, 'sine', 18, now + 0.02, now + 0.38);
    const lfoG = makeGain(ctx, 80);
    lfo.connect(lfoG);
    lfoG.connect(shriek.frequency);
  },

  /**
   * defuse — satisfying click + relief chime
   */
  defuse() {
    const { ctx, master } = getCtx();
    const now = ctx.currentTime;

    // Mechanical click
    const click = makeOsc(ctx, 'square', 1200, now, now + 0.06);
    const cG = makeGain(ctx, 0);
    cG.gain.setValueAtTime(0.2, now);
    cG.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    click.connect(cG);
    cG.connect(master);

    // Relief chime — major third
    [[523, 0.05], [659, 0.12], [784, 0.2]].forEach(([freq, delay]) => {
      const o = makeOsc(ctx, 'sine', freq, now + delay, now + delay + 0.6);
      const g = makeGain(ctx, 0);
      g.gain.setValueAtTime(0.18, now + delay);
      g.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.55);
      o.connect(g);
      g.connect(master);
    });
  },

  /**
   * attack — aggressive descending sting
   */
  attack() {
    const { ctx, master } = getCtx();
    const now = ctx.currentTime;

    const osc = makeOsc(ctx, 'sawtooth', 440, now, now + 0.3);
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.3);
    const lp = makeFilter(ctx, 'lowpass', 800, 3);
    const g = makeGain(ctx, 0);
    g.gain.setValueAtTime(0.32, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(lp);
    lp.connect(g);
    g.connect(master);

    // Stab accent
    const stab = makeOsc(ctx, 'square', 880, now, now + 0.08);
    const sg = makeGain(ctx, 0);
    sg.gain.setValueAtTime(0.15, now);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    stab.connect(sg);
    sg.connect(master);
  },

  /**
   * skip — light upward chirp
   */
  skip() {
    const { ctx, master } = getCtx();
    const now = ctx.currentTime;

    const osc = makeOsc(ctx, 'sine', 440, now, now + 0.22);
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.14);
    osc.frequency.setValueAtTime(880, now + 0.14);

    const g = makeGain(ctx, 0);
    g.gain.setValueAtTime(0.22, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(g);
    g.connect(master);
  },

  /**
   * favor — gentle chime request
   */
  favor() {
    const { ctx, master } = getCtx();
    const now = ctx.currentTime;

    [[523, 0], [659, 0.08], [523, 0.18]].forEach(([freq, delay]) => {
      const o = makeOsc(ctx, 'triangle', freq, now + delay, now + delay + 0.35);
      const g = makeGain(ctx, 0);
      g.gain.setValueAtTime(0.2, now + delay);
      g.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.32);
      o.connect(g);
      g.connect(master);
    });
  },

  /**
   * shuffle — rapid card shuffle rattle
   */
  shuffle() {
    const { ctx, master } = getCtx();
    const now = ctx.currentTime;

    const clicks = 9;
    for (let i = 0; i < clicks; i++) {
      const t = now + i * 0.055 + Math.random() * 0.015;
      const bufLen = Math.floor(ctx.sampleRate * 0.03);
      const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let j = 0; j < bufLen; j++) d[j] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const hp = makeFilter(ctx, 'highpass', 1500, 0.8);
      const g = makeGain(ctx, 0.18 - i * 0.01);
      src.connect(hp);
      hp.connect(g);
      g.connect(master);
      src.start(t);
      src.stop(t + 0.04);
    }
  },

  /**
   * seeFuture — mystical rising sweep
   */
  seeFuture() {
    const { ctx, master } = getCtx();
    const now = ctx.currentTime;

    // Crystal sweep
    const osc = makeOsc(ctx, 'sine', 200, now, now + 0.9);
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(1600, now + 0.7);
    const g = makeGain(ctx, 0);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.18, now + 0.1);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
    osc.connect(g);
    g.connect(master);

    // Sparkle overtones
    [2, 3, 4].forEach((mult, i) => {
      const o = makeOsc(ctx, 'sine', 200 * mult, now + i * 0.05, now + 0.7);
      o.frequency.setValueAtTime(200 * mult, now + i * 0.05);
      o.frequency.exponentialRampToValueAtTime(1600 * mult, now + 0.7);
      const og = makeGain(ctx, 0);
      og.gain.setValueAtTime(0.06, now + i * 0.05);
      og.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
      o.connect(og);
      og.connect(master);
    });
  },

  /**
   * steal — sneaky descending pluck
   */
  steal() {
    const { ctx, master } = getCtx();
    const now = ctx.currentTime;

    [[660, 0], [550, 0.09], [440, 0.18], [330, 0.27]].forEach(([freq, delay]) => {
      const o = makeOsc(ctx, 'triangle', freq, now + delay, now + delay + 0.22);
      const g = makeGain(ctx, 0);
      g.gain.setValueAtTime(0.22, now + delay);
      g.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.2);
      o.connect(g);
      g.connect(master);
    });
  },

  /**
   * win — triumphant fanfare
   */
  win() {
    const { ctx, master } = getCtx();
    const now = ctx.currentTime;

    // Fanfare: C-E-G-C
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      const t = now + i * 0.14;
      const o = makeOsc(ctx, 'square', freq, t, t + 0.5);
      const lp = makeFilter(ctx, 'lowpass', 2200, 0.8);
      const g = makeGain(ctx, 0);
      g.gain.setValueAtTime(0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.48);
      o.connect(lp);
      lp.connect(g);
      g.connect(master);

      // Harmonic
      const h = makeOsc(ctx, 'sine', freq * 2, t, t + 0.5);
      const hg = makeGain(ctx, 0);
      hg.gain.setValueAtTime(0.08, t);
      hg.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      h.connect(hg);
      hg.connect(master);
    });

    // Sparkle at the end
    for (let i = 0; i < 6; i++) {
      const t = now + 0.55 + i * 0.06;
      const freq = 1046 + Math.random() * 800;
      const o = makeOsc(ctx, 'sine', freq, t, t + 0.18);
      const g = makeGain(ctx, 0.12 - i * 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      o.connect(g);
      g.connect(master);
    }
  },

  /**
   * lose — sad descending trombone + splat
   */
  lose() {
    const { ctx, master } = getCtx();
    const now = ctx.currentTime;

    const osc = makeOsc(ctx, 'sawtooth', 300, now, now + 0.85);
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.8);

    const lp = makeFilter(ctx, 'lowpass', 600, 2);
    const g = makeGain(ctx, 0);
    g.gain.setValueAtTime(0.3, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    osc.connect(lp);
    lp.connect(g);
    g.connect(master);

    // Descending thirds
    [[200, 0.1], [150, 0.28], [100, 0.46]].forEach(([freq, delay]) => {
      const o = makeOsc(ctx, 'sine', freq, now + delay, now + delay + 0.3);
      const og = makeGain(ctx, 0.14);
      og.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.28);
      o.connect(og);
      og.connect(master);
    });
  },

  /**
   * myTurn — gentle ping to alert the current player
   */
  myTurn() {
    const { ctx, master } = getCtx();
    const now = ctx.currentTime;

    [0, 0.12].forEach(delay => {
      const o = makeOsc(ctx, 'sine', 880, now + delay, now + delay + 0.3);
      const g = makeGain(ctx, 0);
      g.gain.setValueAtTime(0.18, now + delay);
      g.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.28);
      o.connect(g);
      g.connect(master);
    });
  },

};

// ─── Public API ───────────────────────────────────────────────────────────────

export const SoundManager = {
  /**
   * Play a named sound. Valid keys:
   *   'draw' | 'play' | 'nope' | 'explode' | 'defuse' | 'attack'
   *   'skip' | 'favor' | 'shuffle' | 'seeFuture' | 'steal'
   *   'win' | 'lose' | 'myTurn'
   */
  play(name) {
    if (_muted) return;
    const fn = sounds[name];
    if (!fn) {
      console.warn(`[ExplodingCatSound] Unknown sound: "${name}"`);
      return;
    }
    try {
      fn();
    } catch (e) {
      // Web Audio may throw if user hasn't interacted yet
      console.warn('[ExplodingCatSound] Audio play failed:', e.message);
    }
  },

  /** Set master volume (0.0 – 1.0) */
  setVolume(v) {
    _volume = Math.max(0, Math.min(1, v));
    if (_masterGain) _masterGain.gain.value = _volume;
  },

  getVolume() { return _volume; },

  mute() {
    _muted = true;
    if (_masterGain) _masterGain.gain.value = 0;
  },

  unmute() {
    _muted = false;
    if (_masterGain) _masterGain.gain.value = _volume;
  },

  isMuted() { return _muted; },

  /**
   * Map a CARD_TYPE constant to its appropriate sound name.
   * Handy so you don't have to hardcode mappings in your components.
   */
  soundForCard(cardType) {
    const map = {
      exploding_kitten: 'explode',
      defuse:           'defuse',
      attack:           'attack',
      skip:             'skip',
      favor:            'favor',
      shuffle:          'shuffle',
      see_the_future:   'seeFuture',
      nope:             'nope',
      tacocat:          'steal',
      cattermelon:      'steal',
      hairy_potato_cat: 'steal',
      beard_cat:        'steal',
      rainbow_cat:      'steal',
    };
    return map[cardType] || 'play';
  },
};