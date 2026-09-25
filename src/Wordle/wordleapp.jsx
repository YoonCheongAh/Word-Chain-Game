import { useState, useEffect, useRef, useCallback } from "react";
import { animate, stagger } from "animejs";
import { createRoom, joinRoom, listenRoom, setPlayerOnline } from "../roomService";
import { startWordleGame, submitGuess, checkGuess, isGuessValid, requestWordleRematch, handleWordTimeout, WORD_TIME_MS, MAX_SCORE_PER_WORD, MAX_GUESSES } from "./wordleService";
import { ref, onValue, onDisconnect, update } from "firebase/database";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import UserAvatar from "../components/UserAvatar";
import { playSfx, toggleMute, isMuted } from "./WordleSound";

/* ─── STYLES ─────────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --c-bg: #0d1117;
    --c-surface: #161b22;
    --c-surface2: #1c2128;
    --c-border: #30363d;
    --c-text: #e6edf3;
    --c-muted: #7d8590;
    --c-green: #3fb950;
    --c-green-dim: #1a3d24;
    --c-yellow: #d29922;
    --c-yellow-dim: #3a2f00;
    --c-absent: #21262d;
    --c-absent-text: #484f58;
    --c-red: #f85149;
    --c-red-dim: #3d1a1a;
    --c-blue: #58a6ff;
    --c-blue-dim: #0d2340;
    --c-purple: #bc8cff;
    --c-cell-border: #3d444d;
  }

  body {
    font-family: 'Space Grotesk', sans-serif;
    background: var(--c-bg);
    color: var(--c-text);
    min-height: 100vh;
    display: flex;
    align-items: flex-start;
    justify-content: center;
  }

  .app { width: 100%; max-width: 600px; padding: 24px 16px 80px; }
  .wld-mute {
    position: fixed; top: 14px; right: 14px; z-index: 50;
    width: 36px; height: 36px; border: 1px solid var(--c-border);
    border-radius: 50%; background: rgba(22, 27, 34, 0.92); color: var(--c-text);
    cursor: pointer; font-size: 15px; line-height: 1;
    transition: border-color 0.15s, opacity 0.15s, transform 0.1s;
  }
  .wld-mute:hover { border-color: var(--c-green); }
  .wld-mute:active { transform: scale(0.92); }

  /* ── LOBBY ── */
  .lobby-wrap { padding-top: 48px; }
  .logo { text-align: center; margin-bottom: 6px; }
  .logo-text {
    font-size: 64px; font-weight: 700; letter-spacing: -3px; line-height: 1;
    color: var(--c-text);
  }
  .logo-text em { color: var(--c-green); font-style: normal; }
  .logo-sub { text-align: center; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--c-muted); margin-bottom: 40px; letter-spacing: 0.5px; }

  .card { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 12px; padding: 20px; margin-bottom: 12px; }
  .card-title { font-size: 11px; font-weight: 600; color: var(--c-muted); letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 14px; }

  .inp {
    width: 100%; background: var(--c-bg); border: 1px solid var(--c-border);
    border-radius: 8px; color: var(--c-text);
    font-family: 'Space Grotesk', sans-serif; font-size: 15px;
    padding: 11px 14px; outline: none; transition: border-color 0.15s;
    margin-bottom: 10px; display: block;
  }
  .inp:focus { border-color: var(--c-green); }
  .inp::placeholder { color: var(--c-muted); }
  .inp-mono { font-family: 'JetBrains Mono', monospace; letter-spacing: 3px; font-size: 14px; }
  .inp-locked { opacity: .5; cursor: not-allowed; color: var(--c-muted); background: var(--c-surface2); }

  .btn {
    display: block; width: 100%; padding: 13px 16px;
    border-radius: 8px; border: none; cursor: pointer;
    font-family: 'Space Grotesk', sans-serif; font-size: 14px; font-weight: 600;
    transition: opacity 0.15s, transform 0.1s; text-align: center;
  }
  .btn:active { transform: scale(0.98); }
  .btn:disabled { opacity: 0.3; cursor: not-allowed; }
  .btn-primary { background: var(--c-green); color: #fff; }
  .btn-primary:hover:not(:disabled) { opacity: 0.85; }
  .btn-secondary { background: transparent; color: var(--c-text); border: 1px solid var(--c-border); }
  .btn-secondary:hover:not(:disabled) { border-color: #555; background: var(--c-surface); }
  .btn-danger { background: transparent; color: var(--c-red); border: 1px solid var(--c-red-dim); margin-top: 8px; }
  .btn-danger:hover:not(:disabled) { background: var(--c-red-dim); }

  .err { color: var(--c-red); font-size: 12px; font-family: 'JetBrains Mono', monospace; margin-top: 8px; text-align: center; }

  /* ── ROOM ── */
  .room-code-wrap { text-align: center; padding: 8px 0 4px; }
  .room-code {
    font-family: 'JetBrains Mono', monospace; font-size: 44px; font-weight: 600;
    letter-spacing: 10px; color: var(--c-green); cursor: pointer;
    transition: opacity 0.15s;
  }
  .room-code:hover { opacity: 0.75; }
  .room-hint { text-align: center; font-size: 11px; color: var(--c-muted); font-family: 'JetBrains Mono', monospace; margin-bottom: 16px; }
  .divider { border: none; border-top: 1px solid var(--c-border); margin: 14px 0; }

  .player-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--c-surface2); }
  .player-row:last-child { border-bottom: none; }
  .av { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; flex-shrink: 0; }
  .av-host { background: var(--c-green-dim); color: var(--c-green); }
  .av-p2   { background: var(--c-blue-dim);   color: var(--c-blue); }
  .av-p3   { background: #2d1a3d;             color: var(--c-purple); }
  .av-p4   { background: var(--c-yellow-dim); color: var(--c-yellow); }
  /* ── NEW: player 5 & 6 ── */
  .av-p5   { background: #1a2d3d;             color: #56d4f5; }
  .av-p6   { background: #2d1a2d;             color: #e879f9; }
  .av-empty { background: var(--c-surface2); color: var(--c-muted); }

  .p-name { font-size: 14px; font-weight: 600; flex: 1; }
  .p-name-empty { color: var(--c-muted); font-weight: 400; }
  .p-tag { font-size: 10px; font-family: 'JetBrains Mono', monospace; padding: 3px 8px; border-radius: 20px; }
  .tag-host  { background: var(--c-green-dim); color: var(--c-green); }
  .tag-join  { background: var(--c-blue-dim);  color: var(--c-blue); }
  .tag-wait  { background: var(--c-surface2);  color: var(--c-muted); }
  .tag-you   { background: var(--c-surface2); color: #666; font-size: 9px; margin-left: 4px; padding: 2px 6px; }
  .pulse { animation: pulse 1.6s ease-in-out infinite; }
  @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.35} }

  /* ── GAME HEADER ── */
  .g-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
  .g-logo { font-size: 18px; font-weight: 700; letter-spacing: -0.5px; }
  .g-logo em { color: var(--c-green); font-style: normal; }
  .g-room { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--c-muted); }

  /* ── WORD NAV ── */
  .word-nav { display: flex; gap: 6px; margin-bottom: 12px; }
  .word-pip {
    flex: 1; height: 6px; border-radius: 3px; background: var(--c-surface2);
    transition: background 0.3s;
  }
  .word-pip.active { background: var(--c-green); }
  .word-pip.done   { background: #2a4a2e; }

  /* ── TIMER ── */
  .timer-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
  .timer-label { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--c-muted); }
  .timer-secs  { font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 600; }
  .timer-bar-wrap { height: 5px; background: var(--c-surface2); border-radius: 999px; overflow: hidden; margin-bottom: 14px; }
  .timer-bar { height: 100%; border-radius: 999px; transition: width 0.5s linear, background 0.5s; }

  /* ── SCORE ROW ── */
  .score-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
  .my-score { font-size: 15px; font-weight: 700; }
  .my-score span { color: var(--c-green); }
  .word-label { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--c-muted); }

  /* ── SIDEBAR OTHERS (fixed left) ── */
  .sidebar-others {
    position: fixed;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    flex-direction: column;
    gap: 10px;
    z-index: 10;
  }
  .sidebar-player {
    background: var(--c-surface);
    border: 1px solid var(--c-border);
    border-radius: 10px;
    padding: 8px 10px;
    min-width: 82px;
    max-width: 82px;
  }
  .sidebar-player-name {
    font-size: 10px;
    font-family: 'JetBrains Mono', monospace;
    color: var(--c-muted);
    margin-bottom: 6px;
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sidebar-mini-grid {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
  }
  .sidebar-score {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: var(--c-green);
    text-align: center;
    margin-top: 5px;
  }
  .sidebar-status {
    font-size: 11px;
    text-align: center;
    margin-top: 2px;
  }
  .sidebar-status.done { color: var(--c-green); }
  .sidebar-status.waiting { color: var(--c-muted); font-size: 9px; font-family: 'JetBrains Mono', monospace; }

  /* ── MINI GRID (shared) ── */
  .mini-grid { display: flex; flex-direction: column; gap: 3px; }
  .mini-row { display: flex; gap: 3px; }
  .mini-cell { width: 12px; height: 12px; border-radius: 2px; background: var(--c-surface2); }
  .mini-cell.correct { background: #3fb950; }
  .mini-cell.present { background: #d29922; }
  .mini-cell.absent  { background: #3d444d; }

  /* ── GRID ── */
  .grid-wrap { margin-bottom: 16px; }
  .grid { display: flex; flex-direction: column; gap: 7px; perspective: 900px; }
  .g-row { display: flex; gap: 7px; justify-content: center; }

  .cell {
    width: 62px; height: 62px;
    border: 2px solid var(--c-cell-border);
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-size: 26px; font-weight: 700; text-transform: uppercase;
    color: var(--c-text);
    transition: border-color 0.1s;
    position: relative;
    backface-visibility: hidden;
    transform-style: preserve-3d;
  }
  .cell.filled { border-color: #6e7681; }
  .cell.active-row { border-color: #6e7681; }
  .cell.correct { background: #1a4d28; border-color: #3fb950; color: #3fb950; }
  .cell.present { background: #3a2800; border-color: #d29922; color: #d29922; }
  .cell.absent  { background: var(--c-absent); border-color: #3d444d; color: var(--c-absent-text); }

  /* ── NOTICE ── */
  .notice-bar {
    text-align: center; font-family: 'JetBrains Mono', monospace; font-size: 13px;
    padding: 10px 14px; border-radius: 8px; margin-bottom: 12px;
    animation: fadeIn 0.2s ease;
  }
  @keyframes fadeIn { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
  .notice-solved { background: var(--c-green-dim); color: var(--c-green); border: 1px solid #2a5a30; }
  .notice-failed { background: var(--c-red-dim);   color: var(--c-red);   border: 1px solid #5a2a2a; }
  .notice-info   { background: var(--c-surface);   color: var(--c-muted); border: 1px solid var(--c-border); }
  .notice-timeout { background: var(--c-yellow-dim); color: var(--c-yellow); border: 1px solid #5a4500; }

  /* ── KEYBOARD ── */
  .kb { display: flex; flex-direction: column; gap: 7px; }
  .kb-row { display: flex; justify-content: center; gap: 6px; }
  .key {
    height: 58px; min-width: 38px; padding: 0 6px;
    border: none; border-radius: 8px; cursor: pointer;
    font-family: 'Space Grotesk', sans-serif; font-size: 13px; font-weight: 600;
    background: var(--c-surface2); color: var(--c-text);
    transition: background 0.15s, transform 0.1s; flex: 1; max-width: 44px;
  }
  .key:active { transform: scale(0.92); }
  .key.wide { max-width: 64px; font-size: 11px; }
  .key.correct { background: #1a4d28; color: #3fb950; }
  .key.present { background: #3a2800; color: #d29922; }
  .key.absent  { background: #161b22; color: #3d444d; }

  /* ── GAME OVER ── */
  .gameover-wrap { padding-top: 32px; min-height: 520px; }
  .go-card { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 16px; padding: 28px 24px; }
  .go-icon { text-align: center; font-size: 48px; margin-bottom: 12px; }
  .go-title { font-size: 28px; font-weight: 700; text-align: center; margin-bottom: 4px; }
  .go-sub { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--c-muted); text-align: center; margin-bottom: 24px; }
  .confetti-bit { position: fixed; z-index: 99; pointer-events: none; will-change: transform, opacity; }

  .lb { margin-bottom: 20px; }
  .lb-row { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 10px; background: var(--c-bg); margin-bottom: 6px; border: 1px solid transparent; }
  .lb-row.me { border-color: var(--c-green-dim); }
  .lb-rank { font-size: 20px; min-width: 30px; }
  .lb-name { flex: 1; font-size: 15px; font-weight: 600; }
  .lb-score { font-family: 'JetBrains Mono', monospace; font-size: 15px; color: var(--c-green); font-weight: 600; }
  .lb-me-tag { font-size: 10px; color: var(--c-muted); font-family: 'JetBrains Mono', monospace; }

  .rematch-hint { font-size: 11px; font-family: 'JetBrains Mono', monospace; color: var(--c-yellow); text-align: center; margin-top: 10px; }

  /* ── TOAST ── */
  .toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: var(--c-green); color: #fff; font-family: 'JetBrains Mono', monospace; font-size: 12px; padding: 8px 16px; border-radius: 20px; z-index: 999; animation: toastIn 0.2s ease; pointer-events: none; }
  @keyframes toastIn { from{opacity:0;transform:translateX(-50%) translateY(8px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }

  /* ── DISSOLVED ── */
  .dissolved-overlay { position: fixed; inset: 0; background: rgba(13,17,23,0.93); display: flex; align-items: center; justify-content: center; z-index: 100; }
  .dissolved-box { text-align: center; padding: 36px 28px; background: var(--c-surface); border: 1px solid var(--c-red-dim); border-radius: 16px; max-width: 300px; }
  .dissolved-box h2 { font-size: 20px; font-weight: 700; margin: 12px 0 6px; }
  .dissolved-box p { font-size: 12px; color: var(--c-muted); font-family: 'JetBrains Mono', monospace; margin-bottom: 20px; }

  /* Loading */
  .loading-wrap { padding-top: 60px; text-align: center; color: var(--c-muted); font-family: 'JetBrains Mono', monospace; font-size: 13px; }
`;

// ── CHANGED: 4 → 6 slots ──────────────────────────────────
const PLAYER_SLOTS = ["player1","player2","player3","player4","player5","player6"];

const KEYBOARD_ROWS = [
  ["Q","W","E","R","T","Y","U","I","O","P"],
  ["A","S","D","F","G","H","J","K","L"],
  ["ENTER","Z","X","C","V","B","N","M","⌫"],
];

// ── CHANGED: added 5th & 6th place medals ─────────────────
const MEDALS = ["🥇","🥈","🥉","4️⃣","5️⃣","6️⃣"];

// ── CHANGED: added av-p5, av-p6 ───────────────────────────
const AV_CLASSES = ["av-host","av-p2","av-p3","av-p4","av-p5","av-p6"];

const CONFETTI_COLORS = ["#3fb950", "#d29922", "#58a6ff", "#bc8cff", "#f85149", "#e6edf3"];
const EMPTY_GUESSES = [];

function MuteButton() {
  const [muted, setMutedState] = useState(isMuted());

  function handleToggle() {
    const nextMuted = toggleMute();
    setMutedState(nextMuted);
    if (!nextMuted) playSfx("key");
  }

  return (
    <button
      type="button"
      className="wld-mute"
      onClick={handleToggle}
      onKeyDown={event => event.stopPropagation()}
      title={muted ? "Bật âm thanh" : "Tắt âm thanh"}
      aria-label={muted ? "Bật âm thanh" : "Tắt âm thanh"}
    >
      {muted ? "OFF" : "ON"}
    </button>
  );
}

function spawnWordleConfetti(host, count = 52) {
  if (!host) return;
  const rect = host.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + Math.min(rect.height * 0.42, 240);

  for (let i = 0; i < count; i++) {
    const particle = document.createElement("span");
    const size = 5 + Math.random() * 7;
    particle.className = "confetti-bit";
    particle.style.cssText = `left:${centerX}px;top:${centerY}px;width:${size}px;height:${size * (i % 3 === 0 ? 1.8 : 1)}px;background:${CONFETTI_COLORS[i % CONFETTI_COLORS.length]};border-radius:${i % 3 === 0 ? "2px" : "50%"};`;
    host.appendChild(particle);

    const angle = Math.random() * Math.PI * 2;
    const distance = 0.24 + Math.random() * 0.36;
    animate(particle, {
      translateX: [0, Math.cos(angle) * distance * window.innerWidth],
      translateY: [0, Math.sin(angle) * distance * window.innerHeight + 180],
      rotate: [0, Math.random() * 720 - 360],
      scale: [1, 0.25],
      opacity: [1, 0],
      duration: 1000 + Math.random() * 900,
      delay: Math.random() * 280,
      ease: "outQuart",
      onComplete: () => particle.remove(),
    });
  }
}

function DissolvedOverlay({ onLeave }) {
  return (
    <div className="dissolved-overlay">
      <div className="dissolved-box">
        <div style={{ fontSize: 40 }}>💨</div>
        <h2>Phòng đã đóng</h2>
        <p>Một người chơi đã thoát khỏi phòng.</p>
        <button className="btn btn-primary" onClick={onLeave}>Về trang chủ</button>
      </div>
    </div>
  );
}

function OthersPanel({ myRole, players, wordle }) {
  const others = PLAYER_SLOTS.filter(role => role !== myRole && players?.[role]);
  if (!others.length) return null;
  return (
    <div className="sidebar-others">
      {others.map(role => {
        const playerData = wordle?.playerData?.[role];
        const guesses = playerData?.guesses ?? EMPTY_GUESSES;
        const score = playerData?.score ?? 0;
        const wordDone = playerData?.wordDone;
        return (
          <div className="sidebar-player" key={role}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>
              <UserAvatar
                name={players[role]?.name}
                avatar={players[role]?.avatar}
                className="av av-host"
                style={{ width: 30, height: 30, fontSize: 12 }}
              />
            </div>
            <div className="sidebar-player-name">{players[role]?.name}</div>
            <div className="sidebar-mini-grid">
              {Array(MAX_GUESSES).fill(null).map((_, rowIndex) => {
                const guess = guesses[rowIndex];
                return (
                  <div className="mini-row" key={rowIndex}>
                    {Array(5).fill(null).map((_, cellIndex) => (
                      <div key={cellIndex} className={`mini-cell ${guess?.result?.[cellIndex] ?? ""}`} />
                    ))}
                  </div>
                );
              })}
            </div>
            <div className="sidebar-score">{score}đ</div>
            <div className={`sidebar-status ${wordDone ? "done" : "waiting"}`}>
              {wordDone ? "✓" : "..."}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function WordleApp() {
  const { displayName, avatar, isGoogle } = useAuth();
  const [screen, setScreen]           = useState("lobby");
  const [name, setName]               = useState("");
  const [inputRoomId, setInputRoomId] = useState("");
  const [roomId, setRoomId]           = useState("");
  const [myRole, setMyRole]           = useState("");
  const [roomData, setRoomData]       = useState(null);
  const [currentInput, setCurrentInput] = useState("");
  const [error, setError]             = useState("");
  const [notice, setNotice]           = useState(null);
  const [timeLeft, setTimeLeft]       = useState(WORD_TIME_MS / 1000);
  const [copiedToast, setCopiedToast] = useState(false);
  const [dissolved, setDissolved]     = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  /* ── Display name is driven by auth: Google users are locked to their
     account name; anonymous users can still type their own. ── */
  const fieldName = name || displayName;

  const appRef = useRef(null);
  const gridRef = useRef(null);
  const timerBarRef = useRef(null);
  const gameoverRef = useRef(null);
  const timerRef = useRef(null);
  const timeoutFiredRef = useRef(false);
  const lastWordStartedAtRef = useRef(null);
  const lastGuessAnimationRef = useRef({ wordIdx: null, count: 0 });
  const soundStateRef = useRef({ playerCount: null, finished: false });
  const validatingRef = useRef(false);
  const mountedRef = useRef(false);
  const submitContextRef = useRef(null);

  const wordle      = roomData?.wordle;
  const players     = roomData?.players;
  const playerCount = Object.keys(players || {}).length;
  const myData      = wordle?.playerData?.[myRole];
  const wordIdx     = wordle?.currentWordIdx ?? 0;
  const currentGuesses  = myData?.guesses ?? EMPTY_GUESSES;
  const myScore         = myData?.score ?? 0;
  const myWordDone      = myData?.wordDone ?? false;
  const currentAnswer   = wordle?.words?.[wordIdx] ?? "";
  const guessCount      = currentGuesses.length;
  const latestGuessResultKey = currentGuesses[guessCount - 1]?.result?.join(",") || "";

  const keyColors = {};
  currentGuesses.forEach(g => {
    g.result.forEach((r, i) => {
      const ch = g.word[i].toUpperCase();
      const prev = keyColors[ch];
      if (r === "correct") keyColors[ch] = "correct";
      else if (r === "present" && prev !== "correct") keyColors[ch] = "present";
      else if (!prev) keyColors[ch] = "absent";
    });
  });

  /* ── Inject CSS ── */
  useEffect(() => {
    const id = "wld-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style");
      el.id = id; el.textContent = STYLES;
      document.head.appendChild(el);
    }
    return () => document.getElementById(id)?.remove();
  }, []);

  useEffect(() => {
    const logo = appRef.current?.querySelector(".logo-text");
    const cards = appRef.current?.querySelectorAll(".card");
    const animations = [];
    if (logo) {
      animations.push(animate(logo, {
        translateY: [28, 0],
        scale: [0.82, 1],
        opacity: [0, 1],
        duration: 650,
        ease: "outBack",
      }));
    }
    if (cards?.length) {
      animations.push(animate(cards, {
        translateY: [22, 0],
        opacity: [0, 1],
        duration: 500,
        delay: stagger(90, { start: 120 }),
        ease: "outQuart",
      }));
    }
    return () => animations.forEach(animation => animation.revert());
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    submitContextRef.current = {
      roomId: roomId || null,
      myRole: myRole || null,
      wordStartedAt: wordle?.wordStartedAt ?? null,
      wordDone: myWordDone,
    };
  }, [myRole, myWordDone, roomId, wordle?.wordStartedAt]);

  useEffect(() => {
    if (screen !== "game" || currentInput.length !== 5 || myWordDone || wordle?.roundOver) return;
    void isGuessValid(currentInput);
  }, [currentInput, myWordDone, screen, wordle?.roundOver]);

  /* ── Presence ── */
  useEffect(() => {
    if (!roomId || !myRole) return;
    const connRef = ref(db, ".info/connected");
    const unsub = onValue(connRef, snap => {
      if (snap.val()) {
        update(ref(db, `rooms/${roomId}/players/${myRole}`), { online: true });
        onDisconnect(ref(db, `rooms/${roomId}/players/${myRole}/online`)).set(false);
      }
    });
    return () => unsub();
  }, [roomId, myRole]);

  /* ── Listen room ── */
  useEffect(() => {
    if (!roomId) return;
    const unsub = listenRoom(roomId, data => setRoomData(data));
    return () => unsub();
  }, [roomId]);

  useEffect(() => {
    if (!roomData) return;
    const status = roomData.status;
    let nextScreen = null;
    if (status === "playing" && screen !== "game") nextScreen = "game";
    if ((status === "waiting" || status === "ready") && screen === "lobby" && roomId) nextScreen = "room";
    const shouldDissolve = status === "dissolved" && !dissolved;
    if (!nextScreen && !shouldDissolve) return;

    const timer = setTimeout(() => {
      if (nextScreen) setScreen(nextScreen);
      if (shouldDissolve) setDissolved(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [roomData, roomId, screen, dissolved]);

  useEffect(() => {
    if (!roomData) return;
    const previousCount = soundStateRef.current.playerCount;
    if (previousCount !== null && playerCount > previousCount && (screen === "room" || screen === "game")) {
      playSfx("join");
      const rows = appRef.current?.querySelectorAll(".player-row");
      if (rows?.length) {
        animate(rows, {
          translateX: [-12, 0],
          opacity: [0.4, 1],
          duration: 360,
          ease: "outQuart",
        });
      }
    }
    soundStateRef.current.playerCount = playerCount;
  }, [playerCount, roomData, screen]);

  useEffect(() => {
    const startedAt = wordle?.wordStartedAt;
    if (screen !== "game" || !startedAt || lastWordStartedAtRef.current === startedAt) return;
    const animations = [];
    const frame = requestAnimationFrame(() => {
      if (lastWordStartedAtRef.current === startedAt) return;
      const firstRound = lastWordStartedAtRef.current === null;
      lastWordStartedAtRef.current = startedAt;
      playSfx(firstRound ? "start" : "round");

      const header = appRef.current?.querySelector(".g-top");
      const pips = appRef.current?.querySelectorAll(".word-pip");
      if (header) {
        animations.push(animate(header, {
          translateY: [-12, 0],
          opacity: [0, 1],
          duration: 420,
          ease: "outQuart",
        }));
      }
      if (pips?.length) {
        animations.push(animate(pips, {
          scaleX: [0.2, 1],
          opacity: [0.35, 1],
          duration: 420,
          delay: stagger(65),
          ease: "outBack",
        }));
      }
    });
    return () => {
      cancelAnimationFrame(frame);
      animations.forEach(animation => animation.revert());
    };
  }, [screen, wordle?.wordStartedAt]);

  /* ── Reset on new word ── */
  const prevWordIdx = useRef(0);
  useEffect(() => {
    if (!wordle) return;
    if (wordIdx !== prevWordIdx.current) {
      prevWordIdx.current = wordIdx;
      timeoutFiredRef.current = false;
      lastGuessAnimationRef.current = { wordIdx, count: 0 };
      setCurrentInput("");
      setNotice({ text: `Từ ${wordIdx + 1}/5 bắt đầu!`, type: "info" });
    }
  }, [wordle, wordIdx]);

  /* ── Timer ── */
  useEffect(() => {
    if (screen !== "game" || !wordle?.wordStartedAt || wordle.roundOver) return;
    clearInterval(timerRef.current);
    timeoutFiredRef.current = false;
    let lastTick = -1;

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - wordle.wordStartedAt;
      const left = Math.max(0, Math.round((WORD_TIME_MS - elapsed) / 1000));
      setTimeLeft(left);

      if (left > 0 && left <= 5 && left !== lastTick) {
        lastTick = left;
        playSfx("tick");
        if (left <= 3 && timerBarRef.current) {
          animate(timerBarRef.current, {
            scaleY: [1, 1.8, 1],
            opacity: [1, 0.45, 1],
            duration: 240,
            ease: "outQuad",
          });
        }
      }

      if (left === 0 && !timeoutFiredRef.current) {
        timeoutFiredRef.current = true;
        clearInterval(timerRef.current);
        playSfx("timeout");
        const activeRow = gridRef.current?.querySelector(".g-row.is-active");
        if (activeRow) {
          animate(activeRow, {
            translateX: [0, -9, 9, -5, 5, 0],
            duration: 420,
            ease: "outQuad",
          });
        }
        setNotice({ text: `⏰ Hết giờ! Đáp án: "${currentAnswer.toUpperCase()}"`, type: "timeout" });
        if (myRole === "player1") handleWordTimeout(roomId);
      }
    }, 250);

    return () => clearInterval(timerRef.current);
  }, [wordle?.wordStartedAt, wordle?.roundOver, screen, currentAnswer, myRole, roomId]);

  /* ── Notice auto-clear ── */
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 2800);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    const activeRow = gridRef.current?.querySelector(".g-row.is-active");
    const filledCells = activeRow?.querySelectorAll(".cell.filled");
    const cell = filledCells?.[filledCells.length - 1];
    if (!cell) return;
    const animation = animate(cell, {
      scale: [0.72, 1.14, 1],
      duration: 190,
      ease: "outBack",
    });
    return () => animation.revert();
  }, [currentInput, myWordDone]);

  useEffect(() => {
    if (screen !== "game") return;
    const previous = lastGuessAnimationRef.current;
    if (wordIdx !== previous.wordIdx) {
      lastGuessAnimationRef.current = { wordIdx, count: guessCount };
      return;
    }
    if (guessCount <= previous.count || !latestGuessResultKey) return;

    const row = gridRef.current?.querySelectorAll(".g-row")[guessCount - 1];
    const cells = row?.querySelectorAll(".cell");
    const latestResults = latestGuessResultKey.split(",");
    if (!cells?.length || latestResults.length !== 5) return;

    lastGuessAnimationRef.current = { wordIdx, count: guessCount };
    const flip = animate(cells, {
      rotateX: [0, 90, 90, 0],
      duration: 580,
      delay: stagger(95),
      ease: "inOutQuad",
    });
    latestResults.forEach((result, index) => playSfx(result, 0.12 + index * 0.1));

    let solvedBounce = null;
    const isSolved = latestResults.every(result => result === "correct");
    if (isSolved) {
      solvedBounce = animate(cells, {
        translateY: [0, -10, 0],
        scale: [1, 1.14, 1],
        duration: 520,
        delay: stagger(75, { start: 500 }),
        ease: "outBack",
      });
      playSfx("solved", 0.62);
    }

    return () => {
      if (!row?.isConnected) {
        flip.revert();
        solvedBounce?.revert();
      }
    };
  }, [screen, wordIdx, guessCount, latestGuessResultKey]);

  /* ── Keyboard handler ── */
  const showValidationError = useCallback((message) => {
    setError(message);
    playSfx("invalid");
    const activeRow = gridRef.current?.querySelector(".g-row.is-active");
    if (activeRow) {
      animate(activeRow, {
        translateX: [0, -9, 9, -5, 5, 0],
        duration: 380,
        ease: "outQuad",
      });
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (isValidating || validatingRef.current) return;
    if (currentInput.length !== 5) {
      showValidationError("Từ phải đủ 5 chữ cái!");
      return;
    }

    const guess = currentInput.toLowerCase();
    const submitContext = submitContextRef.current;
    if (!submitContext) return;

    validatingRef.current = true;
    setIsValidating(true);
    const valid = await isGuessValid(guess);
    const currentContext = submitContextRef.current;
    const contextMatches = mountedRef.current && currentContext &&
      currentContext.roomId === submitContext.roomId &&
      currentContext.myRole === submitContext.myRole &&
      currentContext.wordStartedAt === submitContext.wordStartedAt &&
      !currentContext.wordDone;
    if (!contextMatches) {
      validatingRef.current = false;
      setIsValidating(false);
      return;
    }

    if (!valid) {
      validatingRef.current = false;
      setIsValidating(false);
      showValidationError("Từ không hợp lệ!");
      return;
    }

    setError("");
    const result = checkGuess(guess, currentAnswer);
    const isSolved = result.every(r => r === "correct");
    const rowIdx = guessCount;

    setCurrentInput("");
    const accepted = await submitGuess(roomId, myRole, guess, submitContext.wordStartedAt).finally(() => {
      validatingRef.current = false;
      setIsValidating(false);
    });
    if (!accepted) return;

    const latestContext = submitContextRef.current;
    if (!mountedRef.current || !latestContext ||
      latestContext.roomId !== submitContext.roomId ||
      latestContext.myRole !== submitContext.myRole ||
      latestContext.wordStartedAt !== submitContext.wordStartedAt) return;

    if (isSolved) {
      setNotice({ text: `✓ Chính xác! "${currentAnswer.toUpperCase()}"`, type: "solved" });
    } else if (rowIdx + 1 >= MAX_GUESSES) {
      setNotice({ text: `✗ Đáp án là "${currentAnswer.toUpperCase()}"`, type: "failed" });
    }
  }, [currentAnswer, currentInput, guessCount, isValidating, myRole, roomId, showValidationError]);

  const handleKey = useCallback((key) => {
    if (myWordDone || !wordle || wordle.roundOver) return;
    if (key === "⌫" || key === "BACKSPACE") {
      setCurrentInput(prev => prev.slice(0, -1));
      playSfx("backspace");
    } else if (key === "ENTER") {
      playSfx("click");
      handleSubmit();
    } else if (/^[A-Z]$/.test(key) && currentInput.length < 5) {
      setCurrentInput(prev => prev + key);
      playSfx("key");
    }
  }, [currentInput.length, handleSubmit, myWordDone, wordle]);

  useEffect(() => {
    const fn = e => {
      const k = e.key.toUpperCase();
      if (k === "BACKSPACE") handleKey("⌫");
      else if (k === "ENTER") handleKey("ENTER");
      else if (/^[A-Z]$/.test(k)) handleKey(k);
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [handleKey]);

  /* ── Lobby actions ── */
  async function handleCreate() {
    if (!fieldName.trim()) {
      showValidationError("Nhập tên của bạn!");
      return;
    }
    setError("");
    playSfx("click");
    const id = await createRoom(fieldName.trim(), { avatar });
    setRoomId(id); setMyRole("player1"); setScreen("room");
  }

  async function handleJoin() {
    if (!fieldName.trim()) {
      showValidationError("Nhập tên của bạn!");
      return;
    }
    if (!inputRoomId.trim()) {
      showValidationError("Nhập mã phòng!");
      return;
    }
    setError("");
    playSfx("click");
    try {
      const slot = await joinRoom(inputRoomId.toUpperCase(), fieldName.trim(), { avatar });
      setRoomId(inputRoomId.toUpperCase()); setMyRole(slot); setScreen("room");
    } catch (e) {
      showValidationError(e.message);
    }
  }

  async function handleStart() {
    if (playerCount < 2) return;
    playSfx("click");
    await startWordleGame(roomId);
  }

  async function handleRematch() {
    playSfx("click");
    await requestWordleRematch(roomId, myRole);
  }

  function handleLeave() {
    playSfx("click");
    setPlayerOnline(roomId, myRole, false);
    setRoomId(""); setMyRole(""); setRoomData(null);
    setScreen("lobby"); setDissolved(false);
    setCurrentInput(""); setError(""); setNotice(null);
    lastWordStartedAtRef.current = null;
    lastGuessAnimationRef.current = { wordIdx: null, count: 0 };
    soundStateRef.current = { playerCount: null, finished: false };
  }

  function handleCopy() {
    playSfx("copy");
    navigator.clipboard?.writeText(roomId).catch(() => {});
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 1800);
  }

  /* ── Build grid rows ── */
  function buildRows() {
    const rows = [];
    for (let i = 0; i < currentGuesses.length; i++) {
      const g = currentGuesses[i];
      rows.push({
        cells: g.word.split("").map((ch, j) => ({
          ch: ch.toUpperCase(),
          state: g.result[j],
        })),
        isActive: false,
      });
    }
    if (rows.length < MAX_GUESSES && !myWordDone) {
      const cells = Array(5).fill(null).map((_, j) => ({
        ch: currentInput[j]?.toUpperCase() ?? "",
        state: currentInput[j] ? "filled" : "active-row",
      }));
      rows.push({ cells, isActive: true });
    }
    while (rows.length < MAX_GUESSES) {
      rows.push({
        cells: Array(5).fill({ ch: "", state: "" }),
        isActive: false,
      });
    }
    return rows;
  }

  useEffect(() => {
    if (!wordle?.roundOver) {
      soundStateRef.current.finished = false;
      return;
    }
    if (soundStateRef.current.finished) return;

    const host = gameoverRef.current;
    const animations = [];
    const frame = requestAnimationFrame(() => {
      if (soundStateRef.current.finished) return;
      soundStateRef.current.finished = true;

      const scores = Object.values(wordle.playerData || {}).map(player => player.score ?? 0);
      const topScore = Math.max(0, ...scores);
      const isWinner = (wordle.playerData?.[myRole]?.score ?? 0) === topScore;
      playSfx(isWinner ? "win" : "complete");

      spawnWordleConfetti(host, isWinner ? 56 : 18);
      if (!host) return;

      const icon = host.querySelector(".go-icon");
      const title = host.querySelector(".go-title");
      const leaderboardRows = host.querySelectorAll(".lb-row");
      if (icon) {
        animations.push(animate(icon, {
          scale: [0, 1.2, 1],
          rotate: [-14, 8, 0],
          duration: 820,
          delay: 100,
          ease: "outBack",
        }));
      }
      if (title) {
        animations.push(animate(title, {
          translateY: [24, 0],
          opacity: [0, 1],
          duration: 520,
          delay: 220,
          ease: "outQuart",
        }));
      }
      if (leaderboardRows.length) {
        animations.push(animate(leaderboardRows, {
          translateX: [-28, 0],
          opacity: [0, 1],
          duration: 420,
          delay: stagger(75, { start: 300 }),
          ease: "outQuart",
        }));
      }
    });
    return () => {
      cancelAnimationFrame(frame);
      if (!host?.isConnected) animations.forEach(animation => animation.revert());
    };
  }, [wordle, myRole]);

  /* ═══════════════ RENDER ═══════════════ */

  /* LOBBY */
  if (screen === "lobby") return (
    <div className="app" ref={appRef}>
      <MuteButton />
      {dissolved && <DissolvedOverlay onLeave={handleLeave} />}
      <div className="lobby-wrap">
        <div className="logo"><div className="logo-text">Wor<em>dle</em></div></div>
        {/* CHANGED: 4 → 6 */}
        <p className="logo-sub">// đoán từ 5 chữ · 2–6 người · realtime</p>
        <div className="card">
          <div className="card-title">Tạo phòng mới</div>
          <input className={`inp${isGoogle ? " inp-locked" : ""}`} placeholder="Tên của bạn" value={fieldName}
            disabled={isGoogle}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleCreate()} />
          <button className="btn btn-primary" onClick={handleCreate}>Tạo phòng →</button>
        </div>
        <div className="card">
          <div className="card-title">Tham gia phòng</div>
          <input className={`inp${isGoogle ? " inp-locked" : ""}`} placeholder="Tên của bạn" value={fieldName}
            disabled={isGoogle}
            onChange={e => setName(e.target.value)} />
          <input className="inp inp-mono" placeholder="MÃ PHÒNG" value={inputRoomId}
            onChange={e => setInputRoomId(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && handleJoin()} />
          <button className="btn btn-secondary" onClick={handleJoin}>Tham gia →</button>
        </div>
        {error && <p className="err">{error}</p>}
      </div>
    </div>
  );

  /* ROOM LOBBY */
  if (screen === "room") return (
    <div className="app" ref={appRef}>
      <MuteButton />
      {dissolved && <DissolvedOverlay onLeave={handleLeave} />}
      <div className="card" style={{ marginTop: 32 }}>
        <div className="card-title">Mã phòng</div>
        <div className="room-code-wrap">
          <div className="room-code" onClick={handleCopy}>{roomId}</div>
        </div>
        {/* CHANGED: /4 → /6 */}
        <div className="room-hint">nhấn để copy · {playerCount}/6 người</div>
        <hr className="divider" />
        {PLAYER_SLOTS.map((slot, idx) => {
          const p    = players?.[slot];
          const isMe = slot === myRole;
          return (
            <div className="player-row" key={slot}>
              <UserAvatar name={p?.name} avatar={p?.avatar} className={`av ${p ? AV_CLASSES[idx] : "av-empty"}`} fallback={idx + 1} />
              <div className={`p-name${!p ? " p-name-empty" : ""}`}>
                {p?.name ?? "Chờ..."}
                {isMe && <span className="p-tag tag-you">bạn</span>}
              </div>
              <span className={`p-tag ${idx === 0 ? "tag-host" : p ? "tag-join" : "tag-wait"} ${!p && "pulse"}`}>
                {idx === 0 ? "host" : p ? "joined" : "waiting"}
              </span>
            </div>
          );
        })}
        <hr className="divider" />
        {myRole === "player1"
          ? <button className="btn btn-primary" onClick={handleStart} disabled={playerCount < 2}>
              {/* CHANGED: /4 → /6 */}
              {playerCount < 2 ? `Chờ người... (${playerCount}/6)` : `▶ Bắt đầu — ${playerCount} người`}
            </button>
          : <p style={{ textAlign:"center", color:"var(--c-muted)", fontSize:13, fontFamily:"'JetBrains Mono',monospace" }}>Chờ host bắt đầu...</p>
        }
        <button className="btn btn-danger" onClick={handleLeave}>Thoát phòng</button>
      </div>
      {copiedToast && <div className="toast">✓ Đã copy mã phòng!</div>}
    </div>
  );

  /* GAME OVER */
  if (wordle?.roundOver) {
    const pd = wordle.playerData || {};
    const sorted = Object.entries(pd)
      .map(([role, d]) => ({ role, name: players?.[role]?.name ?? role, score: d.score ?? 0 }))
      .sort((a, b) => b.score - a.score);
    const myRematch    = wordle.rematch?.[myRole];
    const rematchCount = Object.keys(wordle.rematch || {}).length;

    return (
      <div className="app" ref={appRef}>
        <MuteButton />
        {dissolved && <DissolvedOverlay onLeave={handleLeave} />}
        <div className="gameover-wrap" ref={gameoverRef}>
          <div className="go-card">
            <div className="go-icon">🏆</div>
            <div className="go-title">Kết quả</div>
            <div className="go-sub">5 từ · {WORD_TIME_MS / 60000} phút/từ · tối đa {MAX_SCORE_PER_WORD}đ/từ</div>
            <div className="lb">
              {sorted.map((p, i) => (
                <div key={p.role} className={`lb-row${p.role === myRole ? " me" : ""}`}>
                  {/* MEDALS now covers up to index 5 */}
                  <span className="lb-rank">{MEDALS[i] ?? "—"}</span>
                  <UserAvatar
                    name={p.name}
                    avatar={players?.[p.role]?.avatar}
                    className="av av-host"
                    style={{ width: 30, height: 30, fontSize: 12 }}
                  />
                  <span className="lb-name">
                    {p.name}
                    {p.role === myRole && <span className="lb-me-tag"> (bạn)</span>}
                  </span>
                  <span className="lb-score">{p.score}đ</span>
                </div>
              ))}
            </div>
            <button className="btn btn-primary" onClick={handleRematch} disabled={!!myRematch} style={{ marginBottom: 8 }}>
              {myRematch ? "Đã sẵn sàng ✓" : "Chơi lại"}
            </button>
            <button className="btn btn-danger" onClick={handleLeave}>Về trang chủ</button>
            {myRematch && <p className="rematch-hint">{rematchCount}/{playerCount} người sẵn sàng...</p>}
          </div>
        </div>
      </div>
    );
  }

  /* LOADING */
  if (screen !== "game" || !wordle) return (
    <div className="app" ref={appRef}>
      <MuteButton />
      <div className="loading-wrap">Đang tải...</div>
    </div>
  );

  /* GAME */
  const rows = buildRows();
  const timerPct   = (timeLeft / (WORD_TIME_MS / 1000)) * 100;
  const timerColor = timerPct > 50 ? "#3fb950" : timerPct > 20 ? "#d29922" : "#f85149";

  const waitingForOthers = myWordDone && !wordle.roundOver &&
    PLAYER_SLOTS.some(r => r !== myRole && players?.[r] && !wordle.playerData?.[r]?.wordDone);

  return (
    <div className="app" ref={appRef}>
      <MuteButton />
      {dissolved && <DissolvedOverlay onLeave={handleLeave} />}

      <OthersPanel myRole={myRole} players={players} wordle={wordle} />

      {/* Header */}
      <div className="g-top">
        <div className="g-logo">Wor<em>dle</em></div>
        <div className="g-room">#{roomId}</div>
      </div>

      {/* Word progress pips */}
      <div className="word-nav">
        {Array(5).fill(null).map((_, i) => (
          <div key={i} className={`word-pip ${i < wordIdx ? "done" : i === wordIdx ? "active" : ""}`} />
        ))}
      </div>

      <div className="score-row">
        <div className="my-score">Score <span>{myScore}đ</span></div>
        <div className="word-label">từ {wordIdx + 1}/5</div>
      </div>
      <div className="timer-row">
        <div className="timer-label">Thời gian</div>
        <div className="timer-secs" style={{ color: timerColor }}>{timeLeft}s</div>
      </div>
      <div className="timer-bar-wrap">
        <div ref={timerBarRef} className="timer-bar" style={{ width: `${timerPct}%`, background: timerColor }} />
      </div>

      {notice && (
        <div className={`notice-bar notice-${notice.type}`}>{notice.text}</div>
      )}

      {waitingForOthers && (
        <div className="notice-bar notice-info pulse">⏳ Chờ người khác hoàn thành...</div>
      )}

      <div className="grid-wrap">
        <div className="grid" ref={gridRef}>
          {rows.map((row, ri) => (
            <div key={ri} className={`g-row${row.isActive ? " is-active" : ""}`}>
              {row.cells.map((cell, ci) => (
                <div key={ci} className={`cell ${cell.state}`}>{cell.ch}</div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {error && <p className="err" style={{ marginBottom: 10 }}>{error}</p>}

      {!myWordDone && (
        <div className="kb">
          {KEYBOARD_ROWS.map((row, ri) => (
            <div key={ri} className="kb-row">
              {row.map(key => (
                <button key={key}
                  className={`key${key.length > 1 ? " wide" : ""} ${keyColors[key] ?? ""}`}
                  disabled={isValidating && key === "ENTER"}
                  onClick={() => handleKey(key)}>
                  {key === "ENTER" && isValidating ? "..." : key}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {copiedToast && <div className="toast">✓ Đã copy!</div>}
    </div>
  );
}