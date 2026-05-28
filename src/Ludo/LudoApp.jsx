import { useState, useEffect, useRef } from "react";
import { createRoom, joinRoom, listenRoom, setPlayerOnline } from "../roomService";
import { playSound, setMuted } from "./ludoSound";
import {
    startLudoGame, rollDiceFirebase, movePawn, passTurnFirebase, requestLudoRematch,
    POINTS, START_POSITIONS, PATH, calcAvailableMoves, shouldPassTurn,
} from "./ludoService";
import { ref, onValue, onDisconnect, update } from "firebase/database";
import { db } from "../firebase";

/* ─── ASSET PATHS ─────────────────────────────────────── */
const ASSETS = {
    board: "/src/Resources/horseraceboard.png",
    pawns: {
        r: "/src/Resources/red.png",
        g: "/src/Resources/green.png",
        y: "/src/Resources/yellow.png",
        b: "/src/Resources/blue.png",
    },
    die: "/src/Resources/die.png",
};

const COLOR_HEX = { r: "#e74c3c", g: "#27ae60", y: "#f1c40f", b: "#2980b9" };
const COLOR_LABELS = { r: "Đỏ", g: "Xanh lá", y: "Vàng", b: "Xanh dương" };
const PLAYER_SLOTS = ["player1", "player2", "player3", "player4"];
const MEDALS = ["🥇", "🥈", "🥉", "4️⃣"];

/* ─── STYLES ──────────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=JetBrains+Mono:wght@400;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --c-bg: #0d1117; --c-surface: #161b22; --c-surface2: #1c2128;
    --c-border: #30363d; --c-text: #e6edf3; --c-muted: #7d8590;
    --c-green: #27ae60; --c-green-dim: #1a3d24;
    --c-red: #e74c3c; --c-red-dim: #3d1a1a;
    --c-yellow: #f1c40f; --c-yellow-dim: #3a2f00;
    --c-blue: #2980b9; --c-blue-dim: #0d2340;
  }
  .ludo-app { width:100%; max-width:620px; padding:16px 12px 80px; font-family:'Nunito',sans-serif; color:var(--c-text); }
  .ludo-lobby-wrap { padding-top:28px; }
  .ludo-logo { text-align:center; margin-bottom:6px; }
  .ludo-logo-text { font-size:48px; font-weight:900; letter-spacing:-2px; line-height:1; }
  .ludo-logo-sub { text-align:center; font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--c-muted); margin-bottom:28px; }
  .ludo-card { background:var(--c-surface); border:1px solid var(--c-border); border-radius:12px; padding:18px; margin-bottom:12px; }
  .ludo-card-title { font-size:11px; font-weight:700; color:var(--c-muted); letter-spacing:1.5px; text-transform:uppercase; margin-bottom:12px; }
  .ludo-inp { width:100%; background:var(--c-bg); border:1px solid var(--c-border); border-radius:8px; color:var(--c-text); font-family:'Nunito',sans-serif; font-size:15px; padding:10px 13px; outline:none; transition:border-color .15s; margin-bottom:10px; display:block; }
  .ludo-inp:focus { border-color:var(--c-green); }
  .ludo-inp::placeholder { color:var(--c-muted); }
  .ludo-inp-mono { font-family:'JetBrains Mono',monospace; letter-spacing:3px; font-size:14px; }
  .ludo-btn { display:block; width:100%; padding:12px 16px; border-radius:8px; border:none; cursor:pointer; font-family:'Nunito',sans-serif; font-size:14px; font-weight:800; transition:opacity .15s,transform .1s; text-align:center; }
  .ludo-btn:active { transform:scale(.98); }
  .ludo-btn:disabled { opacity:.3; cursor:not-allowed; }
  .ludo-btn-primary { background:var(--c-green); color:#fff; }
  .ludo-btn-primary:hover:not(:disabled) { opacity:.85; }
  .ludo-btn-secondary { background:transparent; color:var(--c-text); border:1px solid var(--c-border); }
  .ludo-btn-secondary:hover:not(:disabled) { border-color:#555; background:var(--c-surface); }
  .ludo-btn-danger { background:transparent; color:var(--c-red); border:1px solid var(--c-red-dim); margin-top:8px; }
  .ludo-btn-danger:hover:not(:disabled) { background:var(--c-red-dim); }
  .ludo-err { color:var(--c-red); font-size:12px; font-family:'JetBrains Mono',monospace; margin-top:8px; text-align:center; }
  .ludo-room-code-wrap { text-align:center; padding:8px 0 4px; }
  .ludo-room-code { font-family:'JetBrains Mono',monospace; font-size:38px; font-weight:700; letter-spacing:8px; color:var(--c-green); cursor:pointer; transition:opacity .15s; }
  .ludo-room-code:hover { opacity:.75; }
  .ludo-room-hint { text-align:center; font-size:11px; color:var(--c-muted); font-family:'JetBrains Mono',monospace; margin-bottom:12px; }
  .ludo-divider { border:none; border-top:1px solid var(--c-border); margin:12px 0; }
  .ludo-player-row { display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid var(--c-surface2); }
  .ludo-player-row:last-child { border-bottom:none; }
  .ludo-av { width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:800; flex-shrink:0; }
  .ludo-av-0 { background:#1a3d24; color:#27ae60; }
  .ludo-av-1 { background:#0d2340; color:#2980b9; }
  .ludo-av-2 { background:#3a2f00; color:#f1c40f; }
  .ludo-av-3 { background:#3d1a1a; color:#e74c3c; }
  .ludo-av-empty { background:var(--c-surface2); color:var(--c-muted); }
  .ludo-p-name { font-size:14px; font-weight:700; flex:1; }
  .ludo-p-name-empty { color:var(--c-muted); font-weight:400; }
  .ludo-p-tag { font-size:10px; font-family:'JetBrains Mono',monospace; padding:2px 7px; border-radius:20px; }
  .ludo-tag-host { background:#1a3d24; color:#27ae60; }
  .ludo-tag-join  { background:#0d2340; color:#2980b9; }
  .ludo-tag-wait  { background:var(--c-surface2); color:var(--c-muted); }
  .ludo-tag-you   { background:var(--c-surface2); color:#666; font-size:9px; margin-left:4px; padding:2px 6px; }
  .pulse { animation:pulse 1.6s ease-in-out infinite; }
  @keyframes pulse { 0%,100%{opacity:1}50%{opacity:.35} }
  .ludo-game-wrap { display:flex; flex-direction:column; gap:10px; }
  .ludo-top-bar { display:flex; align-items:center; justify-content:space-between; }
  .ludo-top-logo { font-size:19px; font-weight:900; }
  .ludo-top-room { font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--c-muted); }
  .ludo-turn-bar { display:flex; align-items:center; gap:10px; background:var(--c-surface); border:1px solid var(--c-border); border-radius:10px; padding:10px 14px; }
  .ludo-turn-dot { width:13px; height:13px; border-radius:50%; flex-shrink:0; }
  .ludo-turn-name { font-size:14px; font-weight:700; flex:1; }
  .ludo-turn-phase { font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--c-muted); }
  .ludo-board-wrap { position:relative; width:100%; background:var(--c-surface2); border-radius:10px; overflow:hidden; border:2px solid var(--c-border); }
  .ludo-board-img { width:100%; display:block; user-select:none; }
  .ludo-board-fallback { width:100%; aspect-ratio:1; display:flex; align-items:center; justify-content:center; background:#1a1a2e; color:var(--c-muted); font-family:'JetBrains Mono',monospace; font-size:13px; }
  .ludo-pawns-layer { position:absolute; inset:0; }
  .ludo-pawn { position:absolute; transition:left .26s cubic-bezier(.4,0,.2,1),top .26s cubic-bezier(.4,0,.2,1); cursor:default; filter:drop-shadow(0 2px 4px rgba(0,0,0,.6)); }
  .ludo-pawn.movable { cursor:pointer; animation:pawnPulse .85s ease-in-out infinite; filter:drop-shadow(0 0 7px #fff) drop-shadow(0 2px 5px rgba(0,0,0,.6)); }
  @keyframes pawnPulse { 0%,100%{transform:scale(1)}50%{transform:scale(1.2)} }
  .ludo-dice-panel { display:flex; align-items:center; gap:12px; background:var(--c-surface); border:1px solid var(--c-border); border-radius:10px; padding:12px 14px; }
  .ludo-die-box { width:54px; height:54px; background:#fff; border-radius:8px; display:flex; align-items:center; justify-content:center; flex-shrink:0; overflow:hidden; }
  .ludo-die-box.rolling { animation:diceRoll .1s ease-in-out infinite; }
  @keyframes diceRoll { 0%,100%{transform:rotate(0)}25%{transform:rotate(-16deg)}75%{transform:rotate(16deg)} }
  .ludo-die-num { font-family:'JetBrains Mono',monospace; font-size:30px; font-weight:700; color:#222; }
  .ludo-die-img { width:100%; height:100%; object-fit:cover; }
  .ludo-roll-btn { flex:1; padding:14px; border-radius:8px; border:none; cursor:pointer; font-family:'Nunito',sans-serif; font-size:15px; font-weight:900; background:var(--c-green); color:#fff; transition:opacity .15s,transform .1s; }
  .ludo-roll-btn:hover:not(:disabled) { opacity:.85; }
  .ludo-roll-btn:active:not(:disabled) { transform:scale(.97); }
  .ludo-roll-btn:disabled { opacity:.3; cursor:not-allowed; }
  .ludo-notice { text-align:center; font-family:'JetBrains Mono',monospace; font-size:12px; padding:8px 12px; border-radius:8px; animation:fadeInN .2s ease; }
  @keyframes fadeInN { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
  .ludo-notice-info    { background:var(--c-surface);    color:var(--c-muted);   border:1px solid var(--c-border); }
  .ludo-notice-success { background:var(--c-green-dim);  color:var(--c-green);   border:1px solid #2a5a30; }
  .ludo-notice-danger  { background:var(--c-red-dim);    color:var(--c-red);     border:1px solid #5a2a2a; }
  .ludo-notice-warn    { background:var(--c-yellow-dim); color:var(--c-yellow);  border:1px solid #5a4500; }
  .ludo-moves-hint { font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--c-yellow); text-align:center; }
  .ludo-score-row { display:flex; gap:8px; flex-wrap:wrap; }
  .ludo-score-chip { display:flex; align-items:center; gap:6px; background:var(--c-surface); border:1px solid var(--c-border); border-radius:8px; padding:6px 10px; font-size:12px; }
  .ludo-sidebar { position:fixed; right:8px; top:50%; transform:translateY(-50%); display:flex; flex-direction:column; gap:8px; z-index:10; }
  .ludo-sidebar-card { background:var(--c-surface); border:1px solid var(--c-border); border-radius:10px; padding:8px 9px; min-width:72px; max-width:72px; }
  .ludo-sidebar-name { font-size:9px; font-family:'JetBrains Mono',monospace; color:var(--c-muted); text-align:center; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-bottom:4px; }
  .ludo-sidebar-pawns { display:flex; flex-wrap:wrap; gap:3px; justify-content:center; }
  .ludo-sidebar-dot { width:13px; height:13px; border-radius:50%; }
  .ludo-sidebar-score { font-family:'JetBrains Mono',monospace; font-size:10px; text-align:center; margin-top:4px; }
  .ludo-gameover { padding-top:24px; }
  .ludo-go-card { background:var(--c-surface); border:1px solid var(--c-border); border-radius:16px; padding:24px 20px; }
  .ludo-go-icon  { text-align:center; font-size:40px; margin-bottom:8px; }
  .ludo-go-title { font-size:24px; font-weight:900; text-align:center; margin-bottom:4px; }
  .ludo-go-sub   { font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--c-muted); text-align:center; margin-bottom:18px; }
  .ludo-lb-row { display:flex; align-items:center; gap:10px; padding:10px 13px; border-radius:10px; background:var(--c-bg); margin-bottom:5px; border:1px solid transparent; }
  .ludo-lb-row.me { border-color:#1a3d24; }
  .ludo-lb-rank { font-size:18px; min-width:26px; }
  .ludo-lb-name { flex:1; font-size:14px; font-weight:700; }
  .ludo-dot { display:inline-block; width:9px; height:9px; border-radius:50%; margin-right:5px; }
  .ludo-lb-me { font-size:9px; color:var(--c-muted); font-family:'JetBrains Mono',monospace; }
  .ludo-rematch-hint { font-size:11px; font-family:'JetBrains Mono',monospace; color:var(--c-yellow); text-align:center; margin-top:8px; }
  .ludo-toast { position:fixed; bottom:24px; left:50%; transform:translateX(-50%); background:var(--c-green); color:#fff; font-family:'JetBrains Mono',monospace; font-size:12px; padding:8px 16px; border-radius:20px; z-index:999; pointer-events:none; }
  .ludo-dissolved-overlay { position:fixed; inset:0; background:rgba(13,17,23,.93); display:flex; align-items:center; justify-content:center; z-index:100; }
  .ludo-dissolved-box { text-align:center; padding:30px 22px; background:var(--c-surface); border:1px solid var(--c-red-dim); border-radius:16px; max-width:280px; }
  .ludo-dissolved-box h2 { font-size:17px; font-weight:800; margin:8px 0 4px; }
  .ludo-dissolved-box p  { font-size:11px; color:var(--c-muted); font-family:'JetBrains Mono',monospace; margin-bottom:16px; }
  .ludo-loading { padding-top:60px; text-align:center; color:var(--c-muted); font-family:'JetBrains Mono',monospace; font-size:13px; }
  .ludo-mute-btn { background:transparent; border:1px solid var(--c-border); border-radius:8px; color:var(--c-muted); cursor:pointer; font-size:16px; line-height:1; padding:5px 9px; transition:border-color .15s; }
  .ludo-mute-btn:hover { border-color:#555; }
`;

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
    const [mute, setMute] = useState(false); // ← ĐÃ DI CHUYỂN VÀO ĐÂY

    const boardWrapRef = useRef(null);
    const prevTurnRef = useRef(null);       // ← ĐÃ DI CHUYỂN VÀO ĐÂY
    const prevCompleteRef = useRef(0);      // ← ĐÃ DI CHUYỂN VÀO ĐÂY
    const prevRoundOver = useRef(false);    // ← ĐÃ DI CHUYỂN VÀO ĐÂY

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

    /* ─── Position → pixel ───────────────────────────────────── */
    function getPawnPixel(position, offset = 0) {
        const pt = POINTS[position];
        if (!pt) return { left: 0, top: 0 };

        const BASE = 600;
        const scale = boardW / BASE;
        const col = pt[1];
        const row = pt[0];

        const rawLeft = (2 + 40 * col) * scale;
        const rawTop = (-15 + 40 * row) * scale;

        const pawnSz = Math.max(16, 32 * scale);
        const cell = 40 * scale;

        const left = rawLeft + (cell - pawnSz) / 2 + (offset % 2) * (pawnSz * 0.45);
        const top = rawTop + (cell - pawnSz) / 2 + Math.floor(offset / 2) * (pawnSz * 0.45);

        return { left, top };
    }

    const pawnW = Math.max(16, 32 * (boardW / 600));

    /* ─── Mute toggle ───────────────────────────────────────── */
    function handleToggleMute() {
        const next = !mute;
        setMute(next);
        setMuted(next);
        if (!next) playSound("click"); // phát tiếng khi BẬT lại
    }

    /* ─── Actions ───────────────────────────────────────────── */
    async function handleRoll() {
        if (!isMyTurn || phase !== "roll" || rolling) return;
        setRolling(true);
        playSound("dice");
        await rollDiceFirebase(roomId, myRole);
        setTimeout(() => setRolling(false), 350);
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
        if (move.captureId) setNotice({ text: "🎯 Bắt được quân đối thủ!", type: "success" });
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
                    return (
                        <div key={role} className="ludo-sidebar-card"
                            style={{ borderColor: currentTurn === role ? COLOR_HEX[col] + "80" : undefined }}>
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
                        <span style={{ color: "#e74c3c" }}>C</span>
                        <span style={{ color: "#27ae60" }}>ờ</span>
                        <span style={{ color: "#f1c40f" }}> Cá</span>
                        <span style={{ color: "#2980b9" }}> Ngựa</span>
                    </div>
                </div>
                <p className="ludo-logo-sub">// 2–4 người · realtime · firebase</p>
                <div className="ludo-card">
                    <div className="ludo-card-title">Tạo phòng mới</div>
                    <input className="ludo-inp" placeholder="Tên của bạn" value={name}
                        onChange={e => setName(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleCreate()} />
                    <button className="ludo-btn ludo-btn-primary" onClick={handleCreate}>Tạo phòng →</button>
                </div>
                <div className="ludo-card">
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
            <div className="ludo-card" style={{ marginTop: 24 }}>
                <div className="ludo-card-title">Mã phòng</div>
                <div className="ludo-room-code-wrap">
                    <div className="ludo-room-code" onClick={handleCopy}>{roomId}</div>
                </div>
                <div className="ludo-room-hint">nhấn để copy · {playerCount}/4 người</div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0 14px", padding: "8px 12px", background: "var(--c-surface2)", borderRadius: 8 }}>
                    {["r", "g", "y", "b"].map((c, i) => (
                        <div key={c} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontFamily: "'JetBrains Mono',monospace" }}>
                            <div style={{ width: 10, height: 10, borderRadius: "50%", background: COLOR_HEX[c] }} />
                            <span style={{ color: COLOR_HEX[c] }}>P{i + 1}: {COLOR_LABELS[c]}</span>
                        </div>
                    ))}
                </div>

                <hr className="ludo-divider" />
                {PLAYER_SLOTS.map((slot, idx) => {
                    const p = players?.[slot];
                    const isMe = slot === myRole;
                    return (
                        <div className="ludo-player-row" key={slot}>
                            <div className={`ludo-av ${p ? `ludo-av-${idx}` : "ludo-av-empty"}`}>
                                {p ? p.name[0].toUpperCase() : idx + 1}
                            </div>
                            <div className={`ludo-p-name${!p ? " ludo-p-name-empty" : ""}`}>
                                {p?.name ?? "Chờ..."}
                                {isMe && <span className="ludo-p-tag ludo-tag-you">bạn</span>}
                            </div>
                            {p && <div style={{ width: 9, height: 9, borderRadius: "50%", background: COLOR_HEX[["r", "g", "y", "b"][idx]] }} />}
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

    const allPawns = [];
    if (ludo.playerData) {
        Object.entries(ludo.playerData).forEach(([role, pd]) => {
            pd.pawns.forEach((pawn, idx) => {
                if (pawn.complete) return;
                const canMove = isMyTurn && phase === "move" && role === myRole
                    && availableMoves.some(m => m.pawnId === pawn.id);
                allPawns.push({ role, pd, pawn, idx, canMove });
            });
        });
    }

    return (
        <div className="ludo-app">
            {dissolved && <DissolvedOverlay />}
            <SidebarPanel />

            <div className="ludo-game-wrap">
                {/* Header */}
                <div className="ludo-top-bar">
                    <div className="ludo-top-logo">
                        <span style={{ color: "#e74c3c" }}>C</span>
                        <span style={{ color: "#27ae60" }}>ờ</span>
                        <span style={{ color: "#f1c40f" }}> Cá</span>
                        <span style={{ color: "#2980b9" }}> Ngựa</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div className="ludo-top-room">#{roomId}</div>
                        <MuteButton />
                    </div>
                </div>

                {/* Turn indicator */}
                <div className="ludo-turn-bar">
                    <div className="ludo-turn-dot" style={{ background: COLOR_HEX[curColor] }} />
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
                            [board image not loaded — check /src/Resources/horseraceboard.png]
                        </div>
                    }
                    <div className="ludo-pawns-layer">
                        {allPawns.map(({ role, pd, pawn, idx, canMove }) => {
                            const pos = getPawnPixel(pawn.position, idx);
                            return (
                                <img
                                    key={`${role}-${pawn.id}`}
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
                    <div className={`ludo-die-box${rolling ? " rolling" : ""}`}>
                        {dice.length > 0
                            ? <div className="ludo-die-num">{dice[0]}</div>
                            : <img src={ASSETS.die} alt="die" className="ludo-die-img"
                                onError={e => { e.target.style.display = "none"; }} />
                        }
                    </div>
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