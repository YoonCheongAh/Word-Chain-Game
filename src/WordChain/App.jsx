import { useState, useEffect, useRef } from "react";
import { ref, onValue, update, onDisconnect } from "firebase/database";
import { db } from "../firebase";
import { createRoom, joinRoom, listenRoom, setPlayerOnline } from "../roomService";
import { startGame, submitWord, loseLife, isValidWord, timeoutTurn, requestRematch } from "./gameService";

/* ─── CSS ─────────────────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Syne', sans-serif;
    background:
      radial-gradient(900px 600px at 12% -8%, rgba(29,158,117,.20), transparent 60%),
      radial-gradient(800px 500px at 100% 0%, rgba(55,138,221,.16), transparent 55%),
      radial-gradient(700px 600px at 50% 120%, rgba(160,55,221,.16), transparent 55%),
      #07070c;
    color: #f0ede8;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow-x: hidden;
  }

  /* floating ambient blobs */
  .bg-orbs { position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
  .orb { position: absolute; border-radius: 50%; filter: blur(60px); opacity: .35; animation: float 14s ease-in-out infinite; }
  .orb-1 { width: 320px; height: 320px; background: #1D9E75; top: -80px; left: -60px; }
  .orb-2 { width: 280px; height: 280px; background: #378ADD; bottom: -60px; right: -40px; animation-delay: -4s; }
  .orb-3 { width: 220px; height: 220px; background: #A037DD; top: 40%; left: 60%; animation-delay: -8s; }
  @keyframes float {
    0%,100% { transform: translate(0,0) scale(1); }
    33% { transform: translate(30px,-40px) scale(1.08); }
    66% { transform: translate(-25px,25px) scale(0.95); }
  }

  .app { position: relative; z-index: 1; width: 100%; max-width: 540px; padding: 24px 16px; text-align: center; animation: appIn .4s ease; }
  @keyframes appIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

  .lobby-title {
    font-size: 58px; font-weight: 800; line-height: .95;
    letter-spacing: -2px; margin-bottom: 8px; text-align: center;
  }
  .lobby-title span {
    background: linear-gradient(120deg, #1D9E75, #2fd6a0 40%, #378ADD);
    -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
    animation: hueShift 6s linear infinite;
  }
  @keyframes hueShift { 0%,100% { filter: hue-rotate(0deg); } 50% { filter: hue-rotate(18deg); } }
  .lobby-sub { font-size: 13px; color: #6b6b7a; margin-bottom: 32px; font-family: 'DM Mono', monospace; text-align: center; }

  .card {
    position: relative;
    background: linear-gradient(180deg, rgba(25,25,34,.9), rgba(16,16,22,.9));
    border: 1px solid rgba(255,255,255,.06);
    border-radius: 18px; padding: 24px; margin-bottom: 14px;
    backdrop-filter: blur(12px);
    box-shadow: 0 12px 40px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.04);
    transition: transform .2s, border-color .2s, box-shadow .2s;
  }
  .card:hover { transform: translateY(-2px); border-color: rgba(29,158,117,.3); }
  .card-label {
    font-size: 11px; font-weight: 700; color: #1D9E75;
    letter-spacing: 1.6px; text-transform: uppercase; margin-bottom: 14px;
  }

  .input {
    width: 100%; background: rgba(7,7,12,.7); border: 1px solid #2a2a35;
    border-radius: 12px; color: #f0ede8; font-family: 'DM Mono', monospace;
    font-size: 14px; padding: 13px 14px; outline: none;
    transition: border-color .15s, box-shadow .15s; margin-bottom: 10px;
  }
  .input:focus { border-color: #1D9E75; box-shadow: 0 0 0 3px rgba(29,158,117,.18); }
  .input::placeholder { color: #3a3a45; }

  .btn {
    width: 100%; padding: 14px; border-radius: 12px; border: none;
    font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700;
    cursor: pointer; transition: filter .15s, transform .1s, box-shadow .15s;
  }
  .btn:active { transform: scale(0.97); }
  .btn:disabled { opacity: 0.35; cursor: not-allowed; }
  .btn-primary {
    background: linear-gradient(120deg, #1D9E75, #25c089);
    color: #fff; box-shadow: 0 8px 24px rgba(29,158,117,.35);
  }
  .btn-primary:hover:not(:disabled) { filter: brightness(1.08); box-shadow: 0 10px 30px rgba(29,158,117,.5); }
  .btn-outline { background: rgba(255,255,255,.03); color: #f0ede8; border: 1px solid #2a2a35; }
  .btn-outline:hover:not(:disabled) { border-color: #378ADD; background: rgba(55,138,221,.08); }

  .err { color: #ff7676; font-size: 12px; font-family: 'DM Mono', monospace; margin-top: 8px; animation: fadeIn .25s; }

  .room-code {
    font-family: 'DM Mono', monospace; font-size: 44px; font-weight: 500;
    letter-spacing: 10px; text-align: center; padding: 18px 0 4px;
    background: linear-gradient(120deg, #1D9E75, #378ADD);
    -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
    transition: transform .15s;
  }
  .room-code:hover { transform: scale(1.03); }
  .room-code-hint { text-align: center; font-size: 11px; color: #555; margin-bottom: 8px; font-family: 'DM Mono', monospace; }

  .player-row {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,.05);
    animation: rowIn .3s ease backwards;
  }
  .player-row:nth-child(2){animation-delay:.04s}.player-row:nth-child(3){animation-delay:.08s}
  .player-row:nth-child(4){animation-delay:.12s}.player-row:nth-child(5){animation-delay:.16s}
  @keyframes rowIn { from{opacity:0;transform:translateX(-10px)} to{opacity:1;transform:translateX(0)} }
  .player-row:last-child { border-bottom: none; }
  .player-avatar {
    width: 40px; height: 40px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; font-weight: 800; flex-shrink: 0;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,.08);
  }
  .av-1 { background: linear-gradient(135deg,#0f3d2e,#155c45); color: #5DCAA5; }
  .av-2 { background: #16161e; color: #444; }
  .av-2.filled { background: linear-gradient(135deg,#0c2d4a,#16466e); color: #85B7EB; }
  .av-3 { background: #16161e; color: #444; }
  .av-3.filled { background: linear-gradient(135deg,#3d1f0e,#5c3018); color: #EBA085; }
  .av-4 { background: #16161e; color: #444; }
  .av-4.filled { background: linear-gradient(135deg,#2a0e3d,#461a5c); color: #C385EB; }
  .player-name { font-size: 14px; font-weight: 600; }
  .player-badge {
    margin-left: auto; font-size: 10px; font-family: 'DM Mono', monospace;
    padding: 4px 9px; border-radius: 20px; font-weight: 500;
  }
  .badge-host { background: rgba(29,158,117,.16); color: #2fd6a0; }
  .badge-wait { background: #16161e; color: #555; }
  .badge-joined { background: rgba(55,138,221,.16); color: #85B7EB; }
  .badge-you { background: rgba(255,255,255,.06); color: #999; font-size: 9px; margin-left: 6px; padding: 2px 7px; border-radius: 10px; }

  .pulse { animation: pulse 1.5s infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }

  .game-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
  .game-logo { font-size: 20px; font-weight: 800; letter-spacing: -0.5px; }
  .game-logo span {
    background: linear-gradient(120deg,#1D9E75,#378ADD);
    -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
  }

  .players-bar { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 14px; }
  .player-card {
    background: linear-gradient(180deg, rgba(25,25,34,.9), rgba(16,16,22,.9));
    border: 1px solid rgba(255,255,255,.06);
    border-radius: 14px; padding: 11px 13px; transition: all .25s;
    position: relative; overflow: hidden;
  }
  .player-card.dead { opacity: 0.35; filter: grayscale(.6); }
  .player-card.p1-active { border-color: #1D9E75; box-shadow: 0 0 0 1px #1D9E75, 0 0 22px rgba(29,158,117,.35); animation: cardPulse 1.6s infinite; }
  .player-card.p2-active { border-color: #378ADD; box-shadow: 0 0 0 1px #378ADD, 0 0 22px rgba(55,138,221,.35); animation: cardPulse 1.6s infinite; }
  .player-card.p3-active { border-color: #DD7537; box-shadow: 0 0 0 1px #DD7537, 0 0 22px rgba(221,117,55,.35); animation: cardPulse 1.6s infinite; }
  .player-card.p4-active { border-color: #A037DD; box-shadow: 0 0 0 1px #A037DD, 0 0 22px rgba(160,55,221,.35); animation: cardPulse 1.6s infinite; }
  @keyframes cardPulse { 0%,100%{ filter: brightness(1); } 50%{ filter: brightness(1.15); } }
  .pc-name { font-size: 12px; font-weight: 700; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pc-lives { display: flex; gap: 3px; }
  .heart { font-size: 14px; transition: all 0.35s; transform-origin: center; }
  .heart.lost { opacity: 0.15; filter: grayscale(1); transform: scale(.8); }
  .heart.beat { animation: heartBeat 1.4s infinite; }
  @keyframes heartBeat { 0%,100%{transform:scale(1)} 15%{transform:scale(1.25)} 30%{transform:scale(1)} }
  .active-dot {
    position: absolute; top: 9px; right: 9px;
    width: 8px; height: 8px; border-radius: 50%;
    animation: blink 1s infinite;
  }
  .dot-p1 { background: #1D9E75; box-shadow: 0 0 8px #1D9E75; }
  .dot-p2 { background: #378ADD; box-shadow: 0 0 8px #378ADD; }
  .dot-p3 { background: #DD7537; box-shadow: 0 0 8px #DD7537; }
  .dot-p4 { background: #A037DD; box-shadow: 0 0 8px #A037DD; }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }

  .timer-wrap { position: relative; margin-bottom: 4px; height: 8px; background: #16161e; border-radius: 999px; overflow: hidden; box-shadow: inset 0 1px 2px rgba(0,0,0,.5); }
  .timer-bar { height: 100%; border-radius: 999px; transition: width 1s linear, background-color 0.5s; position: relative; overflow: hidden; }
  .timer-bar::after { content:''; position:absolute; inset:0; background: linear-gradient(90deg, transparent, rgba(255,255,255,.4), transparent); animation: shimmer 1.6s infinite; }
  @keyframes shimmer { from{ transform: translateX(-100%);} to{ transform: translateX(100%);} }
  .timer-bar.danger { animation: dangerFlash .6s infinite; }
  @keyframes dangerFlash { 0%,100%{ filter: brightness(1);} 50%{ filter: brightness(1.5);} }
  .timer-label { font-family: 'DM Mono', monospace; font-size: 11px; color: #555; text-align: right; margin-top: 5px; margin-bottom: 12px; }

  .chain-box {
    background: rgba(16,16,22,.7); border: 1px solid rgba(255,255,255,.06); border-radius: 14px;
    padding: 12px; min-height: 70px; max-height: 124px;
    overflow-y: auto; display: flex; flex-wrap: wrap;
    gap: 6px; align-content: flex-start; margin-bottom: 12px;
  }
  .chain-box::-webkit-scrollbar { width: 4px; }
  .chain-box::-webkit-scrollbar-thumb { background: #2a2a35; border-radius: 2px; }
  .word-chip {
    font-family: 'DM Mono', monospace; font-size: 11px; font-weight: 500;
    padding: 5px 10px; border-radius: 20px; animation: chipPop 0.32s cubic-bezier(.34,1.56,.64,1);
  }
  @keyframes chipPop { 0%{transform:scale(0.4) translateY(8px);opacity:0} 60%{transform:scale(1.12)} 100%{transform:scale(1) translateY(0);opacity:1} }
  .chip-p1 { background: rgba(29,158,117,.14); color: #5DCAA5; border: 1px solid rgba(29,158,117,.4); }
  .chip-p2 { background: rgba(55,138,221,.14); color: #85B7EB; border: 1px solid rgba(55,138,221,.4); }
  .chip-p3 { background: rgba(221,117,55,.14); color: #EBA085; border: 1px solid rgba(221,117,55,.4); }
  .chip-p4 { background: rgba(160,55,221,.14); color: #C385EB; border: 1px solid rgba(160,55,221,.4); }

  .hint-box {
    background: linear-gradient(135deg, rgba(29,158,117,.1), rgba(55,138,221,.06));
    border: 1px solid rgba(29,158,117,.25); border-radius: 14px;
    padding: 12px 14px; display: flex; align-items: center; gap: 12px; margin-bottom: 12px;
  }
  .hint-letter {
    font-family: 'DM Mono', monospace; font-size: 40px; font-weight: 500; line-height: 1; min-width: 40px;
    background: linear-gradient(120deg,#1D9E75,#2fd6a0); -webkit-background-clip: text; background-clip: text;
    -webkit-text-fill-color: transparent; animation: letterBob 2s ease-in-out infinite;
  }
  @keyframes letterBob { 0%,100%{ transform: translateY(0) rotate(-2deg);} 50%{ transform: translateY(-4px) rotate(2deg);} }
  .hint-meta { flex: 1; text-align: left; }
  .hint-title { font-size: 10px; color: #6b6b7a; margin-bottom: 2px; }
  .hint-last { font-family: 'DM Mono', monospace; font-size: 12px; color: #888; }
  .hint-last strong { color: #f0ede8; }
  .turn-label { font-size: 11px; font-family: 'DM Mono', monospace; padding: 6px 11px; border-radius: 20px; white-space: nowrap; }
  .turn-you { background: rgba(29,158,117,.18); color: #2fd6a0; animation: pulse 1.4s infinite; }
  .turn-wait { background: #16161e; color: #555; }

  .input-row { display: flex; gap: 8px; margin-bottom: 8px; }
  .word-input {
    flex: 1; background: rgba(7,7,12,.7); border: 1.5px solid #2a2a35;
    border-radius: 12px; color: #f0ede8; font-family: 'DM Mono', monospace;
    font-size: 14px; font-weight: 500; padding: 12px 14px; outline: none;
    transition: border-color .15s, box-shadow .15s; text-transform: lowercase;
  }
  .word-input:focus { border-color: #1D9E75; box-shadow: 0 0 0 3px rgba(29,158,117,.18); }
  .word-input.error { border-color: #ff7676; animation: shake 0.35s; }
  @keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-7px)} 40%{transform:translateX(7px)} 60%{transform:translateX(-5px)} 80%{transform:translateX(5px)} }
  .word-input:disabled { opacity: 0.3; }

  .send-btn {
    padding: 12px 18px; background: linear-gradient(120deg,#1D9E75,#25c089); border: none; border-radius: 12px;
    color: #fff; font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700;
    cursor: pointer; transition: filter .15s, transform .1s; white-space: nowrap;
    box-shadow: 0 6px 18px rgba(29,158,117,.3);
  }
  .send-btn:hover:not(:disabled) { filter: brightness(1.1); }
  .send-btn:active:not(:disabled) { transform: scale(0.96); }
  .send-btn:disabled { opacity: 0.3; cursor: not-allowed; box-shadow: none; }

  .timeout-notice {
    font-family: 'DM Mono', monospace; font-size: 11px;
    color: #EF9F27; text-align: center; margin-bottom: 6px;
    animation: fadeIn 0.3s;
  }
  @keyframes fadeIn { from{opacity:0} to{opacity:1} }

  .gameover {
    position: relative; text-align: center; padding: 32px 24px;
    background: linear-gradient(180deg, rgba(25,25,34,.95), rgba(16,16,22,.95));
    border: 1px solid rgba(255,255,255,.08); border-radius: 20px; overflow: hidden;
    box-shadow: 0 20px 60px rgba(0,0,0,.5);
    animation: overIn .45s cubic-bezier(.34,1.56,.64,1);
  }
  @keyframes overIn { from{opacity:0; transform: scale(.9);} to{opacity:1; transform: scale(1);} }
  .gameover-emoji { font-size: 56px; margin-bottom: 10px; display: inline-block; animation: trophyPop .6s cubic-bezier(.34,1.56,.64,1); }
  @keyframes trophyPop { 0%{transform:scale(0) rotate(-20deg)} 60%{transform:scale(1.25) rotate(8deg)} 100%{transform:scale(1) rotate(0)} }
  .gameover-title {
    font-size: 30px; font-weight: 800; margin-bottom: 6px;
    background: linear-gradient(120deg,#1D9E75,#378ADD); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent;
  }
  .gameover-title.lose { background: linear-gradient(120deg,#e05c5c,#DD7537); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; }
  .gameover-sub { font-size: 13px; color: #777; font-family: 'DM Mono', monospace; margin-bottom: 22px; }
  .rematch-status { font-size: 11px; color: #EF9F27; font-family: 'DM Mono', monospace; margin-top: 10px; }

  /* confetti */
  .confetti { position: absolute; top: -10px; width: 9px; height: 14px; opacity: .9; animation: confFall linear forwards; }
  @keyframes confFall { to { transform: translateY(360px) rotate(540deg); opacity: 0; } }

  .divider { border: none; border-top: 1px solid rgba(255,255,255,.06); margin: 16px 0; }

  .copied-toast {
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
    background: linear-gradient(120deg,#1D9E75,#25c089); color: #fff; font-family: 'DM Mono', monospace;
    font-size: 12px; padding: 9px 18px; border-radius: 20px;
    animation: toastIn 0.25s ease; z-index: 999; box-shadow: 0 8px 24px rgba(29,158,117,.4);
  }
  @keyframes toastIn { from{opacity:0;transform:translateX(-50%) translateY(10px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }

  .offline-badge {
    font-size: 9px; font-family: 'DM Mono', monospace;
    background: rgba(224,92,92,.16); color: #ff7676; padding: 2px 6px;
    border-radius: 6px; margin-left: 6px; vertical-align: middle;
  }
`;

const TIMER_MAX = 30;
const PLAYER_COLORS = {
  player1: { dot: "dot-p1", chipClass: "chip-p1", activeClass: "p1-active" },
  player2: { dot: "dot-p2", chipClass: "chip-p2", activeClass: "p2-active" },
  player3: { dot: "dot-p3", chipClass: "chip-p3", activeClass: "p3-active" },
  player4: { dot: "dot-p4", chipClass: "chip-p4", activeClass: "p4-active" },
};
const PLAYER_SLOTS = ["player1", "player2", "player3", "player4"];

export default function App() {
  const [screen, setScreen] = useState("lobby");
  const [name, setName] = useState("");
  const [inputRoomId, setInputRoomId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [myRole, setMyRole] = useState("");
  const [roomData, setRoomData] = useState(null);
  const [wordInput, setWordInput] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TIMER_MAX);
  const [timeoutMsg, setTimeoutMsg] = useState("");
  const [copiedToast, setCopiedToast] = useState(false);
  const timerRef = useRef(null);
  const inputRef = useRef(null);
  const handlingTimeoutRef = useRef(false);

  const game = roomData?.game;
  const players = roomData?.players;
  const playerCount = Object.keys(players || {}).length;
  const myTurn = game?.turn === myRole;
  const lastWord = game?.chain?.[game.chain.length - 1] ?? "";
  const nextLetter = game?.currentLetter?.toUpperCase() ?? "—";
  const activePlayers = PLAYER_SLOTS.filter(s => players?.[s]);

  /* ── Inject CSS ── */
  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = STYLES;
    document.head.appendChild(el);
    return () => document.head.removeChild(el);
  }, []);

  /* ── Presence: reconnect tự động ── */
  useEffect(() => {
    if (!roomId || !myRole) return;
    const connectedRef = ref(db, ".info/connected");
    const unsub = onValue(connectedRef, snap => {
      if (snap.val() === true) {
        update(ref(db, `rooms/${roomId}/players/${myRole}`), { online: true });
        onDisconnect(ref(db, `rooms/${roomId}/players/${myRole}/online`)).set(false);
      }
    });
    return () => unsub();
  }, [roomId, myRole]);

  /* ── Cleanup khi đóng tab (chủ động) ── */
  useEffect(() => {
    if (!roomId || !myRole) return;
    const handleUnload = () => setPlayerOnline(roomId, myRole, false);
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [roomId, myRole]);

  /* ── Listen room ── */
  useEffect(() => {
    if (!roomId) return;
    const unsub = listenRoom(roomId, data => setRoomData(data));
    return () => unsub();
  }, [roomId]);

  /* ── Xử lý status transition ── */
  useEffect(() => {
    if (!roomData) return;
    const s = roomData.status;
    if (s === "playing" && screen !== "game") {
      setScreen("game");
    } else if (s === "dissolved") {
      resetToLobby();
    }
    if ((s === "waiting" || s === "ready") && screen === "lobby" && roomId) {
      setScreen("room");
    }
  }, [roomData?.status]);

  /* ── Timer — reset mỗi khi turn hoặc timeoutCount đổi ── */
  useEffect(() => {
    if (screen !== "game" || roomData?.status !== "playing") return;
    clearInterval(timerRef.current);
    setTimeLeft(TIMER_MAX);
    setTimeoutMsg("");
    handlingTimeoutRef.current = false;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [game?.turn, game?.timeoutCount, screen, roomData?.status]);

  /* ── Xử lý hết giờ ── */
  useEffect(() => {
    if (timeLeft !== 0 || screen !== "game" || roomData?.status !== "playing") return;
    if (handlingTimeoutRef.current) return;
    handlingTimeoutRef.current = true;

    if (myTurn) {
      setTimeoutMsg("⏰ Hết giờ! -1 ❤️ Đổi chữ mới...");
      timeoutTurn(roomId, myRole);
    }
  }, [timeLeft]);

  /* ── Focus input khi đến lượt ── */
  useEffect(() => {
    if (myTurn) inputRef.current?.focus();
  }, [myTurn]);

  /* ── HELPERS ── */
  function resetToLobby() {
    clearInterval(timerRef.current);
    setScreen("lobby");
    setRoomId("");
    setMyRole("");
    setRoomData(null);
    setWordInput("");
    setError("");
    setTimeLeft(TIMER_MAX);
    setTimeoutMsg("");
    setCopiedToast(false);
  }

  /* ── HANDLERS ── */
  async function handleCreate() {
    if (!name.trim()) return setError("Nhập tên đi!");
    setError("");
    const id = await createRoom(name.trim());
    setRoomId(id);
    setMyRole("player1");
    setScreen("room");
  }

  async function handleJoin() {
    if (!name.trim()) return setError("Nhập tên đi!");
    if (!inputRoomId.trim()) return setError("Nhập mã phòng!");
    setError("");
    try {
      const slot = await joinRoom(inputRoomId.toUpperCase(), name.trim());
      setRoomId(inputRoomId.toUpperCase());
      setMyRole(slot);
      setScreen("room");
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleStart() {
    if (playerCount < 2) return;
    await startGame(roomId);
  }

  async function handleSubmit() {
    const word = wordInput.trim().toLowerCase();
    if (!word || checking || !myTurn) return;
    setError("");

    if (word[0] !== game.currentLetter) {
      setError(`Từ phải bắt đầu bằng "${nextLetter}"!`);
      inputRef.current?.classList.add("error");
      setTimeout(() => inputRef.current?.classList.remove("error"), 400);
      return;
    }
    if (game.usedWords?.[word]) {
      setError(`"${word}" đã dùng rồi!`);
      return;
    }

    setChecking(true);
    const valid = await isValidWord(word);
    setChecking(false);

    if (!valid) {
      setError(`"${word}" không hợp lệ!`);
      inputRef.current?.classList.add("error");
      setTimeout(() => inputRef.current?.classList.remove("error"), 400);
      await loseLife(roomId, myRole);
      setWordInput("");
      return;
    }

    clearInterval(timerRef.current);
    await submitWord(roomId, word, myRole);
    setWordInput("");
  }

  async function handleRematch() {
    await requestRematch(roomId, myRole);
  }

  async function handleExit() {
    await setPlayerOnline(roomId, myRole, false);
    resetToLobby();
  }

  function handleCopyCode() {
    navigator.clipboard?.writeText(roomId).catch(() => {});
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 1800);
  }

  /* ── COMPONENTS ── */
  function Orbs() {
    return (
      <div className="bg-orbs" aria-hidden="true">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>
    );
  }

  function Hearts({ lives, active }) {
    return (
      <div className="pc-lives">
        {[1, 2, 3].map(i => (
          <span key={i} className={`heart${i > lives ? " lost" : active && i === lives ? " beat" : ""}`}>❤️</span>
        ))}
      </div>
    );
  }

  function chipClassForIndex(i) {
    const role = activePlayers[i % activePlayers.length];
    return PLAYER_COLORS[role]?.chipClass ?? "chip-p1";
  }

  /* ════════════════════════════════════════
     SCREENS
  ════════════════════════════════════════ */

  /* ── LOBBY ── */
  if (screen === "lobby") return (
    <div className="app">
      <Orbs />
      <h1 className="lobby-title">Word<br /><span>Chain</span></h1>
      <p className="lobby-sub">// nối từ tiếng anh · 2–4 người · online</p>

      <div className="card">
        <div className="card-label">Tạo phòng mới</div>
        <input className="input" placeholder="Tên của bạn" value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleCreate()} />
        <button className="btn btn-primary" onClick={handleCreate}>Tạo phòng →</button>
      </div>

      <div className="card">
        <div className="card-label">Join phòng</div>
        <input className="input" placeholder="Tên của bạn" value={name}
          onChange={e => setName(e.target.value)} />
        <input className="input" placeholder="Mã phòng (vd: ABC123)"
          value={inputRoomId}
          onChange={e => setInputRoomId(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === "Enter" && handleJoin()}
          style={{ fontFamily: "'DM Mono',monospace", letterSpacing: 3 }} />
        <button className="btn btn-outline" onClick={handleJoin}>Join →</button>
      </div>

      {error && <p className="err">{error}</p>}
    </div>
  );

  /* ── WAITING ROOM ── */
  if (screen === "room") return (
    <div className="app">
      <Orbs />
      <div className="card">
        <div className="card-label">Mã phòng — gửi cho bạn bè</div>

        <div className="room-code" onClick={handleCopyCode}
          style={{ cursor: "pointer" }} title="Click để copy">
          {roomId}
        </div>
        <div className="room-code-hint">click vào mã để copy · {playerCount}/4 người</div>

        <hr className="divider" />

        {PLAYER_SLOTS.map((slot, idx) => {
          const p = players?.[slot];
          const avBase = `av-${idx + 1}`;
          const avClass = p ? `${avBase} filled` : avBase;
          return (
            <div className="player-row" key={slot}>
              <div className={`player-avatar ${avClass}`}>
                {p?.name?.[0]?.toUpperCase() ?? (idx + 1)}
              </div>
              <div className="player-name" style={{ color: p ? "#f0ede8" : "#333" }}>
                {p?.name ?? "Chờ người chơi..."}
                {slot === myRole && <span className="badge-you">bạn</span>}
                {p && !p.online && <span className="offline-badge">offline</span>}
              </div>
              <span className={`player-badge ${
                idx === 0 ? "badge-host" :
                p ? "badge-joined" : "badge-wait pulse"
              }`}>
                {idx === 0 ? "host" : p ? "joined" : "waiting"}
              </span>
            </div>
          );
        })}

        <hr className="divider" />

        {myRole === "player1" ? (
          <button className="btn btn-primary" onClick={handleStart}
            disabled={playerCount < 2}>
            {playerCount < 2
              ? `Chờ thêm người... (${playerCount}/4)`
              : `▶ Bắt đầu (${playerCount} người)`}
          </button>
        ) : (
          <p style={{ textAlign: "center", color: "#555", fontSize: 13, fontFamily: "'DM Mono',monospace" }}>
            Chờ host bắt đầu...
          </p>
        )}
      </div>

      {copiedToast && <div className="copied-toast">✓ Đã copy mã phòng!</div>}
    </div>
  );

  /* ── GAME OVER ── */
  if (roomData?.status === "finished") {
    const winner = players?.[game?.winner];
    const isWinner = game?.winner === myRole;
    const myRematch = players?.[myRole]?.rematch;
    const rematchCount = Object.values(players || {}).filter(p => p.rematch).length;
    const totalCount = Object.keys(players || {}).length;
    const confColors = ["#1D9E75", "#378ADD", "#DD7537", "#A037DD", "#EF9F27"];

    return (
      <div className="app">
        <Orbs />
        <div className="gameover">
          {isWinner && Array.from({ length: 28 }).map((_, i) => (
            <span key={i} className="confetti" style={{
              left: `${Math.random() * 100}%`,
              background: confColors[i % confColors.length],
              animationDuration: `${1.6 + Math.random() * 1.4}s`,
              animationDelay: `${Math.random() * 0.6}s`,
              borderRadius: i % 2 ? "50%" : "2px",
            }} />
          ))}
          <div className="gameover-emoji">{isWinner ? "🏆" : "💀"}</div>
          <div className={`gameover-title${isWinner ? "" : " lose"}`}>{isWinner ? "Bạn thắng!" : "Thua rồi!"}</div>
          <div className="gameover-sub">
            {winner?.name} chiến thắng · {game?.chain?.length ?? 0} từ
          </div>
          <button className="btn btn-primary" onClick={handleRematch}
            disabled={!!myRematch} style={{ marginBottom: 8 }}>
            {myRematch ? "Đã sẵn sàng ✓" : "Chơi lại"}
          </button>
          <button className="btn btn-outline" onClick={handleExit}>
            Thoát về trang chủ
          </button>
          {myRematch && (
            <p className="rematch-status">
              {rematchCount}/{totalCount} người sẵn sàng...
            </p>
          )}
        </div>
      </div>
    );
  }

  /* ── GAME ── */
  const timerPct = (timeLeft / TIMER_MAX) * 100;
  const timerColor = timeLeft > 15 ? "#1D9E75" : timeLeft > 8 ? "#EF9F27" : "#e05c5c";

  return (
    <div className="app">
      <Orbs />
      <div className="game-header">
        <div className="game-logo">Word<span>Chain</span></div>
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "#444" }}>
          #{roomId}
        </span>
      </div>

      {/* Players grid */}
      <div className="players-bar">
        {activePlayers.map(role => {
          const p = players?.[role];
          const isActive = game?.turn === role;
          const col = PLAYER_COLORS[role];
          return (
            <div key={role}
              className={`player-card${isActive ? ` ${col.activeClass}` : ""}${p?.lives <= 0 ? " dead" : ""}`}>
              {isActive && <div className={`active-dot ${col.dot}`} />}
              <div className="pc-name">
                {role === myRole ? `👤 ` : `🎮 `}
                {p?.name}
                {!p?.online && <span className="offline-badge">offline</span>}
              </div>
              <Hearts lives={p?.lives ?? 3} active={isActive} />
            </div>
          );
        })}
      </div>

      {/* Timer */}
      <div className="timer-wrap">
        <div className={`timer-bar${timeLeft <= 8 ? " danger" : ""}`} style={{ width: `${timerPct}%`, background: timerColor }} />
      </div>
      <div className="timer-label" style={{ color: timeLeft <= 8 ? timerColor : "#555" }}>
        {timeLeft}s {myTurn
          ? "— lượt của bạn"
          : `— ${players?.[game?.turn]?.name ?? "..."} đang nghĩ`}
      </div>

      {timeoutMsg && <p className="timeout-notice">{timeoutMsg}</p>}

      {/* Chain */}
      <div className="chain-box">
        {!game?.chain?.length
          ? <span style={{ color: "#333", fontSize: 11, fontFamily: "'DM Mono',monospace" }}>
              Chuỗi từ sẽ hiện ở đây...
            </span>
          : game.chain.map((w, i) => (
              <span key={i} className={`word-chip ${chipClassForIndex(i)}`}>{w}</span>
            ))
        }
      </div>

      {/* Hint */}
      <div className="hint-box">
        <div className="hint-letter">{nextLetter}</div>
        <div className="hint-meta">
          <div className="hint-title">từ tiếp theo bắt đầu bằng</div>
          <div className="hint-last">từ trước: <strong>{lastWord || "—"}</strong></div>
        </div>
        <span className={`turn-label ${myTurn ? "turn-you" : "turn-wait"}`}>
          {myTurn ? "lượt bạn" : "chờ..."}
        </span>
      </div>

      {/* Input */}
      <div className="input-row">
        <input
          ref={inputRef}
          className="word-input"
          placeholder={myTurn ? `nhập từ bắt đầu bằng "${nextLetter}"...` : "chờ lượt..."}
          value={wordInput}
          onChange={e => setWordInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSubmit()}
          disabled={!myTurn || checking}
        />
        <button className="send-btn" onClick={handleSubmit} disabled={!myTurn || checking}>
          {checking ? "..." : "Nối →"}
        </button>
      </div>

      {error && <p className="err">{error}</p>}
    </div>
  );
}
