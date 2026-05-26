import { useState, useEffect, useRef } from "react";
import { createRoom, joinRoom, listenRoom, setPlayerOnline } from "./roomService";
import { startGame, submitWord, loseLife, isValidWord, timeoutTurn, requestRematch } from "./gameService";

/* ─── CSS ─────────────────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Syne', sans-serif;
    background: #0a0a0f;
    color: #f0ede8;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .app { width: 100%; max-width: 560px; padding: 24px 16px; text-align: center; }

  .lobby-title {
    font-size: 52px; font-weight: 800; line-height: 1;
    letter-spacing: -2px; margin-bottom: 4px; text-align: center;
  }
  .lobby-title span { color: #1D9E75; }
  .lobby-sub { font-size: 13px; color: #555; margin-bottom: 36px; font-family: 'DM Mono', monospace; text-align: center; }

  .card {
    background: #13131a; border: 1px solid #222;
    border-radius: 16px; padding: 24px; margin-bottom: 12px;
  }
  .card-label {
    font-size: 11px; font-weight: 600; color: #555;
    letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 14px;
  }

  .input {
    width: 100%; background: #0a0a0f; border: 1px solid #2a2a35;
    border-radius: 10px; color: #f0ede8; font-family: 'DM Mono', monospace;
    font-size: 14px; padding: 12px 14px; outline: none;
    transition: border-color 0.15s; margin-bottom: 10px;
  }
  .input:focus { border-color: #1D9E75; }
  .input::placeholder { color: #333; }

  .btn {
    width: 100%; padding: 13px; border-radius: 10px; border: none;
    font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700;
    cursor: pointer; transition: opacity 0.15s, transform 0.1s;
  }
  .btn:active { transform: scale(0.98); }
  .btn:disabled { opacity: 0.35; cursor: not-allowed; }
  .btn-primary { background: #1D9E75; color: #fff; }
  .btn-primary:hover:not(:disabled) { opacity: 0.88; }
  .btn-outline { background: transparent; color: #f0ede8; border: 1px solid #2a2a35; }
  .btn-outline:hover:not(:disabled) { border-color: #444; background: #13131a; }

  .err { color: #e05c5c; font-size: 12px; font-family: 'DM Mono', monospace; margin-top: 8px; }

  .room-code {
    font-family: 'DM Mono', monospace; font-size: 40px; font-weight: 500;
    letter-spacing: 8px; color: #1D9E75; text-align: center; padding: 20px 0 4px;
  }
  .room-code-hint { text-align: center; font-size: 11px; color: #444; margin-bottom: 8px; font-family: 'DM Mono', monospace; }

  .player-row {
    display: flex; align-items: center; gap: 10px;
    padding: 12px 0; border-bottom: 1px solid #1a1a22;
  }
  .player-row:last-child { border-bottom: none; }
  .player-avatar {
    width: 36px; height: 36px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 700; flex-shrink: 0;
  }
  .av-1 { background: #0f3d2e; color: #1D9E75; }
  .av-2 { background: #1a1a22; color: #555; }
  .av-2.filled { background: #0c2d4a; color: #378ADD; }
  .av-3 { background: #1a1a22; color: #555; }
  .av-3.filled { background: #2d1a1a; color: #DD7537; }
  .av-4 { background: #1a1a22; color: #555; }
  .av-4.filled { background: #261a2d; color: #A037DD; }
  .player-name { font-size: 14px; font-weight: 600; }
  .player-badge {
    margin-left: auto; font-size: 10px; font-family: 'DM Mono', monospace;
    padding: 3px 8px; border-radius: 20px;
  }
  .badge-host { background: #0f3d2e; color: #1D9E75; }
  .badge-wait { background: #1a1a22; color: #555; }
  .badge-joined { background: #0c2d4a; color: #378ADD; }
  .badge-you { background: #1a1a22; color: #888; font-size: 9px; margin-left: 6px; padding: 2px 6px; border-radius: 10px; }

  .pulse { animation: pulse 1.5s infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }

  .game-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
  .game-logo { font-size: 18px; font-weight: 800; letter-spacing: -0.5px; }
  .game-logo span { color: #1D9E75; }

  .players-bar { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 14px; }
  .player-card {
    background: #13131a; border: 1px solid #222;
    border-radius: 12px; padding: 10px 12px; transition: border-color 0.2s;
    position: relative;
  }
  .player-card.dead { opacity: 0.4; }
  .player-card.p1-active { border-color: #1D9E75; }
  .player-card.p2-active { border-color: #378ADD; }
  .player-card.p3-active { border-color: #DD7537; }
  .player-card.p4-active { border-color: #A037DD; }
  .pc-name { font-size: 12px; font-weight: 700; margin-bottom: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pc-lives { display: flex; gap: 3px; }
  .heart { font-size: 13px; transition: all 0.3s; }
  .heart.lost { opacity: 0.15; filter: grayscale(1); }
  .active-dot {
    position: absolute; top: 8px; right: 8px;
    width: 7px; height: 7px; border-radius: 50%;
    animation: blink 1s infinite;
  }
  .dot-p1 { background: #1D9E75; }
  .dot-p2 { background: #378ADD; }
  .dot-p3 { background: #DD7537; }
  .dot-p4 { background: #A037DD; }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }

  .timer-wrap { position: relative; margin-bottom: 4px; height: 6px; background: #1a1a22; border-radius: 999px; overflow: hidden; }
  .timer-bar { height: 100%; border-radius: 999px; transition: width 1s linear, background-color 0.5s; }
  .timer-label { font-family: 'DM Mono', monospace; font-size: 11px; color: #555; text-align: right; margin-top: 4px; margin-bottom: 12px; }

  .chain-box {
    background: #13131a; border: 1px solid #222; border-radius: 12px;
    padding: 12px; min-height: 72px; max-height: 130px;
    overflow-y: auto; display: flex; flex-wrap: wrap;
    gap: 5px; align-content: flex-start; margin-bottom: 12px;
  }
  .chain-box::-webkit-scrollbar { width: 3px; }
  .chain-box::-webkit-scrollbar-thumb { background: #2a2a35; border-radius: 2px; }
  .word-chip {
    font-family: 'DM Mono', monospace; font-size: 11px; font-weight: 500;
    padding: 4px 9px; border-radius: 20px; animation: chipPop 0.2s ease;
  }
  @keyframes chipPop { from{transform:scale(0.7);opacity:0} to{transform:scale(1);opacity:1} }
  .chip-p1 { background: #0f3d2e; color: #5DCAA5; border: 1px solid #1a5c44; }
  .chip-p2 { background: #0c2d4a; color: #85B7EB; border: 1px solid #1a4a72; }
  .chip-p3 { background: #3d1f0e; color: #EBA085; border: 1px solid #5c3018; }
  .chip-p4 { background: #2a0e3d; color: #C385EB; border: 1px solid #461a5c; }

  .hint-box {
    background: #13131a; border: 1px solid #222; border-radius: 12px;
    padding: 12px 14px; display: flex; align-items: center; gap: 12px; margin-bottom: 12px;
  }
  .hint-letter { font-family: 'DM Mono', monospace; font-size: 34px; font-weight: 500; color: #1D9E75; line-height: 1; min-width: 34px; }
  .hint-meta { flex: 1; }
  .hint-title { font-size: 10px; color: #555; margin-bottom: 2px; }
  .hint-last { font-family: 'DM Mono', monospace; font-size: 12px; color: #888; }
  .hint-last strong { color: #f0ede8; }
  .turn-label { font-size: 11px; font-family: 'DM Mono', monospace; padding: 5px 10px; border-radius: 20px; white-space: nowrap; }
  .turn-you { background: #0f3d2e; color: #1D9E75; }
  .turn-wait { background: #1a1a22; color: #555; }

  .input-row { display: flex; gap: 8px; margin-bottom: 8px; }
  .word-input {
    flex: 1; background: #0a0a0f; border: 1.5px solid #2a2a35;
    border-radius: 10px; color: #f0ede8; font-family: 'DM Mono', monospace;
    font-size: 14px; font-weight: 500; padding: 11px 13px; outline: none;
    transition: border-color 0.15s; text-transform: lowercase;
  }
  .word-input:focus { border-color: #1D9E75; }
  .word-input.error { border-color: #e05c5c; animation: shake 0.3s; }
  @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-6px)} 75%{transform:translateX(6px)} }
  .word-input:disabled { opacity: 0.3; }

  .send-btn {
    padding: 11px 16px; background: #1D9E75; border: none; border-radius: 10px;
    color: #fff; font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700;
    cursor: pointer; transition: opacity 0.15s, transform 0.1s; white-space: nowrap;
  }
  .send-btn:hover:not(:disabled) { opacity: 0.88; }
  .send-btn:active:not(:disabled) { transform: scale(0.97); }
  .send-btn:disabled { opacity: 0.3; cursor: not-allowed; }

  .timeout-notice {
    font-family: 'DM Mono', monospace; font-size: 11px;
    color: #EF9F27; text-align: center; margin-bottom: 6px;
    animation: fadeIn 0.3s;
  }
  @keyframes fadeIn { from{opacity:0} to{opacity:1} }

  .gameover {
    text-align: center; padding: 28px 24px; background: #13131a;
    border: 1px solid #222; border-radius: 16px;
  }
  .gameover-emoji { font-size: 48px; margin-bottom: 10px; }
  .gameover-title { font-size: 26px; font-weight: 800; margin-bottom: 6px; }
  .gameover-sub { font-size: 13px; color: #555; font-family: 'DM Mono', monospace; margin-bottom: 20px; }
  .rematch-status { font-size: 11px; color: #EF9F27; font-family: 'DM Mono', monospace; margin-top: 10px; }

  .divider { border: none; border-top: 1px solid #1a1a22; margin: 14px 0; }
  .player-count-badge { display: inline-block; font-family: 'DM Mono', monospace; font-size: 11px; color: #555; margin-bottom: 16px; }

  .copied-toast {
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
    background: #1D9E75; color: #fff; font-family: 'DM Mono', monospace;
    font-size: 12px; padding: 8px 16px; border-radius: 20px;
    animation: toastIn 0.2s ease;
    z-index: 999;
  }
  @keyframes toastIn { from{opacity:0;transform:translateX(-50%) translateY(10px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
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

  /* ── Cleanup khi đóng tab ── */
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
      // Reset toàn bộ state, đưa tất cả về lobby
      resetToLobby();
    }
    if ((s === "waiting" || s === "ready") && screen === "lobby" && roomId) {
      setScreen("room");
    }
  }, [roomData?.status]);

  /* ── Timer — reset mỗi khi turn đổi ── */
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
    // Báo Firebase biết player này offline → trigger dissolved cho phòng
    await setPlayerOnline(roomId, myRole, false);
    resetToLobby();
  }

  function handleCopyCode() {
    navigator.clipboard?.writeText(roomId).catch(() => {});
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 1800);
  }

  /* ── COMPONENTS ── */
  function Hearts({ lives }) {
    return (
      <div className="pc-lives">
        {[1, 2, 3].map(i => (
          <span key={i} className={`heart${i > lives ? " lost" : ""}`}>❤️</span>
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

    return (
      <div className="app">
        <div className="gameover">
          <div className="gameover-emoji">{isWinner ? "🏆" : "💀"}</div>
          <div className="gameover-title">{isWinner ? "Bạn thắng!" : "Thua rồi!"}</div>
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
                {role === myRole ? `👤 ${p?.name}` : `🎮 ${p?.name}`}
              </div>
              <Hearts lives={p?.lives ?? 3} />
            </div>
          );
        })}
      </div>

      {/* Timer */}
      <div className="timer-wrap">
        <div className="timer-bar" style={{ width: `${timerPct}%`, background: timerColor }} />
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