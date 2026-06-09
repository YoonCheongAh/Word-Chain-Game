import { useState, useEffect } from "react";
import App from "./WordChain/App";
import WordleApp from "./Wordle/wordleapp";
import LudoApp from "./Ludo/LudoApp";
import CaroApp from "./Caro/CaroApp";
import noneLogo from "/none.png";

/* ─────────────────────────────────────────────
   STYLES
───────────────────────────────────────────── */
const HUB_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Space+Mono:wght@400;700&family=Orbitron:wght@400;500;600;700;800;900&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --ink: #0a0a10;
    --surface: #10101a;
    --card-bg: #13131f;
    --border: rgba(255,255,255,0.06);
    --border-hover: rgba(255,255,255,0.12);
    --text: #f2f0ec;
    --muted: #7a7a92;
    --dim: #a0a0b4;
    --g1: #00e5a0;
    --g2: #64d96a;
    --g3: #ff5a5a;
  }

  body {
    font-family: 'Orbitron', sans-serif;
    background: var(--ink);
    color: var(--text);
    min-height: 100vh;
  }

  /* ── Hub root ── */
  .gh-root {
    min-height: 100vh;
    background: var(--ink);
    position: relative;
    overflow: hidden;
  }

  /* Scanlines */
  .gh-root::before {
    content: '';
    position: fixed;
    inset: 0;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 3px,
      rgba(0,0,0,0.12) 3px,
      rgba(0,0,0,0.12) 4px
    );
    pointer-events: none;
    z-index: 100;
    opacity: 0.45;
  }

  /* Ambient glow blobs */
  .gh-blob {
    position: fixed;
    border-radius: 50%;
    filter: blur(90px);
    pointer-events: none;
    z-index: 0;
    animation: blobPulse 7s ease-in-out infinite;
  }
  .gh-blob-1 { width: 480px; height: 320px; top: -120px; left: -80px;  background: rgba(0,229,160,0.07);  animation-delay: 0s; }
  .gh-blob-2 { width: 360px; height: 280px; top: 40px;   right: -60px; background: rgba(90,180,255,0.06); animation-delay: 2.5s; }
  .gh-blob-3 { width: 300px; height: 260px; bottom: 60px; left: 38%;   background: rgba(255,90,90,0.05);  animation-delay: 5s; }

  @keyframes blobPulse {
    0%, 100% { opacity: 0.7; transform: scale(1); }
    50%       { opacity: 1;   transform: scale(1.1); }
  }

  /* ── Hub content ── */
  .gh-content {
    position: relative;
    z-index: 1;
    max-width: 1100px;
    margin: 0 auto;
    padding: 0 28px;
  }

  /* ── Header ── */
  .gh-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
    padding: 32px 0 0;
  }

  .gh-logo-wrap { display: flex; align-items: center; gap: 14px; }

  .gh-logo {
    font-family: 'Press Start 2P', cursive;
    font-size: 30px;
    letter-spacing: 1px;
    line-height: 1.1;
    background: linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.45) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .gh-logo-dot {
    display: inline-block;
    width: 9px;
    height: 9px;
    background: var(--g1);
    border-radius: 50%;
    margin-left: 4px;
    vertical-align: middle;
    box-shadow: 0 0 12px var(--g1);
    animation: dotBlink 2.2s ease-in-out infinite;
    -webkit-text-fill-color: initial;
  }

  @keyframes dotBlink {
    0%, 100% { opacity: 1;   box-shadow: 0 0 12px var(--g1); }
    50%       { opacity: 0.3; box-shadow: 0 0 4px  var(--g1); }
  }

  .gh-beta {
    font-family: 'Press Start 2P', cursive;
    font-size: 8px;
    color: var(--g1);
    border: 1px solid rgba(0,229,160,0.3);
    background: rgba(0,229,160,0.08);
    padding: 5px 10px;
    border-radius: 6px;
    letter-spacing: 1px;
    vertical-align: middle;
  }

  .gh-header-tagline {
    font-family: 'Space Mono', monospace;
    font-size: 12px;
    color: var(--dim);
    letter-spacing: 0.5px;
    padding-bottom: 6px;
  }

  /* ── Marquee strip ── */
  .gh-marquee-wrap {
    margin: 24px 0 0;
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    background: rgba(255,255,255,0.015);
    overflow: hidden;
    padding: 8px 0;
  }

  .gh-marquee-inner {
    display: flex;
    white-space: nowrap;
    width: max-content;
    animation: marqueeScroll 22s linear infinite;
  }

  @keyframes marqueeScroll {
    from { transform: translateX(0); }
    to   { transform: translateX(-50%); }
  }

  .gh-marquee-item {
    font-family: 'Space Mono', monospace;
    font-size: 11px;
    color: var(--dim);
    letter-spacing: 2px;
    padding: 0 36px;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    text-transform: uppercase;
  }

  .gh-pip {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    flex-shrink: 0;
    display: inline-block;
  }

  /* ── Section label ── */
  .gh-section-label {
    font-family: 'Press Start 2P', cursive;
    font-size: 10px;
    letter-spacing: 1px;
    color: var(--dim);
    text-transform: uppercase;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 32px 0 18px;
  }
  .gh-section-label::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border);
  }

  /* ── Game grid ── */
  .gh-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 16px;
    padding-bottom: 40px;
  }

  /* ── Game card ── */
  .gh-card {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 20px;
    overflow: hidden;
    cursor: pointer;
    transition: transform 0.28s cubic-bezier(.2,.8,.3,1),
                border-color 0.25s,
                box-shadow 0.25s;
    position: relative;
  }

  .gh-card.available:hover {
    transform: translateY(-7px) scale(1.012);
    border-color: var(--card-accent, var(--g1));
    box-shadow:
      0 24px 64px rgba(0,0,0,0.55),
      0 0 0 1px var(--card-accent, var(--g1)),
      0 0 48px -10px var(--card-accent, var(--g1));
  }

  .gh-card.available:hover .gh-card-overlay { opacity: 1; }
  .gh-card.available:hover .gh-play-pill     { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }

  /* Thumbnail */
  .gh-thumb {
    height: 160px;
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .gh-thumb-glow {
    position: absolute;
    inset: 0;
    opacity: 0.18;
  }

  .gh-thumb-grid {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px);
    background-size: 24px 24px;
  }

  .gh-card-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.3);
    opacity: 0;
    transition: opacity 0.2s;
    z-index: 2;
  }

  .gh-play-pill {
    position: absolute;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%) translateY(10px) scale(0.9);
    background: var(--card-accent, var(--g1));
    color: #000;
    font-family: 'Orbitron', sans-serif;
    font-size: 12px;
    font-weight: 700;
    padding: 7px 22px;
    border-radius: 20px;
    opacity: 0;
    transition: opacity 0.2s, transform 0.22s cubic-bezier(.2,.8,.3,1);
    z-index: 3;
    white-space: nowrap;
    letter-spacing: 0.3px;
    pointer-events: none;
  }

  /* Card body */
  .gh-card-body {
    padding: 14px 18px 18px;
    border-top: 1px solid var(--border);
  }

  .gh-card-num {
    font-family: 'Space Mono', monospace;
    font-size: 10px;
    color: var(--dim);
    letter-spacing: 2.5px;
    margin-bottom: 5px;
    text-transform: uppercase;
  }

  .gh-card-title {
    font-family: 'Orbitron', sans-serif;
    font-size: 18px;
    font-weight: 800;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
    line-height: 1.15;
    text-transform: uppercase;
  }

  .gh-card-desc {
    font-family: 'Space Mono', monospace;
    font-size: 11px;
    color: var(--dim);
    line-height: 1.7;
    margin-bottom: 14px;
  }

  .gh-card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .gh-tag {
    font-family: 'Space Mono', monospace;
    font-size: 10px;
    padding: 3px 10px;
    border-radius: 20px;
    letter-spacing: 0.5px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .gh-tag-teal { background: rgba(0,229,160,0.1);   color: var(--g1); border: 1px solid rgba(0,229,160,0.22); }
  .gh-tag-lime { background: rgba(100,217,106,0.1); color: var(--g2); border: 1px solid rgba(100,217,106,0.22); }
  .gh-tag-red  { background: rgba(255,90,90,0.1);   color: var(--g3); border: 1px solid rgba(255,90,90,0.22); }

  .gh-live-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    flex-shrink: 0;
    animation: livePulse 2.2s ease-in-out infinite;
  }

  @keyframes livePulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.25; }
  }

  .gh-players {
    font-family: 'Space Mono', monospace;
    font-size: 11px;
    color: var(--dim);
  }

  /* ── WordChain thumb ── */
  .wc-thumb {
    display: flex;
    align-items: center;
    gap: 7px;
    flex-wrap: wrap;
    justify-content: center;
    padding: 18px;
    position: relative;
    z-index: 1;
  }

  .wc-word {
    font-family: 'Space Mono', monospace;
    font-size: 11px;
    font-weight: 700;
    padding: 5px 11px;
    border-radius: 20px;
    letter-spacing: 0.5px;
    animation: wordFloat 3s ease-in-out infinite;
  }
  .wc-word:nth-child(1) { animation-delay: 0s; }
  .wc-word:nth-child(3) { animation-delay: 1s; }
  .wc-word:nth-child(5) { animation-delay: 2s; }

  @keyframes wordFloat {
    0%, 100% { transform: translateY(0); }
    50%       { transform: translateY(-4px); }
  }

  .wc-a { background: #0c2c20; color: #00e5a0; border: 1px solid #175c3c; }
  .wc-b { background: #0c1e38; color: #5ab4ff; border: 1px solid #18386a; }
  .wc-c { background: #2c1414; color: #ff8888; border: 1px solid #581e1e; }

  .wc-arr { color: #333; font-size: 15px; line-height: 1; }

  /* ── Wordle thumb ── */
  .wd-thumb {
    display: flex;
    flex-direction: column;
    gap: 3px;
    position: relative;
    z-index: 1;
  }

  .wd-row { display: flex; gap: 3px; }

  .wd-cell {
    width: 27px;
    height: 27px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 800;
    font-family: 'Orbitron', sans-serif;
  }

  .wd-empty   { background: #191926; border: 1px solid #282838; }
  .wd-correct { background: #2b6645; color: #fff; }
  .wd-present { background: #7a6420; color: #fff; }
  .wd-absent  { background: #262630; color: #555; }

  /* ── Ludo thumb ── */
  .ld-thumb {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
    position: relative;
    z-index: 1;
  }

  .ld-row { display: flex; gap: 12px; }

  .ld-piece {
    width: 34px; 
    height: 40px; 
    object-fit: contain;
    animation: pieceRock 2.8s ease-in-out infinite;
    position: relative;
  }

  @keyframes pieceRock {
    0%, 100% { transform: rotate(-4deg); }
    50%       { transform: rotate(4deg) translateY(-3px); }
  }

  .ld-piece:nth-child(2) { animation-delay: 0.7s; }

  /* ── Caro thumb (matches in-game X/O marks) ── */
  .caro-thumb {
    display: flex;
    flex-direction: column;
    gap: 3px;
    position: relative;
    z-index: 1;
  }
  .caro-thumb-row { display: flex; gap: 3px; }
  .caro-thumb-cell {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }
  /* shape-based marks, same as the real game board */
  .caro-thumb-mark { position: relative; display: block; width: 56%; height: 56%; }
  .caro-thumb-x::before, .caro-thumb-x::after {
    content: ''; position: absolute; top: 50%; left: 0; width: 100%; height: 18%;
    min-height: 2px; border-radius: 3px; background: #e8503a;
    box-shadow: 0 0 5px rgba(232,80,58,.5);
  }
  .caro-thumb-x::before { transform: translateY(-50%) rotate(45deg); }
  .caro-thumb-x::after  { transform: translateY(-50%) rotate(-45deg); }
  .caro-thumb-o {
    border: 2.5px solid #4a9eff; border-radius: 50%;
    box-shadow: 0 0 5px rgba(74,158,255,.45), inset 0 0 3px rgba(74,158,255,.3);
  }

  /* ── Footer ── */
  .gh-footer {
    border-top: 1px solid var(--border);
    padding: 20px 0 28px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  .gh-footer-copy {
    font-family: 'Space Mono', monospace;
    font-size: 10px;
    color: var(--muted);
    letter-spacing: 1px;
  }

  .gh-footer-dots { display: flex; gap: 6px; align-items: center; }

  .gh-fdot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    transition: opacity 0.3s;
  }

  .gh-logo {
    display:flex;
    align-items:center;
    gap:10px;
  }

  .gh-logo-image {
    width: 40px;
    height: 40px;
    object-fit:contain;
  }
  
  /* ── Back bar (in-game) ── */
  .gh-back-bar {
    position: fixed;
    top: 0; left: 0; right: 0;
    height: 50px;
    background: rgba(10,10,16,0.92);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    padding: 0 20px;
    gap: 14px;
    z-index: 200;
  }

  .gh-back-btn {
    display: flex;
    align-items: center;
    gap: 7px;
    background: none;
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    font-family: 'Orbitron', sans-serif;
    font-size: 12px;
    font-weight: 700;
    padding: 5px 13px;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
    letter-spacing: 0.3px;
  }

  .gh-back-btn:hover {
    border-color: var(--border-hover);
    background: rgba(255,255,255,0.04);
  }

  .gh-back-sep  { color: var(--muted); font-size: 11px; font-family: 'Space Mono', monospace; }
  .gh-back-name { font-family: 'Orbitron', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 0.3px; text-transform: uppercase; }
  .gh-back-dot  {
    margin-left: auto;
    width: 7px; height: 7px;
    border-radius: 50%;
    box-shadow: 0 0 8px var(--g1);
    animation: dotBlink 2.2s ease-in-out infinite;
  }

  .gh-game-body { padding-top: 50px; }

  @media (max-width: 640px) {
    .gh-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
    .gh-thumb { height: 120px; }
    .gh-logo  { font-size: 20px; }
  }
`;

/* ─────────────────────────────────────────────
   DATA
───────────────────────────────────────────── */
const GAMES = [
  {
    id: "wordchain",
    num: "01 / WORD",
    title: "Word Chain",
    desc: "Nối từ tiếng Anh · ai hết máu thua",
    players: "2–4",
    accent: "#00e5a0",
    tagClass: "gh-tag-teal",
    thumb: "wordchain",
  },
  {
    id: "wordle",
    num: "02 / WORD",
    title: "Wordle",
    desc: "Đoán từ 5 chữ · 6 lần thử",
    players: "2–4",
    accent: "#64d96a",
    tagClass: "gh-tag-lime",
    thumb: "wordle",
  },
  {
    id: "ludo",
    num: "03 / BOARD",
    title: "Cờ Cá Ngựa",
    desc: "Đua ngựa về nhà · bắt quân đối thủ",
    players: "2–4",
    accent: "#ff5a5a",
    tagClass: "gh-tag-red",
    thumb: "ludo",
  },
  {
    id: "caro",
    num: "04 / BOARD",
    title: "Cờ Caro",
    desc: "Caro 15×15 · thắng 5 quân liên tiếp",
    players: "2",
    accent: "#e8503a",
    tagClass: "gh-tag-red",
    thumb: "caro",
  }
];

const GAME_COMPONENTS = { wordchain: App, wordle: WordleApp, ludo: LudoApp, caro: CaroApp };
const GAME_NAMES = { wordchain: "Word Chain", wordle: "Wordle", ludo: "Cờ Cá Ngựa", caro: "Cờ Caro" };

const MARQUEE_ITEMS = [
  { label: "WORD CHAIN — LIVE", color: "#00e5a0", live: true },
  { label: "WORDLE — LIVE", color: "#64d96a", live: true },
  { label: "CỜ CÁ NGỰA — LIVE", color: "#ff5a5a", live: true },
  { label: "CỜ CARO — LIVE", color: "#e8503a", live: true },
];

/* ──────────────────────────────────��──────────
   THUMBNAILS
───────────────────────────────────────────── */
function WordChainThumb() {
  return (
    <div className="wc-thumb">
      <span className="wc-word wc-a">apple</span>
      <span className="wc-arr">›</span>
      <span className="wc-word wc-b">elephant</span>
      <span className="wc-arr">›</span>
      <span className="wc-word wc-c">tiger</span>
    </div>
  );
}

function WordleThumb() {
  const rows = [
    [{ l: "B", s: "absent" }, { l: "R", s: "absent" }, { l: "A", s: "present" }, { l: "V", s: "absent" }, { l: "E", s: "absent" }],
    [{ l: "P", s: "absent" }, { l: "L", s: "absent" }, { l: "A", s: "correct" }, { l: "N", s: "absent" }, { l: "T", s: "present" }],
    [{ l: "S", s: "absent" }, { l: "T", s: "correct" }, { l: "A", s: "correct" }, { l: "T", s: "correct" }, { l: "E", s: "correct" }],
    null,
    null,
  ];
  return (
    <div className="wd-thumb">
      {rows.map((row, ri) => (
        <div className="wd-row" key={ri}>
          {row
            ? row.map((c, ci) => (
              <div key={ci} className={`wd-cell wd-${c.s}`}>{c.l}</div>
            ))
            : Array(5).fill(null).map((_, ci) => (
              <div key={ci} className="wd-cell wd-empty" />
            ))
          }
        </div>
      ))}
    </div>
  );
}

function LudoThumb() {
  const pieces = [
    { src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/red-GIP3cNU5HlUNPZBNq4yH5rwIMJizh7.png", shadow: "#e74c3c66", alt: "Red knight" },
    { src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/green-6j3n5umXJmoXfKufezD22tZPxOmq2V.png", shadow: "#2ecc7166", alt: "Green knight" },
    { src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/yellow-X7VOeF8ftS4q2iVk0F2LhXvz5oL3vB.png", shadow: "#f1c40f66", alt: "Yellow knight" },
    { src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/blue-jHgLPPXTtNzk1wuQfkKmDPEaEYevT9.png", shadow: "#3498db66", alt: "Blue knight" },
  ];
  return (
    <div className="ld-thumb">
      <div className="ld-row">
        {pieces.slice(0, 2).map((p, i) => (
          <img
            key={i}
            className="ld-piece"
            src={p.src || "/placeholder.svg"}
            alt={p.alt}
            style={{ filter: `drop-shadow(0 5px 14px ${p.shadow})` }}
          />
        ))}
      </div>
      <div className="ld-row">
        {pieces.slice(2).map((p, i) => (
          <img
            key={i}
            className="ld-piece"
            src={p.src || "/placeholder.svg"}
            alt={p.alt}
            style={{ filter: `drop-shadow(0 5px 14px ${p.shadow})` }}
          />
        ))}
      </div>
    </div>
  );
}

function CaroThumb() {
  // Mini 5x5 board preview — diagonal "X wins" line, matching the real board look
  const preview = [
    ["O", null, "O", null, "X"],
    [null, "O", "X", "X", null],
    ["O", "X", "X", "O", "O"],
    ["X", "X", "O", "X", null],
    ["X", "O", null, "O", "X"],
  ];
  // highlight X's winning diagonal (top-right → bottom-left)
  const winCells = new Set(["0-4", "1-3", "2-2", "3-1", "4-0"]);
  return (
    <div className="caro-thumb">
      {preview.map((row, ri) => (
        <div key={ri} className="caro-thumb-row">
          {row.map((cell, ci) => {
            const isWin = winCells.has(`${ri}-${ci}`);
            return (
              <div
                key={ci}
                className="caro-thumb-cell"
                style={{
                  background: isWin
                    ? "#3d2e00"
                    : cell
                      ? cell === "X" ? "#3d1a16" : "#0f2a4d"
                      : "#1c1c28",
                  border: `1px solid ${isWin
                    ? "#f0c040"
                    : cell
                      ? cell === "X" ? "#8c2a1c" : "#1e5080"
                      : "#2a2a3a"
                    }`,
                  boxShadow: isWin ? "0 0 6px rgba(240,192,64,.5)" : "none",
                }}
              >
                {cell === "X" ? (
                  <span className="caro-thumb-mark caro-thumb-x" />
                ) : cell === "O" ? (
                  <span className="caro-thumb-mark caro-thumb-o" />
                ) : null}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────
   GAME CARD
───────────────────────────────────────────── */
function GameCard({ game, onPlay }) {
  return (
    <div
      className="gh-card available"
      style={{ "--card-accent": game.accent }}
      onClick={() => onPlay(game.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onPlay(game.id)}
      aria-label={`Chơi ${game.title}`}
    >
      {/* Thumbnail */}
      <div className="gh-thumb">
        <div
          className="gh-thumb-glow"
          style={{
            background: `radial-gradient(ellipse at 40% 50%, ${game.accent}55, transparent 70%)`,
          }}
        />
        <div className="gh-thumb-grid" />
        <div className="gh-card-overlay" />

        {game.thumb === "wordchain" && <WordChainThumb />}
        {game.thumb === "wordle" && <WordleThumb />}
        {game.thumb === "ludo" && <LudoThumb />}
        {game.thumb === "caro" && <CaroThumb />}

        <div className="gh-play-pill">▶ Chơi ngay</div>
      </div>

      {/* Body */}
      <div className="gh-card-body">
        <div className="gh-card-num">{game.num}</div>
        <div className="gh-card-title">{game.title}</div>
        <div className="gh-card-desc">{game.desc}</div>
        <div className="gh-card-footer">
          <span className={`gh-tag ${game.tagClass}`}>
            <span
              className="gh-live-dot"
              style={{ background: game.accent }}
            />
            Live
          </span>
          <span className="gh-players">{game.players} người</span>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MARQUEE
───────────────────────────────────────────── */
function Marquee() {
  const doubled = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS];
  return (
    <div className="gh-marquee-wrap">
      <div className="gh-marquee-inner">
        {doubled.map((item, i) => (
          <span className="gh-marquee-item" key={i}>
            <span
              className="gh-pip"
              style={{
                background: item.color,
                boxShadow: item.live ? `0 0 7px ${item.color}` : "none",
              }}
            />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   GAME HUB
───────────────────────────────────────────── */
export default function GameHub() {
  const [activeGame, setActiveGame] = useState(null);

  /* Inject styles once */
  useEffect(() => {
    if (typeof document === "undefined") return;
    const id = "gh-styles-v2";
    if (!document.getElementById(id)) {
      const el = document.createElement("style");
      el.id = id;
      el.textContent = HUB_STYLES;
      document.head.appendChild(el);
    }
  }, []);

  /* ── Active game view ── */
  if (activeGame && GAME_COMPONENTS[activeGame]) {
    const GameComponent = GAME_COMPONENTS[activeGame];
    const accent = GAMES.find(g => g.id === activeGame)?.accent ?? "#00e5a0";
    return (
      <div className="gh-root">
        <div className="gh-back-bar">
          <button className="gh-back-btn" onClick={() => setActiveGame(null)}>
            ← Hub
          </button>
          <span className="gh-back-sep">/</span>
          <span className="gh-back-name">{GAME_NAMES[activeGame]}</span>
          <div
            className="gh-back-dot"
            style={{ background: accent, boxShadow: `0 0 8px ${accent}` }}
          />
        </div>
        <div className="gh-game-body">
          <GameComponent />
        </div>
      </div>
    );
  }

  /* ── Hub view ── */
  return (
    <div className="gh-root">
      {/* Ambient glows */}
      <div className="gh-blob gh-blob-1" />
      <div className="gh-blob gh-blob-2" />
      <div className="gh-blob gh-blob-3" />

      <div className="gh-content">
        {/* Header */}
        <header className="gh-header">
          <div className="gh-logo-wrap">
            <img
              src="/none.png"
              alt="MINIGAMES Logo"
              className="gh-logo-image"
            />
            <div className="gh-logo">
              PIXEL ARENA
              <span className="gh-logo-dot" />
            </div>
            <span className="gh-beta">BETA</span>
          </div>
          <div className="gh-header-tagline">
            Chọn game · mời bạn bè · chơi thôi
          </div>
        </header>
      </div>

      {/* Marquee (full-width, outside content padding) */}
      <Marquee />

      <div className="gh-content">
        {/* Section label */}
        <div className="gh-section-label">Select game</div>

        {/* Cards */}
        <div className="gh-grid">
          {GAMES.map(g => (
            <GameCard key={g.id} game={g} onPlay={setActiveGame} />
          ))}
        </div>

        {/* Footer */}
        <footer className="gh-footer">
          <div className="gh-footer-copy">
            © 2025 MINIGAMES
          </div>
          <div className="gh-footer-dots">
            <div className="gh-fdot" style={{ background: "#00e5a0", opacity: 1 }} />
            <div className="gh-fdot" style={{ background: "#64d96a", opacity: 1 }} />
            <div className="gh-fdot" style={{ background: "#ff5a5a", opacity: 1 }} />
            <div className="gh-fdot" style={{ background: "#e8503a", opacity: 1 }} />
          </div>
        </footer>
      </div>
    </div>
  );
}
