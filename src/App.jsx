import { useState, useEffect, useRef, useCallback } from "react";
import { createRoom, joinRoom, listenRoom } from "./roomService";
import { startGame, submitWord, loseLife, isValidWord } from "./gameService";

/* ─── CSS-in-JS ─────────────────────────────────────────────────── */
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

  .app { width: 100%; max-width: 520px; padding: 24px 16px; text-align: center;}

  /* ── LOBBY ── */
  .lobby-title {
    font-size: 52px;
    font-weight: 800;
    line-height: 1;
    letter-spacing: -2px;
    margin-bottom: 4px;
    text-align: center;
  }
  .lobby-title span { color: #1D9E75; }
  .lobby-sub { font-size: 13px; color: #666; margin-bottom: 36px; font-family: 'DM Mono', monospace; text-align: center;}

  .card {
    background: #13131a;
    border: 1px solid #222;
    border-radius: 16px;
    padding: 24px;
    margin-bottom: 12px;
  }

  .card-label {
    font-size: 11px;
    font-weight: 600;
    color: #555;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    margin-bottom: 14px;
  }

  .input {
    width: 100%;
    background: #0a0a0f;
    border: 1px solid #2a2a35;
    border-radius: 10px;
    color: #f0ede8;
    font-family: 'DM Mono', monospace;
    font-size: 14px;
    padding: 12px 14px;
    outline: none;
    transition: border-color 0.15s;
    margin-bottom: 10px;
  }
  .input:focus { border-color: #1D9E75; }
  .input::placeholder { color: #333; }

  .btn {
    width: 100%;
    padding: 13px;
    border-radius: 10px;
    border: none;
    font-family: 'Syne', sans-serif;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.1s;
  }
  .btn:active { transform: scale(0.98); }
  .btn:disabled { opacity: 0.35; cursor: not-allowed; }

  .btn-primary { background: #1D9E75; color: #fff; }
  .btn-primary:hover:not(:disabled) { opacity: 0.88; }
  .btn-outline { background: transparent; color: #f0ede8; border: 1px solid #2a2a35; }
  .btn-outline:hover:not(:disabled) { border-color: #444; background: #13131a; }

  .err { color: #e05c5c; font-size: 12px; font-family: 'DM Mono', monospace; margin-top: 8px; }

  /* ── WAITING ROOM ── */
  .room-code {
    font-family: 'DM Mono', monospace;
    font-size: 40px;
    font-weight: 500;
    letter-spacing: 8px;
    color: #1D9E75;
    text-align: center;
    padding: 20px 0 4px;
  }
  .room-code-hint { text-align: center; font-size: 11px; color: #444; margin-bottom: 20px; font-family: 'DM Mono', monospace; }

  .player-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 0;
    border-bottom: 1px solid #1a1a22;
  }
  .player-row:last-child { border-bottom: none; }
  .player-avatar {
    width: 36px; height: 36px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 700; flex-shrink: 0;
  }
  .avatar-1 { background: #0f3d2e; color: #1D9E75; }
  .avatar-2 { background: #1a1a22; color: #555; }
  .avatar-2.active { background: #0c2d4a; color: #378ADD; }
  .player-name { font-size: 14px; font-weight: 600; }
  .player-badge {
    margin-left: auto; font-size: 10px; font-family: 'DM Mono', monospace;
    padding: 3px 8px; border-radius: 20px;
  }
  .badge-host { background: #0f3d2e; color: #1D9E75; }
  .badge-wait { background: #1a1a22; color: #555; }
  .badge-joined { background: #0c2d4a; color: #378ADD; }

  .pulse { animation: pulse 1.5s infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }

  /* ── GAME ── */
  .game-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }
  .game-logo { font-size: 18px; font-weight: 800; letter-spacing: -0.5px; }
  .game-logo span { color: #1D9E75; }

  .players-bar {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 16px;
  }
  .player-card {
    background: #13131a;
    border: 1px solid #222;
    border-radius: 12px;
    padding: 12px 14px;
    transition: border-color 0.2s;
  }
  .player-card.active-turn { border-color: #1D9E75; }
  .player-card.losing { border-color: #e05c5c; }
  .pc-name { font-size: 13px; font-weight: 700; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pc-lives { display: flex; gap: 4px; }
  .heart { font-size: 14px; transition: all 0.3s; }
  .heart.lost { opacity: 0.15; filter: grayscale(1); }

  /* ── TIMER ── */
  .timer-wrap {
    position: relative;
    margin-bottom: 16px;
    height: 6px;
    background: #1a1a22;
    border-radius: 999px;
    overflow: hidden;
  }
  .timer-bar {
    height: 100%;
    border-radius: 999px;
    transition: width 1s linear, background-color 0.5s;
  }
  .timer-label {
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    color: #555;
    text-align: right;
    margin-top: 4px;
  }

  /* ── CHAIN ── */
  .chain-box {
    background: #13131a;
    border: 1px solid #222;
    border-radius: 12px;
    padding: 14px;
    min-height: 90px;
    max-height: 150px;
    overflow-y: auto;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-content: flex-start;
    margin-bottom: 14px;
  }
  .chain-box::-webkit-scrollbar { width: 3px; }
  .chain-box::-webkit-scrollbar-thumb { background: #2a2a35; border-radius: 2px; }

  .word-chip {
    font-family: 'DM Mono', monospace;
    font-size: 12px;
    font-weight: 500;
    padding: 5px 10px;
    border-radius: 20px;
    animation: chipPop 0.2s ease;
  }
  @keyframes chipPop { from{transform:scale(0.7);opacity:0} to{transform:scale(1);opacity:1} }
  .chip-p1 { background: #0f3d2e; color: #5DCAA5; border: 1px solid #1a5c44; }
  .chip-p2 { background: #0c2d4a; color: #85B7EB; border: 1px solid #1a4a72; }

  /* ── HINT ── */
  .hint-box {
    background: #13131a;
    border: 1px solid #222;
    border-radius: 12px;
    padding: 14px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;
  }
  .hint-letter {
    font-family: 'DM Mono', monospace;
    font-size: 36px;
    font-weight: 500;
    color: #1D9E75;
    line-height: 1;
    min-width: 36px;
  }
  .hint-meta { flex: 1; }
  .hint-title { font-size: 11px; color: #555; margin-bottom: 2px; }
  .hint-last { font-family: 'DM Mono', monospace; font-size: 13px; color: #888; }
  .hint-last strong { color: #f0ede8; }

  .turn-label {
    font-size: 12px;
    font-family: 'DM Mono', monospace;
    padding: 6px 12px;
    border-radius: 20px;
    white-space: nowrap;
  }
  .turn-you { background: #0f3d2e; color: #1D9E75; }
  .turn-wait { background: #1a1a22; color: #555; }

  /* ── INPUT ROW ── */
  .input-row { display: flex; gap: 8px; margin-bottom: 8px; }
  .word-input {
    flex: 1;
    background: #0a0a0f;
    border: 1.5px solid #2a2a35;
    border-radius: 10px;
    color: #f0ede8;
    font-family: 'DM Mono', monospace;
    font-size: 15px;
    font-weight: 500;
    padding: 12px 14px;
    outline: none;
    transition: border-color 0.15s;
    text-transform: lowercase;
  }
  .word-input:focus { border-color: #1D9E75; }
  .word-input.error { border-color: #e05c5c; animation: shake 0.3s; }
  @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-6px)} 75%{transform:translateX(6px)} }
  .word-input:disabled { opacity: 0.3; }

  .send-btn {
    padding: 12px 18px;
    background: #1D9E75;
    border: none;
    border-radius: 10px;
    color: #fff;
    font-family: 'Syne', sans-serif;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.1s;
    white-space: nowrap;
  }
  .send-btn:hover:not(:disabled) { opacity: 0.88; }
  .send-btn:active:not(:disabled) { transform: scale(0.97); }
  .send-btn:disabled { opacity: 0.3; cursor: not-allowed; }

  /* ── GAME OVER ── */
  .gameover {
    text-align: center;
    padding: 32px 24px;
    background: #13131a;
    border: 1px solid #222;
    border-radius: 16px;
  }
  .gameover-emoji { font-size: 52px; margin-bottom: 12px; }
  .gameover-title { font-size: 28px; font-weight: 800; margin-bottom: 6px; }
  .gameover-sub { font-size: 13px; color: #555; font-family: 'DM Mono', monospace; margin-bottom: 24px; }

  .divider { border: none; border-top: 1px solid #1a1a22; margin: 16px 0; }
`;

const TIMER_MAX = 30;

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
  const timerRef = useRef(null);
  const inputRef = useRef(null);

  const game = roomData?.game;
  const players = roomData?.players;
  const myTurn = game?.turn === myRole;
  const lastWord = game?.chain?.[game.chain.length - 1] ?? "";
  const nextLetter = game?.currentLetter?.toUpperCase() ?? "—";

  /* ── Inject CSS ── */
  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = STYLES;
    document.head.appendChild(el);
    return () => document.head.removeChild(el);
  }, []);

  /* ── Listen room ── */
  useEffect(() => {
    if (!roomId) return;
    const unsub = listenRoom(roomId, setRoomData);
    return () => unsub();
  }, [roomId]);

  useEffect(() => {
    if (roomData?.status === "playing" && screen !== "game") setScreen("game");
  }, [roomData?.status]);

  /* ── Timer ── */
  const handleTimeout = useCallback(async () => {
    if (!myTurn || roomData?.status !== "playing") return;
    setError("Hết giờ! Mất 1 mạng ⏰");
    await loseLife(roomId, myRole);
    // chuyển lượt
    const { submitWord: sw } = await import("./gameService");
  }, [myTurn, roomId, myRole, roomData?.status]);

  useEffect(() => {
    if (screen !== "game" || roomData?.status !== "playing") return;
    clearInterval(timerRef.current);
    setTimeLeft(TIMER_MAX);

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          if (myTurn) handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [game?.turn, screen, roomData?.status]);

  /* ── Focus input on my turn ── */
  useEffect(() => {
    if (myTurn) inputRef.current?.focus();
  }, [myTurn]);

  /* ── Handlers ── */
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
      await joinRoom(inputRoomId.toUpperCase(), name.trim());
      setRoomId(inputRoomId.toUpperCase());
      setMyRole("player2");
      setScreen("room");
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleStart() {
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

  function Hearts({ lives }) {
    return (
      <div className="pc-lives">
        {[1, 2, 3].map(i => (
          <span key={i} className={`heart${i > lives ? " lost" : ""}`}>❤️</span>
        ))}
      </div>
    );
  }

  /* ── LOBBY ── */
  if (screen === "lobby") return (
    <div className="app">
      <h1 className="lobby-title">Word<br /><span>Chain</span></h1>
      <p className="lobby-sub">// nối từ tiếng anh · 2 người · online</p>

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
        <div className="room-code">{roomId}</div>
        <div className="room-code-hint">copy và gửi mã này để mời người chơi</div>

        <hr className="divider" />

        <div className="player-row">
          <div className="player-avatar avatar-1">
            {players?.player1?.name?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="player-name">{players?.player1?.name}</div>
          <span className="player-badge badge-host">host</span>
        </div>

        <div className="player-row">
          <div className={`player-avatar avatar-2 ${players?.player2 ? "active" : ""}`}>
            {players?.player2?.name?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="player-name" style={{ color: players?.player2 ? "#f0ede8" : "#444" }}>
            {players?.player2?.name ?? "Chờ người chơi..."}
          </div>
          <span className={`player-badge ${players?.player2 ? "badge-joined" : "badge-wait pulse"}`}>
            {players?.player2 ? "joined" : "waiting"}
          </span>
        </div>

        <hr className="divider" />

        {myRole === "player1" && roomData?.status === "ready"
          ? <button className="btn btn-primary" onClick={handleStart}>▶ Bắt đầu game!</button>
          : <p style={{ textAlign: "center", color: "#555", fontSize: 13, fontFamily: "'DM Mono',monospace" }}>
              {myRole === "player1" ? "Chờ người chơi join..." : "Chờ host bắt đầu..."}
            </p>
        }
      </div>
    </div>
  );

  /* ── GAME OVER ── */
  if (roomData?.status === "finished") {
    const winner = players?.[game?.winner];
    const isWinner = game?.winner === myRole;
    return (
      <div className="app">
        <div className="gameover">
          <div className="gameover-emoji">{isWinner ? "🏆" : "💀"}</div>
          <div className="gameover-title">{isWinner ? "Bạn thắng!" : "Thua rồi!"}</div>
          <div className="gameover-sub">
            {winner?.name} chiến thắng · chuỗi {game?.chain?.length ?? 0} từ
          </div>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Chơi lại
          </button>
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

      {/* Players */}
      <div className="players-bar">
        {["player1", "player2"].map(role => {
          const p = players?.[role];
          const isActive = game?.turn === role;
          return (
            <div key={role} className={`player-card${isActive ? " active-turn" : ""}${p?.lives <= 0 ? " losing" : ""}`}>
              <div className="pc-name">
                {role === myRole ? `👤 ${p?.name}` : `🤖 ${p?.name}`}
                {isActive && <span style={{ marginLeft: 6, fontSize: 10, color: "#1D9E75" }}>●</span>}
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
        {timeLeft}s {myTurn ? "— lượt của bạn" : `— ${players?.[game?.turn]?.name} đang nghĩ`}
      </div>

      {/* Chain */}
      <div className="chain-box" style={{ marginTop: 12 }}>
        {game?.chain?.length === 0
          ? <span style={{ color: "#333", fontSize: 12, fontFamily: "'DM Mono',monospace" }}>Chuỗi từ sẽ hiện ở đây...</span>
          : game?.chain?.map((w, i) => {
              // Xác định ai nói từ này (player1 đi lẻ, player2 đi chẵn nếu player1 bắt đầu)
              const chipRole = i % 2 === 0 ? "chip-p1" : "chip-p2";
              return <span key={i} className={`word-chip ${chipRole}`}>{w}</span>;
            })
        }
      </div>

      {/* Hint */}
      <div className="hint-box">
        <div className="hint-letter">{nextLetter}</div>
        <div className="hint-meta">
          <div className="hint-title">từ tiếp theo bắt đầu bằng</div>
          <div className="hint-last">
            từ trước: <strong>{lastWord || "—"}</strong>
          </div>
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