import { useState, useEffect, useRef, useCallback } from "react";
import { ref, onValue, onDisconnect, update } from "firebase/database";
import { db } from "../firebase";
import { createRoom, joinRoom, listenRoom, rejoinRoom, setPlayerOnline } from "../roomService";
import { useAuth } from "../auth/AuthContext";
import UserAvatar from "../components/UserAvatar";
import DrawingToolbar from "./DrawingToolbar";
import DrawingCanvas from "./DrawingCanvas";
import { playSfx, toggleMute, isMuted } from "./ScribbleSound";
import {
  MODE_CLASSIC,
  ROUND_END_MS,
  WORD_CHOICE_SECONDS,
  DIFFICULTY,
  SLOT_ORDER,
  startScribbleGame,
  chooseWord,
  autoChooseWordIfExpired,
  pushStroke,
  undoLastStroke,
  redoStroke,
  clearStrokes,
  submitGuess,
  setTypingIndicator,
  clearTypingIndicator,
  revealHint,
  advanceTurn,
  requestScribbleRematch,
  sendChatMessage,
  listenGame,
  listenStrokes,
  listenChat,
  setLiveStroke,
  clearLiveStroke,
  getMaskLayout,
  letterCount,
} from "./scribbleService";
import { WORD_PACKAGES } from "./words";

const SESSION_KEY = "scribble_session_v1";
const STEPPER = ["Game Mode", "Visibility", "Words", "Difficulty", "Lobby"];
const RANK_NUM = ["①", "②", "③", "④", "⑤", "⑥"];
const MEDALS = ["🥇", "🥈", "🥉"];
const INGAME_AVATAR = "/scribble-it/avatar.webp";

function sbAvatarFor(player) {
  const a = player?.avatar;
  return a && a !== "/none.png" ? a : INGAME_AVATAR;
}

const PLAYER_STYLES = [
  { bg: "#ffd6bd", text: "#7a2d00", bd: "#ff9d70" }, // pastel cam
  { bg: "#c9f2d8", text: "#0e5c33", bd: "#7fe0a8" }, // mint
  { bg: "#ffe9a8", text: "#6b4a00", bd: "#f5c542" }, // vàng nhạt
  { bg: "#cfd9ff", text: "#1d3e9e", bd: "#8fa5ff" }, // xanh dương
  { bg: "#ffd3e1", text: "#8b1e4f", bd: "#ff9ab8" }, // hồng
  { bg: "#e5d3ff", text: "#4d1e8b", bd: "#c29bff" }, // tím
];

const DEFAULT_SETTINGS = () => ({
  mode: MODE_CLASSIC,
  maxRounds: 3,
  difficulty: "normal",
  wordPackages: ["animals", "food"],
  randomTopic: false,
  customWords: "",
});

/* ════════════════════════════════ STYLES ════════════════════════════════ */
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Quicksand:wght@500;600;700;800&display=swap');

:root {
  --sb-ink: #232323;
  --sb-paper: #fbf1de;
  --sb-paper-2: #f6e8cf;
  --sb-yellow: #f4c430;
  --sb-coral: #ff6b52;
  --sb-mint: #2fbf83;
  --sb-blue: #4d7cff;
  --sb-purple: #9a63ff;
  --sb-font-display: 'Baloo 2', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
  --sb-font-body: 'Quicksand', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
}

.sb-root {
  width: 100%;
  min-height: 100%;
  font-family: var(--sb-font-body);
  color: var(--sb-ink);
  /* carried directly on the root (not just <body>) so the playful paper
     texture always shows, even if this component is mounted inside a
     host shell that sets its own background on a wrapping element. */
  background-color: var(--sb-paper);
  background-image: radial-gradient(rgba(35,35,35,0.07) 1.4px, transparent 1.8px);
  background-size: 22px 22px;
}
.sb-root *, .sb-root *::before, .sb-root *::after { box-sizing: border-box; }

body.sb-body {
  margin: 0;
  background-color: var(--sb-paper, #fbf1de);
  background-image:
    radial-gradient(rgba(35,35,35,0.06) 1.2px, transparent 1.6px);
  background-size: 22px 22px;
}

/* ── Landing ── */
.sb-landing {
  width: 100%;
  min-height: calc(100svh - 50px);
  background: linear-gradient(160deg, #ffd23f 0%, #f4c430 48%, #f0ba1f 100%);
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.sb-landing::before {
  /* soft vignette so the flat gradient gets depth without extra imagery */
  content: '';
  position: absolute; inset: 0;
  background: radial-gradient(ellipse 80% 60% at 20% 15%, rgba(255,255,255,0.35), transparent 60%),
              radial-gradient(ellipse 70% 70% at 100% 100%, rgba(0,0,0,0.10), transparent 55%);
  pointer-events: none;
}
.sb-dots {
  position: absolute; inset: 0;
  background-image: radial-gradient(rgba(0,0,0,0.16) 1.4px, transparent 2px);
  background-size: 44px 44px;
  pointer-events: none;
}
.sb-dot {
  position: absolute; border-radius: 50%;
  border: 2.5px solid rgba(0,0,0,0.9);
  background: rgba(255,255,255,0.85);
  pointer-events: none;
  animation: sbFloat 6s ease-in-out infinite;
}
@keyframes sbFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}
.sb-land-head {
  position: relative; z-index: 2;
  display: flex; align-items: flex-start; justify-content: space-between;
  padding: 26px 34px 0;
}
.sb-brush {
  display: inline-flex;
  align-items: center;
  position: relative;
  background: #0d0d0d;
  border-radius: 4px 40px 30px 4px;
  padding: 14px 38px 14px 22px;
  transform: rotate(-4deg) skewX(-4deg);
  box-shadow: 0 6px 0 rgba(0,0,0,0.35), 0 10px 18px rgba(0,0,0,0.18);
  transition: transform .25s cubic-bezier(.34,1.56,.64,1);
}
.sb-brush:hover { transform: rotate(-2deg) skewX(-4deg) scale(1.03); }
.sb-brush-splat {
  position: absolute; left: -12px; bottom: 10px;
  width: 6px; height: 6px; border-radius: 50%;
  background: #0d0d0d;
  box-shadow: -11px 5px 0 -1.5px #0d0d0d, -19px -3px 0 -2.5px #0d0d0d;
}
.sb-brush-tool {
  position: absolute; top: -20px; right: -8px;
  width: 30px; height: auto;
  transform: rotate(24deg);
  filter: drop-shadow(0 3px 2px rgba(0,0,0,0.25));
}
.sb-brush-name {
  font-family: 'Caveat', cursive;
  font-size: 42px; font-weight: 700; line-height: 1;
  color: #f4c430;
  position: relative; z-index: 1;
  white-space: nowrap;
  transform: skewX(4deg);
}
.sb-user-chip {
  display: flex; align-items: center; gap: 9px;
  background: rgba(255,255,255,0.95);
  border: 2.5px solid #0d0d0d;
  border-radius: 999px;
  padding: 4px 16px 4px 4px;
  font-family: var(--sb-font-body);
  font-size: 13px; font-weight: 800; color: #0d0d0d;
  cursor: pointer;
  box-shadow: 0 4px 0 rgba(0,0,0,0.18);
  transition: transform .15s, box-shadow .15s;
}
.sb-user-chip:hover { transform: translateY(-2px); box-shadow: 0 6px 0 rgba(0,0,0,0.18); }
.sb-user-chip:active { transform: translateY(1px); box-shadow: 0 2px 0 rgba(0,0,0,0.18); }
.sb-ava {
  width: 44px; height: 44px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 15px; font-weight: 900;
  position: relative; flex-shrink: 0;
  box-shadow: inset 0 0 0 2px rgba(0,0,0,0.14);
  overflow: visible;
}
.sb-user-chip .sb-ava { width: 34px; height: 34px; font-size: 12px; }

.sb-land-body {
  position: relative; z-index: 2;
  flex: 1;
  display: flex; align-items: center; justify-content: center;
  padding: 10px clamp(26px, 6vw, 90px);
  width: 100%;
}
.sb-menu {
  display: flex; flex-direction: column; gap: 18px; align-items: stretch;
  width: min(360px, 100%);
}
.sb-menu-btn {
  border: 2.5px solid #0d0d0d;
  cursor: pointer;
  font-family: var(--sb-font-body);
  font-size: 19px; font-weight: 800; color: #0d0d0d;
  padding: 18px 24px;
  width: 100%;
  border-radius: 16px;
  transition: transform .16s cubic-bezier(.34,1.56,.64,1), box-shadow .16s, filter .16s;
  box-shadow: 0 6px 0 rgba(0,0,0,0.25);
}
.sb-menu-btn:hover { transform: translateY(-3px); box-shadow: 0 9px 0 rgba(0,0,0,0.25); filter: brightness(1.05); }
.sb-menu-btn:active { transform: translateY(3px); box-shadow: 0 2px 0 rgba(0,0,0,0.25); }
.sb-mb-yellow { background: #35A86B; color: #fff; }
.sb-mb-coral { background: #F4775C; color: #fff; }
.sb-mb-blue { background: #5574E8; color: #fff; }
.sb-mb-purple { background: #D9535B; color: #fff; }

.sb-pop {
  position: absolute; z-index: 20;
  left: 50%; top: 50%;
  transform: translate(-50%, -50%);
  background: #ffffff;
  border: 3px solid #0d0d0d;
  border-radius: 18px;
  padding: 22px;
  width: min(340px, 92vw);
  box-shadow: 0 18px 40px rgba(0,0,0,0.3);
  animation: sbPopIn .22s cubic-bezier(.2,.8,.3,1);
}
@keyframes sbPopIn {
  from { opacity: 0; transform: translate(-50%, -50%) scale(0.92); }
  to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}
.sb-pop h3 { margin: 0 0 12px; font-size: 18px; font-family: var(--sb-font-display); }
.sb-pop-inp {
  width: 100%;
  border: 2px solid #0d0d0d;
  border-radius: 10px;
  font-family: inherit;
  font-size: 15px; font-weight: 800;
  padding: 10px 12px; outline: none;
  margin-bottom: 10px;
  letter-spacing: 2px;
  transition: box-shadow .15s, border-color .15s;
}
.sb-pop-inp:focus { box-shadow: 0 0 0 3px rgba(244,196,48,0.55); border-color: #0d0d0d; }
.sb-pop-row { display: flex; gap: 8px; }
.sb-pop-glow { position: fixed; inset: 0; background: rgba(0,0,0,0.35); z-index: 19; }

/* ── Toast / error ── */
.sb-toast {
  position: fixed; bottom: 22px; left: 50%; transform: translateX(-50%);
  background: #0d0d0d; color: #fff;
  font-family: var(--sb-font-body); font-weight: 800; font-size: 13px;
  padding: 10px 20px; border-radius: 24px; z-index: 500;
  box-shadow: 0 10px 24px rgba(0,0,0,0.35);
  animation: sbToastIn .3s cubic-bezier(.2,.8,.3,1);
}
@keyframes sbToastIn {
  from { opacity: 0; transform: translate(-50%, 12px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}
.sb-err { color: #b5121b; font-weight: 800; font-size: 13px; margin-top: 8px; }

.sb-mute {
  position: fixed;
  bottom: 16px; right: 16px;
  z-index: 700;
  width: 46px; height: 46px;
  border-radius: 14px;
  border: 2.5px solid #0d0d0d;
  background: #fff;
  font-size: 20px; line-height: 1;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 0 rgba(0,0,0,0.25);
  transition: transform .15s, box-shadow .15s, opacity .12s;
}
.sb-mute:hover { transform: translateY(-2px); box-shadow: 0 6px 0 rgba(0,0,0,0.25); }
.sb-mute:active { transform: translateY(2px); box-shadow: 0 2px 0 rgba(0,0,0,0.25); }

/* ── Shared buttons ── */
.sb-btn {
  border: 2.5px solid #0d0d0d;
  border-radius: 12px;
  font-family: var(--sb-font-body);
  font-weight: 800; font-size: 14px;
  padding: 10px 18px;
  cursor: pointer;
  background: #ffffff;
  color: #0d0d0d;
  transition: transform .14s cubic-bezier(.34,1.56,.64,1), filter .12s, opacity .12s, box-shadow .14s;
  box-shadow: 0 4px 0 rgba(0,0,0,0.18);
}
.sb-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 0 rgba(0,0,0,0.18); }
.sb-btn:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 2px 0 rgba(0,0,0,0.18); }
.sb-btn:disabled { opacity: 0.4; cursor: not-allowed; box-shadow: none; }
.sb-btn-dark { background: #0d0d0d; color: #f4c430; }
.sb-btn-dark:hover:not(:disabled) { filter: brightness(1.3); }
.sb-btn-slim { padding: 8px 14px; font-size: 12px; box-shadow: 0 3px 0 rgba(0,0,0,0.18); }

/* ── Loading ── */
.sb-loading {
  width: 100%; min-height: 40vh;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Caveat', cursive; font-size: 34px; font-weight: 700;
  color: #8a6d1a;
}

/* ── RoomWaiting ── */
.sb-room {
  height: calc(100svh - 50px);
  max-width: 1180px;
  margin: 0 auto;
  padding: 24px 24px 20px;
  display: flex; flex-direction: column; gap: 16px;
}
.sb-stepper { display: flex; align-items: center; justify-content: center; user-select: none; }
.sb-step {
  position: relative;
  font-family: var(--sb-font-body);
  font-size: 12px; font-weight: 800; letter-spacing: 0.4px;
  padding: 10px 16px 10px 26px;
  margin-left: -12px;
  color: rgba(255,255,255,0.5);
  background: #0d0d0d;
  clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%, 14px 50%);
  cursor: pointer;
  transition: color .15s, background .15s;
}
.sb-step:first-child { clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%); margin-left: 0; padding-left: 22px; }
.sb-step-cur { color: #0d0d0d; background: var(--sb-yellow); }
.sb-step-lock { cursor: default; }

.sb-room-main {
  flex: 1; min-height: 0;
  display: grid; grid-template-columns: 1fr minmax(280px, 340px); gap: 16px; align-items: stretch;
}
.sb-card {
  background: linear-gradient(180deg, #fffdf6, var(--sb-paper-2));
  border: 3px solid var(--sb-ink);
  border-radius: 18px;
  padding: 18px;
  color: var(--sb-ink);
  display: flex; flex-direction: column; gap: 14px;
  box-shadow: 0 8px 0 rgba(35,35,35,0.12);
  min-height: 0;
  overflow-y: auto;
}
.sb-card-light { background: #ffffff; color: var(--sb-ink); border: 2.5px solid var(--sb-ink); }
.sb-card-head {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 12px; font-weight: 800; letter-spacing: 0.5px;
  color: var(--sb-ink);
}
.sb-card-head > span:first-child {
  background: var(--sb-yellow);
  border: 2px solid var(--sb-ink);
  border-radius: 999px;
  padding: 4px 14px;
}
.sb-mode-title { font-size: 15px; font-weight: 800; color: var(--sb-ink); }
.sb-players-count { font-family: var(--sb-font-body); font-size: 13px; font-weight: 800; }

.sb-player-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
}
.sb-lobby-card {
  border-radius: 14px;
  padding: 12px 10px;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  transition: filter .2s, opacity .2s, transform .18s;
}
.sb-lobby-card:hover { transform: translateY(-3px); }
.sb-lobby-card.offline { opacity: 0.42; filter: grayscale(0.7); }
.sb-pname {
  padding: 4px 10px;
  border-radius: 10px;
  font-size: 12px; font-weight: 800;
  text-align: center;
  max-width: 100%;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.sb-lobby-tag { font-size: 10px; font-weight: 800; opacity: 0.75; }

.sb-card-title {
  font-weight: 800; font-size: 13px; letter-spacing: 0.5px;
  display: flex; align-items: center; justify-content: space-between;
}
.sb-side { display: flex; flex-direction: column; gap: 16px; min-height: 0; overflow-y: auto; }

.sb-pkgs { display: flex; flex-direction: column; gap: 8px; }
.sb-pkg {
  width: 100%;
  border: 2.5px solid #0d0d0d;
  border-radius: 999px;
  padding: 9px 16px;
  font-family: var(--sb-font-body);
  font-size: 13px; font-weight: 800;
  background: #fff;
  color: #0d0d0d;
  cursor: pointer;
  text-align: left;
  display: flex; align-items: center; justify-content: space-between;
  transition: background .15s, color .15s, transform .12s;
}
.sb-pkg:hover { transform: translateY(-1px); }
.sb-pkg.sb-pkg-on { background: #f4c430; }
.sb-pkg-cnt { font-size: 10px; font-weight: 800; opacity: 0.6; }
.sb-pkg-check { font-size: 14px; }
.sb-opt-row {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  font-size: 13px; font-weight: 800;
}
.sb-toggle {
  width: 46px; height: 26px; border-radius: 999px;
  background: #d9d3c6; border: 2px solid #0d0d0d;
  position: relative; cursor: pointer; flex-shrink: 0; transition: background .15s;
}
.sb-toggle::after {
  content: ''; position: absolute; top: 2px; left: 2px;
  width: 18px; height: 18px; border-radius: 50%;
  background: #fff; border: 2px solid #0d0d0d;
  transition: transform .15s;
}
.sb-toggle.sb-toggle-on { background: #f4c430; }
.sb-toggle.sb-toggle-on::after { transform: translateX(20px); }

.sb-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.sb-chip {
  border: 2px solid #0d0d0d;
  border-radius: 999px;
  padding: 5px 14px;
  font-family: var(--sb-font-body);
  font-size: 12px; font-weight: 800;
  background: #fff; color: #0d0d0d;
  cursor: pointer;
}
.sb-chip.sb-chip-on { background: #0d0d0d; color: #f4c430; }

.sb-ta {
  width: 100%; min-height: 84px;
  border: 2.5px solid #0d0d0d; border-radius: 12px;
  font-family: inherit; font-size: 13px; font-weight: 700;
  padding: 10px 12px; resize: vertical; outline: none;
  transition: box-shadow .15s;
}
.sb-ta:focus { box-shadow: 0 0 0 3px rgba(244,196,48,0.55); }
.sb-hint { font-size: 11px; font-weight: 700; opacity: 0.55; line-height: 1.5; }

.sb-chat-log {
  background: #fff; color: var(--sb-ink);
  border: 2.5px solid var(--sb-ink);
  border-radius: 12px;
  flex: 1;
  height: 100%; min-height: 260px; overflow-y: auto;
  padding: 10px 12px;
  display: flex; flex-direction: column; gap: 6px;
}
.sb-chat-log.grow { min-height: 200px; }
.sb-chat-title {
  font-size: 11px; font-weight: 800; letter-spacing: .4px;
  color: var(--sb-ink); opacity: .65;
  display: flex; align-items: center; gap: 6px;
}
.sb-msg { font-size: 12px; font-weight: 700; line-height: 1.35; word-break: break-word; }
.sb-msg .who { font-weight: 800; }
.sb-msg-sys { text-align: center; font-size: 11px; opacity: 0.6; }
.sb-msg-correct { color: #0e5c33; background: #c9f2d8; border-radius: 8px; padding: 3px 8px; animation: sbPop .25s; }
.sb-msg-close { color: #7a4a00; background: #ffe3a8; border-radius: 8px; padding: 3px 8px; animation: sbPop .25s; }
.sb-msg-close .sb-msg-word { font-weight: 800; text-decoration: underline; text-decoration-color: #f4c430; text-underline-offset: 2px; }
.sb-msg-guess { color: #6b4a00; }
.sb-chat-inp-row { display: flex; gap: 8px; }
.sb-inp {
  flex: 1;
  border: 2.5px solid #0d0d0d;
  border-radius: 12px;
  font-family: var(--sb-font-body);
  font-size: 13px; font-weight: 800;
  padding: 9px 12px; outline: none; background: #fff; color: #0d0d0d;
  transition: box-shadow .15s;
}
.sb-inp:focus { box-shadow: 0 0 0 3px rgba(244,196,48,0.55); }
.sb-inp::placeholder { color: #b6ae9c; font-weight: 700; }

.sb-room-bottom {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  flex-wrap: wrap;
}
.sb-leave-btns { display: flex; gap: 10px; flex-wrap: wrap; }
.sb-start-big {
  font-size: 17px; padding: 13px 34px;
  border-radius: 14px;
  box-shadow: 0 8px 0 rgba(0,0,0,0.25);
  position: relative;
  overflow: hidden;
}
.sb-start-big:not(:disabled)::after {
  content: '';
  position: absolute; top: 0; left: -70%;
  width: 40%; height: 100%;
  background: linear-gradient(120deg, transparent, rgba(244,196,48,0.55), transparent);
  animation: sbShineSweep 2.6s ease-in-out infinite;
}
@keyframes sbShineSweep {
  0% { left: -70%; }
  60%, 100% { left: 130%; }
}
.sb-code-big {
  font-family: var(--sb-font-body);
  font-size: 22px; font-weight: 800; letter-spacing: 6px;
  background: #0d0d0d; color: #f4c430;
  border-radius: 12px; padding: 8px 16px;
  cursor: pointer;
  transition: transform .15s, filter .15s;
}
.sb-code-big:hover { transform: translateY(-2px); filter: brightness(1.25); }

/* ── InGame ── */
.sb-game {
  height: calc(100svh - 50px);
  display: flex; flex-direction: column;
  gap: 12px;
  padding: 12px 20px 16px;
  max-width: 1480px;
  width: 100%;
  margin: 0 auto;
}
.sb-game-bd {
  flex: 1; min-height: 0;
  display: grid;
  grid-template-columns: 170px minmax(0, 1fr) 170px;
  gap: 14px;
  overflow: hidden;
}
.sb-side {
  min-height: 0;
  overflow-y: auto;
  display: flex; flex-direction: column; gap: 12px;
  padding-bottom: 4px;
}
.sb-center {
  position: relative;
  min-height: 0;
  display: flex; flex-direction: column; gap: 10px;
}
.sb-topbar {
  display: grid;
  grid-template-columns: 120px 1fr 130px;
  align-items: center;
  gap: 10px;
  background: linear-gradient(180deg, #2b2b2b, var(--sb-ink));
  border: 2.5px solid var(--sb-ink);
  border-radius: 14px;
  padding: 10px 14px;
  position: relative;
  flex-shrink: 0;
  box-shadow: 0 6px 0 rgba(35,35,35,0.15);
}
.sb-round { font-size: 13px; font-weight: 800; color: #f4c430; }
.sb-wordcell {
  position: relative;
  text-align: center;
  min-height: 44px;
  display: flex; align-items: center; justify-content: center;
  flex-wrap: wrap; gap: 6px;
}
.sb-wordseg { display: flex; gap: 3px; }
.sb-wordseg + .sb-wordseg { margin-left: 16px; }
.sb-wordlet {
  font-family: var(--sb-font-display);
  font-size: 21px; font-weight: 800;
  color: #fff;
  width: 16px; height: 26px;
  display: inline-flex; align-items: center; justify-content: center;
}
.sb-wordlen { color: #f4c430; font-weight: 800; font-size: 25px; }
.sb-drawer-word {
  background: #f4c430; color: #0d0d0d;
  border-radius: 10px;
  padding: 4px 16px;
  font-size: 21px; font-weight: 800;
  display: inline-block;
  animation: sbPop .3s cubic-bezier(.34,1.56,.64,1);
}
@keyframes sbPop { from { opacity: 0; transform: scale(0.6); } to { opacity: 1; transform: scale(1); } }
.sb-skeleton {
  width: 40%; height: 18px;
  background: linear-gradient(90deg, #2a2a2a, #444, #2a2a2a);
  background-size: 200% 100%;
  border-radius: 6px;
  animation: sbShimmer 1.2s infinite;
}
@keyframes sbShimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
.sb-clock {
  display: flex; align-items: center; justify-content: flex-end; gap: 6px;
  font-size: 20px; font-weight: 800;
  color: #fff;
}
.sb-clock-ic {
  display: inline-block;
  width: 22px; height: 22px;
  border: 3px solid currentColor;
  border-radius: 50%;
  position: relative;
}
.sb-clock-ic::before, .sb-clock-ic::after {
  content: ''; position: absolute; left: 50%; top: 50%;
  width: 8px; height: 8px;
  border: 2px solid currentColor;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  animation: sbSpin 1s linear infinite;
}
.sb-clock-ic::before { border-left-color: transparent; border-bottom-color: transparent; }
.sb-clock-ic::after { border-top-color: transparent; border-right-color: transparent; animation-direction: reverse; }
@keyframes sbSpin { to { transform: translate(-50%, -50%) rotate(360deg); } }
.sb-clock.danger { color: #ff5f6d; animation: sbBlink .5s steps(2) infinite; }
@keyframes sbBlink { 50% { opacity: 0.35; } }

.sb-canvas-wrap {
  position: relative; flex: 1; min-height: 0;
  border: 2.5px solid #0d0d0d;
  border-radius: 14px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 6px 0 rgba(35,35,35,0.10);
}
.sb-canvas { position: absolute; inset: 0; }
.sb-canvas-el { width: 100%; height: 100%; display: block; background: #fff; }
.sb-choose-hint {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,0.75);
  font-size: 18px; font-weight: 800; color: #0d0d0d;
  pointer-events: none;
  gap: 8px;
}
.sb-topic-tag {
  position: absolute; top: 10px; left: 10px; z-index: 3;
  background: #0d0d0d; color: #fff;
  font-size: 12px; font-weight: 800;
  padding: 5px 12px; border-radius: 999px;
  border: 2px solid #fff;
  box-shadow: 0 3px 8px rgba(0,0,0,0.25);
  pointer-events: none;
}
.sb-answer-banner {
  position: absolute; left: 0; right: 0; bottom: 0;
  background: #f4c430; color: #0d0d0d;
  border-top: 2.5px solid #0d0d0d;
  text-align: center;
  padding: 12px;
  font-size: 20px; font-weight: 800;
  animation: sbSlide .35s cubic-bezier(.2,.8,.3,1);
  z-index: 4;
}
@keyframes sbSlide { from { transform: translateY(100%); } to { transform: translateY(0); } }

.sb-under { flex-shrink: 0; min-height: 76px; display: flex; flex-direction: column; justify-content: flex-end; gap: 2px; }
.sb-my-hearts { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 22px; }
.sb-my-hearts-lbl { font-size: 12px; font-weight: 800; color: #6b7280; }
.sb-guess-row { display: flex; gap: 8px; align-items: center; }
.sb-guess-ic { font-size: 18px; }
.sb-guess-input {
  flex: 1;
  border: 2.5px solid #0d0d0d;
  border-radius: 14px;
  font-family: var(--sb-font-body);
  font-size: 16px; font-weight: 800;
  padding: 12px 16px; outline: none; color: #0d0d0d;
  transition: box-shadow .15s;
}
.sb-guess-input:focus { box-shadow: 0 0 0 3px rgba(244,196,48,0.55); }
.sb-guess-input:disabled { opacity: 0.55; }

/* Toolbar */
.sb-tb {
  display: flex; align-items: stretch; gap: 2px;
  background: var(--sb-ink);
  border: 2.5px solid var(--sb-ink);
  border-radius: 14px;
  padding: 6px;
  flex-wrap: nowrap;
  overflow-x: auto;
  box-shadow: 0 6px 0 rgba(35,35,35,0.15);
}
.sb-tb-group {
  display: flex; align-items: center; gap: 4px;
  padding: 0 8px;
  border-right: 2px solid rgba(255,255,255,0.14);
  flex-shrink: 0;
}
.sb-tb-group:last-of-type { border-right: none; }
.sb-tb-btn {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 3px;
  min-width: 48px;
  padding: 6px 7px;
  border: 2px solid transparent;
  border-radius: 10px;
  background: transparent;
  cursor: pointer;
  color: #fff;
  transition: background .15s, transform .12s, color .15s;
}
.sb-tb-btn:hover { background: rgba(255,255,255,0.12); transform: translateY(-2px); }
.sb-tb-btn.on { background: var(--sb-yellow); color: var(--sb-ink); box-shadow: 0 3px 0 rgba(0,0,0,0.3); }
.sb-tb-btn:active { transform: translateY(0); }
.sb-tb-btn:disabled { opacity: 0.35; cursor: not-allowed; transform: none; }
.sb-tb-ic { display: flex; align-items: center; justify-content: center; width: 20px; height: 20px; line-height: 1; }
.sb-tb-ic svg { width: 100%; height: 100%; display: block; }
.sb-tb-btn kbd {
  font-family: var(--sb-font-body);
  font-size: 8px; font-weight: 800;
  background: rgba(255,255,255,0.18);
  color: #fff;
  border-radius: 4px;
  padding: 0 3px;
}
.sb-tb-btn.on kbd { background: rgba(35,35,35,0.2); color: var(--sb-ink); }
.sb-size-btn { min-width: 44px; }
.sb-size-dot { border-radius: 50%; background: currentColor; display: inline-block; margin: 2px 0; }
.sb-size-btn.on .sb-size-dot { background: #0d0d0d; }
.sb-tb-colors {
  display: grid;
  grid-template-columns: repeat(8, 26px);
  gap: 3px;
  padding: 2px 8px;
  align-content: center;
}
.sb-swatch {
  width: 26px; height: 26px;
  border-radius: 7px;
  cursor: pointer;
  position: relative;
  border: 1px solid rgba(0,0,0,0.3);
  padding: 0;
  transition: transform .15s cubic-bezier(.34,1.56,.64,1), box-shadow .15s;
}
.sb-swatch:hover { transform: scale(1.15); }
.sb-swatch.on { box-shadow: 0 0 0 2.5px #f4c430; transform: scale(1.08); }
.sb-swatch-k {
  font-size: 9px; font-weight: 800;
  color: #fff;
  text-shadow: 0 0 4px #000, 0 0 4px #000;
  position: absolute; right: 1px; bottom: 0;
}
.sb-color-pick { position: relative; }
.sb-color-pick input {
  position: absolute; inset: 0; opacity: 0; width: 100%; height: 100%;
  cursor: pointer;
}
.sb-chat-btn { align-self: stretch; }

/* Chat panel */
.sb-chat-panel {
  position: absolute; z-index: 30;
  top: 0; right: 0; bottom: 0;
  width: min(330px, 88%);
  background: #fff;
  border: 2.5px solid #0d0d0d;
  border-radius: 14px;
  display: flex; flex-direction: column;
  box-shadow: -10px 0 30px rgba(0,0,0,0.25);
}
.sb-chat-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 2px solid #0d0d0d;
  font-weight: 800; font-size: 13px;
}
.sb-chat-close { border: none; background: none; font-size: 17px; cursor: pointer; color: #0d0d0d; }
.sb-canvas-wrap, .sb-chat-panel .sb-chat-log {
  overflow-y: auto;
}

/* Player cards in game */
.sb-pcard {
  border: 2.5px solid #0d0d0d;
  border-radius: 14px;
  padding: 10px;
  background: #fff;
  display: flex; flex-direction: column; align-items: center; gap: 7px;
  transition: transform .18s, box-shadow .18s;
}
.sb-pcard:hover { transform: translateY(-3px); box-shadow: 0 6px 0 rgba(0,0,0,0.12); }
.sb-pcard.sb-pcard-drawing {
  box-shadow: 0 0 0 3px var(--sb-yellow), 0 6px 0 rgba(0,0,0,0.12);
  animation: sbGlow 1.8s ease-in-out infinite;
}
@keyframes sbGlow {
  0%, 100% { box-shadow: 0 0 0 3px var(--sb-yellow), 0 6px 0 rgba(0,0,0,0.12); }
  50% { box-shadow: 0 0 0 5px rgba(244,196,48,0.55), 0 6px 0 rgba(0,0,0,0.12); }
}
.sb-pcard-top { position: relative; width: 100%; display: flex; align-items: center; justify-content: center; }
.sb-badge {
  position: absolute;
  font-size: 13px;
  background: #fff;
  border: 2px solid #0d0d0d;
  border-radius: 50%;
  width: 24px; height: 24px;
  display: flex; align-items: center; justify-content: center;
  animation: sbPop .3s cubic-bezier(.34,1.56,.64,1);
}
.sb-badge-drawer { bottom: -4px; right: 8px; background: #f4c430; }
.sb-badge-rank { top: -5px; left: 6px; background: #f4c430; font-weight: 800; font-size: 12px; }
.sb-score-chip {
  position: absolute; top: -9px; right: -6px;
  background: #fff; border: 2px solid #0d0d0d; border-radius: 999px;
  font-size: 12px; font-weight: 800;
  padding: 1px 8px;
  transition: transform .2s;
}
.sb-bubble-tip {
  position: absolute;
  background: #0d0d0d; color: #fff;
  border-radius: 8px;
  font-size: 9px; font-weight: 800;
  padding: 2px 8px;
  white-space: nowrap;
  top: -8px; right: -2px;
  animation: sbPop .25s;
}
.sb-correct-bub {
  position: absolute; left: 0; top: -10px;
  background: #3ecf6e; color: #fff;
  border: 2px solid #0d0d0d;
  border-radius: 999px;
  font-size: 9px; font-weight: 800;
  padding: 2px 9px;
  animation: sbPop .25s;
}
.sb-pgame-name {
  padding: 5px 10px;
  border-radius: 10px;
  font-size: 11px; font-weight: 800;
  width: 100%; text-align: center;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.sb-pcard-hearts { display: flex; justify-content: center; align-items: center; margin-top: 5px; }

/* ── Choose word modal ── */
.sb-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.55);
  z-index: 60;
  display: flex; align-items: center; justify-content: center;
  animation: sbFadeIn .2s ease;
}
@keyframes sbFadeIn { from { opacity: 0; } to { opacity: 1; } }
.sb-modal {
  width: min(520px, 92vw);
  background: #fff;
  border: 3px solid #0d0d0d;
  border-radius: 22px;
  padding: 24px 26px;
  box-shadow: 0 24px 60px rgba(0,0,0,0.4);
  animation: sbPop .28s cubic-bezier(.2,.8,.3,1);
}
.sb-modal-top {
  display: flex; align-items: center; justify-content: space-between;
  font-weight: 800; font-size: 12px; color: #0d0d0d;
}
.sb-choose-clock {
  display: flex; align-items: center; gap: 6px;
  background: #0d0d0d; color: #f4c430;
  border-radius: 999px; padding: 4px 12px;
}
.sb-modal-title {
  font-family: 'Caveat', cursive;
  font-size: 38px; font-weight: 700;
  margin: 12px 0 18px; text-align: center;
}
.sb-choose-list { display: flex; flex-direction: column; gap: 12px; }
.sb-choice-btn {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  border: 3px solid #0d0d0d;
  border-radius: 14px;
  background: #fff;
  padding: 14px 18px;
  cursor: pointer;
  transition: background .15s, transform .12s, box-shadow .15s;
}
.sb-choice-btn:hover {
  background: #f4c430;
  transform: translateY(-2px) scale(1.01);
  box-shadow: 0 6px 0 rgba(0,0,0,0.25);
}
.sb-choice-btn:active { transform: translateY(1px) scale(1); }
.sb-choice-word { font-size: 21px; font-weight: 800; color: #0d0d0d; }
.sb-choice-cat {
  display: flex; align-items: center; gap: 5px;
  font-size: 11px; font-weight: 800;
  background: #0d0d0d; color: #fff;
  border-radius: 999px;
  padding: 4px 12px;
}

/* ── Results ── */
.sb-end {
  width: 100%; max-width: 640px;
  margin: 0 auto;
  padding: 40px 20px;
}
.sb-end-card {
  background: #fff;
  border: 3px solid #0d0d0d;
  border-radius: 22px;
  padding: 28px;
  text-align: center;
  animation: sbPop .3s cubic-bezier(.2,.8,.3,1);
}
.sb-end-title {
  font-family: 'Caveat', cursive;
  font-size: 44px; font-weight: 700; line-height: 1;
  margin-bottom: 4px;
}
.sb-end-sub { font-weight: 800; color: #8a6d1a; margin-bottom: 20px; font-size: 13px; }
.sb-lb { display: flex; flex-direction: column; gap: 8px; margin-bottom: 22px; }
.sb-lb-row {
  display: flex; align-items: center; gap: 12px;
  border: 2px solid #0d0d0d;
  border-radius: 12px;
  padding: 10px 14px;
  background: #fff;
  transition: transform .15s;
}
.sb-lb-row:hover { transform: translateX(3px); }
.sb-lb-row.lbme { background: #eaffe3; box-shadow: 0 4px 0 rgba(0,0,0,0.2); }
.sb-lb-rank { font-size: 22px; min-width: 34px; }
.sb-lb-name { flex: 1; font-weight: 800; font-size: 15px; text-align: left; }
.sb-lb-score { font-weight: 800; font-size: 15px; }
.sb-rematch-hint { font-size: 12px; font-weight: 800; color: #8a6d1a; margin-top: 10px; }

/* ── Dissolved ── */
.sb-dissolved {
  width: 100%; min-height: 60vh;
  display: flex; align-items: center; justify-content: center;
}
.sb-dissolved-box {
  background: #fff;
  border: 3px solid #0d0d0d;
  border-radius: 18px;
  padding: 30px;
  text-align: center;
  max-width: 320px;
}
.sb-dissolved-box h2 { margin: 8px 0 4px; font-size: 22px; font-family: var(--sb-font-display); }
.sb-dissolved-box p { font-size: 13px; font-weight: 700; color: #6b4a00; margin-bottom: 16px; }

/* ── Bổ sung render ScribbleApp ── */
.sb-wordlet {
  font-size: 21px; font-weight: 800; color: #fff;
  width: 14px; height: 26px;
  display: inline-flex; align-items: center; justify-content: center;
  border-bottom: 2.5px solid #9a9a9a;
}
.sb-wordlet.lv { border-bottom-color: transparent; }
.sb-ava-lg { width: 44px; height: 44px; font-size: 15px; }
.sb-online-dot {
  position: absolute; top: 2px; right: 2px;
  width: 9px; height: 9px; border-radius: 50%;
  background: #3ecf6e; box-shadow: 0 0 6px #3ecf6e;
  border: 1.5px solid #fff;
}
.sb-offline-dot { background: #b9b9b9; box-shadow: none; }
.sb-mode-opt {
  display: flex; align-items: center; gap: 12px;
  border: 2.5px solid #0d0d0d; border-radius: 14px;
  padding: 12px 16px; background: #fff; color: #0d0d0d;
  width: 100%; cursor: pointer; text-align: left;
  margin-bottom: 10px;
  transition: transform .15s, box-shadow .15s;
}
.sb-mode-opt:hover:not(:disabled) { transform: translateY(-2px); }
.sb-mode-opt.on { background: #f4c430; box-shadow: 0 4px 0 rgba(0,0,0,0.25); }
.sb-mode-opt:disabled { opacity: 0.5; cursor: not-allowed; }
.sb-mode-t { display: block; font-size: 14px; font-weight: 800; }
.sb-mode-d { display: block; font-size: 11px; font-weight: 700; opacity: 0.7; }
.sb-note { font-size: 11px; font-weight: 800; opacity: 0.55; line-height: 1.55; }
.sb-count-badge {
  background: #f4c430; color: #0d0d0d;
  border-radius: 999px; font-size: 11px; font-weight: 800;
  padding: 2px 10px; white-space: nowrap;
}
.sb-wait-text { text-align: center; font-size: 12px; font-weight: 800; color: #fff; opacity: 0.85; }
.sb-guess-status { min-height: 20px; line-height: 20px; text-align: center; font-size: 12px; font-weight: 800; color: #0e5c33; }
.sb-btn-row { display: flex; gap: 10px; align-items: center; justify-content: center; flex-wrap: wrap; }
.sb-ready-chip {
  border-radius: 999px; padding: 4px 12px;
  font-size: 12px; font-weight: 800;
  border: 2px solid #0d0d0d; background: #fff; color: #0d0d0d;
  transition: transform .15s;
}
.sb-ready-chip.ready { background: #3ecf6e; color: #fff; border-color: #3ecf6e; }
.sb-rematch-row { display: flex; align-items: center; justify-content: center; gap: 6px; flex-wrap: wrap; margin-top: 12px; }
.sb-chat-log.sb-chat-flex { flex: 1; height: auto; min-height: 120px; }
.sb-side-chat { overflow: hidden; }
.sb-side-chat .sb-chat-log.sb-chat-flex { flex: 1; min-height: 0; height: auto; }
.sb-side-chat .sb-chat-inp-row { flex-shrink: 0; }

@media (max-width: 900px) {
  .sb-land-body { padding-top: 10px; }
  .sb-room { height: auto; }
  .sb-room-main { grid-template-columns: 1fr; }
  .sb-game-bd { grid-template-columns: 1fr; grid-template-rows: auto 1fr auto; }
  .sb-topbar { grid-template-columns: 90px 1fr 90px; }
}
`;

/* ════════════════════════════════ LANDING ════════════════════════════════ */
function Landing({ onJoin, onPlay, onOptions, onExit, name, avatar }) {
  const dots = Array.from({ length: 26 }).map((_, i) => ({
    left: (i * 37 + 9) % 100,
    top: (i * 61 + 13) % 88,
    r: 5 + (i % 4) * 3,
    o: 0.16 + ((i * 7) % 40) / 110,
    delay: (i % 7) * 0.4,
  }));
  const chipAvatar = avatar && avatar !== "/none.png" ? avatar : INGAME_AVATAR;
  return (
    <div className="sb-landing">
      <div className="sb-dots" />
      {dots.map((d, i) => (
        <span key={i} className="sb-dot" style={{ left: `${d.left}%`, top: `${d.top}%`, width: d.r, height: d.r, opacity: d.o, animationDelay: `${d.delay}s` }} />
      ))}
        <header className="sb-land-head">
          <div className="sb-brush">
            <span className="sb-brush-splat" aria-hidden="true" />
            <span className="sb-brush-name">Scribble it!</span>
            <svg className="sb-brush-tool" viewBox="0 0 40 64" aria-hidden="true">
              <rect x="14" y="0" width="12" height="18" rx="3" fill="#0d0d0d" />
              <rect x="9" y="15" width="22" height="11" rx="3" fill="#f4c430" />
              <path d="M13 25 L27 25 L22 60 Q20 64 18 60 Z" fill="#8a5a2b" />
            </svg>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <MuteButton />
            <button className="sb-user-chip" onClick={onOptions} title="Hồ sơ của bạn">
              <span className="sb-ava"><UserAvatar name={name} avatar={chipAvatar} className="sb-ava" /></span>
              {name}
            </button>
          </div>
        </header>
      <div className="sb-land-body">
        <div className="sb-menu">
          <button className="sb-menu-btn sb-mb-yellow" onClick={onPlay}>Chơi ngay</button>
          <button className="sb-menu-btn sb-mb-blue" onClick={onOptions}>Tuỳ chọn</button>
          <button className="sb-menu-btn sb-mb-coral" onClick={onJoin}>Tham gia phòng</button>
          <button className="sb-menu-btn sb-mb-purple" onClick={onExit}>Thoát</button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════ PRESENTATIONAL ════════════════════════════════ */

function Loading() {
  return <div className="sb-loading">Scribble It · đang kết nối…</div>;
}

function MuteButton() {
  const [muted, setMutedState] = useState(isMuted());
  return (
    <button
      className="sb-mute"
      onClick={() => setMutedState(toggleMute())}
      title={muted ? "🔇 Bật âm thanh" : "🔊 Tắt âm thanh"}
      aria-label={muted ? "Bật âm thanh" : "Tắt âm thanh"}
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );
}

function PlayerLobbyCard({ player, slot, mySlot }) {
  const st = PLAYER_STYLES[SLOT_ORDER.indexOf(slot) % PLAYER_STYLES.length];
  return (
    <div
      className={`sb-lobby-card${player.online ? "" : " offline"}`}
      style={{ background: st.bg, border: `2px solid ${st.bd}` }}
    >
      <span className="sb-ava" style={{ background: "#fff", color: st.text }}>
        <UserAvatar name={player.name} avatar={sbAvatarFor(player)} className="sb-ava" style={{ background: "#fff", color: st.text }} />
      </span>
      <div className="sb-pname" style={{ color: st.text }}>{player.name}{slot === mySlot ? " (bạn)" : ""}</div>
      <div className="sb-lobby-tag" style={{ color: st.text }}>{slot === "player1" ? "⭐ Host" : player.online ? "online" : "offline"}</div>
    </div>
  );
}

function heartPath(ctx, cx, cy, r) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + r * 0.75);
  ctx.bezierCurveTo(cx - r * 1.7, cy - r * 0.35, cx - r * 0.85, cy - r * 1.35, cx, cy - r * 0.3);
  ctx.bezierCurveTo(cx + r * 0.85, cy - r * 1.35, cx + r * 1.7, cy - r * 0.35, cx, cy + r * 0.75);
  ctx.closePath();
}

function HeartCanvas({ hearts, max, size = 13, className = "" }) {
  const ref = useRef(null);
  const total = Math.max(1, max | 0);
  const fill = Math.max(0, Math.min(total, hearts | 0));
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const gap = Math.max(2, Math.round(size * 0.22));
    const w = total * size + (total - 1) * gap;
    const h = Math.round(size * 1.1);
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    cv.style.width = `${w}px`;
    cv.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < total; i++) {
      const cx = i * (size + gap) + size / 2;
      const cy = h / 2;
      heartPath(ctx, cx, cy, size * 0.42);
      ctx.fillStyle = i < fill ? "#E5484D" : "#D8DCE2";
      ctx.fill();
      ctx.lineWidth = Math.max(1, size * 0.08);
      ctx.strokeStyle = "#0d0d0d";
      ctx.stroke();
    }
  }, [fill, total, size]);
  return <canvas ref={ref} className={className} aria-hidden />;
}

function GamePlayerCard({ player, slot, mySlot, score, isDrawer, correct, typing, flash, hearts, maxHearts }) {
  const st = PLAYER_STYLES[SLOT_ORDER.indexOf(slot) % PLAYER_STYLES.length];
  const me = slot === mySlot;
  return (
    <div className={`sb-pcard${isDrawer ? " sb-pcard-drawing" : ""}`} style={{ background: st.bg, borderColor: st.bd }}>
      <div className="sb-pcard-top">
        <span className="sb-ava sb-ava-lg" style={{ background: "#fff", color: st.text }}>
          <UserAvatar name={player.name} avatar={sbAvatarFor(player)} className="sb-ava sb-ava-lg" style={{ background: "#fff", color: st.text }} />
        </span>
        <span className="sb-badge sb-badge-rank" style={{ color: st.text }}>{RANK_NUM[SLOT_ORDER.indexOf(slot)]}</span>
        {isDrawer && <span className="sb-badge sb-badge-drawer">✏️</span>}
        <span className={`sb-online-dot${player.online ? "" : " sb-offline-dot"}`} />
        <span className="sb-score-chip">{score ?? 0}</span>
        {flash && <span className="sb-bubble-tip">Correct!</span>}
        {correct && <span className="sb-correct-bub">✓ Đúng</span>}
        {typing && <span className="sb-bubble-tip" style={{ right: -2, top: 22 }}>…</span>}
      </div>
      <div className="sb-pgame-name" style={{ color: st.text, background: st.bg }}>{player.name}{me ? " (bạn)" : ""}</div>
      <div className="sb-pcard-hearts" style={{ opacity: isDrawer ? 0.4 : 1 }}>
        <HeartCanvas hearts={hearts ?? maxHearts} max={maxHearts} size={11} />
      </div>
    </div>
  );
}

function WordCell({ game, phase, isDrawer }) {
  const word = game?.currentWord;
  if (phase === "drawing" || phase === "roundEnd") {
    if (isDrawer) return <span className="sb-drawer-word">{word}</span>;
    const layout = getMaskLayout(word, game.hintsRevealed);
    return (
      <span className="sb-wordcell">
        {layout.map((w, wi) => (
          <span className="sb-wordseg" key={wi}>
            {w.map((l, li) => (
              <span className={`sb-wordlet${l.revealed ? " lv" : ""}`} key={li}>{l.revealed ? l.ch : ""}</span>
            ))}
          </span>
        ))}
        <span className="sb-wordlen">({letterCount(word)})</span>
      </span>
    );
  }
  if (phase === "choosingWord") {
    return (
      <span className="sb-wordcell">
        {isDrawer ? <span className="sb-wait-text">Chọn từ bên dưới 👇</span> : <span className="sb-skeleton" />}
      </span>
    );
  }
  return null;
}

function ChatMessage({ m }) {
  if (m.type === "sys") return <div className="sb-msg sb-msg-sys">{m.text}</div>;
  if (m.type === "correct") return <div className="sb-msg sb-msg-correct"><span className="who">{m.name}</span> đã đoán đúng! 🎉</div>;
  if (m.type === "close") return (
    <div className="sb-msg sb-msg-close"><span className="who">{m.name}</span> gần đúng! <span className="sb-msg-word">“{m.text}”</span></div>
  );
  return (
    <div className="sb-msg sb-msg-guess">
      <span className="who">{m.name}:</span> {m.text}
    </div>
  );
}

function ResultsView({ roomData, game, mySlot, onRematch, onExit }) {
  const players = roomData?.players || {};
  const scores = game?.scores || {};
  const rows = SLOT_ORDER
    .filter(s => players[s])
    .map(s => ({ slot: s, score: scores[s] || 0, name: players[s].name, rematch: !!players[s].rematch }))
    .sort((a, b) => b.score - a.score);
  const myRank = rows.findIndex(r => r.slot === mySlot);
  const allReady = rows.length > 0 && rows.every(r => r.rematch);
  return (
    <div className="sb-end">
      <div className="sb-end-card">
        <div className="sb-end-title">Kết thúc!</div>
        <div className="sb-end-sub">
          {rows[0] && <>🏆 <b>{rows[0].name}</b> giành chiến thắng{myRank === 0 ? " — đó là bạn!" : ""}</>}
        </div>
        <div className="sb-lb">
          {rows.map((r, i) => (
            <div key={r.slot} className={`sb-lb-row${r.slot === mySlot ? " lbme" : ""}`}>
              <span className="sb-lb-rank">{i === 0 ? "🥇" : MEDALS[i] || RANK_NUM[i]}</span>
              <span className="sb-lb-name">{r.name}{r.slot === mySlot ? " (bạn)" : ""}</span>
              <span className="sb-lb-score">{r.score}</span>
            </div>
          ))}
        </div>
        <div className="sb-btn-row">
          <button className="sb-btn sb-btn-dark" onClick={onRematch} disabled={allReady}>👍 Chơi lại</button>
          <button className="sb-btn" onClick={onExit}>Về menu</button>
        </div>
        <div className="sb-rematch-row">
          {rows.map(r => (
            <span key={r.slot} className={`sb-ready-chip${r.rematch ? " ready" : ""}`}>{r.name}{r.rematch ? " ✓" : ""}</span>
          ))}
        </div>
        {allReady && <div className="sb-rematch-hint">Tất cả đã sẵn sàng — bắt đầu lượt mới…</div>}
      </div>
    </div>
  );
}

/* ════════════════════════════════ APP ════════════════════════════════ */
export default function ScribbleApp() {
  const { displayName, avatar } = useAuth();
  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [mySlot, setMySlot] = useState("");
  const [roomData, setRoomData] = useState(null);
  const [game, setGame] = useState(null);
  const [strokes, setStrokes] = useState({ list: [], live: null });
  const [chat, setChat] = useState([]);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [optsOpen, setOptsOpen] = useState(false);
  const [step, setStep] = useState(4);
  const [pendingJoin, setPendingJoin] = useState(true);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS());
  const [guess, setGuess] = useState("");
  const [heartNote, setHeartNote] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [now, setNow] = useState(0);
  const [flashUntil, setFlashUntil] = useState({});
  const [activeTool, setActiveTool] = useState("pen");
  const [activeColor, setActiveColor] = useState("#000000");
  const [activeSize, setActiveSize] = useState(1);

  const roomIdRef = useRef("");
  const mySlotRef = useRef("");
  const gameRef = useRef(null);
  const flashRef = useRef({});
  const chatLogRef = useRef(null);
  const toastTimer = useRef(null);
  const heartNoteTimer = useRef(null);
  const sfxRef = useRef({
    round: 0,
    turnKey: "",
    hintCount: 0,
    lastChatKey: "",
    joinCount: -1,
    lastPhase: "",
    lastTick: -1,
    finishedPlayed: false,
  });

  useEffect(() => {
    roomIdRef.current = roomId;
    mySlotRef.current = mySlot;
    gameRef.current = game;
    flashRef.current = flashUntil;
  });

  /* ── helpers ── */
  function showToast(text, ms = 2200) {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), ms);
  }

  function flashHeartNote(text) {
    setHeartNote(text);
    clearTimeout(heartNoteTimer.current);
    heartNoteTimer.current = setTimeout(() => setHeartNote(""), 3200);
  }

  const saveSession = useCallback(() => {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify({ roomId, role: mySlot })); } catch { /* ignore */ }
  }, [roomId, mySlot]);
  function clearSession() {
    try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
  }

  /* ── CSS inject ── */
  useEffect(() => {
    const id = "scribble-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style");
      el.id = id;
      el.textContent = STYLES;
      document.head.appendChild(el);
    }
    document.body.classList.add("sb-body");
    return () => { document.body.classList.remove("sb-body"); };
  }, []);

  /* ── Rejoin sau F5 ── */
  useEffect(() => {
    let alive = true;
    (async () => {
      let stored = null;
      try { stored = JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { /* ignore */ }
      if (stored && stored.roomId && stored.role) {
        try {
          const res = await rejoinRoom(stored.roomId, stored.role);
          if (alive) {
            setRoomId(stored.roomId);
            setMySlot(stored.role);
            setPendingJoin(true);
          }
          if (res.status) setRoomData(null); // listener sẽ nạp lại
        } catch {
          if (alive) clearSession();
        }
      } else {
        if (alive) setPendingJoin(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  /* ── Listeners ── */
  useEffect(() => {
    if (!roomId) return;
    const t = setTimeout(() => {
      setGame(null);
      setStrokes({ list: [], live: null });
      setChat([]);
    }, 0);
    const unsubs = [
      listenRoom(roomId, data => { setRoomData(data); if (data) setPendingJoin(false); }),
      listenGame(roomId, d => setGame(d)),
      listenStrokes(roomId, d => setStrokes(d)),
      listenChat(roomId, d => setChat(d)),
    ];
    return () => { clearTimeout(t); unsubs.forEach(u => u()); };
  }, [roomId]);

  /* ── Presence ── */
  useEffect(() => {
    if (!roomId || !mySlot) return;
    const connRef = ref(db, ".info/connected");
    const unsub = onValue(connRef, snap => {
      if (snap.val()) {
        update(ref(db, `rooms/${roomId}/players/${mySlot}`), { online: true });
        onDisconnect(ref(db, `rooms/${roomId}/players/${mySlot}/online`)).set(false);
      }
    });
    const onUnload = () => { try { setPlayerOnline(roomId, mySlot, false); } catch { /* ignore */ } };
    window.addEventListener("beforeunload", onUnload);
    return () => { unsub(); window.removeEventListener("beforeunload", onUnload); };
  }, [roomId, mySlot]);

  /* ── Đồng hồ + persist session ── */
  useEffect(() => {
    if (!roomId) return;
    saveSession();
    const bump = () => setNow(Date.now());
    bump();
    const t = setInterval(bump, 800);
    return () => clearInterval(t);
  }, [roomId, saveSession]);

  /* ── Flash "Correct!" khi ai đó vừa đoán đúng ── */
  useEffect(() => {
    const order = game?.correctOrder || [];
    const prev = flashRef.current;
    const fresh = order.filter(s => !prev[s]);
    if (fresh.length) {
      playSfx("correct");
      const untilT = Date.now() + 1600;
      setFlashUntil(m => ({ ...m, ...Object.fromEntries(fresh.map(s => [s, untilT])) }));
    }
  }, [game?.correctOrder]);

  /* ── SOUND FX ─────────────────────────────────────────────── */

  /* Vòng mới bắt đầu (round) + đến lượt mình vẽ (turn) */
  useEffect(() => {
    if (!game || roomData?.status !== "playing") return;
    const round = game.round || 1;
    const phase = game.phase;
    if (round !== sfxRef.current.round) {
      sfxRef.current.round = round;
      if (phase === "drawing" || phase === "choosingWord") playSfx("round");
    }
    if (phase === "drawing" || phase === "choosingWord") {
      const turnKey = `${game.round}|${game.turnIndex ?? 0}|${game.drawerSlot}`;
      if (turnKey !== sfxRef.current.turnKey) {
        sfxRef.current.turnKey = turnKey;
        if (game.drawerSlot === mySlot) playSfx("turn");
      }
    }
  }, [game, roomData?.status, mySlot]);

  /* Mở gợi ý chữ cái (hint) */
  const gamePhase = game?.phase;
  const hintCount = (game?.hintsRevealed || []).length;
  useEffect(() => {
    if (gamePhase !== "drawing") return;
    if (hintCount > sfxRef.current.hintCount) {
      sfxRef.current.hintCount = hintCount;
      playSfx("hint");
    }
  }, [gamePhase, hintCount]);

  /* Hiện đáp án cuối lượt (reveal) */
  const roomStatus = roomData?.status;
  useEffect(() => {
    if (roomStatus !== "playing") return;
    if (gamePhase !== sfxRef.current.lastPhase) {
      sfxRef.current.lastPhase = gamePhase;
      if (gamePhase === "roundEnd") playSfx("reveal");
    }
  }, [gamePhase, roomStatus]);

  /* Tick đếm ngược 10 giây cuối lượt vẽ */
  useEffect(() => {
    if (!game || game.phase !== "drawing") return;
    const t = Date.now();
    const c = Math.max(0, Math.ceil(((game.roundStartedAt || t) + (game.roundDuration || 0) * 1000 - t) / 1000));
    if (c >= 1 && c <= 10 && c !== sfxRef.current.lastTick) {
      sfxRef.current.lastTick = c;
      playSfx("tick");
    }
  }, [game, now]);

  /* Chat mới đến từ người khác */
  useEffect(() => {
    if (!chat.length) return;
    const last = chat[chat.length - 1];
    if (last && last.key !== sfxRef.current.lastChatKey) {
      sfxRef.current.lastChatKey = last.key;
      if (last.type === "chat" && last.slot !== mySlot) playSfx("chat");
    }
  }, [chat, mySlot]);

  /* Có người chơi mới vào phòng chờ */
  const playerCount = roomData ? Object.keys(roomData.players || {}).length : 0;
  useEffect(() => {
    if (sfxRef.current.joinCount >= 0 && playerCount > sfxRef.current.joinCount
        && (roomStatus === "waiting" || roomStatus === "ready")) {
      playSfx("join");
    }
    sfxRef.current.joinCount = playerCount;
  }, [playerCount, roomStatus]);

  /* Kết thúc game: thắng / thua */
  useEffect(() => {
    if (roomStatus !== "finished" || !game || sfxRef.current.finishedPlayed) return;
    sfxRef.current.finishedPlayed = true;
    const scores = game.scores || {};
    const myScore = scores[mySlot] || 0;
    const others = Object.keys(scores).filter(s => s !== mySlot);
    const isWinner = others.every(s => myScore >= (scores[s] || 0));
    playSfx(isWinner ? "win" : "lose");
  }, [roomStatus, game, mySlot]);

  /* ── Auto scroll chat ── */
  useEffect(() => {
    chatLogRef.current?.scrollTo?.({ top: 1e9 });
  }, [chat, chatOpen]);

  /* ── TIMER AUTHORITY: HOST (player1) tick nhịp game.
       Quy ước: chỉ client của player1 mới gọi revealHint/advanceTurn/
       autoChooseWordIfExpired để tránh nhiều client ghi đè nhau; các hàm
       đều chạy transaction nên an toàn kể cả khi rơi vào race. ── */
  useEffect(() => {
    if (!roomId || mySlot !== "player1" || roomData?.status !== "playing") return;
    const tick = async () => {
      const g = gameRef.current;
      if (!g) return;
      const t = Date.now();
      const rid = roomIdRef.current;
      try {
        if (g.phase === "choosingWord") {
          if (g.wordChoiceDeadline && t >= g.wordChoiceDeadline) await autoChooseWordIfExpired(rid);
        } else if (g.phase === "drawing") {
          const diff = DIFFICULTY[g.difficulty] || DIFFICULTY.normal;
          const elapsed = g.roundStartedAt ? t - g.roundStartedAt : 0;
          const due = Math.floor(elapsed / diff.hintInterval);
          const cap = Math.min(diff.maxReveals, letterCount(g.currentWord));
          if ((g.hintsRevealed || []).length < Math.min(due, cap)) await revealHint(rid);
          if (elapsed >= (g.roundDuration || diff.duration) * 1000) await advanceTurn(rid);
        } else if (g.phase === "roundEnd") {
          if (t >= (g.roundEndAt || 0) + ROUND_END_MS) await advanceTurn(rid);
        }
      } catch { /* transient network */ }
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [roomId, mySlot, roomData?.status, game?.phase]);

  /* ── Drawer fallback: hết giờ chọn từ mà host mất kết nối ── */
  useEffect(() => {
    if (!roomId || !game || game.phase !== "choosingWord" || mySlot !== game.drawerSlot) return;
    if (!game.wordChoiceDeadline) return;
    const wait = Math.max(0, game.wordChoiceDeadline - Date.now()) + 60;
    const id = setTimeout(() => { autoChooseWordIfExpired(roomIdRef.current); }, wait);
    return () => clearTimeout(id);
  }, [game?.phase, game?.wordChoiceDeadline, mySlot, game?.drawerSlot, roomId]);

  /* ════════════ HANDLERS ════════════ */
  const fieldName = name.trim() || displayName;

  async function handleCreate() {
    if (!fieldName) return setError("Nhập tên của bạn!");
    setError("");
    clearSession();
    setPendingJoin(true);
    const id = await createRoom(fieldName, { avatar });
    setRoomId(id);
    setMySlot("player1");
  }

  async function handleJoin() {
    if (!fieldName) return setError("Nhập tên của bạn!");
    if (!joinCode.trim()) return setError("Nhập mã phòng!");
    setError("");
    clearSession();
    setPendingJoin(true);
    try {
      const slot = await joinRoom(joinCode.toUpperCase(), fieldName, { avatar });
      setRoomId(joinCode.toUpperCase());
      setMySlot(slot);
      setJoinOpen(false);
    } catch (e) {
      setPendingJoin(false);
      setError(e.message);
    }
  }

  async function handleStart() {
    const customWords = settings.customWords.split(/[\n\r,，]+/).map(s => s.trim()).filter(Boolean);
    if (!settings.wordPackages.length && !customWords.length) {
      return showToast("Chọn ít nhất 1 gói từ hoặc nhập từ tuỳ chỉnh!");
    }
    playSfx("start");
    await startScribbleGame(roomId, {
      mode: settings.mode,
      maxRounds: Number(settings.maxRounds),
      difficulty: settings.difficulty,
      wordPackages: settings.wordPackages,
      randomTopic: settings.randomTopic,
      customWords,
    });
  }

  function exitToLanding() {
    clearSession();
    if (roomId && mySlot) setPlayerOnline(roomId, mySlot, false);
    setRoomId(""); setMySlot(""); setRoomData(null); setGame(null);
    setStrokes({ list: [], live: null }); setChat([]);
    setGuess(""); setChatInput(""); setChatOpen(false);
    setError(""); setPendingJoin(false);
  }

  function handleCopy(text) {
    navigator.clipboard?.writeText(text).catch(() => { });
    playSfx("click");
    showToast("✓ Đã copy!");
  }

  async function handleChoose(choice) {
    playSfx("selectWord");
    await chooseWord(roomId, mySlot, choice);
  }

  async function handleSubmitGuess() {
    const text = guess.trim();
    if (!text || !game || game.phase !== "drawing") return;
    if ((game.correctOrder || []).includes(mySlot)) return;
    const res = await submitGuess(roomId, mySlot, text);
    const p = players[mySlot] || {};
    const code = res?.status;
    const left = Number.isFinite(res?.game?.hearts?.[mySlot]) ? res.game.hearts[mySlot] : 0;
    if (code === "correct") await sendChatMessage(roomId, mySlot, p.name || fieldName, text, "correct");
    else if (code === "close") {
      playSfx("close");
      await sendChatMessage(roomId, mySlot, p.name || fieldName, text, "close");
      flashHeartNote(`💔 Gần đúng — -1 tim (còn ${left})`);
    } else if (code === "wrong") {
      playSfx("wrong");
      await sendChatMessage(roomId, mySlot, p.name || fieldName, text, "guess");
      flashHeartNote(`💔 Sai — -1 tim (còn ${left})`);
    } else if (code === "locked") {
      playSfx("lockout");
      await sendChatMessage(roomId, mySlot, p.name || fieldName, "💔 hết tim rồi — không đoán được nữa!", "sys");
      flashHeartNote("💔 Hết tim rồi — không được đoán nữa!");
      clearTypingIndicator(roomId, mySlot);
      setGuess("");
      return;
    }
    clearTypingIndicator(roomId, mySlot);
    setGuess("");
  }

  function handleGuessInput(v) {
    setGuess(v);
    if (roomId && mySlot && v.trim()) setTypingIndicator(roomId, mySlot);
  }

  async function handleChatSend() {
    const text = chatInput.trim();
    if (!text) return;
    const p = players[mySlot] || {};
    await sendChatMessage(roomId, mySlot, p.name || fieldName, text, "chat");
    setChatInput("");
  }

  function handleStrokeCommit(stroke) {
    pushStroke(roomId, { ...stroke, slot: mySlot });
  }
  function handleLiveChange(stroke) {
    if (!roomId || !mySlot) return;
    if (!stroke) { clearLiveStroke(roomId, mySlot); return; }
    setLiveStroke(roomId, mySlot, stroke);
  }

  async function handleRematch() {
    const started = await requestScribbleRematch(roomId, mySlot);
    if (started) showToast("Đang chơi lại…");
  }

  /* ════════════ RENDER ════════════ */

  const players = roomData?.players || {};
  const slots = SLOT_ORDER.filter(s => players[s]);
  const orderedSlots = (() => {
    const order = game?.turnOrder || [];
    return order.filter(s => slots.includes(s)).concat(slots.filter(s => !order.includes(s)));
  })();
  const isHost = mySlot === "player1";

  if (!roomId) {
    return (
      <div className="sb-root">
        {pendingJoin ? <Loading /> : (
          <>
            <Landing name={fieldName} avatar={avatar} onPlay={() => { playSfx("click"); handleCreate(); }} onJoin={() => { playSfx("click"); setError(""); setJoinOpen(true); }} onOptions={() => { playSfx("click"); setOptsOpen(true); }} onExit={() => { playSfx("click"); showToast("Dùng nút ← Hub ở góc trái để thoát"); }} />
            {joinOpen && (
              <>
                <div className="sb-pop-glow" onClick={() => setJoinOpen(false)} />
                <div className="sb-pop">
                  <h3>Nhập mã phòng</h3>
                  <input className="sb-pop-inp" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} placeholder="ABC123" maxLength={6} onKeyDown={e => e.key === "Enter" && handleJoin()} />
                  {error && <div className="sb-err">{error}</div>}
                  <div className="sb-pop-row">
                    <button className="sb-btn sb-btn-dark" onClick={handleJoin}>Vào phòng</button>
                    <button className="sb-btn" onClick={() => { setJoinOpen(false); setError(""); }}>Huỷ</button>
                  </div>
                </div>
              </>
            )}
            {optsOpen && (
              <>
                <div className="sb-pop-glow" onClick={() => setOptsOpen(false)} />
                <div className="sb-pop">
                  <h3>Tuỳ chọn</h3>
                  <input className="sb-pop-inp" value={name} onChange={e => setName(e.target.value)} placeholder="Tên của bạn" />
                  <p className="sb-hint">Tên sẽ hiển thị cho mọi người trong phòng.</p>
                  <div className="sb-pop-row">
                    <button className="sb-btn sb-btn-dark" onClick={() => setOptsOpen(false)}>Lưu</button>
                    <button className="sb-btn" onClick={() => setOptsOpen(false)}>Đóng</button>
                  </div>
                </div>
              </>
            )}
            {error && !joinOpen && <div className="sb-toast">{error}</div>}
          </>
        )}
      </div>
    );
  }

  if (!roomData) return <div className="sb-root"><MuteButton /><Loading /></div>;

  /* ── Phòng đã đóng ── */
  if (roomData.status === "dissolved") {
    return (
      <div className="sb-root">
        <MuteButton />
        <div className="sb-dissolved">
          <div className="sb-dissolved-box">
            <div style={{ fontSize: 38 }}>🚪</div>
            <h2>Phòng đã đóng</h2>
            <p>Chủ phòng rời đi hoặc phòng không còn tồn tại.</p>
            <button className="sb-btn sb-btn-dark" onClick={exitToLanding}>Về menu</button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Kết thúc game ── */
  if (roomData.status === "finished") {
    return (
      <div className="sb-root">
        <MuteButton />
        <ResultsView roomData={roomData} game={game} mySlot={mySlot} onRematch={handleRematch} onExit={exitToLanding} />
        {toast && <div className="sb-toast">{toast}</div>}
      </div>
    );
  }

  /* ── Phòng chờ ── */
  if (roomData.status === "waiting" || roomData.status === "ready") {
    const setHost = (updater) => { if (isHost) setSettings(updater); };
    const customCount = settings.customWords.split(/[\n\r,，]+/).map(s => s.trim()).filter(Boolean).length;
    const totalWords = settings.wordPackages.reduce((n, id) => n + (WORD_PACKAGES[id]?.words?.length || 0), 0);
    const visibleSteps = settings.randomTopic ? STEPPER.filter(s => s !== "Words") : STEPPER;
    const cur = settings.randomTopic && step === 2 ? 3 : step;
    return (
      <div className="sb-root">
        <MuteButton />
        <div className="sb-room">
          <div className="sb-stepper">
            {visibleSteps.map(s => {
              const i = STEPPER.indexOf(s);
              return (
                <button
                  key={s}
                  className={`sb-step${cur === i ? " sb-step-cur" : ""}${!isHost && i < 4 ? " sb-step-lock" : ""}`}
                  onClick={() => setStep(i)}
                >
                  {s}
                  {!isHost && i < 4 && " 🔒"}
                </button>
              );
            })}
          </div>

          <div className="sb-room-main">
            <div className="sb-card">
              <div className="sb-card-head">
                <span>{STEPPER[cur]}</span>
                <button className="sb-code-big" onClick={() => handleCopy(roomId)} title="Copy mã phòng">#{roomId}</button>
              </div>

              {cur === 0 && (
                <div className="sb-pkgs">
                  <p className="sb-note">Chọn chế độ chơi cho phòng. Hiện tại có 1 chế độ:</p>
                  <button className={`sb-mode-opt${settings.mode === MODE_CLASSIC ? " on" : ""}`} disabled={!isHost} onClick={() => setHost(s => ({ ...s, mode: MODE_CLASSIC }))}>
                    <span>
                      <span className="sb-mode-t">🎨 Kinh điển (Classic)</span>
                      <span className="sb-mode-d">Mỗi vòng một người vẽ, cả phòng đoán từ theo chủ đề.</span>
                    </span>
                  </button>
                </div>
              )}

              {cur === 1 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div className="sb-opt-row">
                    <span>Chủ đề ngẫu nhiên</span>
                    <span
                      className={`sb-toggle${settings.randomTopic ? " sb-toggle-on" : ""}`}
                      onClick={() => setHost(s => ({ ...s, randomTopic: !s.randomTopic }))}
                      role="switch"
                    />
                  </div>
                  <p className="sb-note">Nếu bật: bỏ qua bước chọn chủ đề, hệ thống tự rút 3 gói khác nhau ngẫu nhiên mỗi lượt.</p>
                </div>
              )}

              {cur === 2 && (
                <div className="sb-pkgs">
                  <p className="sb-note">Chọn ít nhất 1 gói từ — drawer sẽ rút 3 từ ngẫu nhiên từ các gói này để vẽ.{isHost ? "" : " (chỉ host chỉnh)"}</p>
                  {Object.entries(WORD_PACKAGES).map(([id, pkg]) => (
                    <button
                      key={id}
                      className={`sb-pkg${settings.wordPackages.includes(id) ? " sb-pkg-on" : ""}`}
                      disabled={!isHost}
                      onClick={() => setHost(s => ({
                        ...s,
                        wordPackages: s.wordPackages.includes(id)
                          ? s.wordPackages.filter(x => x !== id)
                          : [...s.wordPackages, id],
                      }))}
                    >
                      <span>
                        {settings.wordPackages.includes(id) ? "☑ " : "☐ "}
                        {pkg.label} <span className="sb-pkg-cnt">({pkg.words.length} từ)</span>
                      </span>
                      <span className="sb-pkg-check">{settings.wordPackages.includes(id) ? "✓" : ""}</span>
                    </button>
                  ))}
                  <textarea
                    className="sb-ta"
                    value={settings.customWords}
                    disabled={!isHost}
                    onChange={e => setHost({ ...settings, customWords: e.target.value })}
                    placeholder={"Từ tuỳ chỉnh (mỗi từ 1 dòng, hoặc cách bằng dấu phẩy)…\nVí dụ:\ncon rồng\nquả bàng\nmặt trăng"}
                  />
                </div>
              )}

              {cur === 3 && (
                <div className="sb-pkgs">
                  <p className="sb-note">Ảnh hưởng thời gian lượt vẽ và nhịp mở gợi ý chữ cái.{isHost ? "" : " (chỉ host chỉnh)"}</p>
                  {Object.entries(DIFFICULTY).map(([id, d]) => (
                    <button
                      key={id}
                      className={`sb-pkg${settings.difficulty === id ? " sb-pkg-on" : ""}`}
                      disabled={!isHost}
                      onClick={() => setHost(s => ({ ...s, difficulty: id }))}
                    >
                      <span>{d.label} <span className="sb-pkg-cnt">({d.duration}s/lượt · {d.hearts} tim · tối đa {d.maxReveals} gợi ý)</span></span>
                      <span className="sb-pkg-check">{settings.difficulty === id ? "✓" : ""}</span>
                    </button>
                  ))}
                </div>
              )}

              {cur === 4 && (
                <div className="sb-player-grid">
                  {slots.map(slot => (
                    <PlayerLobbyCard key={slot} player={players[slot]} slot={slot} mySlot={mySlot} />
                  ))}
                </div>
              )}

              <div className="sb-card-head" style={{ marginTop: "auto" }}>
                <span className="sb-count-badge">{slots.length}/6 người</span>
                <span className="sb-players-count">{settings.randomTopic ? "🎲 Chủ đề ngẫu nhiên" : `${totalWords + customCount} từ`}</span>
              </div>
            </div>

            <div className="sb-side">
              <span className="sb-chat-title">Chatbox</span>
              <div className="sb-chat-log" ref={chatLogRef}>
                {chat.map(m => <ChatMessage key={m.key} m={m} />)}
              </div>
              <div className="sb-chat-inp-row">
                <input className="sb-inp" value={chatInput} placeholder="Nhắn..." onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleChatSend(); }} />
                <button className="sb-btn sb-btn-dark sb-btn-slim" onClick={handleChatSend}>Gửi</button>
              </div>
            </div>
          </div>

          <div className="sb-room-bottom">
            <div className="sb-leave-btns">
              <button className="sb-btn" onClick={exitToLanding}>← Rời phòng</button>
              <button className="sb-btn" onClick={() => handleCopy(roomId)}>🔗 Copy mã phòng</button>
            </div>
            {isHost ? (
              <button
                className="sb-btn sb-btn-dark sb-start-big"
                onClick={handleStart}
                disabled={slots.length < 2 || (!settings.randomTopic && settings.wordPackages.length === 0 && customCount === 0)}
              >
                ▶ Chơi ngay{slots.length < 2 ? " (cần ≥2 người)" : ""}
              </button>
            ) : (
              <p className="sb-hint" style={{ textAlign: "right" }}>Chờ host bắt đầu trận…</p>
            )}
          </div>
        </div>
        {toast && <div className="sb-toast">{toast}</div>}
      </div>
    );
  }

  /* ── Đang chơi ── */
  if (roomData.status === "playing" && game) {
    const phase = game.phase;
    const isDrawer = game.drawerSlot === mySlot;
    const canDraw = isDrawer && phase === "drawing";
    const scores = game.scores || {};
    const correctOrder = game.correctOrder || [];
    const typing = game.typingIndicator || {};
    const flash = flashUntil;
    const cd = phase === "choosingWord"
      ? Math.max(0, Math.ceil(((game.wordChoiceDeadline || (now + WORD_CHOICE_SECONDS * 1000)) - now) / 1000))
      : phase === "roundEnd"
        ? Math.max(0, Math.ceil(((game.roundEndAt || now) + ROUND_END_MS - now) / 1000))
        : Math.max(0, Math.ceil(((game.roundStartedAt || now) + (game.roundDuration || 0) * 1000 - now) / 1000));
    const typingLive = Object.entries(typing).filter(([, ts]) => now - ts < 3000).map(([s]) => s);
    const visChat = chat.filter(m => !((m.type === "guess" || m.type === "close") && correctOrder.includes(m.slot)));
    const myCorrect = correctOrder.includes(mySlot);
    const maxHearts = DIFFICULTY[game.difficulty]?.hearts ?? 5;
    const myHearts = Number.isFinite(game.hearts?.[mySlot]) ? game.hearts[mySlot] : maxHearts;
    const outOfHearts = myHearts <= 0;
    const canUndo = strokes.list.some(s => !s.undone);
    const canRedo = strokes.list.some(s => s.undone);

    return (
      <div className="sb-root">
        <MuteButton />
        <div className="sb-game">
          <div className="sb-topbar">
            <div className="sb-round">Vòng {game.round}/{game.maxRounds} · {DIFFICULTY[game.difficulty]?.label}</div>
            <div className="sb-wordcell">
              <WordCell game={game} phase={phase} isDrawer={isDrawer} />
            </div>
            <div className={`sb-clock${phase === "drawing" && cd <= 10 ? " danger" : ""}`}>
              <span className="sb-clock-ic" /> {phase === "drawing" || phase === "roundEnd" ? cd : "⏳"}
            </div>
          </div>

          <div className="sb-game-bd">
            <div className="sb-side">
              {orderedSlots.map(slot => (
                <GamePlayerCard
                  key={slot}
                  player={players[slot]}
                  slot={slot}
                  mySlot={mySlot}
                  score={scores[slot] || 0}
                  isDrawer={game.drawerSlot === slot}
                  correct={correctOrder.includes(slot)}
                  typing={!correctOrder.includes(slot) && typingLive.includes(slot)}
                  flash={!!flash[slot] && now < flash[slot]}
                  hearts={Number.isFinite(game.hearts?.[slot]) ? game.hearts[slot] : maxHearts}
                  maxHearts={maxHearts}
                />
              ))}
            </div>

            <div className="sb-center">
              <div className="sb-canvas-wrap">
                <DrawingCanvas
                  strokes={strokes.list}
                  live={strokes.live}
                  editable={canDraw}
                  activeTool={activeTool}
                  activeColor={activeColor}
                  activeSize={activeSize}
                  onLiveChange={canDraw ? handleLiveChange : null}
                  onStrokeCommit={canDraw ? handleStrokeCommit : null}
                />
                {phase === "choosingWord" && !isDrawer && <div className="sb-choose-hint">✏️ Drawer đang chọn từ…</div>}
                {phase !== "choosingWord" && game.currentWordCategory && (
                  <span className="sb-topic-tag">🖍 Chủ đề: {game.currentWordCategory}</span>
                )}
                {phase === "roundEnd" && <div className="sb-answer-banner">{game.currentWord}</div>}
              </div>

              {isDrawer ? (
                <div className="sb-under">
                  {phase === "drawing" ? (
                    <DrawingToolbar
                      activeTool={activeTool}
                      onToolChange={setActiveTool}
                      activeColor={activeColor}
                      onColorChange={setActiveColor}
                      activeSize={activeSize}
                      onSizeChange={setActiveSize}
                      onUndo={() => { playSfx("undo"); undoLastStroke(roomId, mySlot); }}
                      onRedo={() => { playSfx("redo"); redoStroke(roomId, mySlot); }}
                      onClear={() => { playSfx("clear"); clearStrokes(roomId, mySlot); }}
                      canUndo={canUndo}
                      canRedo={canRedo}
                      onToggleChat={() => chatLogRef.current?.scrollTo?.({ top: 1e9 })}
                    />
                  ) : (
                    <div className="sb-guess-row" style={{ minHeight: 64, justifyContent: "center" }}>
                      <span className="sb-wait-text" style={{ color: "#0d0d0d" }}>
                        {phase === "choosingWord" ? "⏳ Chọn từ phía trên để bắt đầu vẽ…" : "🎉 Xem kết quả lượt vẽ…"}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="sb-under">
                  <div className="sb-my-hearts">
                    <span className="sb-my-hearts-lbl">Lượt đoán của bạn:</span>
                    <HeartCanvas hearts={myHearts} max={maxHearts} size={16} className="sb-hearts-lg" />
                  </div>
                  <div className="sb-guess-row">
                    <input
                      className="sb-guess-input"
                      value={guess}
                      onChange={e => handleGuessInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") handleSubmitGuess(); }}
                      placeholder={outOfHearts && phase === "drawing" ? "💔 Hết tim rồi — chờ vòng sau nhé!" : phase === "drawing" ? "Gõ từ khoá rồi Enter để đoán…" : "…"}
                      disabled={phase !== "drawing" || myCorrect || outOfHearts}
                    />
                  </div>
                  <div className="sb-guess-status" style={heartNote ? { color: "#d1363f" } : undefined}>
                    {myCorrect && phase === "drawing" ? "✓ Bạn đã đoán đúng — chờ hết lượt!" : heartNote || "\u00A0"}
                  </div>
                </div>
              )}
            </div>

            <div className="sb-side sb-side-chat">
              <div className="sb-chat-log sb-chat-flex" ref={chatLogRef}>
                {visChat.map(m => <ChatMessage key={m.key} m={m} />)}
                {typingLive.filter(s => !correctOrder.includes(s)).map(s => (
                  <div key={`typing-${s}`} className="sb-msg"><span className="who">{players[s].name}</span> đang gõ…</div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {isDrawer && phase === "choosingWord" && (
          <div className="sb-overlay">
            <div className="sb-modal">
              <div className="sb-modal-top">
                <span>Lượt vẽ của bạn</span>
                <span className="sb-choose-clock">⏱ {cd}s</span>
              </div>
              <div className="sb-modal-title">Chọn từ để vẽ</div>
              <div className="sb-choose-list">
                {(game.wordChoices || []).map(c => (
                  <button key={c.word} className="sb-choice-btn" onClick={() => handleChoose(c)}>
                    <span className="sb-choice-word">{c.word}</span>
                    <span className="sb-choice-cat">🖍 {c.category}</span>
                  </button>
                ))}
                {!(game.wordChoices || []).length && <p className="sb-hint" style={{ textAlign: "center" }}>Đang tải từ…</p>}
              </div>
              <p className="sb-hint" style={{ textAlign: "center", marginTop: 14 }}>Hết giờ sẽ tự chọn ngẫu nhiên.</p>
            </div>
          </div>
        )}
        {toast && <div className="sb-toast">{toast}</div>}
      </div>
    );
  }

  return <div className="sb-root"><Loading /></div>;
}