import { useState, useEffect, useRef, useCallback } from "react";
import { createCaroRoom, startCaroGame, makeMove, requestCaroRematch,
         flatToGrid, cellIdx, BOARD_SIZE, MODE_FREE, MODE_BLOCK } from "./caroService";
import { joinRoom, listenRoom, setPlayerOnline } from "../roomService";
import { ref, onValue, onDisconnect, update } from "firebase/database";
import { db } from "../firebase";

/* ─── STYLES ──────────────────────────────────────────────────────────────── */
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0e0e12;--surface:#161620;--surface2:#1c1c28;--border:#2a2a3a;
  --text:#f0eeff;--muted:#6b6b88;--dim:#9090aa;
  --x:#e8503a;--x-dim:#3d1a16;--x-mid:#8c2a1c;
  --o:#4a9eff;--o-dim:#0f2a4d;--o-mid:#1e5080;
  --green:#3ecf6e;--green-dim:#0e3320;
  --gold:#f0c040;--gold-dim:#3d2e00;
  --red:#f04040;--red-dim:#3d0f0f;
  --radius:14px;--radius-sm:8px;
}
body{font-family:'Syne',sans-serif;background:var(--bg);color:var(--text);min-height:100vh;}
.caro-app{width:100%;max-width:680px;margin:0 auto;padding:20px 16px 80px;}

/* LOBBY */
.c-logo{text-align:center;padding:36px 0 8px;}
.c-logo-text{font-size:56px;font-weight:800;letter-spacing:-2px;line-height:1;}
.c-logo-x{color:var(--x);}
.c-logo-o{color:var(--o);}
.c-logo-sub{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted);letter-spacing:1px;text-align:center;margin-bottom:36px;}

.c-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px;margin-bottom:12px;}
.c-card-title{font-size:10px;font-weight:600;color:var(--muted);letter-spacing:2px;text-transform:uppercase;margin-bottom:16px;}

.c-inp{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);
  color:var(--text);font-family:'Syne',sans-serif;font-size:14px;padding:11px 14px;
  outline:none;transition:border-color .15s;margin-bottom:10px;display:block;}
.c-inp:focus{border-color:var(--x);}
.c-inp::placeholder{color:var(--muted);}
.c-inp-mono{font-family:'JetBrains Mono',monospace;letter-spacing:3px;font-size:13px;}

/* MODE SELECTOR */
.mode-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;}
.mode-card{background:var(--bg);border:2px solid var(--border);border-radius:var(--radius-sm);
  padding:14px 12px;cursor:pointer;transition:all .2s;text-align:left;}
.mode-card:hover{border-color:var(--dim);}
.mode-card.selected-free{border-color:var(--x);background:var(--x-dim);}
.mode-card.selected-block{border-color:var(--o);background:var(--o-dim);}
.mode-card-title{font-size:13px;font-weight:700;margin-bottom:4px;}
.mode-card-desc{font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--muted);line-height:1.6;}
.mode-tag{display:inline-block;font-family:'JetBrains Mono',monospace;font-size:9px;
  padding:2px 8px;border-radius:20px;margin-bottom:6px;letter-spacing:.5px;}
.mode-tag-free{background:var(--x-dim);color:var(--x);border:1px solid var(--x-mid);}
.mode-tag-block{background:var(--o-dim);color:var(--o);border:1px solid var(--o-mid);}

/* BUTTONS */
.c-btn{display:block;width:100%;padding:13px 16px;border-radius:var(--radius-sm);border:none;
  cursor:pointer;font-family:'Syne',sans-serif;font-size:14px;font-weight:700;
  transition:opacity .15s,transform .1s;text-align:center;}
.c-btn:active{transform:scale(.98);}
.c-btn:disabled{opacity:.3;cursor:not-allowed;}
.c-btn-x{background:var(--x);color:#fff;}
.c-btn-x:hover:not(:disabled){opacity:.85;}
.c-btn-o{background:var(--o);color:#fff;}
.c-btn-o:hover:not(:disabled){opacity:.85;}
.c-btn-sec{background:transparent;color:var(--text);border:1px solid var(--border);}
.c-btn-sec:hover:not(:disabled){background:var(--surface);}
.c-btn-danger{background:transparent;color:var(--red);border:1px solid var(--red-dim);margin-top:8px;}
.c-btn-danger:hover:not(:disabled){background:var(--red-dim);}

.c-err{color:var(--red);font-size:11px;font-family:'JetBrains Mono',monospace;margin-top:8px;text-align:center;}

/* ROOM LOBBY */
.room-code-wrap{text-align:center;padding:6px 0 2px;}
.room-code{font-family:'JetBrains Mono',monospace;font-size:42px;font-weight:600;
  letter-spacing:10px;color:var(--x);cursor:pointer;transition:opacity .15s;}
.room-code:hover{opacity:.7;}
.room-hint{text-align:center;font-size:11px;color:var(--muted);font-family:'JetBrains Mono',monospace;margin-bottom:14px;}
.divider{border:none;border-top:1px solid var(--border);margin:14px 0;}

.mode-badge{display:inline-flex;align-items:center;gap:6px;font-family:'JetBrains Mono',monospace;
  font-size:10px;padding:5px 12px;border-radius:20px;margin:0 auto 14px;display:flex;width:fit-content;}
.mode-badge-free{background:var(--x-dim);color:var(--x);border:1px solid var(--x-mid);}
.mode-badge-block{background:var(--o-dim);color:var(--o);border:1px solid var(--o-mid);}

.player-row{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--surface2);}
.player-row:last-child{border-bottom:none;}
.av{width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-size:14px;font-weight:800;flex-shrink:0;}
.av-x{background:var(--x-dim);color:var(--x);}
.av-o{background:var(--o-dim);color:var(--o);}
.av-empty{background:var(--surface2);color:var(--muted);}
.p-name{font-size:14px;font-weight:600;flex:1;}
.p-name-empty{color:var(--muted);font-weight:400;}
.p-tag{font-size:10px;font-family:'JetBrains Mono',monospace;padding:3px 9px;border-radius:20px;}
.tag-host{background:var(--x-dim);color:var(--x);}
.tag-join{background:var(--o-dim);color:var(--o);}
.tag-wait{background:var(--surface2);color:var(--muted);}
.tag-you{background:var(--surface2);color:#555;font-size:9px;margin-left:4px;padding:2px 6px;}
.sym-badge{font-size:10px;font-family:'JetBrains Mono',monospace;margin-left:6px;font-weight:700;}
.sym-x{color:var(--x);}
.sym-o{color:var(--o);}
.pulse{animation:pulse 1.8s ease-in-out infinite;}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}

/* GAME HEADER */
.g-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}
.g-logo{font-size:20px;font-weight:800;letter-spacing:-1px;}
.g-room{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--muted);}
.turn-bar{display:flex;align-items:center;justify-content:space-between;
  background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);
  padding:10px 16px;margin-bottom:12px;}
.turn-indicator{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:700;}
.turn-sym{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;
  justify-content:center;font-size:13px;font-weight:800;}
.turn-sym-x{background:var(--x-dim);color:var(--x);}
.turn-sym-o{background:var(--o-dim);color:var(--o);}
.turn-mine{color:var(--green);}
.turn-others{color:var(--muted);}
.move-count{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted);}

/* BOARD */
.board-wrap{overflow-x:auto;margin-bottom:16px;}
.board{
  display:inline-grid;
  grid-template-columns:repeat(15,var(--cell));
  grid-template-rows:repeat(15,var(--cell));
  --cell:36px;
  gap:1px;
  background:var(--border);
  border:1px solid var(--border);
  border-radius:var(--radius-sm);
  overflow:hidden;
  user-select:none;
}
@media(max-width:600px){.board{--cell:26px;}}
@media(max-width:440px){.board{--cell:22px;}}

.cell{
  width:var(--cell);height:var(--cell);
  background:var(--surface);
  display:flex;align-items:center;justify-content:center;
  cursor:pointer;transition:background .1s;
  font-size:calc(var(--cell) * .52);
  font-weight:800;position:relative;
  font-family:'JetBrains Mono',monospace;
}
.cell:hover{background:var(--surface2);}
.cell.last-move{background:#1e1e2e;}
.cell.win-line{background:#1a2a1a;}
.cell.x-piece{color:var(--x);cursor:default;}
.cell.o-piece{color:var(--o);cursor:default;}
.cell.x-piece:hover,.cell.o-piece:hover{background:var(--surface);}
.cell.win-line.x-piece{background:var(--x-dim);}
.cell.win-line.o-piece{background:var(--o-dim);}
.cell.disabled{cursor:not-allowed;opacity:.7;}
@keyframes placeX{0%{transform:scale(.3);opacity:0}70%{transform:scale(1.2)}100%{transform:scale(1);opacity:1}}
@keyframes placeO{0%{transform:scale(.3);opacity:0}70%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}
.cell.anim-x{animation:placeX .22s cubic-bezier(.2,.8,.3,1) both;}
.cell.anim-o{animation:placeO .22s cubic-bezier(.2,.8,.3,1) both;}

/* SCOREBOARD */
.score-bar{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;margin-bottom:14px;}
.score-player{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 14px;}
.score-player.my-turn{border-color:var(--green);}
.score-p-name{font-size:11px;color:var(--muted);font-family:'JetBrains Mono',monospace;margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.score-p-val{font-size:20px;font-weight:800;line-height:1;}
.score-p-val.sym-x{color:var(--x);}
.score-p-val.sym-o{color:var(--o);}
.score-vs{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted);text-align:center;}
.score-wins{font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:600;margin-top:2px;}
.score-wins-x{color:var(--x);}
.score-wins-o{color:var(--o);}

/* SPECTATORS */
.spectators{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;}
.spec-tag{font-family:'JetBrains Mono',monospace;font-size:9px;padding:3px 8px;
  background:var(--surface);border:1px solid var(--border);border-radius:20px;color:var(--dim);}

/* NOTICE */
.notice{text-align:center;font-family:'JetBrains Mono',monospace;font-size:12px;
  padding:10px 14px;border-radius:var(--radius-sm);margin-bottom:12px;animation:fadeIn .2s ease;}
@keyframes fadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
.notice-win{background:var(--green-dim);color:var(--green);border:1px solid #1e5c30;}
.notice-lose{background:var(--red-dim);color:var(--red);border:1px solid #5a1a1a;}
.notice-draw{background:var(--gold-dim);color:var(--gold);border:1px solid #5a4500;}
.notice-wait{background:var(--surface);color:var(--muted);border:1px solid var(--border);}

/* GAME OVER */
.gameover-wrap{padding-top:28px;}
.go-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:28px 24px;}
.go-icon{text-align:center;font-size:52px;margin-bottom:12px;}
.go-title{font-size:30px;font-weight:800;text-align:center;margin-bottom:4px;letter-spacing:-1px;}
.go-sub{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted);text-align:center;margin-bottom:24px;}
.lb{margin-bottom:20px;}
.lb-row{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:var(--radius-sm);
  background:var(--bg);margin-bottom:6px;border:1px solid transparent;}
.lb-row.me{border-color:var(--green-dim);}
.lb-rank{font-size:22px;min-width:32px;}
.lb-name{flex:1;font-size:14px;font-weight:700;}
.lb-sym{font-size:18px;font-weight:800;margin-right:4px;}
.lb-score{font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:600;}
.lb-score-x{color:var(--x);}
.lb-score-o{color:var(--o);}
.lb-me-tag{font-size:9px;color:var(--muted);font-family:'JetBrains Mono',monospace;margin-left:4px;}
.rematch-hint{font-size:11px;font-family:'JetBrains Mono',monospace;color:var(--gold);text-align:center;margin-top:10px;}

/* TOAST */
.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
  background:var(--green);color:#fff;font-family:'JetBrains Mono',monospace;
  font-size:12px;padding:8px 18px;border-radius:20px;z-index:999;
  animation:toastIn .2s ease;pointer-events:none;}
@keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}

/* DISSOLVED */
.dissolved-overlay{position:fixed;inset:0;background:rgba(14,14,18,.95);
  display:flex;align-items:center;justify-content:center;z-index:100;}
.dissolved-box{text-align:center;padding:40px 32px;background:var(--surface);
  border:1px solid var(--red-dim);border-radius:var(--radius);max-width:300px;}
.dissolved-box h2{font-size:22px;font-weight:800;margin:12px 0 6px;}
.dissolved-box p{font-size:11px;color:var(--muted);font-family:'JetBrains Mono',monospace;margin-bottom:20px;}

.loading-wrap{padding-top:60px;text-align:center;color:var(--muted);
  font-family:'JetBrains Mono',monospace;font-size:13px;}
`;

const PLAYER_SLOTS = ["player1","player2","player3","player4"];
const AV_CLASSES   = ["av-x","av-o","av-x","av-o"];
const MEDALS = ["🥇","🥈","🥉","4️⃣"];
const SYM_CHARS = { X: "✕", O: "○" };

export default function CaroApp() {
  const [screen,       setScreen]       = useState("lobby");
  const [name,         setName]         = useState("");
  const [inputRoom,    setInputRoom]    = useState("");
  const [roomId,       setRoomId]       = useState("");
  const [myRole,       setMyRole]       = useState("");
  const [roomData,     setRoomData]     = useState(null);
  const [mode,         setMode]         = useState(MODE_FREE);
  const [error,        setError]        = useState("");
  const [notice,       setNotice]       = useState(null);
  const [copiedToast,  setCopiedToast]  = useState(false);
  const [dissolved,    setDissolved]    = useState(false);
  const [animCell,     setAnimCell]     = useState(null); // {idx, sym}

  /* ── Inject CSS ── */
  useEffect(() => {
    const id = "caro-styles";
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
    return listenRoom(roomId, data => setRoomData(data));
  }, [roomId]);

  useEffect(() => {
    if (!roomData) return;
    const s = roomData.status;
    if (s === "playing" && screen !== "game") setScreen("game");
    if (s === "dissolved") setDissolved(true);
    if ((s === "waiting" || s === "ready") && screen === "lobby" && roomId) setScreen("room");
  }, [roomData?.status]);

  /* ── Notice from game state ── */
  const caro     = roomData?.caro;
  const players  = roomData?.players;
  const mySymbol = caro?.symbols?.[myRole];
  const isMeTurn = caro?.currentTurn === myRole;

  useEffect(() => {
    if (!caro?.roundOver) { setNotice(null); return; }
    if (caro.winner === "draw") {
      setNotice({ text: "🤝 Hòa! Không ai thắng.", type: "draw" });
    } else if (caro.winnerRole === myRole) {
      setNotice({ text: `🎉 Bạn thắng! ${SYM_CHARS[mySymbol]} là người chiến thắng!`, type: "win" });
    } else {
      const winner = players?.[caro.winnerRole]?.name ?? "Đối thủ";
      setNotice({ text: `😔 ${winner} thắng rồi!`, type: "lose" });
    }
  }, [caro?.roundOver]);

  /* ── Board click ── */
  async function handleCellClick(row, col) {
    if (!caro || caro.roundOver || !isMeTurn) return;
    const idx = cellIdx(row, col);
    if (caro.board[idx] !== null) return;
    const sym = caro.symbols?.[myRole];
    setAnimCell({ idx, sym });
    setTimeout(() => setAnimCell(null), 300);
    await makeMove(roomId, myRole, row, col);
  }

  /* ── Lobby actions ── */
  async function handleCreate() {
    if (!name.trim()) return setError("Nhập tên của bạn!");
    setError("");
    const id = await createCaroRoom(name.trim(), mode);
    setRoomId(id); setMyRole("player1"); setScreen("room");
  }

  async function handleJoin() {
    if (!name.trim()) return setError("Nhập tên của bạn!");
    if (!inputRoom.trim()) return setError("Nhập mã phòng!");
    setError("");
    try {
      const slot = await joinRoom(inputRoom.toUpperCase(), name.trim());
      setRoomId(inputRoom.toUpperCase()); setMyRole(slot); setScreen("room");
    } catch(e) { setError(e.message); }
  }

  async function handleStart() {
    if (Object.keys(players || {}).length < 2) return;
    await startCaroGame(roomId);
  }

  async function handleRematch() {
    await requestCaroRematch(roomId, myRole);
  }

  function handleLeave() {
    setPlayerOnline(roomId, myRole, false);
    setRoomId(""); setMyRole(""); setRoomData(null);
    setScreen("lobby"); setDissolved(false); setNotice(null); setError("");
  }

  function handleCopy() {
    navigator.clipboard?.writeText(roomId).catch(() => {});
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 1800);
  }

  /* ── Build board cells ── */
  function BoardView() {
    const flat  = caro?.board ?? Array(BOARD_SIZE * BOARD_SIZE).fill(null);
    const grid  = flatToGrid(flat);
    const last  = caro?.lastMove;
    const canClick = !caro?.roundOver && isMeTurn;

    return (
      <div className="board-wrap">
        <div className="board">
          {grid.map((row, ri) =>
            row.map((val, ci) => {
              const idx  = cellIdx(ri, ci);
              const isX  = val === "X";
              const isO  = val === "O";
              const isLast = last?.row === ri && last?.col === ci;
              const isAnim = animCell?.idx === idx;
              const symClass = isX ? "x-piece" : isO ? "o-piece" : "";
              const animClass = isAnim ? (isX ? "anim-x" : "anim-o") : "";
              const disabledClass = (!canClick && !val) ? "disabled" : "";
              return (
                <div
                  key={idx}
                  className={`cell ${symClass} ${isLast ? "last-move" : ""} ${animClass} ${disabledClass}`}
                  onClick={() => handleCellClick(ri, ci)}
                >
                  {isX ? SYM_CHARS.X : isO ? SYM_CHARS.O : ""}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  const DissolvedOverlay = () => (
    <div className="dissolved-overlay">
      <div className="dissolved-box">
        <div style={{ fontSize: 42 }}>💨</div>
        <h2>Phòng đã đóng</h2>
        <p>Một người chơi đã thoát khỏi phòng.</p>
        <button className="c-btn c-btn-x" onClick={handleLeave}>Về trang chủ</button>
      </div>
    </div>
  );

  /* ════════════ LOBBY ════════════ */
  if (screen === "lobby") return (
    <div className="caro-app">
      {dissolved && <DissolvedOverlay />}
      <div className="c-logo">
        <div className="c-logo-text">
          <span className="c-logo-x">C</span>ARO
        </div>
      </div>
      <p className="c-logo-sub">// 15×15 · thắng 5 · 2 người chơi</p>

      <div className="c-card">
        <div className="c-card-title">Chọn chế độ chơi</div>
        <div className="mode-grid">
          <div
            className={`mode-card ${mode === MODE_FREE ? "selected-free" : ""}`}
            onClick={() => setMode(MODE_FREE)}
          >
            <div><span className="mode-tag mode-tag-free">TỰ DO</span></div>
            <div className="mode-card-title" style={{ color: mode === MODE_FREE ? "var(--x)" : "var(--text)" }}>
              Caro Tự Do
            </div>
            <div className="mode-card-desc">
              5 quân liên tiếp là thắng<br/>
              Kể cả 6, 7 quân liên tiếp<br/>
              Không cần đầu hở
            </div>
          </div>
          <div
            className={`mode-card ${mode === MODE_BLOCK ? "selected-block" : ""}`}
            onClick={() => setMode(MODE_BLOCK)}
          >
            <div><span className="mode-tag mode-tag-block">CHẶN 2 ĐẦU</span></div>
            <div className="mode-card-title" style={{ color: mode === MODE_BLOCK ? "var(--o)" : "var(--text)" }}>
              Caro Chặn 2 Đầu
            </div>
            <div className="mode-card-desc">
              Phải có ít nhất 1 đầu hở<br/>
              Bị chặn cả 2 đầu = không thắng<br/>
              Chiến thuật cao hơn
            </div>
          </div>
        </div>
      </div>

      <div className="c-card">
        <div className="c-card-title">Tạo phòng mới</div>
        <input className="c-inp" placeholder="Tên của bạn" value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleCreate()} />
        <button className="c-btn c-btn-x" onClick={handleCreate}>
          Tạo phòng · {mode === MODE_FREE ? "Tự Do" : "Chặn 2 Đầu"} →
        </button>
      </div>

      <div className="c-card">
        <div className="c-card-title">Tham gia phòng</div>
        <input className="c-inp" placeholder="Tên của bạn" value={name}
          onChange={e => setName(e.target.value)} />
        <input className="c-inp c-inp-mono" placeholder="MÃ PHÒNG" value={inputRoom}
          onChange={e => setInputRoom(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === "Enter" && handleJoin()} />
        <button className="c-btn c-btn-sec" onClick={handleJoin}>Tham gia →</button>
      </div>

      {error && <p className="c-err">{error}</p>}
      {copiedToast && <div className="toast">✓ Đã copy mã phòng!</div>}
    </div>
  );

  /* ════════════ ROOM ════════════ */
  const playerCount = Object.keys(players || {}).length;
  const caroMode    = roomData?.caro?.mode ?? roomData?.["caro"]?.mode ?? mode;

  if (screen === "room") return (
    <div className="caro-app">
      {dissolved && <DissolvedOverlay />}
      <div className="c-card" style={{ marginTop: 28 }}>
        <div className="c-card-title">Mã phòng</div>
        <div className="room-code-wrap">
          <div className="room-code" onClick={handleCopy}>{roomId}</div>
        </div>
        <div className="room-hint">nhấn để copy · {playerCount}/4 người</div>

        <div className={`mode-badge ${caroMode === MODE_BLOCK ? "mode-badge-block" : "mode-badge-free"}`}>
          {caroMode === MODE_BLOCK ? "⚔ Chặn 2 Đầu" : "🔥 Tự Do"}&nbsp;·&nbsp;thắng 5 liên tiếp
        </div>

        <hr className="divider" />

        {PLAYER_SLOTS.map((slot, idx) => {
          const p = players?.[slot];
          const isMe = slot === myRole;
          const sym = idx % 2 === 0 ? "X" : "O";
          return (
            <div className="player-row" key={slot}>
              <div className={`av ${p ? AV_CLASSES[idx] : "av-empty"}`}>
                {p ? p.name[0].toUpperCase() : (idx + 1)}
              </div>
              <div className={`p-name${!p ? " p-name-empty" : ""}`}>
                {p?.name ?? "Chờ..."}
                {p && <span className={`sym-badge sym-${sym.toLowerCase()}`}>{SYM_CHARS[sym]}</span>}
                {isMe && <span className="p-tag tag-you">bạn</span>}
              </div>
              <span className={`p-tag ${idx === 0 ? "tag-host" : p ? "tag-join" : "tag-wait"} ${!p ? "pulse" : ""}`}>
                {idx === 0 ? "host" : p ? "joined" : "waiting"}
              </span>
            </div>
          );
        })}

        <hr className="divider" />
        {myRole === "player1"
          ? <button className="c-btn c-btn-x" onClick={handleStart} disabled={playerCount < 2}>
              {playerCount < 2 ? `Chờ người... (${playerCount}/4)` : `▶ Bắt đầu — ${playerCount} người`}
            </button>
          : <p style={{ textAlign:"center", color:"var(--muted)", fontSize:13, fontFamily:"'JetBrains Mono',monospace" }}>
              Chờ host bắt đầu...
            </p>
        }
        <button className="c-btn c-btn-danger" onClick={handleLeave}>Thoát phòng</button>
      </div>
      {copiedToast && <div className="toast">✓ Đã copy mã phòng!</div>}
    </div>
  );

  /* ════════════ GAME OVER ════════════ */
  if (caro?.roundOver) {
    const symbols = caro.symbols || {};
    const sorted  = Object.entries(players || {})
      .map(([role, p]) => ({ role, name: p.name, score: p.score ?? 0, sym: symbols[role] }))
      .sort((a, b) => b.score - a.score);
    const myRematch    = caro.rematch?.[myRole];
    const rematchCount = Object.keys(caro.rematch || {}).length;
    const winSym = caro.winner !== "draw" ? caro.winner : null;

    return (
      <div className="caro-app">
        {dissolved && <DissolvedOverlay />}
        <div className="gameover-wrap">
          <div className="go-card">
            <div className="go-icon">
              {caro.winner === "draw" ? "🤝" : caro.winnerRole === myRole ? "🏆" : "😤"}
            </div>
            <div className="go-title">
              {caro.winner === "draw" ? "Hòa!" : caro.winnerRole === myRole ? "Bạn thắng!" : `${players?.[caro.winnerRole]?.name} thắng!`}
            </div>
            <div className="go-sub">
              {caroMode === MODE_BLOCK ? "⚔ Chặn 2 Đầu" : "🔥 Tự Do"} · {(caro.moveCount ?? 0)} nước đi
            </div>

            <div className="lb">
              {sorted.map((p, i) => (
                <div key={p.role} className={`lb-row ${p.role === myRole ? "me" : ""}`}>
                  <span className="lb-rank">{MEDALS[i] ?? "—"}</span>
                  <span className="lb-name">
                    {p.sym && <span className={`lb-sym sym-${(p.sym||"").toLowerCase()}`}>{SYM_CHARS[p.sym]}</span>}
                    {p.name}
                    {p.role === myRole && <span className="lb-me-tag"> (bạn)</span>}
                  </span>
                  <span className={`lb-score lb-score-${(p.sym||"x").toLowerCase()}`}>{p.score} thắng</span>
                </div>
              ))}
            </div>

            <button className="c-btn c-btn-x" onClick={handleRematch} disabled={!!myRematch} style={{ marginBottom: 8 }}>
              {myRematch ? "Đã sẵn sàng ✓" : "Chơi lại"}
            </button>
            <button className="c-btn c-btn-danger" onClick={handleLeave}>Về trang chủ</button>
            {myRematch && <p className="rematch-hint">{rematchCount}/{playerCount} người sẵn sàng...</p>}
          </div>
        </div>
      </div>
    );
  }

  /* ════════════ GAME ════════════ */
  if (screen !== "game" || !caro) return (
    <div className="caro-app">
      <div className="loading-wrap">Đang tải...</div>
    </div>
  );

  const symbols = caro.symbols || {};
  const turnRole = caro.currentTurn;
  const turnName = players?.[turnRole]?.name ?? turnRole;
  const turnSym  = symbols[turnRole];
  const mySym    = symbols[myRole];
  const caroModeLabel = (roomData?.caro?.mode === MODE_BLOCK) ? "Chặn 2 Đầu" : "Tự Do";

  // Separate out active players vs spectators
  const activePlayers = PLAYER_SLOTS.filter(r => r !== myRole && players?.[r]).filter(
    (_, i) => i < 1 // show first opponent in score bar
  );
  const opponentRole = Object.keys(symbols).find(r => r !== myRole) ?? "";
  const opponentSym  = symbols[opponentRole];

  return (
    <div className="caro-app">
      {dissolved && <DissolvedOverlay />}

      {/* Header */}
      <div className="g-head">
        <div className="g-logo">
          <span className="c-logo-x">C</span>ARO
          <span style={{ fontSize:11, color:"var(--muted)", fontFamily:"'JetBrains Mono',monospace", fontWeight:400, marginLeft:8 }}>{caroModeLabel}</span>
        </div>
        <div className="g-room">#{roomId}</div>
      </div>

      {/* Score bar */}
      <div className="score-bar">
        <div className={`score-player ${myRole === turnRole ? "my-turn" : ""}`}>
          <div className="score-p-name">
            {players?.[myRole]?.name} (bạn)
          </div>
          <div className={`score-p-val sym-${(mySym||"x").toLowerCase()}`}>
            {SYM_CHARS[mySym] ?? "?"}
            <span className="score-wins score-wins-x"> {players?.[myRole]?.score ?? 0}W</span>
          </div>
        </div>
        <div className="score-vs">VS</div>
        <div className={`score-player ${opponentRole === turnRole ? "my-turn" : ""}`}>
          <div className="score-p-name">{players?.[opponentRole]?.name ?? "..."}</div>
          <div className={`score-p-val sym-${(opponentSym||"o").toLowerCase()}`}>
            {SYM_CHARS[opponentSym] ?? "?"}
            <span className={`score-wins score-wins-o`}> {players?.[opponentRole]?.score ?? 0}W</span>
          </div>
        </div>
      </div>

      {/* Turn bar */}
      <div className="turn-bar">
        <div className="turn-indicator">
          <div className={`turn-sym turn-sym-${(turnSym||"x").toLowerCase()}`}>
            {SYM_CHARS[turnSym] ?? "?"}
          </div>
          <span className={isMeTurn ? "turn-mine" : "turn-others"}>
            {isMeTurn ? "Lượt của bạn" : `${turnName} đang đi...`}
          </span>
        </div>
        <div className="move-count">{caro.moveCount ?? 0} nước</div>
      </div>

      {/* Notice */}
      {notice && <div className={`notice notice-${notice.type}`}>{notice.text}</div>}

      {/* Board */}
      <BoardView />

      {copiedToast && <div className="toast">✓ Đã copy!</div>}
    </div>
  );
}