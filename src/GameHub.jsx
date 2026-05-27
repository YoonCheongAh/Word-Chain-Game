import { useState } from "react";
import App from "./WordChain/App";           // Word Chain
import WordleApp from "./Wordle/wordleapp"; // Wordle

const HUB_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800;900&family=DM+Mono:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #07070d; --surface: #0f0f18; --border: #1c1c28;
    --border-hover: #2e2e42; --text: #f0ede8; --muted: #44445a;
  }
  body { font-family: 'Syne', sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; }
  .hub-root { min-height: 100vh; padding: 0 0 80px; position: relative; overflow: hidden; }
  .hub-root::before {
    content: ''; position: fixed; inset: 0;
    background-image: linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px);
    background-size: 48px 48px; opacity: 0.35; pointer-events: none; z-index: 0;
  }
  .hub-root::after {
    content: ''; position: fixed; top: -200px; left: 50%; transform: translateX(-50%);
    width: 700px; height: 500px;
    background: radial-gradient(ellipse, rgba(29,158,117,0.10) 0%, transparent 70%);
    pointer-events: none; z-index: 0;
  }
  .hub-content { position: relative; z-index: 1; max-width: 1100px; margin: 0 auto; padding: 0 24px; }
  .hub-header { display: flex; align-items: center; justify-content: space-between; padding: 28px 0 48px; border-bottom: 1px solid var(--border); margin-bottom: 52px; }
  .hub-brand { display: flex; align-items: baseline; gap: 10px; }
  .hub-brand-name { font-size: 22px; font-weight: 900; letter-spacing: -0.5px; background: linear-gradient(135deg, var(--text) 0%, #888 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .hub-brand-tag { font-family: 'DM Mono', monospace; font-size: 11px; color: #1D9E75; background: rgba(29,158,117,0.12); border: 1px solid rgba(29,158,117,0.25); padding: 3px 8px; border-radius: 20px; }
  .hub-tagline { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--muted); }
  .hub-section-label { font-family: 'DM Mono', monospace; font-size: 10px; font-weight: 500; color: var(--muted); letter-spacing: 2px; text-transform: uppercase; margin-bottom: 20px; display: flex; align-items: center; gap: 12px; }
  .hub-section-label::after { content: ''; flex: 1; height: 1px; background: var(--border); }
  .game-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; margin-bottom: 48px; }
  .game-card { background: var(--surface); border: 1px solid var(--border); border-radius: 18px; overflow: hidden; cursor: pointer; transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s; position: relative; }
  .game-card:hover { border-color: var(--border-hover); transform: translateY(-3px); box-shadow: 0 16px 48px rgba(0,0,0,0.4); }
  .game-card.available:hover { border-color: var(--card-accent, #1D9E75); box-shadow: 0 16px 48px rgba(0,0,0,0.4), 0 0 0 1px var(--card-accent, #1D9E75); }
  .game-card.coming-soon { cursor: default; opacity: 0.45; }
  .game-card.coming-soon:hover { transform: none; box-shadow: none; border-color: var(--border); }
  .card-thumb { height: 152px; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; }
  .card-thumb-bg { position: absolute; inset: 0; opacity: 0.12; }
  .card-play-btn { position: absolute; top: 12px; right: 12px; background: var(--card-accent, #1D9E75); color: #fff; border: none; border-radius: 20px; font-family: 'Syne', sans-serif; font-size: 11px; font-weight: 700; padding: 5px 12px; cursor: pointer; opacity: 0; transform: translateY(-4px); transition: opacity 0.15s, transform 0.15s; z-index: 2; }
  .game-card.available:hover .card-play-btn { opacity: 1; transform: translateY(0); }
  .card-meta { padding: 14px 16px 16px; border-top: 1px solid var(--border); }
  .card-title { font-size: 16px; font-weight: 800; margin-bottom: 4px; letter-spacing: -0.3px; }
  .card-desc { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--muted); line-height: 1.5; margin-bottom: 10px; }
  .card-tags { display: flex; gap: 6px; flex-wrap: wrap; }
  .card-tag { font-family: 'DM Mono', monospace; font-size: 10px; padding: 2px 8px; border-radius: 20px; background: var(--border); color: var(--muted); }
  .card-tag.tag-live { background: rgba(29,158,117,0.15); color: #1D9E75; border: 1px solid rgba(29,158,117,0.25); }
  .card-tag.tag-live2 { background: rgba(106,170,100,0.15); color: #6aaa64; border: 1px solid rgba(106,170,100,0.25); }
  .card-tag.tag-soon { background: rgba(239,159,39,0.1); color: #EF9F27; }
  /* Thumbnails */
  .wc-thumb { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; justify-content: center; padding: 16px; position: relative; z-index: 1; }
  .wc-chip { font-family: 'DM Mono', monospace; font-size: 11px; font-weight: 500; padding: 4px 9px; border-radius: 20px; }
  .wc-c1 { background: #0f3d2e; color: #5DCAA5; border: 1px solid #1a5c44; }
  .wc-c2 { background: #0c2d4a; color: #85B7EB; border: 1px solid #1a4a72; }
  .wc-c3 { background: #3d1f0e; color: #EBA085; border: 1px solid #5c3018; }
  .wc-arr { color: #333; font-size: 12px; }
  .wd-thumb { display: flex; flex-direction: column; gap: 3px; position: relative; z-index: 1; }
  .wd-row { display: flex; gap: 3px; }
  .wd-cell { width: 24px; height: 24px; border-radius: 3px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; font-family: 'Syne', sans-serif; }
  .wd-empty { background: #1a1a22; border: 1px solid #2a2a35; }
  .wd-correct { background: #538d4e; color: #fff; }
  .wd-present { background: #b59f3b; color: #fff; }
  .wd-absent  { background: #3a3a4a; color: #888; }
  /* Back bar */
  .back-bar { position: fixed; top: 0; left: 0; right: 0; height: 48px; background: rgba(7,7,13,0.9); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); display: flex; align-items: center; padding: 0 20px; gap: 12px; z-index: 50; }
  .back-btn { display: flex; align-items: center; gap: 6px; background: none; border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-family: 'Syne', sans-serif; font-size: 12px; font-weight: 700; padding: 5px 12px; cursor: pointer; transition: border-color 0.15s, background 0.15s; }
  .back-btn:hover { border-color: var(--border-hover); background: var(--surface); }
  .back-bar-sep { color: var(--muted); font-size: 12px; font-family: 'DM Mono', monospace; }
  .back-bar-game { font-size: 13px; font-weight: 700; }
  .game-body { padding-top: 48px; }
  @media (max-width: 600px) { .game-grid { grid-template-columns: 1fr 1fr; gap: 10px; } .hub-header { flex-direction: column; align-items: flex-start; gap: 8px; padding: 20px 0 28px; margin-bottom: 28px; } .card-thumb { height: 110px; } }
`;

const GAMES = [
  {
    id: "wordchain",
    title: "Word Chain",
    desc: "Nối từ tiếng Anh · ai hết máu thua",
    players: "2–4", status: "live", accent: "#1D9E75", thumb: "wordchain",
  },
  {
    id: "wordle",
    title: "Wordle",
    desc: "Đoán từ 5 chữ · 5 lần thử · ghi điểm",
    players: "2–4", status: "live", accent: "#6aaa64", thumb: "wordle",
  },
  {
    id: "coming1",
    title: "???",
    desc: "Minigame tiếp theo đang được phát triển...",
    players: "?", status: "soon", accent: "#DD7537", thumb: "soon",
  },
];

function WordChainThumb() {
  return (
    <div className="wc-thumb">
      <span className="wc-chip wc-c1">apple</span>
      <span className="wc-arr">→</span>
      <span className="wc-chip wc-c2">elephant</span>
      <span className="wc-arr">→</span>
      <span className="wc-chip wc-c3">tiger</span>
    </div>
  );
}

function WordleThumb() {
  const rows = [
    [{l:"B",s:"absent"},{l:"R",s:"absent"},{l:"A",s:"present"},{l:"V",s:"absent"},{l:"E",s:"absent"}],
    [{l:"P",s:"absent"},{l:"L",s:"absent"},{l:"A",s:"correct"},{l:"N",s:"absent"},{l:"T",s:"present"}],
    [{l:"S",s:"absent"},{l:"T",s:"correct"},{l:"A",s:"correct"},{l:"T",s:"correct"},{l:"E",s:"correct"}],
    null, null,
  ];
  return (
    <div className="wd-thumb">
      {rows.map((row, ri) => (
        <div className="wd-row" key={ri}>
          {row
            ? row.map((c, ci) => <div key={ci} className={`wd-cell wd-${c.s}`}>{c.l}</div>)
            : Array(5).fill(null).map((_, ci) => <div key={ci} className="wd-cell wd-empty" />)
          }
        </div>
      ))}
    </div>
  );
}

function GameCard({ game, onPlay }) {
  const available = game.status === "live";
  return (
    <div className={`game-card ${available ? "available" : "coming-soon"}`}
      style={{ "--card-accent": game.accent }}
      onClick={() => available && onPlay(game.id)}>
      {available && <button className="card-play-btn" tabIndex={-1}>▶ Chơi</button>}
      <div className="card-thumb">
        <div className="card-thumb-bg"
          style={{ background: `radial-gradient(ellipse at center, ${game.accent}33 0%, transparent 70%)` }} />
        {game.thumb === "wordchain" && <WordChainThumb />}
        {game.thumb === "wordle" && <WordleThumb />}
        {game.thumb === "soon" && <div style={{ fontSize: 40, opacity: 0.25, position: "relative", zIndex: 1 }}>🎲</div>}
      </div>
      <div className="card-meta">
        <div className="card-title">{game.title}</div>
        <div className="card-desc">{game.desc}</div>
        <div className="card-tags">
          {game.status === "live"
            ? <span className={`card-tag ${game.id === "wordle" ? "tag-live2" : "tag-live"}`}>● Live</span>
            : <span className="card-tag tag-soon">Soon</span>}
          <span className="card-tag">👥 {game.players} người</span>
        </div>
      </div>
    </div>
  );
}

export default function GameHub() {
  const [activeGame, setActiveGame] = useState(null);

  if (typeof document !== "undefined" && !document.getElementById("hub-styles")) {
    const el = document.createElement("style");
    el.id = "hub-styles";
    el.textContent = HUB_STYLES;
    document.head.appendChild(el);
  }

  const GAME_COMPONENTS = { wordchain: App, wordle: WordleApp };
  const GAME_NAMES = { wordchain: "Word Chain", wordle: "Wordle" };

  if (activeGame && GAME_COMPONENTS[activeGame]) {
    const GameComponent = GAME_COMPONENTS[activeGame];
    return (
      <div>
        <div className="back-bar">
          <button className="back-btn" onClick={() => setActiveGame(null)}>← Hub</button>
          <span className="back-bar-sep">/</span>
          <span className="back-bar-game">{GAME_NAMES[activeGame]}</span>
        </div>
        <div className="game-body">
          <GameComponent />
        </div>
      </div>
    );
  }

  return (
    <div className="hub-root">
      <div className="hub-content">
        <header className="hub-header">
          <div className="hub-brand">
            <span className="hub-brand-name">MiniGames</span>
            <span className="hub-brand-tag">beta</span>
          </div>
          <span className="hub-tagline">// chọn game · mời bạn bè · chơi thôi</span>
        </header>
        <div className="hub-section-label">Games</div>
        <div className="game-grid">
          {GAMES.map(g => <GameCard key={g.id} game={g} onPlay={setActiveGame} />)}
        </div>
      </div>
    </div>
  );
}