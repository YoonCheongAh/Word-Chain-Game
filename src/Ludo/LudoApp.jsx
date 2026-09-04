import { useState, useEffect, useRef } from "react";
import { createRoom, joinRoom, listenRoom, setPlayerOnline } from "../roomService";
import { playSound, setMuted } from "./Ludosound";
import {
    startLudoGame, rollDiceFirebase, movePawn, passTurnFirebase, requestLudoRematch,
    POINTS, START_POSITIONS, PATH, calcAvailableMoves, shouldPassTurn,
} from "./ludoService";
import { ref, onValue, onDisconnect, update } from "firebase/database";
import { db } from "../firebase";

/* ─── ASSET PATHS ─────────────────────────────────────── */
const ASSETS = {
    board: "/Resources/horseraceboard.png",
    pawns: {
        r: "/Resources/red.png",
        g: "/Resources/green.png",
        y: "/Resources/yellow.png",
        b: "/Resources/blue.png",
    },
    die: "/Resources/die.png",
};

const COLOR_HEX = { r: "#ff4d4d", g: "#22c55e", y: "#facc15", b: "#3b82f6" };
const COLOR_GLOW = { r: "#ff7b7b", g: "#5eead4", y: "#fde68a", b: "#93c5fd" };
const COLOR_LABELS = { r: "Đỏ", g: "Xanh lá", y: "Vàng", b: "Xanh dương" };
const PLAYER_SLOTS = ["player1", "player2", "player3", "player4"];
const MEDALS = ["🥇", "🥈", "🥉", "4️⃣"];

/* ─── STYLES ──────────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Fredoka:wght@500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --c-bg: #0a0e1a; --c-surface: #131a2b; --c-surface2: #1b2438;
    --c-border: #2a3550; --c-text: #eef2ff; --c-muted: #8b96b8;
    --c-green: #22c55e; --c-green-dim: #0f2e1c;
    --c-red: #ff4d4d; --c-red-dim: #34161a;
    --c-yellow: #facc15; --c-yellow-dim: #332a07;
    --c-blue: #3b82f6; --c-blue-dim: #122443;
    --grad-1: linear-gradient(135deg,#3b82f6,#22c55e);
    --grad-2: linear-gradient(135deg,#ff4d4d,#facc15);
  }
  .ludo-app {
    width:100%; max-width:620px; margin:0 auto; padding:16px 12px 80px;
    font-family:'Nunito',sans-serif; color:var(--c-text);
    background:
      radial-gradient(900px 500px at 15% -10%, rgba(59,130,246,.14), transparent 60%),
      radial-gradient(900px 500px at 85% 10%, rgba(34,197,94,.12), transparent 60%),
      radial-gradient(700px 500px at 50% 110%, rgba(250,204,21,.08), transparent 60%),
      var(--c-bg);
    min-height:100vh;
  }

  /* ── LOBBY ── */
  .ludo-lobby-wrap { padding-top:32px; animation:floatIn .5s ease; }
  @keyframes floatIn { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
  .ludo-logo { text-align:center; margin-bottom:8px; perspective:600px; }
  .ludo-logo-text {
    font-family:'Fredoka',sans-serif; font-size:60px; font-weight:700; letter-spacing:1px; line-height:1;
    display:inline-flex; gap:1px; transform-style:preserve-3d;
  }
  .ludo-logo-text span {
    display:inline-block; position:relative;
    text-shadow:0 2px 0 rgba(0,0,0,.25), 0 6px 18px rgba(0,0,0,.4);
    animation:letterPop .6s cubic-bezier(.34,1.6,.5,1) backwards, letterFloat 3s ease-in-out infinite;
  }
  .ludo-logo-text span:nth-child(1){ animation-delay:.05s,1s }
  .ludo-logo-text span:nth-child(2){ animation-delay:.12s,1.15s }
  .ludo-logo-text span:nth-child(3){ animation-delay:.19s,1.3s }
  .ludo-logo-text span:nth-child(4){ animation-delay:.26s,1.45s }
  @keyframes letterPop { from{opacity:0;transform:translateY(24px) rotateX(-60deg) scale(.6)} to{opacity:1;transform:none} }
  @keyframes letterFloat { 0%,100%{transform:translateY(0) rotate(0)} 50%{transform:translateY(-8px) rotate(-2deg)} }
  .ludo-top-logo {
    font-family:'Fredoka',sans-serif; font-size:24px; font-weight:700; letter-spacing:.5px;
    display:inline-flex; gap:1px;
  }
  .ludo-top-logo span { text-shadow:0 1px 0 rgba(0,0,0,.25), 0 3px 8px rgba(0,0,0,.35); }
  .ludo-logo-sub { text-align:center; font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--c-muted); margin-bottom:6px; }
  .ludo-dots-deco { display:flex; gap:8px; justify-content:center; margin-bottom:26px; }
  .ludo-dots-deco span { width:11px; height:11px; border-radius:50%; animation:bob 1.4s ease-in-out infinite; box-shadow:0 0 12px currentColor; }
  .ludo-dots-deco span:nth-child(2){ animation-delay:.15s } .ludo-dots-deco span:nth-child(3){ animation-delay:.3s } .ludo-dots-deco span:nth-child(4){ animation-delay:.45s }
  @keyframes bob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
  .ludo-card {
    background:linear-gradient(180deg, rgba(27,36,56,.9), rgba(19,26,43,.9));
    border:1px solid var(--c-border); border-radius:18px; padding:20px;
    margin-bottom:14px; backdrop-filter:blur(8px);
    box-shadow:0 12px 40px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.04);
  }
  .ludo-card-title { font-size:11px; font-weight:800; color:var(--c-muted); letter-spacing:2px; text-transform:uppercase; margin-bottom:14px; display:flex; align-items:center; gap:8px; }
  .ludo-card-title::before { content:''; width:14px; height:14px; border-radius:5px; background:var(--grad-1); }
  .ludo-card.join .ludo-card-title::before { background:var(--grad-2); }
  .ludo-inp { width:100%; background:rgba(10,14,26,.7); border:1.5px solid var(--c-border); border-radius:12px; color:var(--c-text); font-family:'Nunito',sans-serif; font-size:15px; padding:12px 15px; outline:none; transition:border-color .15s, box-shadow .15s; margin-bottom:11px; display:block; }
  .ludo-inp:focus { border-color:var(--c-green); box-shadow:0 0 0 3px rgba(34,197,94,.16); }
  .ludo-inp::placeholder { color:var(--c-muted); }
  .ludo-inp-mono { font-family:'JetBrains Mono',monospace; letter-spacing:3px; font-size:14px; }
  .ludo-btn { display:block; width:100%; padding:13px 16px; border-radius:12px; border:none; cursor:pointer; font-family:'Nunito',sans-serif; font-size:14px; font-weight:800; transition:opacity .15s,transform .1s,box-shadow .15s; text-align:center; }
  .ludo-btn:active { transform:scale(.98); }
  .ludo-btn:disabled { opacity:.35; cursor:not-allowed; }
  .ludo-btn-primary { background:var(--grad-1); color:#fff; box-shadow:0 8px 22px rgba(34,197,94,.28); }
  .ludo-btn-primary:hover:not(:disabled) { box-shadow:0 10px 28px rgba(34,197,94,.4); }
  .ludo-btn-secondary { background:rgba(255,255,255,.04); color:var(--c-text); border:1.5px solid var(--c-border); }
  .ludo-btn-secondary:hover:not(:disabled) { border-color:var(--c-blue); background:rgba(59,130,246,.1); }
  .ludo-btn-danger { background:transparent; color:var(--c-red); border:1.5px solid var(--c-red-dim); margin-top:10px; }
  .ludo-btn-danger:hover:not(:disabled) { background:var(--c-red-dim); }
  .ludo-err { color:var(--c-red); font-size:12px; font-family:'JetBrains Mono',monospace; margin-top:8px; text-align:center; }

  /* ── ROOM ── */
  .ludo-room-code-wrap { text-align:center; padding:10px 0 4px; }
  .ludo-room-code {
    font-family: 'DM Mono', monospace; font-size: 44px; font-weight: 500;
    letter-spacing: 10px; text-align: center; padding: 18px 0 4px;
    background: linear-gradient(120deg, #1D9E75, #378ADD);
    -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
    transition: transform .15s;
  }
  .ludo-room-code:hover { opacity:.75; }
  .ludo-room-hint { text-align:center; font-size:11px; color:var(--c-muted); font-family:'JetBrains Mono',monospace; margin-bottom:14px; }
  .ludo-divider { border:none; border-top:1px solid var(--c-border); margin:14px 0; }
  .ludo-player-row { display:flex; align-items:center; gap:11px; padding:10px; border-radius:12px; margin-bottom:6px; background:rgba(10,14,26,.4); border:1px solid transparent; transition:border-color .2s; }
  .ludo-player-row.filled { border-color:var(--c-border); }
  .ludo-av { width:36px; height:36px; border-radius:11px; display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:900; flex-shrink:0; color:#fff; box-shadow:0 4px 12px rgba(0,0,0,.3); }
  .ludo-av-empty { background:var(--c-surface2); color:var(--c-muted); box-shadow:none; }
  .ludo-p-name { font-size:15px; font-weight:800; flex:1; }
  .ludo-p-name-empty { color:var(--c-muted); font-weight:500; }
  .ludo-p-tag { font-size:10px; font-weight:700; font-family:'JetBrains Mono',monospace; padding:3px 9px; border-radius:20px; }
  .ludo-tag-host { background:rgba(34,197,94,.15); color:var(--c-green); }
  .ludo-tag-join  { background:rgba(59,130,246,.15); color:var(--c-blue); }
  .ludo-tag-wait  { background:var(--c-surface2); color:var(--c-muted); }
  .ludo-tag-you   { background:rgba(255,255,255,.08); color:#aab; font-size:9px; margin-left:6px; padding:2px 7px; border-radius:20px; }
  .pulse { animation:pulse 1.6s ease-in-out infinite; }
  @keyframes pulse { 0%,100%{opacity:1}50%{opacity:.35} }

  /* ── GAME ── */
  .ludo-game-wrap { display:flex; flex-direction:column; gap:12px; animation:floatIn .4s ease; }
  .ludo-top-bar { display:flex; align-items:center; justify-content:space-between; }
  .ludo-top-room { font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--c-muted); }
  .ludo-turn-bar {
    display:flex; align-items:center; gap:11px; border-radius:14px; padding:12px 16px;
    border:1px solid var(--c-border); transition:background .3s, box-shadow .3s;
  }
  .ludo-turn-bar.mine { box-shadow:0 0 0 1.5px var(--turn-c), 0 8px 26px -8px var(--turn-c); }
  .ludo-turn-dot { width:15px; height:15px; border-radius:50%; flex-shrink:0; box-shadow:0 0 10px var(--turn-c); animation:pulse 1.6s ease-in-out infinite; }
  .ludo-turn-name { font-size:15px; font-weight:800; flex:1; }
  .ludo-turn-phase { font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--c-muted); }
  .ludo-board-wrap {
    position:relative; width:100%; border-radius:16px; overflow:hidden;
    border:3px solid var(--c-border);
    box-shadow:0 20px 50px rgba(0,0,0,.5), inset 0 0 0 1px rgba(255,255,255,.03);
  }
  .ludo-board-img { width:100%; display:block; user-select:none; }
  .ludo-board-fallback { width:100%; aspect-ratio:1; display:flex; align-items:center; justify-content:center; background:#1a1a2e; color:var(--c-muted); font-family:'JetBrains Mono',monospace; font-size:13px; text-align:center; padding:20px; }
  .ludo-pawns-layer { position:absolute; inset:0; }
  .ludo-pawn { position:absolute; transition:left .28s cubic-bezier(.34,1.56,.64,1),top .28s cubic-bezier(.34,1.56,.64,1); cursor:default; filter:drop-shadow(0 3px 4px rgba(0,0,0,.6)); }
  .ludo-pawn.movable { cursor:pointer; animation:pawnPulse .85s ease-in-out infinite; filter:drop-shadow(0 0 8px #fff) drop-shadow(0 3px 5px rgba(0,0,0,.6)); }
  @keyframes pawnPulse { 0%,100%{transform:scale(1)}50%{transform:scale(1.22)} }

  /* ── 3D DICE ── */
  .ludo-dice-panel { display:flex; align-items:center; gap:16px; background:linear-gradient(180deg, rgba(27,36,56,.9), rgba(19,26,43,.9)); border:1px solid var(--c-border); border-radius:16px; padding:14px 16px; box-shadow:0 10px 30px rgba(0,0,0,.3); }
  .dice-scene { width:62px; height:62px; flex-shrink:0; perspective:340px; }
  .dice-cube {
    width:100%; height:100%; position:relative; transform-style:preserve-3d;
    transition:transform .9s cubic-bezier(.3,1.1,.4,1);
  }
  .dice-cube.rolling { animation:tumble .5s linear infinite; }
  @keyframes tumble {
    0%{transform:rotateX(0) rotateY(0)}
    100%{transform:rotateX(360deg) rotateY(360deg)}
  }
  .dice-face {
    position:absolute; width:62px; height:62px; border-radius:13px;
    background:linear-gradient(145deg,#ffffff,#dfe4ee);
    box-shadow:inset 0 0 0 1px rgba(0,0,0,.06), inset 4px 4px 8px rgba(255,255,255,.7), inset -4px -4px 8px rgba(0,0,0,.12);
    display:grid; grid-template-columns:repeat(3,1fr); grid-template-rows:repeat(3,1fr);
    padding:9px; gap:2px;
  }
  .dice-pip { width:9px; height:9px; border-radius:50%; align-self:center; justify-self:center;
    background:radial-gradient(circle at 35% 30%, #4b5563, #111827);
    box-shadow:inset -1px -1px 2px rgba(0,0,0,.5); }
  /* pip grid placement */
  .p-tl{grid-area:1/1} .p-tr{grid-area:1/3} .p-ml{grid-area:2/1} .p-c{grid-area:2/2} .p-mr{grid-area:2/3} .p-bl{grid-area:3/1} .p-br{grid-area:3/3}
  .face-1{ transform:rotateY(0deg) translateZ(31px) }
  .face-2{ transform:rotateY(180deg) translateZ(31px) }
  .face-3{ transform:rotateY(90deg) translateZ(31px) }
  .face-4{ transform:rotateY(-90deg) translateZ(31px) }
  .face-5{ transform:rotateX(90deg) translateZ(31px) }
  .face-6{ transform:rotateX(-90deg) translateZ(31px) }
  /* show face N facing camera */
  .show-1{ transform:rotateX(-12deg) rotateY(0deg) }
  .show-2{ transform:rotateX(-12deg) rotateY(-180deg) }
  .show-3{ transform:rotateX(-12deg) rotateY(-90deg) }
  .show-4{ transform:rotateX(-12deg) rotateY(90deg) }
  .show-5{ transform:rotateX(-90deg) rotateY(0deg) }
  .show-6{ transform:rotateX(90deg) rotateY(0deg) }

  .ludo-roll-btn { flex:1; padding:15px; border-radius:12px; border:none; cursor:pointer; font-family:'Nunito',sans-serif; font-size:15px; font-weight:900; background:var(--grad-1); color:#fff; transition:opacity .15s,transform .1s,box-shadow .15s; box-shadow:0 8px 22px rgba(34,197,94,.28); }
  .ludo-roll-btn:hover:not(:disabled) { box-shadow:0 10px 28px rgba(34,197,94,.4); }
  .ludo-roll-btn:active:not(:disabled) { transform:scale(.97); }
  .ludo-roll-btn:disabled { opacity:.35; cursor:not-allowed; box-shadow:none; background:var(--c-surface2); }

  .ludo-notice { text-align:center; font-family:'JetBrains Mono',monospace; font-size:12px; padding:9px 12px; border-radius:10px; animation:fadeInN .2s ease; }
  @keyframes fadeInN { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
  .ludo-notice-info    { background:var(--c-surface);    color:var(--c-muted);   border:1px solid var(--c-border); }
  .ludo-notice-success { background:var(--c-green-dim);  color:var(--c-green);   border:1px solid #1c5234; }
  .ludo-notice-danger  { background:var(--c-red-dim);    color:var(--c-red);     border:1px solid #5a2a2a; }
  .ludo-notice-warn    { background:var(--c-yellow-dim); color:var(--c-yellow);  border:1px solid #5a4500; }
  .ludo-moves-hint { font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--c-yellow); text-align:center; }
  .ludo-score-row { display:flex; gap:8px; flex-wrap:wrap; }
  .ludo-score-chip { display:flex; align-items:center; gap:6px; background:var(--c-surface); border:1px solid var(--c-border); border-left-style:solid; border-radius:10px; padding:7px 11px; font-size:12px; }
  .ludo-sidebar { position:fixed; right:8px; top:50%; transform:translateY(-50%); display:flex; flex-direction:column; gap:9px; z-index:10; }
  .ludo-sidebar-card { background:linear-gradient(180deg, rgba(27,36,56,.95), rgba(19,26,43,.95)); border:1.5px solid var(--c-border); border-radius:13px; padding:9px; min-width:74px; max-width:74px; transition:border-color .25s, box-shadow .25s; }
  .ludo-sidebar-name { font-size:9px; font-family:'JetBrains Mono',monospace; color:var(--c-muted); text-align:center; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-bottom:5px; }
  .ludo-sidebar-pawns { display:flex; flex-wrap:wrap; gap:3px; justify-content:center; }
  .ludo-sidebar-dot { width:14px; height:14px; border-radius:50%; }
  .ludo-sidebar-score { font-family:'JetBrains Mono',monospace; font-size:10px; text-align:center; margin-top:5px; font-weight:700; }
  .ludo-gameover { padding-top:28px; animation:floatIn .5s ease; }
  .ludo-go-card { background:linear-gradient(180deg, rgba(27,36,56,.95), rgba(19,26,43,.95)); border:1px solid var(--c-border); border-radius:20px; padding:26px 22px; box-shadow:0 20px 50px rgba(0,0,0,.4); }
  .ludo-go-icon  { text-align:center; font-size:46px; margin-bottom:8px; filter:drop-shadow(0 4px 12px rgba(250,204,21,.4)); }
  .ludo-go-title { font-size:26px; font-weight:900; text-align:center; margin-bottom:4px; }
  .ludo-go-sub   { font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--c-muted); text-align:center; margin-bottom:20px; }
  .ludo-lb-row { display:flex; align-items:center; gap:10px; padding:11px 14px; border-radius:12px; background:rgba(10,14,26,.5); margin-bottom:6px; border:1px solid transparent; }
  .ludo-lb-row.me { border-color:var(--c-green); }
  .ludo-lb-rank { font-size:20px; min-width:28px; }
  .ludo-lb-name { flex:1; font-size:14px; font-weight:800; }
  .ludo-dot { display:inline-block; width:9px; height:9px; border-radius:50%; margin-right:6px; }
  .ludo-lb-me { font-size:9px; color:var(--c-muted); font-family:'JetBrains Mono',monospace; }
  .ludo-rematch-hint { font-size:11px; font-family:'JetBrains Mono',monospace; color:var(--c-yellow); text-align:center; margin-top:8px; }
  .ludo-toast { position:fixed; bottom:24px; left:50%; transform:translateX(-50%); background:var(--grad-1); color:#fff; font-family:'JetBrains Mono',monospace; font-size:12px; padding:9px 18px; border-radius:24px; z-index:999; pointer-events:none; box-shadow:0 8px 24px rgba(0,0,0,.4); }
  .ludo-dissolved-overlay { position:fixed; inset:0; background:rgba(10,14,26,.94); display:flex; align-items:center; justify-content:center; z-index:100; backdrop-filter:blur(4px); }
  .ludo-dissolved-box { text-align:center; padding:30px 24px; background:var(--c-surface); border:1px solid var(--c-red-dim); border-radius:18px; max-width:280px; }
  .ludo-dissolved-box h2 { font-size:17px; font-weight:800; margin:8px 0 4px; }
  .ludo-dissolved-box p  { font-size:11px; color:var(--c-muted); font-family:'JetBrains Mono',monospace; margin-bottom:16px; }
  .ludo-loading { padding-top:60px; text-align:center; color:var(--c-muted); font-family:'JetBrains Mono',monospace; font-size:13px; }
  .ludo-mute-btn { background:rgba(255,255,255,.04); border:1px solid var(--c-border); border-radius:10px; color:var(--c-muted); cursor:pointer; font-size:16px; line-height:1; padding:7px 11px; transition:border-color .15s; }
  .ludo-mute-btn:hover { border-color:var(--c-blue); }
`;

/* ─── 3D DICE COMPONENT ───────────────────────────────── */
const PIP_MAP = {
    1: ["p-c"],
    2: ["p-tl", "p-br"],
    3: ["p-tl", "p-c", "p-br"],
    4: ["p-tl", "p-tr", "p-bl", "p-br"],
    5: ["p-tl", "p-tr", "p-c", "p-bl", "p-br"],
    6: ["p-tl", "p-tr", "p-ml", "p-mr", "p-bl", "p-br"],
};

function DiceFace({ value, faceClass }) {
    const pips = PIP_MAP[value] || [];
    return (
        <div className={`dice-face ${faceClass}`}>
            {pips.map((cls) => <span key={cls} className={`dice-pip ${cls}`} />)}
        </div>
    );
}

function Dice3D({ value, rolling }) {
    const showClass = rolling ? "" : `show-${value || 1}`;
    return (
        <div className="dice-scene">
            <div className={`dice-cube ${rolling ? "rolling" : ""} ${showClass}`}>
                <DiceFace value={1} faceClass="face-1" />
                <DiceFace value={2} faceClass="face-2" />
                <DiceFace value={3} faceClass="face-3" />
                <DiceFace value={4} faceClass="face-4" />
                <DiceFace value={5} faceClass="face-5" />
                <DiceFace value={6} faceClass="face-6" />
            </div>
        </div>
    );
}

export default function LudoApp() {
    const [screen, setScreen] = useState("lobby");
    const [name, setName] = useState("");
    const [inputRoomId, setInputRoomId] = useState("");
    const [roomId, setRoomId] = useState("");
    const [myRole, setMyRole] = useState("");
    const [roomData, setRoomData] = useState(null);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState(null);
    const [copiedToast, setCopiedToast] = useState(false);
    const [dissolved, setDissolved] = useState(false);
    const [rolling, setRolling] = useState(false);
    const [boardW, setBoardW] = useState(400);
    const [boardImgOk, setBoardImgOk] = useState(true);
    const [mute, setMute] = useState(false);

    const boardWrapRef = useRef(null);
    const prevTurnRef = useRef(null);
    const prevCompleteRef = useRef(0);
    const prevRoundOver = useRef(false);

    /* shortcuts */
    const ludo = roomData?.ludo;
    const players = roomData?.players;
    const playerCount = Object.keys(players || {}).length;
    const myColor = ludo?.colorMap?.[myRole];
    const myPD = ludo?.playerData?.[myRole];
    const currentTurn = ludo?.currentTurn;
    const isMyTurn = currentTurn === myRole;
    const phase = ludo?.phase;
    const dice = ludo?.dice ?? [];
    const cachePath = ludo?.cachePath ?? {};

    const availableMoves = (() => {
        if (!ludo || !myPD || !isMyTurn || phase !== "move" || dice.length === 0) return [];
        return calcAvailableMoves(myPD.pawns, dice, myColor, cachePath);
    })();

    /* CSS inject */
    useEffect(() => {
        const id = "ludo-styles";
        if (!document.getElementById(id)) {
            const el = document.createElement("style");
            el.id = id; el.textContent = STYLES;
            document.head.appendChild(el);
        }
        return () => document.getElementById(id)?.remove();
    }, []);

    /* Board resize observer */
    useEffect(() => {
        if (!boardWrapRef.current) return;
        const ro = new ResizeObserver(entries => setBoardW(entries[0].contentRect.width));
        ro.observe(boardWrapRef.current);
        return () => ro.disconnect();
    });

    /* Presence */
    useEffect(() => {
        if (!roomId || !myRole) return;
        const unsub = onValue(ref(db, ".info/connected"), snap => {
            if (snap.val()) {
                update(ref(db, `rooms/${roomId}/players/${myRole}`), { online: true });
                onDisconnect(ref(db, `rooms/${roomId}/players/${myRole}/online`)).set(false);
            }
        });
        return () => unsub();
    }, [roomId, myRole]);

    /* Listen room */
    useEffect(() => {
        if (!roomId) return;
        return listenRoom(roomId, data => setRoomData(data));
    }, [roomId]);

    /* Screen transitions */
    useEffect(() => {
        if (!roomData) return;
        const s = roomData.status;
        if (s === "playing" && screen !== "game") setScreen("game");
        if (s === "dissolved") setDissolved(true);
        if ((s === "waiting" || s === "ready") && screen === "lobby" && roomId) setScreen("room");
    }, [roomData?.status]);

    /* Notice auto-clear */
    useEffect(() => {
        if (!notice) return;
        const t = setTimeout(() => setNotice(null), 2500);
        return () => clearTimeout(t);
    }, [notice]);

    /* Auto-pass when no legal moves */
    useEffect(() => {
        if (!ludo || !isMyTurn || phase !== "move" || dice.length === 0) return;
        if (availableMoves.length > 0) return;
        const t = setTimeout(() => {
            playSound("pass");
            setNotice({ text: "Không có nước đi, bỏ lượt!", type: "warn" });
            passTurnFirebase(roomId, myRole);
        }, 900);
        return () => clearTimeout(t);
    }, [phase, JSON.stringify(dice), isMyTurn]);

    /* Sound: your turn */
    useEffect(() => {
        if (!ludo || !isMyTurn) return;
        if (prevTurnRef.current !== null && prevTurnRef.current !== currentTurn) {
            playSound("turn");
        }
        prevTurnRef.current = currentTurn;
    }, [currentTurn, isMyTurn]);

    /* Sound: pawn reaches home */
    useEffect(() => {
        if (!myPD) return;
        const count = myPD.pawns.filter(p => p.complete).length;
        if (count > prevCompleteRef.current) {
            playSound("home");
        }
        prevCompleteRef.current = count;
    }, [myPD?.pawns]);

    /* Sound: win */
    useEffect(() => {
        if (!ludo?.roundOver || prevRoundOver.current) return;
        prevRoundOver.current = true;
        playSound("win");
    }, [ludo?.roundOver]);

    /* ─── Position → pixel ─────────────────────────────────────
     * Board is a 15×15 grid (600px base → 40px per cell).
     * Each pawn sits at the CENTER of its grid cell.
     * Correct center = col*cell + cell/2 (then minus half the pawn size).
     *
     * FIX: `stackIndex` must only be nonzero when multiple pawns truly
     * share a square. The caller used to pass each pawn's fixed array
     * index (0-3) as the offset, so pawn #2/#3/#4 of every color was
     * permanently nudged off-center even standing completely alone on
     * the track. Grouping pawns by position before rendering (see
     * render section below) and passing a real "how many pawns are on
     * this square, and which one am I" index fixes the visual drift
     * for all 4 colors. */
    function getPawnPixel(position, stackIndex = 0) {
        const pt = POINTS[position];
        if (!pt) return { left: 0, top: 0 };

        const BASE = 600;
        const CELLS = 15;
        const scale = boardW / BASE;
        const cell = (BASE / CELLS) * scale; // 40 * scale
        const col = pt[1];
        const row = pt[0];

        // true center of the cell
        const cellCenterX = (col + 0.5) * cell;
        const cellCenterY = (row + 0.5) * cell;

        const pawnSz = pawnW;
        const pawnH = pawnW * 1.15;

        // when multiple pawns share a cell, fan them out symmetrically
        // around the cell center so none of them drift off the square.
        // stackIndex is 0 whenever the pawn is alone on its square, so
        // spreadX/spreadY correctly stay 0 in that case.
        const fan = pawnSz * 0.2;
        const spreadX = stackIndex === 0 ? 0 : (stackIndex % 2 === 0 ? -fan : fan);
        const spreadY = stackIndex === 0 ? 0 : (stackIndex < 2 ? -fan : fan);

        // center the pawn box exactly on the cell center (both axes)
        const left = cellCenterX - pawnSz / 2 + spreadX;
        const top = cellCenterY - pawnH / 2 + spreadY;

        return { left, top };
    }

    const pawnW = Math.max(16, 30 * (boardW / 600));

    /* ─── Mute toggle ───────────────────────────────────────── */
    function handleToggleMute() {
        const next = !mute;
        setMute(next);
        setMuted(next);
        if (!next) playSound("click");
    }

    /* ─── Actions ───────────────────────────────────────────── */
    async function handleRoll() {
        if (!isMyTurn || phase !== "roll" || rolling) return;
        setRolling(true);
        playSound("dice");
        await rollDiceFirebase(roomId, myRole);
        setTimeout(() => setRolling(false), 550);
    }

    async function handlePawnClick(pawnId, color) {
        if (!isMyTurn || phase !== "move" || color !== myColor) return;
        const move = availableMoves.find(m => m.pawnId === pawnId);
        if (!move) return;

        const pawn = myPD?.pawns.find(p => p.id === pawnId);
        if (!pawn?.active) {
            playSound("enter");
        } else if (move.captureId) {
            playSound("capture");
        } else {
            playSound("move");
        }

        await movePawn(roomId, myRole, move);
    }

    /* ─── Lobby actions ─────────────────────────────────────── */
    async function handleCreate() {
        if (!name.trim()) return setError("Nhập tên của bạn!");
        setError("");
        playSound("click");
        const id = await createRoom(name.trim());
        setRoomId(id); setMyRole("player1"); setScreen("room");
    }

    async function handleJoin() {
        if (!name.trim()) return setError("Nhập tên của bạn!");
        if (!inputRoomId.trim()) return setError("Nhập mã phòng!");
        setError("");
        playSound("click");
        try {
            const slot = await joinRoom(inputRoomId.toUpperCase(), name.trim());
            setRoomId(inputRoomId.toUpperCase()); setMyRole(slot); setScreen("room");
        } catch (e) { setError(e.message); }
    }

    async function handleStart() {
        if (playerCount < 2) return;
        playSound("click");
        await startLudoGame(roomId);
    }

    async function handleRematch() {
        playSound("click");
        await requestLudoRematch(roomId, myRole);
    }

    function handleLeave() {
        playSound("click");
        setPlayerOnline(roomId, myRole, false);
        setRoomId(""); setMyRole(""); setRoomData(null);
        setScreen("lobby"); setDissolved(false); setError(""); setNotice(null);
    }

    function handleCopy() {
        navigator.clipboard?.writeText(roomId).catch(() => { });
        setCopiedToast(true);
        setTimeout(() => setCopiedToast(false), 1800);
    }

    /* ─── Sub-components ───────────────────────────────────── */
    const DissolvedOverlay = () => (
        <div className="ludo-dissolved-overlay">
            <div className="ludo-dissolved-box">
                <div style={{ fontSize: 36 }}>💨</div>
                <h2>Phòng đã đóng</h2>
                <p>Một người chơi đã thoát.</p>
                <button className="ludo-btn ludo-btn-primary" onClick={handleLeave}>Về trang chủ</button>
            </div>
        </div>
    );

    const MuteButton = () => (
        <button
            className="ludo-mute-btn"
            onClick={handleToggleMute}
            title={mute ? "Bật âm thanh" : "Tắt âm thanh"}
        >
            {mute ? "🔇" : "🔊"}
        </button>
    );

    function SidebarPanel() {
        const others = PLAYER_SLOTS.filter(r => r !== myRole && players?.[r] && ludo?.playerData?.[r]);
        if (!others.length) return null;
        return (
            <div className="ludo-sidebar">
                {others.map(role => {
                    const pd = ludo.playerData[role];
                    const col = pd.color;
                    const active = currentTurn === role;
                    return (
                        <div key={role} className="ludo-sidebar-card"
                            style={{
                                borderColor: active ? COLOR_HEX[col] : undefined,
                                boxShadow: active ? `0 0 16px -2px ${COLOR_HEX[col]}` : undefined,
                            }}>
                            <div className="ludo-sidebar-name">{players[role]?.name}</div>
                            <div className="ludo-sidebar-pawns">
                                {pd.pawns.map(p => (
                                    <div key={p.id} className="ludo-sidebar-dot"
                                        style={{ background: p.complete ? COLOR_HEX[col] : p.active ? COLOR_HEX[col] + "70" : "#2a2a2a" }} />
                                ))}
                            </div>
                            <div className="ludo-sidebar-score" style={{ color: COLOR_HEX[col] }}>
                                {pd.pawns.filter(p => p.complete).length}/4 🏠
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    /* ══════════════════════════════════════════════════════════
     *  RENDER
     * ══════════════════════════════════════════════════════════ */

    /* LOBBY */
    if (screen === "lobby") return (
        <div className="ludo-app">
            {dissolved && <DissolvedOverlay />}
            <div className="ludo-lobby-wrap">
                <div className="ludo-logo">
                    <div className="ludo-logo-text">
                        <span style={{ color: COLOR_HEX.r }}>C</span>
                        <span style={{ color: COLOR_HEX.g }}>ờ</span>
                        <span style={{ color: COLOR_HEX.y }}> Cá</span>
                        <span style={{ color: COLOR_HEX.b }}> Ngựa</span>
                    </div>
                </div>
                <p className="ludo-logo-sub">// 2–4 người · realtime · firebase</p>
                <div className="ludo-dots-deco">
                    <span style={{ background: COLOR_HEX.r, color: COLOR_HEX.r }} />
                    <span style={{ background: COLOR_HEX.g, color: COLOR_HEX.g }} />
                    <span style={{ background: COLOR_HEX.y, color: COLOR_HEX.y }} />
                    <span style={{ background: COLOR_HEX.b, color: COLOR_HEX.b }} />
                </div>
                <div className="ludo-card">
                    <div className="ludo-card-title">Tạo phòng mới</div>
                    <input className="ludo-inp" placeholder="Tên của bạn" value={name}
                        onChange={e => setName(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleCreate()} />
                    <button className="ludo-btn ludo-btn-primary" onClick={handleCreate}>Tạo phòng →</button>
                </div>
                <div className="ludo-card join">
                    <div className="ludo-card-title">Tham gia phòng</div>
                    <input className="ludo-inp" placeholder="Tên của bạn" value={name}
                        onChange={e => setName(e.target.value)} />
                    <input className="ludo-inp ludo-inp-mono" placeholder="MÃ PHÒNG" value={inputRoomId}
                        onChange={e => setInputRoomId(e.target.value.toUpperCase())}
                        onKeyDown={e => e.key === "Enter" && handleJoin()} />
                    <button className="ludo-btn ludo-btn-secondary" onClick={handleJoin}>Tham gia →</button>
                </div>
                {error && <p className="ludo-err">{error}</p>}
            </div>
        </div>
    );

    /* ROOM */
    if (screen === "room") return (
        <div className="ludo-app">
            {dissolved && <DissolvedOverlay />}
            <div className="ludo-card" style={{ marginTop: 28 }}>
                <div className="ludo-card-title">Mã phòng</div>
                <div className="ludo-room-code-wrap">
                    <div className="ludo-room-code" onClick={handleCopy}>{roomId}</div>
                </div>
                <div className="ludo-room-hint">nhấn để copy · {playerCount}/4 người</div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0 14px", padding: "10px 12px", background: "rgba(10,14,26,.5)", borderRadius: 12 }}>
                    {["r", "g", "y", "b"].map((c, i) => (
                        <div key={c} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontFamily: "'JetBrains Mono',monospace" }}>
                            <div style={{ width: 11, height: 11, borderRadius: "50%", background: COLOR_HEX[c], boxShadow: `0 0 8px ${COLOR_HEX[c]}` }} />
                            <span style={{ color: COLOR_HEX[c] }}>P{i + 1}: {COLOR_LABELS[c]}</span>
                        </div>
                    ))}
                </div>

                <hr className="ludo-divider" />
                {PLAYER_SLOTS.map((slot, idx) => {
                    const p = players?.[slot];
                    const isMe = slot === myRole;
                    const col = ["r", "g", "y", "b"][idx];
                    return (
                        <div className={`ludo-player-row${p ? " filled" : ""}`} key={slot}>
                            <div className="ludo-av" style={p
                                ? { background: COLOR_HEX[col], boxShadow: `0 4px 12px ${COLOR_HEX[col]}66` }
                                : undefined}>
                                {p ? p.name[0].toUpperCase() : idx + 1}
                            </div>
                            <div className={`ludo-p-name${!p ? " ludo-p-name-empty" : ""}`}>
                                {p?.name ?? "Chờ..."}
                                {isMe && <span className="ludo-p-tag ludo-tag-you">bạn</span>}
                            </div>
                            <span className={`ludo-p-tag ${idx === 0 ? "ludo-tag-host" : p ? "ludo-tag-join" : "ludo-tag-wait"} ${!p ? "pulse" : ""}`}>
                                {idx === 0 ? "host" : p ? "joined" : "waiting"}
                            </span>
                        </div>
                    );
                })}
                <hr className="ludo-divider" />
                {myRole === "player1"
                    ? <button className="ludo-btn ludo-btn-primary" onClick={handleStart} disabled={playerCount < 2}>
                        {playerCount < 2 ? `Chờ người... (${playerCount}/4)` : `▶ Bắt đầu — ${playerCount} người`}
                    </button>
                    : <p style={{ textAlign: "center", color: "var(--c-muted)", fontSize: 12, fontFamily: "'JetBrains Mono',monospace" }}>Chờ host bắt đầu...</p>
                }
                <button className="ludo-btn ludo-btn-danger" onClick={handleLeave}>Thoát phòng</button>
            </div>
            {copiedToast && <div className="ludo-toast">✓ Đã copy mã phòng!</div>}
        </div>
    );

    /* GAME OVER */
    if (ludo?.roundOver) {
        const pd = ludo.playerData || {};
        const sorted = Object.entries(pd)
            .map(([role, d]) => ({ role, name: players?.[role]?.name ?? role, color: d.color, done: d.pawns.filter(p => p.complete).length }))
            .sort((a, b) => b.done - a.done);
        const winnerName = players?.[ludo.winner]?.name ?? "???";
        const myRematch = ludo.rematch?.[myRole];
        const rematchCnt = Object.keys(ludo.rematch || {}).length;
        return (
            <div className="ludo-app">
                {dissolved && <DissolvedOverlay />}
                <div className="ludo-gameover">
                    <div className="ludo-go-card">
                        <div className="ludo-go-icon">🏆</div>
                        <div className="ludo-go-title">{winnerName} thắng!</div>
                        <div className="ludo-go-sub">Cờ cá ngựa · {playerCount} người</div>
                        <div style={{ marginBottom: 16 }}>
                            {sorted.map((p, i) => (
                                <div key={p.role} className={`ludo-lb-row${p.role === myRole ? " me" : ""}`}>
                                    <span className="ludo-lb-rank">{MEDALS[i] ?? ""}</span>
                                    <span className="ludo-lb-name">
                                        <span className="ludo-dot" style={{ background: COLOR_HEX[p.color] }} />
                                        {p.name}
                                        {p.role === myRole && <span className="ludo-lb-me"> (bạn)</span>}
                                    </span>
                                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: COLOR_HEX[p.color] }}>{p.done}/4 🏠</span>
                                </div>
                            ))}
                        </div>
                        <button className="ludo-btn ludo-btn-primary" onClick={handleRematch} disabled={!!myRematch} style={{ marginBottom: 8 }}>
                            {myRematch ? "Đã sẵn sàng ✓" : "Chơi lại"}
                        </button>
                        <button className="ludo-btn ludo-btn-danger" onClick={handleLeave}>Về trang chủ</button>
                        {myRematch && <p className="ludo-rematch-hint">{rematchCnt}/{playerCount} người sẵn sàng...</p>}
                    </div>
                </div>
            </div>
        );
    }

    /* LOADING */
    if (screen !== "game" || !ludo) return (
        <div className="ludo-app"><div className="ludo-loading">Đang tải...</div></div>
    );

    /* GAME */
    const curColor = ludo.colorMap?.[currentTurn];
    const curName = players?.[currentTurn]?.name ?? currentTurn;

    /* Build render list, then group by DISPLAYED board position so that
     * stacking offsets only apply to squares that truly hold >1 pawn.
     * (Fix for the "pawns look off-center" bug — see getPawnPixel above.) */
    const allPawns = [];
    if (ludo.playerData) {
        Object.entries(ludo.playerData).forEach(([role, pd]) => {
            pd.pawns.forEach((pawn) => {
                if (pawn.complete) return;
                const canMove = isMyTurn && phase === "move" && role === myRole
                    && availableMoves.some(m => m.pawnId === pawn.id);
                const key = `${role}-${pawn.id}`;
                allPawns.push({ role, pd, pawn, canMove, key, displayPos: pawn.position });
            });
        });
    }

    // group by displayed position to compute real stack sizes/indices
    const posGroups = {};
    allPawns.forEach(p => {
        (posGroups[p.displayPos] ||= []).push(p);
    });
    Object.values(posGroups).forEach(group => {
        group.forEach((p, i) => {
            p.stackIndex = group.length > 1 ? i : 0;
        });
    });

    return (
        <div className="ludo-app">
            {dissolved && <DissolvedOverlay />}
            <SidebarPanel />

            <div className="ludo-game-wrap">
                {/* Header */}
                <div className="ludo-top-bar">
                    <div className="ludo-top-logo">
                        <span style={{ color: COLOR_HEX.r }}>C</span>
                        <span style={{ color: COLOR_HEX.g }}>ờ</span>
                        <span style={{ color: COLOR_HEX.y }}> Cá</span>
                        <span style={{ color: COLOR_HEX.b }}> Ngựa</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div className="ludo-top-room">#{roomId}</div>
                        <MuteButton />
                    </div>
                </div>

                {/* Turn indicator */}
                <div className={`ludo-turn-bar${isMyTurn ? " mine" : ""}`}
                    style={{
                        "--turn-c": COLOR_HEX[curColor],
                        background: isMyTurn
                            ? `linear-gradient(135deg, ${COLOR_HEX[curColor]}22, rgba(19,26,43,.9))`
                            : "var(--c-surface)",
                    }}>
                    <div className="ludo-turn-dot" style={{ background: COLOR_HEX[curColor], "--turn-c": COLOR_HEX[curColor] }} />
                    <div className="ludo-turn-name">
                        {isMyTurn ? "✨ Lượt của bạn!" : `Lượt: ${curName}`}
                    </div>
                    <div className="ludo-turn-phase">
                        {phase === "roll" ? "🎲 tung xúc xắc" : phase === "move" ? "♟ chọn quân" : "..."}
                    </div>
                </div>

                {/* Notice */}
                {notice && <div className={`ludo-notice ludo-notice-${notice.type}`}>{notice.text}</div>}

                {/* Board */}
                <div className="ludo-board-wrap" ref={boardWrapRef}>
                    {boardImgOk
                        ? <img src={ASSETS.board} alt="board" className="ludo-board-img"
                            onError={() => setBoardImgOk(false)} />
                        : <div className="ludo-board-fallback" style={{ height: boardW }}>
                            [board image not loaded — check /Resources/horseraceboard.png]
                        </div>
                    }
                    <div className="ludo-pawns-layer">
                        {allPawns.map(({ role, pd, pawn, canMove, key, displayPos, stackIndex }) => {
                            const pos = getPawnPixel(displayPos, stackIndex);
                            return (
                                <img
                                    key={key}
                                    className={`ludo-pawn${canMove ? " movable" : ""}`}
                                    src={ASSETS.pawns[pd.color]}                                    
                                    alt={`${pd.color}${pawn.id}`}
                                    style={{
                                        left: pos.left,
                                        top: pos.top,
                                        width: pawnW,
                                        height: pawnW * 1.15,
                                        zIndex: canMove ? 20 : 10,
                                    }}
                                    onClick={() => handlePawnClick(pawn.id, pd.color)}
                                    onError={e => {
                                        e.target.style.display = "none";
                                        const div = document.createElement("div");
                                        div.style.cssText = `position:absolute;left:${pos.left}px;top:${pos.top}px;`
                                            + `width:${pawnW}px;height:${pawnW}px;border-radius:50%;`
                                            + `background:${COLOR_HEX[pd.color]};border:2px solid #fff;`
                                            + `z-index:${canMove ? 20 : 10};cursor:${canMove ? "pointer" : "default"}`;
                                        e.target.parentNode.appendChild(div);
                                    }}
                                />
                            );
                        })}
                    </div>
                </div>

                {/* Move hint */}
                {isMyTurn && phase === "move" && availableMoves.length > 0 && (
                    <div className="ludo-moves-hint">
                        ✨ {availableMoves.length} quân di chuyển được — nhấn vào quân sáng
                    </div>
                )}

                {/* Dice panel */}
                <div className="ludo-dice-panel">
                    <Dice3D value={dice[0]} rolling={rolling} />
                    <button className="ludo-roll-btn"
                        disabled={!isMyTurn || phase !== "roll" || rolling}
                        onClick={handleRoll}>
                        {!isMyTurn
                            ? `⏳ Chờ ${curName}...`
                            : phase === "roll"
                                ? rolling ? "🎲 Đang tung..." : "🎲 Tung xúc xắc"
                                : "Nhấn quân để đi →"
                        }
                    </button>
                </div>

                {/* Score chips */}
                <div className="ludo-score-row">
                    {ludo.playerData && Object.entries(ludo.playerData).map(([role, pd]) => (
                        <div key={role} className="ludo-score-chip"
                            style={{
                                borderLeftColor: role === myRole ? COLOR_HEX[pd.color] : "var(--c-border)",
                                borderLeftWidth: role === myRole ? 3 : 1,
                            }}>
                            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: COLOR_HEX[pd.color] }} />
                            <span style={{ fontWeight: 700, fontSize: 12 }}>{players?.[role]?.name}</span>
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: COLOR_HEX[pd.color] }}>
                                {pd.pawns.filter(p => p.complete).length}/4
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {copiedToast && <div className="ludo-toast">✓ Đã copy!</div>}
        </div>
    );
}