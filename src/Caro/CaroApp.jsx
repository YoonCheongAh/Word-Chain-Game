import { useState, useEffect } from "react";
import {
  createCaroRoom, joinCaroRoom, startCaroGame, makeMove,
  requestCaroRematch, setCaroPlayerOnline,
  flatToGrid, cellIdx, BOARD_SIZE, MODE_FREE, MODE_BLOCK,
} from "./caroService";
import { listenRoom } from "../roomService";
import { ref, onValue, onDisconnect, update } from "firebase/database";
import { db } from "../firebase";

/* ─── STYLES ─────────────────────────────────────────────────────────────── */
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

.c-logo{text-align:center;padding:36px 0 8px;}
.c-logo-text{font-size:56px;font-weight:800;letter-spacing:-2px;line-height:1;}
.c-logo-x{color:var(--x);}
.c-logo-sub{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted);letter-spacing:1px;text-align:center;margin-bottom:36px;}

.c-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px;margin-bottom:12px;}
.c-card-title{font-size:10px;font-weight:600;color:var(--muted);letter-spacing:2px;text-transform:uppercase;margin-bottom:16px;}

.c-inp{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);
  color:var(--text);font-family:'Syne',sans-serif;font-size:14px;padding:11px 14px;
  outline:none;transition:border-color .15s;margin-bottom:10px;display:block;}
.c-inp:focus{border-color:var(--x);}
.c-inp::placeholder{color:var(--muted);}
.c-inp-mono{font-family:'JetBrains Mono',monospace;letter-spacing:3px;font-size:13px;}

.mode-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;}
.mode-card{background:var(--bg);border:2px solid var(--border);border-radius:var(--radius-sm);
  padding:14px 12px;cursor:pointer;transition:all .2s;text-align:left;}
.mode-card:hover{border-color:var(--dim);}
.mode-card.sel-free{border-color:var(--x);background:var(--x-dim);}
.mode-card.sel-block{border-color:var(--o);background:var(--o-dim);}
.mode-card-title{font-size:13px;font-weight:700;margin-bottom:4px;}
.mode-card-desc{font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--muted);line-height:1.6;}
.mode-tag{display:inline-block;font-family:'JetBrains Mono',monospace;font-size:9px;
  padding:2px 8px;border-radius:20px;margin-bottom:6px;letter-spacing:.5px;}
.mode-tag-free{background:var(--x-dim);color:var(--x);border:1px solid var(--x-mid);}
.mode-tag-block{background:var(--o-dim);color:var(--o);border:1px solid var(--o-mid);}

.c-btn{display:block;width:100%;padding:13px 16px;border-radius:var(--radius-sm);border:none;
  cursor:pointer;font-family:'Syne',sans-serif;font-size:14px;font-weight:700;
  transition:opacity .15s,transform .1s;text-align:center;}
.c-btn:active{transform:scale(.98);}
.c-btn:disabled{opacity:.3;cursor:not-allowed;}
.c-btn-x{background:var(--x);color:#fff;}
.c-btn-x:hover:not(:disabled){opacity:.85;}
.c-btn-sec{background:transparent;color:var(--text);border:1px solid var(--border);}
.c-btn-sec:hover:not(:disabled){background:var(--surface);}
.c-btn-danger{background:transparent;color:var(--red);border:1px solid var(--red-dim);margin-top:8px;}
.c-btn-danger:hover:not(:disabled){background:var(--red-dim);}
.c-err{color:var(--red);font-size:11px;font-family:'JetBrains Mono',monospace;margin-top:8px;text-align:center;}

.room-code-wrap{text-align:center;padding:6px 0 2px;}
.room-code{font-family:'JetBrains Mono',monospace;font-size:42px;font-weight:600;
  letter-spacing:10px;color:var(--x);cursor:pointer;transition:opacity .15s;}
.room-code:hover{opacity:.7;}
.room-hint{text-align:center;font-size:11px;color:var(--muted);font-family:'JetBrains Mono',monospace;margin-bottom:14px;}
.divider{border:none;border-top:1px solid var(--border);margin:14px 0;}

.mode-badge{display:flex;align-items:center;gap:6px;font-family:'JetBrains Mono',monospace;
  font-size:10px;padding:5px 12px;border-radius:20px;margin:0 auto 14px;width:fit-content;}
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
.sym-badge{font-family:'JetBrains Mono',monospace;font-size:11px;margin-left:6px;font-weight:700;}
.sym-x{color:var(--x);}
.sym-o{color:var(--o);}
.pulse{animation:cpulse 1.8s ease-in-out infinite;}
@keyframes cpulse{0%,100%{opacity:1}50%{opacity:.3}}

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

.score-bar{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;margin-bottom:14px;}
.score-player{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 14px;}
.score-player.my-turn{border-color:var(--green);}
.score-p-name{font-size:11px;color:var(--muted);font-family:'JetBrains Mono',monospace;margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.score-p-val{font-size:20px;font-weight:800;line-height:1;}
.score-p-val.val-x{color:var(--x);}
.score-p-val.val-o{color:var(--o);}
.score-vs{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted);text-align:center;}
.score-wins{font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:600;}

.notice{text-align:center;font-family:'JetBrains Mono',monospace;font-size:12px;
  padding:10px 14px;border-radius:var(--radius-sm);margin-bottom:12px;}
.notice-win{background:var(--green-dim);color:var(--green);border:1px solid #1e5c30;}
.notice-lose{background:var(--red-dim);color:var(--red);border:1px solid #5a1a1a;}
.notice-draw{background:var(--gold-dim);color:var(--gold);border:1px solid #5a4500;}

.board-wrap{overflow-x:auto;margin-bottom:16px;}
.caro-board{
  display:inline-grid;
  grid-template-columns:repeat(15,var(--csz));
  grid-template-rows:repeat(15,var(--csz));
  --csz:36px;gap:1px;
  background:var(--border);border:1px solid var(--border);
  border-radius:var(--radius-sm);overflow:hidden;user-select:none;
}
@media(max-width:600px){.caro-board{--csz:26px;}}
@media(max-width:420px){.caro-board{--csz:21px;}}

.cc{
  width:var(--csz);height:var(--csz);background:var(--surface);
  display:flex;align-items:center;justify-content:center;
  cursor:pointer;
  font-size:calc(var(--csz) * .52);font-weight:800;
  font-family:'JetBrains Mono',monospace;
}
.cc:hover{background:var(--surface2);}
.cc.cx{color:var(--x);cursor:default;}
.cc.co{color:var(--o);cursor:default;}
.cc.cx:hover,.cc.co:hover{background:var(--surface);}
.cc.clast{background:#1e1e2e;}
.cc.cnodrop{cursor:not-allowed;}
@keyframes cplaceX{0%{transform:scale(.2);opacity:0}70%{transform:scale(1.25)}100%{transform:scale(1);opacity:1}}
@keyframes cplaceO{0%{transform:scale(.2);opacity:0}70%{transform:scale(1.2)}100%{transform:scale(1);opacity:1}}
.cc.canx{animation:cplaceX .2s cubic-bezier(.2,.8,.3,1) both;}
.cc.cano{animation:cplaceO .2s cubic-bezier(.2,.8,.3,1) both;}

.gameover-wrap{padding-top:28px;}
.go-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:28px 24px;}
.go-icon{text-align:center;font-size:52px;margin-bottom:12px;}
.go-title{font-size:30px;font-weight:800;text-align:center;margin-bottom:4px;letter-spacing:-1px;}
.go-sub{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted);text-align:center;margin-bottom:24px;}
.lb{margin-bottom:20px;}
.lb-row{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:var(--radius-sm);
  background:var(--bg);margin-bottom:6px;border:1px solid transparent;}
.lb-row.lbme{border-color:var(--green-dim);}
.lb-rank{font-size:22px;min-width:32px;}
.lb-name{flex:1;font-size:14px;font-weight:700;}
.lb-score{font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:600;}
.lb-score-x{color:var(--x);}
.lb-score-o{color:var(--o);}
.rematch-hint{font-size:11px;font-family:'JetBrains Mono',monospace;color:var(--gold);text-align:center;margin-top:10px;}

.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
  background:var(--green);color:#fff;font-family:'JetBrains Mono',monospace;
  font-size:12px;padding:8px 18px;border-radius:20px;z-index:999;pointer-events:none;}

.dissolved-overlay{position:fixed;inset:0;background:rgba(14,14,18,.96);
  display:flex;align-items:center;justify-content:center;z-index:100;}
.dissolved-box{text-align:center;padding:40px 32px;background:var(--surface);
  border:1px solid var(--red-dim);border-radius:var(--radius);max-width:300px;}
.dissolved-box h2{font-size:22px;font-weight:800;margin:12px 0 6px;}
.dissolved-box p{font-size:11px;color:var(--muted);font-family:'JetBrains Mono',monospace;margin-bottom:20px;}
.loading-wrap{padding-top:60px;text-align:center;color:var(--muted);
  font-family:'JetBrains Mono',monospace;font-size:13px;}
`;

const SYM = { X: "✕", O: "○" };
const MEDALS = ["🥇", "🥈"];

// Firebase xóa null trong array → dùng hàm này để kiểm tra ô trống
function isCellEmpty(val) {
  return val === null || val === undefined || val === 0 || val === false || val === "";
}

export default function CaroApp() {
  const [screen,      setScreen]      = useState("lobby");
  const [name,        setName]        = useState("");
  const [inputRoom,   setInputRoom]   = useState("");
  const [roomId,      setRoomId]      = useState("");
  const [myRole,      setMyRole]      = useState("");
  const [roomData,    setRoomData]    = useState(null);
  const [mode,        setMode]        = useState(MODE_FREE);
  const [error,       setError]       = useState("");
  const [notice,      setNotice]      = useState(null);
  const [copiedToast, setCopiedToast] = useState(false);
  const [dissolved,   setDissolved]   = useState(false);
  const [animCell,    setAnimCell]    = useState(null);

  /* ── CSS inject ── */
  useEffect(() => {
    const id = "caro-v2-styles";
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

  const caro    = roomData?.caro;
  const players = roomData?.players;
  const isMeTurn = caro?.currentTurn === myRole;
  const mySym    = caro?.symbols?.[myRole];

  /* ── Win notice ── */
  useEffect(() => {
    if (!caro?.roundOver) { setNotice(null); return; }
    if (caro.winner === "draw") {
      setNotice({ text: "🤝 Hòa! Không ai thắng.", type: "draw" });
    } else if (caro.winnerRole === myRole) {
      setNotice({ text: `🎉 Bạn thắng! ${SYM[mySym]} chiến thắng!`, type: "win" });
    } else {
      const wname = players?.[caro.winnerRole]?.name ?? "Đối thủ";
      setNotice({ text: `😔 ${wname} thắng rồi!`, type: "lose" });
    }
  }, [caro?.roundOver]);

  /* ── Cell click ── */
  async function handleCellClick(row, col) {
    if (!caro || caro.roundOver || !isMeTurn) return;
    const idx = cellIdx(row, col);
    const board = caro.board ?? [];
    // FIX: dùng isCellEmpty thay vì check null/undefined trực tiếp
    // vì Firebase xóa null → ô trống có thể là undefined hoặc 0
    if (!isCellEmpty(board[idx])) return;
    setAnimCell({ idx, sym: mySym });
    setTimeout(() => setAnimCell(null), 280);
    await makeMove(roomId, myRole, row, col);
  }

  /* ── Actions ── */
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
      const slot = await joinCaroRoom(inputRoom.toUpperCase(), name.trim());
      setRoomId(inputRoom.toUpperCase()); setMyRole(slot); setScreen("room");
    } catch(e) { setError(e.message); }
  }

  async function handleStart() {
    const cnt = Object.keys(players || {}).length;
    if (cnt < 2) return;
    await startCaroGame(roomId);
  }

  async function handleRematch() {
    await requestCaroRematch(roomId, myRole);
  }

  function handleLeave() {
    setCaroPlayerOnline(roomId, myRole, false);
    setRoomId(""); setMyRole(""); setRoomData(null);
    setScreen("lobby"); setDissolved(false); setNotice(null); setError("");
  }

  function handleCopy() {
    navigator.clipboard?.writeText(roomId).catch(() => {});
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 1800);
  }

  /* ── DISSOLVED ── */
  function DissolvedOverlay() {
    return (
      <div className="dissolved-overlay">
        <div className="dissolved-box">
          <div style={{ fontSize: 42 }}>💨</div>
          <h2>Phòng đã đóng</h2>
          <p>Người chơi kia đã thoát.</p>
          <button className="c-btn c-btn-x" onClick={handleLeave}>Về trang chủ</button>
        </div>
      </div>
    );
  }

  /* ════════════ LOBBY ════════════ */
  if (screen === "lobby") return (
    <div className="caro-app">
      {dissolved && <DissolvedOverlay />}
      <div className="c-logo">
        <div className="c-logo-text"><span className="c-logo-x">C</span>ARO</div>
      </div>
      <p className="c-logo-sub">// 15×15 · thắng 5 · 2 người chơi</p>

      <div className="c-card">
        <div className="c-card-title">Chọn chế độ chơi</div>
        <div className="mode-grid">
          <div className={`mode-card ${mode === MODE_FREE ? "sel-free" : ""}`} onClick={() => setMode(MODE_FREE)}>
            <div><span className="mode-tag mode-tag-free">TỰ DO</span></div>
            <div className="mode-card-title" style={{ color: mode === MODE_FREE ? "var(--x)" : "var(--text)" }}>Caro Tự Do</div>
            <div className="mode-card-desc">5 quân liên tiếp là thắng<br/>Kể cả 6, 7 quân<br/>Không cần đầu hở</div>
          </div>
          <div className={`mode-card ${mode === MODE_BLOCK ? "sel-block" : ""}`} onClick={() => setMode(MODE_BLOCK)}>
            <div><span className="mode-tag mode-tag-block">CHẶN 2 ĐẦU</span></div>
            <div className="mode-card-title" style={{ color: mode === MODE_BLOCK ? "var(--o)" : "var(--text)" }}>Caro Chặn 2 Đầu</div>
            <div className="mode-card-desc">Phải có ít nhất 1 đầu hở<br/>Bị chặn 2 đầu = không thắng<br/>Chiến thuật cao hơn</div>
          </div>
        </div>
      </div>

      <div className="c-card">
        <div className="c-card-title">Tạo phòng mới</div>
        <input className="c-inp" placeholder="Tên của bạn" value={name}
          onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleCreate()} />
        <button className="c-btn c-btn-x" onClick={handleCreate}>
          Tạo phòng · {mode === MODE_FREE ? "Tự Do" : "Chặn 2 Đầu"} →
        </button>
      </div>

      <div className="c-card">
        <div className="c-card-title">Tham gia phòng</div>
        <input className="c-inp" placeholder="Tên của bạn" value={name} onChange={e => setName(e.target.value)} />
        <input className="c-inp c-inp-mono" placeholder="MÃ PHÒNG" value={inputRoom}
          onChange={e => setInputRoom(e.target.value.toUpperCase())} onKeyDown={e => e.key === "Enter" && handleJoin()} />
        <button className="c-btn c-btn-sec" onClick={handleJoin}>Tham gia →</button>
      </div>

      {error && <p className="c-err">{error}</p>}
    </div>
  );

  /* ════════════ ROOM ════════════ */
  const playerCount = Object.keys(players || {}).length;
  const roomMode    = roomData?.caro?.mode ?? mode;

  if (screen === "room") return (
    <div className="caro-app">
      {dissolved && <DissolvedOverlay />}
      <div className="c-card" style={{ marginTop: 28 }}>
        <div className="c-card-title">Mã phòng</div>
        <div className="room-code-wrap">
          <div className="room-code" onClick={handleCopy}>{roomId}</div>
        </div>
        <div className="room-hint">nhấn để copy · {playerCount}/2 người</div>

        <div className={`mode-badge ${roomMode === MODE_BLOCK ? "mode-badge-block" : "mode-badge-free"}`}>
          {roomMode === MODE_BLOCK ? "⚔ Chặn 2 Đầu" : "🔥 Tự Do"} · thắng 5 liên tiếp
        </div>

        <hr className="divider" />

        {["player1","player2"].map((slot, idx) => {
          const p    = players?.[slot];
          const isMe = slot === myRole;
          const sym  = idx === 0 ? "X" : "O";
          return (
            <div className="player-row" key={slot}>
              <div className={`av ${p ? (idx === 0 ? "av-x" : "av-o") : "av-empty"}`}>
                {p ? p.name[0].toUpperCase() : (idx + 1)}
              </div>
              <div className={`p-name${!p ? " p-name-empty" : ""}`}>
                {p?.name ?? "Chờ..."}
                {p && <span className={`sym-badge sym-${sym.toLowerCase()}`}>{SYM[sym]}</span>}
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
              {playerCount < 2 ? `Chờ đối thủ... (${playerCount}/2)` : "▶ Bắt đầu"}
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
    const syms   = caro.symbols || {};
    const sorted = Object.entries(players || {})
      .map(([role, p]) => ({ role, name: p.name, score: p.score ?? 0, sym: syms[role] }))
      .sort((a, b) => b.score - a.score);
    const myRematch    = caro.rematch?.[myRole];
    const rematchCount = Object.keys(caro.rematch || {}).length;

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
              {roomMode === MODE_BLOCK ? "⚔ Chặn 2 Đầu" : "🔥 Tự Do"} · {caro.moveCount ?? 0} nước đi
            </div>
            <div className="lb">
              {sorted.map((p, i) => (
                <div key={p.role} className={`lb-row ${p.role === myRole ? "lbme" : ""}`}>
                  <span className="lb-rank">{MEDALS[i] ?? "—"}</span>
                  <span className="lb-name">
                    {p.sym && <span style={{ color: p.sym === "X" ? "var(--x)" : "var(--o)", marginRight: 6, fontSize: 16 }}>{SYM[p.sym]}</span>}
                    {p.name}
                    {p.role === myRole && <span style={{ fontSize:9, color:"var(--muted)", fontFamily:"'JetBrains Mono',monospace", marginLeft:4 }}>(bạn)</span>}
                  </span>
                  <span className={`lb-score lb-score-${(p.sym||"x").toLowerCase()}`}>{p.score} thắng</span>
                </div>
              ))}
            </div>
            <button className="c-btn c-btn-x" onClick={handleRematch} disabled={!!myRematch} style={{ marginBottom:8 }}>
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
    <div className="caro-app"><div className="loading-wrap">Đang tải...</div></div>
  );

  const syms        = caro.symbols || {};
  const turnRole    = caro.currentTurn;
  const turnName    = players?.[turnRole]?.name ?? turnRole;
  const turnSym     = syms[turnRole];
  const opponentRole = Object.keys(syms).find(r => r !== myRole) ?? "";
  const opponentSym  = syms[opponentRole];
  const modeLabel    = roomMode === MODE_BLOCK ? "Chặn 2 Đầu" : "Tự Do";

  // Build board — đảm bảo đủ 225 phần tử, lấp lỗ hổng Firebase
  const rawFlat = caro.board ?? [];
  const flat = Array(BOARD_SIZE * BOARD_SIZE).fill(0).map((_, i) => rawFlat[i] ?? 0);
  const grid = flatToGrid(flat);
  const last = caro.lastMove;

  return (
    <div className="caro-app">
      {dissolved && <DissolvedOverlay />}

      <div className="g-head">
        <div className="g-logo">
          <span className="c-logo-x">C</span>ARO
          <span style={{ fontSize:11, color:"var(--muted)", fontFamily:"'JetBrains Mono',monospace", fontWeight:400, marginLeft:8 }}>{modeLabel}</span>
        </div>
        <div className="g-room">#{roomId}</div>
      </div>

      {/* Scores */}
      <div className="score-bar">
        <div className={`score-player ${myRole === turnRole ? "my-turn" : ""}`}>
          <div className="score-p-name">{players?.[myRole]?.name} (bạn)</div>
          <div className={`score-p-val val-${(mySym||"x").toLowerCase()}`}>
            {SYM[mySym] ?? "?"}
            <span className="score-wins" style={{ color: mySym === "X" ? "var(--x)" : "var(--o)", marginLeft:6 }}>
              {players?.[myRole]?.score ?? 0}W
            </span>
          </div>
        </div>
        <div className="score-vs">VS</div>
        <div className={`score-player ${opponentRole === turnRole ? "my-turn" : ""}`}>
          <div className="score-p-name">{players?.[opponentRole]?.name ?? "..."}</div>
          <div className={`score-p-val val-${(opponentSym||"o").toLowerCase()}`}>
            {SYM[opponentSym] ?? "?"}
            <span className="score-wins" style={{ color: opponentSym === "X" ? "var(--x)" : "var(--o)", marginLeft:6 }}>
              {players?.[opponentRole]?.score ?? 0}W
            </span>
          </div>
        </div>
      </div>

      {/* Turn */}
      <div className="turn-bar">
        <div className="turn-indicator">
          <div className={`turn-sym turn-sym-${(turnSym||"x").toLowerCase()}`}>{SYM[turnSym] ?? "?"}</div>
          <span className={isMeTurn ? "turn-mine" : "turn-others"}>
            {isMeTurn ? "Lượt của bạn" : `${turnName} đang đi...`}
          </span>
        </div>
        <div className="move-count">{caro.moveCount ?? 0} nước</div>
      </div>

      {notice && <div className={`notice notice-${notice.type}`}>{notice.text}</div>}

      {/* Board */}
      <div className="board-wrap">
        <div className="caro-board">
          {grid.map((row, ri) =>
            row.map((val, ci) => {
              const idx     = cellIdx(ri, ci);
              const isEmpty = isCellEmpty(val);
              const isX     = val === "X";
              const isO     = val === "O";
              const isLast  = last?.row === ri && last?.col === ci;
              const isAnim  = animCell?.idx === idx;
              const animCls = isAnim ? (animCell.sym === "X" ? "canx" : "cano") : "";
              const canClick = !caro.roundOver && isMeTurn && isEmpty;
              return (
                <div
                  key={idx}
                  className={[
                    "cc",
                    isX ? "cx" : isO ? "co" : "",
                    isLast ? "clast" : "",
                    animCls,
                    (!canClick && isEmpty) ? "cnodrop" : "",
                  ].join(" ")}
                  onClick={() => handleCellClick(ri, ci)}
                >
                  {isX ? SYM.X : isO ? SYM.O : ""}
                </div>
              );
            })
          )}
        </div>
      </div>

      {copiedToast && <div className="toast">✓ Đã copy!</div>}
    </div>
  );
}