import { useState, useEffect, useRef } from "react";
import { createRoom, joinRoom, listenRoom, setPlayerOnline } from "../roomService";
import { startWordleGame, submitGuess, checkGuess, requestWordleRematch, handleWordTimeout, WORD_TIME_MS, MAX_SCORE_PER_WORD, MAX_GUESSES } from "./wordleService";
import { ref, onValue, onDisconnect, update } from "firebase/database";
import { db } from "../firebase";

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
  .grid { display: flex; flex-direction: column; gap: 7px; }
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
  }
  .cell.filled { border-color: #6e7681; }
  .cell.active-row { border-color: #6e7681; }
  .cell.correct { background: #1a4d28; border-color: #3fb950; color: #3fb950; }
  .cell.present { background: #3a2800; border-color: #d29922; color: #d29922; }
  .cell.absent  { background: var(--c-absent); border-color: #3d444d; color: var(--c-absent-text); }

  /* Flip animation */
  @keyframes flipReveal {
    0%   { transform: rotateX(0deg); }
    40%  { transform: rotateX(-90deg); }
    60%  { transform: rotateX(-90deg); }
    100% { transform: rotateX(0deg); }
  }
  .cell.flip-0 { animation: flipReveal 0.5s ease 0.0s both; }
  .cell.flip-1 { animation: flipReveal 0.5s ease 0.1s both; }
  .cell.flip-2 { animation: flipReveal 0.5s ease 0.2s both; }
  .cell.flip-3 { animation: flipReveal 0.5s ease 0.3s both; }
  .cell.flip-4 { animation: flipReveal 0.5s ease 0.4s both; }

  /* Pop when typing */
  @keyframes pop { 0%{transform:scale(1)} 50%{transform:scale(1.12)} 100%{transform:scale(1)} }
  .cell.pop { animation: pop 0.1s ease; }

  /* Shake row on invalid */
  @keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 60%{transform:translateX(8px)} }
  .g-row.shake { animation: shake 0.35s ease; }

  /* Bounce when solved */
  @keyframes bounce { 0%,100%{transform:translateY(0)} 40%{transform:translateY(-12px)} 70%{transform:translateY(-6px)} }
  .cell.bounce-0 { animation: bounce 0.6s ease 0.05s both; }
  .cell.bounce-1 { animation: bounce 0.6s ease 0.12s both; }
  .cell.bounce-2 { animation: bounce 0.6s ease 0.19s both; }
  .cell.bounce-3 { animation: bounce 0.6s ease 0.26s both; }
  .cell.bounce-4 { animation: bounce 0.6s ease 0.33s both; }

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
  .gameover-wrap { padding-top: 32px; }
  .go-card { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 16px; padding: 28px 24px; }
  .go-icon { text-align: center; font-size: 48px; margin-bottom: 12px; }
  .go-title { font-size: 28px; font-weight: 700; text-align: center; margin-bottom: 4px; }
  .go-sub { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--c-muted); text-align: center; margin-bottom: 24px; }

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

const ANIM_FLIP   = "flip";
const ANIM_BOUNCE = "bounce";

export default function WordleApp() {
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
  const [animatingRow, setAnimatingRow] = useState(null);
  const [shakeRow, setShakeRow]       = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  const timerRef       = useRef(null);
  const validatedCache = useRef(new Set());
  const timeoutFiredRef = useRef(false);

  const wordle      = roomData?.wordle;
  const players     = roomData?.players;
  const playerCount = Object.keys(players || {}).length;
  const myData      = wordle?.playerData?.[myRole];
  const wordIdx     = wordle?.currentWordIdx ?? 0;
  const currentGuesses  = myData?.guesses ?? [];
  const myScore         = myData?.score ?? 0;
  const myWordDone      = myData?.wordDone ?? false;
  const currentAnswer   = wordle?.words?.[wordIdx] ?? "";

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
    const s = roomData.status;
    if (s === "playing" && screen !== "game") setScreen("game");
    if (s === "dissolved") setDissolved(true);
    if ((s === "waiting" || s === "ready") && screen === "lobby" && roomId) setScreen("room");
  }, [roomData?.status]);

  /* ── Reset on new word ── */
  const prevWordIdx = useRef(0);
  useEffect(() => {
    if (!wordle) return;
    if (wordIdx !== prevWordIdx.current) {
      prevWordIdx.current = wordIdx;
      timeoutFiredRef.current = false;
      setCurrentInput("");
      setNotice({ text: `Từ ${wordIdx + 1}/5 bắt đầu!`, type: "info" });
      setAnimatingRow(null);
    }
  }, [wordIdx]);

  /* ── Timer ── */
  useEffect(() => {
    if (screen !== "game" || !wordle?.wordStartedAt) return;
    clearInterval(timerRef.current);
    timeoutFiredRef.current = false;

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - wordle.wordStartedAt;
      const left = Math.max(0, Math.round((WORD_TIME_MS - elapsed) / 1000));
      setTimeLeft(left);

      if (left === 0 && !timeoutFiredRef.current) {
        timeoutFiredRef.current = true;
        clearInterval(timerRef.current);
        setNotice({ text: `⏰ Hết giờ! Đáp án: "${currentAnswer.toUpperCase()}"`, type: "timeout" });
        if (myRole === "player1") handleWordTimeout(roomId);
      }
    }, 250);

    return () => clearInterval(timerRef.current);
  }, [wordle?.wordStartedAt, screen]);

  /* ── Notice auto-clear ── */
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 2800);
    return () => clearTimeout(t);
  }, [notice]);

  /* ── Keyboard handler ── */
  function handleKey(key) {
    if (myWordDone || !wordle || wordle.roundOver) return;
    if (key === "⌫" || key === "BACKSPACE") {
      setCurrentInput(prev => prev.slice(0, -1));
    } else if (key === "ENTER") {
      handleSubmit();
    } else if (/^[A-Z]$/.test(key) && currentInput.length < 5) {
      setCurrentInput(prev => prev + key);
    }
  }

  useEffect(() => {
    const fn = e => {
      const k = e.key.toUpperCase();
      if (k === "BACKSPACE") handleKey("⌫");
      else if (k === "ENTER") handleKey("ENTER");
      else if (/^[A-Z]$/.test(k)) handleKey(k);
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [currentInput, myWordDone, wordle]);

  async function handleSubmit() {
    if (currentInput.length !== 5) {
      setShakeRow(true);
      setTimeout(() => setShakeRow(false), 400);
      setError("Từ phải đủ 5 chữ cái!");
      return;
    }

    const guess = currentInput.toLowerCase();

    if (!validatedCache.current.has(guess)) {
      setIsValidating(true);
      try {
        const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${guess}`);
        if (!res.ok) {
          setIsValidating(false);
          setShakeRow(true);
          setTimeout(() => setShakeRow(false), 400);
          setError("Từ không hợp lệ!");
          return;
        }
        validatedCache.current.add(guess);
      } catch {
        validatedCache.current.add(guess);
      }
      setIsValidating(false);
    }

    setError("");
    const result = checkGuess(guess, currentAnswer);
    const isSolved = result.every(r => r === "correct");
    const rowIdx = currentGuesses.length;

    setCurrentInput("");
    setAnimatingRow({ rowIdx, type: ANIM_FLIP });
    if (isSolved) {
      setTimeout(() => setAnimatingRow({ rowIdx, type: ANIM_BOUNCE }), 550);
    }

    await submitGuess(roomId, myRole, guess);

    if (isSolved) {
      setNotice({ text: `✓ Chính xác! "${currentAnswer.toUpperCase()}"`, type: "solved" });
    } else if (rowIdx + 1 >= MAX_GUESSES) {
      setNotice({ text: `✗ Đáp án là "${currentAnswer.toUpperCase()}"`, type: "failed" });
    }
  }

  /* ── Lobby actions ── */
  async function handleCreate() {
    if (!name.trim()) return setError("Nhập tên của bạn!");
    setError("");
    const id = await createRoom(name.trim());
    setRoomId(id); setMyRole("player1"); setScreen("room");
  }

  async function handleJoin() {
    if (!name.trim()) return setError("Nhập tên của bạn!");
    if (!inputRoomId.trim()) return setError("Nhập mã phòng!");
    setError("");
    try {
      const slot = await joinRoom(inputRoomId.toUpperCase(), name.trim());
      setRoomId(inputRoomId.toUpperCase()); setMyRole(slot); setScreen("room");
    } catch (e) { setError(e.message); }
  }

  async function handleStart() {
    if (playerCount < 2) return;
    await startWordleGame(roomId);
  }

  async function handleRematch() {
    await requestWordleRematch(roomId, myRole);
  }

  function handleLeave() {
    setPlayerOnline(roomId, myRole, false);
    setRoomId(""); setMyRole(""); setRoomData(null);
    setScreen("lobby"); setDissolved(false);
    setCurrentInput(""); setError(""); setNotice(null);
  }

  function handleCopy() {
    navigator.clipboard?.writeText(roomId).catch(() => {});
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 1800);
  }

  /* ── Build grid rows ── */
  function buildRows() {
    const rows = [];
    for (let i = 0; i < currentGuesses.length; i++) {
      const g = currentGuesses[i];
      const isAnimRow = animatingRow?.rowIdx === i;
      rows.push({
        cells: g.word.split("").map((ch, j) => ({
          ch: ch.toUpperCase(),
          state: g.result[j],
          anim: isAnimRow ? `${animatingRow.type}-${j}` : "",
        })),
        isActive: false,
        shake: false,
      });
    }
    if (rows.length < MAX_GUESSES && !myWordDone) {
      const cells = Array(5).fill(null).map((_, j) => ({
        ch: currentInput[j]?.toUpperCase() ?? "",
        state: currentInput[j] ? "filled" : "active-row",
        anim: "",
      }));
      rows.push({ cells, isActive: true, shake: shakeRow });
    }
    while (rows.length < MAX_GUESSES) {
      rows.push({ cells: Array(5).fill({ ch: "", state: "", anim: "" }), isActive: false, shake: false });
    }
    return rows;
  }

  /* ── Sidebar Others ── */
  function OthersPanel() {
    const others = PLAYER_SLOTS.filter(r => r !== myRole && players?.[r]);
    if (!others.length) return null;
    return (
      <div className="sidebar-others">
        {others.map(role => {
          const pd = wordle?.playerData?.[role];
          const guesses  = pd?.guesses ?? [];
          const score    = pd?.score ?? 0;
          const wordDone = pd?.wordDone;
          return (
            <div className="sidebar-player" key={role}>
              <div className="sidebar-player-name">{players[role]?.name}</div>
              <div className="sidebar-mini-grid">
                {Array(MAX_GUESSES).fill(null).map((_, ri) => {
                  const g = guesses[ri];
                  return (
                    <div className="mini-row" key={ri}>
                      {Array(5).fill(null).map((_, ci) => (
                        <div key={ci} className={`mini-cell ${g?.result?.[ci] ?? ""}`} />
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

  /* ═══════════════ RENDER ═══════════════ */

  const DissolvedOverlay = () => (
    <div className="dissolved-overlay">
      <div className="dissolved-box">
        <div style={{ fontSize: 40 }}>💨</div>
        <h2>Phòng đã đóng</h2>
        <p>Một người chơi đã thoát khỏi phòng.</p>
        <button className="btn btn-primary" onClick={handleLeave}>Về trang chủ</button>
      </div>
    </div>
  );

  /* LOBBY */
  if (screen === "lobby") return (
    <div className="app">
      {dissolved && <DissolvedOverlay />}
      <div className="lobby-wrap">
        <div className="logo"><div className="logo-text">Wor<em>dle</em></div></div>
        {/* CHANGED: 4 → 6 */}
        <p className="logo-sub">// đoán từ 5 chữ · 2–6 người · realtime</p>
        <div className="card">
          <div className="card-title">Tạo phòng mới</div>
          <input className="inp" placeholder="Tên của bạn" value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleCreate()} />
          <button className="btn btn-primary" onClick={handleCreate}>Tạo phòng →</button>
        </div>
        <div className="card">
          <div className="card-title">Tham gia phòng</div>
          <input className="inp" placeholder="Tên của bạn" value={name}
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
    <div className="app">
      {dissolved && <DissolvedOverlay />}
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
              <div className={`av ${p ? AV_CLASSES[idx] : "av-empty"}`}>
                {p ? p.name[0].toUpperCase() : (idx + 1)}
              </div>
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
      <div className="app">
        {dissolved && <DissolvedOverlay />}
        <div className="gameover-wrap">
          <div className="go-card">
            <div className="go-icon">🏆</div>
            <div className="go-title">Kết quả</div>
            <div className="go-sub">5 từ · {WORD_TIME_MS / 60000} phút/từ · tối đa {MAX_SCORE_PER_WORD}đ/từ</div>
            <div className="lb">
              {sorted.map((p, i) => (
                <div key={p.role} className={`lb-row${p.role === myRole ? " me" : ""}`}>
                  {/* MEDALS now covers up to index 5 */}
                  <span className="lb-rank">{MEDALS[i] ?? "—"}</span>
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
    <div className="app">
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
    <div className="app">
      {dissolved && <DissolvedOverlay />}

      <OthersPanel />

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
        <div className="timer-bar" style={{ width: `${timerPct}%`, background: timerColor }} />
      </div>

      {notice && (
        <div className={`notice-bar notice-${notice.type}`}>{notice.text}</div>
      )}

      {waitingForOthers && (
        <div className="notice-bar notice-info pulse">⏳ Chờ người khác hoàn thành...</div>
      )}

      <div className="grid-wrap">
        <div className="grid">
          {rows.map((row, ri) => (
            <div key={ri} className={`g-row${row.shake ? " shake" : ""}`}>
              {row.cells.map((cell, ci) => (
                <div key={ci} className={`cell ${cell.state} ${cell.anim}`}>{cell.ch}</div>
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