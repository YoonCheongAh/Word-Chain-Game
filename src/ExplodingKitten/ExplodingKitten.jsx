'use client';

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { ref, onValue, update } from 'firebase/database';
import { db } from '../firebase';
import { createRoom, joinRoom, listenRoom, setPlayerOnline } from '../roomService';
import { SoundManager } from './ExplodingKittenSound';
import {
  startGame, drawCard, playCard, placeBombAfterDefuse,
  giveFavorCard, stealPairCard, closeSeeTheFuture, requestRematch,
  resolveNopeWindow, reorderAlterTheFuture,
  CARD_META, CARD_TYPES, CAT_CARD_TYPES, getCardImageStable, tradeFiveCatsForDefuse, placeImplodingKitten,
} from './ExplodingKittenService';

// ── Inject styles ONCE at module level, not in useEffect ──
const STYLE_ID = 'ek-styles';
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = getStyles();
  document.head.appendChild(style);
}

// ── Static arrays moved outside components ──
const BOMB_PARTICLES = [...Array(22)];
const BOMB_EMBERS = [...Array(14)];
const LOBBY_SPARKS = [...Array(12)];
const OPP_POSITIONS = { 1: ['north'], 2: ['northwest', 'northeast'], 3: ['northwest', 'north', 'northeast'], 4: ['west', 'northwest', 'northeast', 'east'] };
const SLOT_COLORS = ['#FF6B35', '#5DCAA5', '#85B7EB', '#C385EB', '#FFD700', '#FF1493'];
const SLOT_LABELS = ['HOST', 'P2', 'P3', 'P4', 'P5', 'P6'];
const PLAYER_SLOTS = ['player1', 'player2', 'player3', 'player4', 'player5', 'player6'];
const ALL_ROLES = ['player1', 'player2', 'player3', 'player4', 'player5'];
const ACTION_LABEL_MAP = {
  attack: 'Attack', skip: 'Skip', favor: 'Favor',
  shuffle: 'Shuffle', see_the_future: 'See the Future', alter_the_future: 'Alter the Future', pair: 'Cat Pair steal',
  trade_cats: 'Trade 5 Cats for Defuse', draw_from_bottom: 'Draw From Bottom',
  swap_top_bottom: 'Swap Top & Bottom',
  catomic_bomb: 'Catomic Bomb',
};
const FX_ICON_MAP = {
  [CARD_TYPES.ATTACK]: '⚔️',
  [CARD_TYPES.SKIP]: '⏭️',
  [CARD_TYPES.FAVOR]: '🤲',
  [CARD_TYPES.SHUFFLE]: '🔀',
  [CARD_TYPES.SEE_THE_FUTURE]: '🔮',
  [CARD_TYPES.ALTER_THE_FUTURE]: '✨',
  [CARD_TYPES.DRAW_FROM_BOTTOM]: '⬇️',
  [CARD_TYPES.SWAP_TOP_BOTTOM]: '🔁',
  [CARD_TYPES.DEFUSE]: '🛡️',
};

export default function ExplodingKitten() {
  const [screen, setScreen] = useState('lobby');
  const [name, setName] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ek_player_name') || '';
    }
    return '';
  });
  const [inputRoomId, setInputRoomId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [myRole, setMyRole] = useState('');
  const [roomData, setRoomData] = useState(null);
  const [err, setErr] = useState('');
  const [toast, setToast] = useState('');
  const [selectedCards, setSelectedCards] = useState([]);
  const nopeTimerRef = useRef(null);
  const [tradeMode, setTradeMode] = useState(false);

  const game = roomData?.game;
  const players = roomData?.players || {};
  const myPlayer = players[myRole];
  const myHand = myPlayer?.hand || [];
  const myTurn = game?.turn === myRole;
  const phase = game?.phase || 'play';
  const pending = game?.pendingAction;
  const nopeWindow = game?.nopeWindow;

  // Removed: useEffect for style injection (now done at module level above)

  useEffect(() => {
    if (!roomId) return;
    const unsub = listenRoom(roomId, data => setRoomData(data));
    return () => unsub?.();
  }, [roomId]);

  useEffect(() => {
    if (typeof window !== 'undefined' && name) {
      localStorage.setItem('ek_player_name', name);
    }
  }, [name]);
  
  // Merged status effects to avoid multiple useEffect evaluations
  useEffect(() => {
    if (!roomData) return;
    const status = roomData.status;
    if (status === 'playing' && screen !== 'game') setScreen('game');
    else if (status === 'dissolved') resetToLobby();
    else if ((status === 'waiting' || status === 'ready') && screen === 'lobby' && roomId) setScreen('room');
  }, [roomData?.status]);

  useEffect(() => {
    if (!nopeWindow?.open || !pending) return;
    if (pending.by !== myRole) return;
    if (nopeTimerRef.current) clearTimeout(nopeTimerRef.current);
    const delay = Math.max(0, (nopeWindow.expiresAt || 0) - Date.now());
    nopeTimerRef.current = setTimeout(() => resolveNopeWindow(roomId), delay + 300);
    return () => clearTimeout(nopeTimerRef.current);
  }, [nopeWindow?.expiresAt, nopeWindow?.open, pending?.by, myRole, roomId]);

  useEffect(() => {
    if (myTurn) SoundManager.play('myTurn');
  }, [game?.turn]);

  const showToast = useCallback((msg, duration = 2500) => {
    setToast(msg);
    setTimeout(() => setToast(''), duration);
  }, []);

  const resetToLobby = useCallback(() => {
    setScreen('lobby');
    setRoomId('');
    setMyRole('');
    setRoomData(null);
    setErr('');
    setSelectedCards([]);
  }, []);

  const handleCreate = useCallback(async () => {
    if (!name.trim()) return setErr('Enter your name!');
    setErr('');
    const id = await createRoom(name.trim());
    setRoomId(id);
    setMyRole('player1');
    setScreen('room');
  }, [name]);

  const handleJoin = useCallback(async () => {
    if (!name.trim()) return setErr('Enter your name!');
    if (!inputRoomId.trim()) return setErr('Enter room code!');
    setErr('');
    try {
      const slot = await joinRoom(inputRoomId.toUpperCase(), name.trim());
      setRoomId(inputRoomId.toUpperCase());
      setMyRole(slot);
      setScreen('room');
    } catch (e) {
      setErr(e.message);
    }
  }, [name, inputRoomId]);

  const handleStartGame = useCallback(() => startGame(roomId), [roomId]);

  const handleDrawCard = useCallback(() => {
    SoundManager.play('draw');
    drawCard(roomId, myRole);
  }, [roomId, myRole]);

  const handleCardClick = useCallback((card) => {
    SoundManager.play(SoundManager.soundForCard(card.type));
    if (card.type === CARD_TYPES.NOPE) {
      if (!nopeWindow?.open) {
        showToast('No action to Nope right now!');
        return;
      }
      playCard(roomId, myRole, card.id, {});
      setSelectedCards([]);
      return;
    }
    if (card.type === CARD_TYPES.STREAKING_KITTEN) {
      showToast('Streaking Kitten không thể chơi ra — nó chỉ có tác dụng khi nằm trong tay bạn!');
      return;
    }
    if (!myTurn) { showToast('Not your turn!'); return; }
    if (phase !== 'play') { showToast('Finish the current action first!'); return; }

    if (tradeMode && CAT_CARD_TYPES.has(card.type)) {
      setSelectedCards(prev => {
        if (prev.some(c => c.id === card.id)) return prev.filter(c => c.id !== card.id);
        if (prev.length >= 5) return prev;
        return [...prev, card];
      });
      return;
    }

    if (CAT_CARD_TYPES.has(card.type)) {
      setSelectedCards(prev => {
        const alreadySelected = prev[0];
        if (alreadySelected?.id === card.id) return [];
        if (alreadySelected?.type === card.type) {
          playCard(roomId, myRole, alreadySelected.id, { isPair: true });
          return [];
        }
        showToast(`Select another ${CARD_META[card.type]?.label} to play as pair`);
        return [card];
      });
      return;
    }

    setSelectedCards(prev => prev[0]?.id === card.id ? [] : [card]);
  }, [roomId, myRole, myTurn, phase, nopeWindow?.open, showToast, tradeMode]);

  const handlePlaySelected = useCallback(() => {
    const card = selectedCards[0];
    if (!card) return;
    if (CAT_CARD_TYPES.has(card.type)) {
      showToast(`Select another ${CARD_META[card.type]?.label} to play as pair!`);
      return;
    }
    playCard(roomId, myRole, card.id, {});
    setSelectedCards([]);
  }, [selectedCards, roomId, myRole, showToast]);

  const handleSelectFavorTarget = useCallback((targetRole) => {
    update(ref(db, `rooms/${roomId}`), {
      'game/pendingAction': { ...pending, target: targetRole },
      'game/phase': 'nope_window',
      'game/nopeWindow': {
        open: true,
        expiresAt: Date.now() + 5000,
        pendingType: 'favor',
        isCurrentlyNoped: false,
      },
      'game/nopeChain': [],
    });
  }, [roomId, pending]);

  const handlePlaceBomb = useCallback((pos) => placeBombAfterDefuse(roomId, myRole, pos), [roomId, myRole]);
  const handleGiveCard = useCallback((cId) => giveFavorCard(roomId, myRole, cId), [roomId, myRole]);
  const handleStealCard = useCallback((target, cardIndex) => stealPairCard(roomId, myRole, target, cardIndex), [roomId, myRole]);
  const handleChooseFavorTarget = useCallback((targetRole) => playCard(roomId, myRole, pending?.favorCardId || '', { targetRole }), [roomId, myRole, pending?.favorCardId]);
  const handleCloseFuture = useCallback(() => closeSeeTheFuture(roomId), [roomId]);
  const handleReorderAlterFuture = useCallback((reorderedCards) => reorderAlterTheFuture(roomId, myRole, reorderedCards), [roomId, myRole]);
  const handleRematch = useCallback(() => requestRematch(roomId, myRole), [roomId, myRole]);
  const handleTradeCatsForDefuse = useCallback((cardIds) => tradeFiveCatsForDefuse(roomId, myRole, cardIds), [roomId, myRole]);
  const handlePlaceImploding = useCallback((pos) => placeImplodingKitten(roomId, myRole, pos), [roomId, myRole]);

  if (screen === 'lobby') {
    return <LobbyScreen onCreateRoom={handleCreate} onJoinRoom={handleJoin} name={name} setName={setName} inputRoomId={inputRoomId} setInputRoomId={setInputRoomId} err={err} />;
  }
  if (screen === 'room') {
    return <RoomScreen roomData={roomData} roomId={roomId} myRole={myRole} onStart={handleStartGame} onBack={resetToLobby} />;
  }
  if (screen === 'game' && roomData) {
    return (
      <GameBoardScreen
        game={game}
        players={players}
        myRole={myRole}
        myHand={myHand}
        myTurn={myTurn}
        phase={phase}
        pending={pending}
        nopeWindow={nopeWindow}
        selectedCards={selectedCards}
        onCardClick={handleCardClick}
        onPlaySelected={handlePlaySelected}
        onDrawCard={handleDrawCard}
        onPlaceBomb={handlePlaceBomb}
        onGiveCard={handleGiveCard}
        onStealCard={handleStealCard}
        tradeMode={tradeMode}
        setTradeMode={setTradeMode}
        onChooseFavorTarget={handleChooseFavorTarget}
        onSelectFavorTarget={handleSelectFavorTarget}
        onPlaceImploding={handlePlaceImploding}
        onCloseFuture={handleCloseFuture}
        setSelectedCards={setSelectedCards}
        onTradeCatsForDefuse={handleTradeCatsForDefuse}
        onReorderAlterFuture={handleReorderAlterFuture}
        onRematch={handleRematch}
        toast={toast}
        showToast={showToast}
        roomId={roomId}
      />
    );
  }
  return <div className="ek-loading">Loading...</div>;
}

/* ─── LOBBY ─────────────────────────────────────────────────────────── */
const LobbyScreen = memo(function LobbyScreen({ onCreateRoom, onJoinRoom, name, setName, inputRoomId, setInputRoomId, err }) {
  return (
    <div className="ek-root ek-lobby-root">
      <div className="ek-lobby-sparks" aria-hidden="true">
        {LOBBY_SPARKS.map((_, i) => (
          <div key={i} className={`ek-spark ek-spark-${i % 4}`} style={{ left: `${8 + i * 7.5}%`, animationDelay: `${i * 0.4}s` }} />
        ))}
      </div>
      <div className="ek-lobby-inner">
        <div className="ek-lobby-brand">
          <div className="ek-brand-icon">💣</div>
          <h1 className="ek-brand-title">EXPLODING<br /><span>KITTENS</span></h1>
          <p className="ek-brand-sub">Online · Multiplayer · Live</p>
        </div>
        <div className="ek-lobby-forms">
          <div className="ek-form-card">
            <div className="ek-form-tag">Your Identity</div>
            <input
              className="ek-field"
              placeholder="Enter your name…"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onCreateRoom()}
            />
          </div>
          <div className="ek-form-row">
            <button className="ek-cta ek-cta-fire" onClick={onCreateRoom}>
              <span className="ek-cta-icon">🔥</span>
              <span>Create Room</span>
            </button>
            <div className="ek-join-group">
              <input
                className="ek-field ek-field-code"
                placeholder="Room code…"
                value={inputRoomId}
                onChange={e => setInputRoomId(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && onJoinRoom()}
              />
              <button className="ek-cta ek-cta-ghost" onClick={onJoinRoom}>Join →</button>
            </div>
          </div>
          {err && <div className="ek-err-pill">{err}</div>}
        </div>
      </div>
    </div>
  );
});

/* ─── ROOM SCREEN ────────────────────────────────────────────────────── */
function RoomScreen({ roomData, roomId, myRole, onStart, onBack }) {
  const [copied, setCopied] = useState(false);
  const players = roomData?.players || {};
  const isHost = myRole === 'player1';
  const playerCount = Object.keys(players).length;

  const copyCode = useCallback(() => {
    navigator.clipboard?.writeText(roomId).catch(() => { });
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }, [roomId]);

  return (
    <div className="ek-root ek-room-root">
      <div className="ek-room-wrap">
        <div className="ek-room-header">
          <button className="ek-back-btn" onClick={onBack}>← Back</button>
          <h2 className="ek-room-title">Room Lobby</h2>
          <div style={{ width: '40px' }} />
        </div>
        <div className="ek-room-code-card">
          <p className="ek-room-eyebrow">Share Code with Friends</p>
          <div className="ek-room-code-display-large" onClick={copyCode} title="Click to copy">{roomId}</div>
          <p className="ek-code-sub">{copied ? '✓ Copied to clipboard!' : 'Click to copy the room code'}</p>
        </div>
        <div className="ek-players-section">
          <div className="ek-players-header">
            <p className="ek-section-label">Players ({playerCount}/6)</p>
          </div>
          <div className="ek-players-grid">
            {PLAYER_SLOTS.map((slot, i) => {
              const p = players[slot];
              return (
                <div
                  key={slot}
                  className={`ek-player-card ${p ? 'ek-player-filled' : 'ek-player-empty'} ${slot === myRole ? 'ek-player-self' : ''}`}
                  style={{ '--player-color': SLOT_COLORS[i] }}
                >
                  <div className="ek-player-slot-indicator">
                    <span className="ek-slot-label">{SLOT_LABELS[i]}</span>
                  </div>
                  <div className="ek-player-avatar">{p ? p.name[0].toUpperCase() : '?'}</div>
                  <div className="ek-player-details">
                    <div className="ek-player-name">{p ? p.name : 'Empty Slot'}</div>
                    {p && slot === myRole && <div className="ek-player-you">You</div>}
                    {!p && <div className="ek-player-waiting">Waiting…</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="ek-room-action">
          {isHost ? (
            <>
              <button
                className={`ek-start-btn ${playerCount >= 2 ? 'ek-start-ready' : 'ek-start-wait'}`}
                onClick={onStart}
                disabled={playerCount < 2}
              >
                {playerCount < 2 ? `Waiting for players… (${playerCount}/6)` : `🚀 Start Game (${playerCount} players)`}
              </button>
              <p className="ek-host-info">You are the host</p>
            </>
          ) : (
            <>
              <p className="ek-host-wait">Waiting for host to start the game…</p>
              <p className="ek-lobby-hint">Invite friends with the room code above</p>
            </>
          )}
        </div>
      </div>
      {copied && <div className="ek-copied-toast">✓ Copied to clipboard!</div>}
    </div>
  );
}

/* ─── BOMB EXPLOSION EFFECT ─────────────────────────────────────────── */
const BombExplosionEffect = memo(function BombExplosionEffect({ onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2800);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="ek-bomb-overlay" aria-hidden="true">
      <div className="ek-bomb-flash" />
      <div className="ek-bomb-ring ek-bomb-ring-1" />
      <div className="ek-bomb-ring ek-bomb-ring-2" />
      <div className="ek-bomb-ring ek-bomb-ring-3" />
      {BOMB_PARTICLES.map((_, i) => {
        const angle = (i / BOMB_PARTICLES.length) * 360;
        const dist = 100 + (i % 5) * 40;
        const size = 8 + (i % 4) * 6;
        return (
          <div
            key={i}
            className="ek-bomb-particle"
            style={{
              '--angle': `${angle}deg`,
              '--dist': `${dist}px`,
              '--size': `${size}px`,
              '--delay': `${0.05 + (i % 6) * 0.04}s`,
            }}
          />
        );
      })}
      <div className="ek-bomb-card-slam">
        <div className="ek-bomb-card-inner">
          <img src="/Resources/exploding kitten/bomb_1.webp" alt="Exploding Kitten" onError={e => { e.target.style.display = 'none'; }} />
          <div className="ek-bomb-emoji">💥</div>
        </div>
      </div>
      <div className="ek-bomb-text">
        <span className="ek-bomb-text-main">BOOM!</span>
        <span className="ek-bomb-text-sub">EXPLODING KITTEN!</span>
      </div>
      {BOMB_EMBERS.map((_, i) => (
        <div
          key={`ember-${i}`}
          className="ek-bomb-ember"
          style={{ '--ex': `${10 + i * 6}%`, '--delay': `${i * 0.08}s`, '--size': `${3 + (i % 3) * 3}px` }}
        />
      ))}
    </div>
  );
});

const DefuseFx = memo(function DefuseFx({ onDone }) {

  useEffect(() => {
    const t = setTimeout(onDone, 1200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <CardPlayEffect type={CARD_TYPES.DEFUSE} />
  );
});

const IMPLODE_PARTICLES = [...Array(20)];
const ImplodingKittenEffect = memo(function ImplodingKittenEffect({ onDone, cardImage }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="ek-implode-overlay" aria-hidden="true">
      <div className="ek-implode-void" />
      <div className="ek-implode-ring ek-implode-ring-1" />
      <div className="ek-implode-ring ek-implode-ring-2" />
      <div className="ek-implode-ring ek-implode-ring-3" />
      {IMPLODE_PARTICLES.map((_, i) => {
        const angle = (i / IMPLODE_PARTICLES.length) * 360;
        const dist = 140 + (i % 5) * 50;
        const size = 5 + (i % 4) * 5;
        return (
          <div
            key={i}
            className="ek-implode-particle"
            style={{
              '--angle': `${angle}deg`,
              '--dist': `${dist}px`,
              '--size': `${size}px`,
              '--delay': `${0.1 + (i % 6) * 0.05}s`,
            }}
          />
        );
      })}
      <div className="ek-implode-card-pull">
        <div className="ek-implode-card-inner">
          <img
            src={cardImage || '/Resources/exploding kitten/Imploding-Kitten.webp'}
            alt="Imploding Kitten"
            onError={e => { e.target.style.display = 'none'; }}
          />
        </div>
      </div>
      <div className="ek-implode-text">
        <span className="ek-implode-text-main">IMPLODING…</span>
        <span className="ek-implode-text-sub">KITTEN REVEALED — FACE UP ON THE DECK</span>
      </div>
    </div>
  );
});

/* ─── GAME BOARD ─────────────────────────────────────────────────────── */
function GameBoardScreen({
  game, players, myRole, myHand, myTurn, phase, pending, nopeWindow,
  selectedCards, setSelectedCards, tradeMode, setTradeMode, onCardClick, onPlaySelected, onDrawCard,
  onPlaceBomb, onGiveCard, onStealCard, onSelectFavorTarget, onChooseFavorTarget,
  onPlaceImploding, onCloseFuture, onReorderAlterFuture, onRematch, onTradeCatsForDefuse, toast, showToast, roomId,
}) {
  const gameOver = game?.winner;
  const drawPile = game?.drawPile || [];
  const discardPile = game?.discardPile || [];
  const topDiscard = discardPile[discardPile.length - 1];
  const log = game?.log || [];
  const aliveCount = Object.values(players).filter(p => p?.alive !== false).length;
  const isSpectating = players[myRole]?.alive === false && !gameOver;

  const [newCardIds, setNewCardIds] = useState(new Set());
  const prevHandIdsRef = useRef(new Set());
  const flipTimersRef = useRef({});
  const prevGameIdRef = useRef(game?.startedAt);
  const [bombDone, setBombDone] = useState(true);
  const [showBombFx, setShowBombFx] = useState(false);
  const [defusePending, setDefusePending] = useState(false);
  const [bombFxFinished, setBombFxFinished] = useState(true);
  const [showDefuseFx, setShowDefuseFx] = useState(false);
  const [showSeeFutureFx, setShowSeeFutureFx] = useState(false);
  const prevPhaseSeeRef = useRef(phase);

  // Effect 1: khi phase → defuse, đánh dấu defuse đang chờ
  useEffect(() => {
    if (phase === 'defuse') {
      setDefusePending(true);
    } else {
      setDefusePending(false);
    }
  }, [phase]);

  // Effect 2: bomb FX xong + defuse đang chờ → trigger defuse FX
  useEffect(() => {
    if (bombFxFinished && defusePending) {
      setShowDefuseFx(true);
      setDefusePending(false); // reset để không trigger lại
    }
  }, [bombFxFinished, defusePending]);

  useEffect(() => {
    if (prevPhaseSeeRef.current !== 'see_future' && phase === 'see_future') {
      setShowSeeFutureFx(true);
    }
    prevPhaseSeeRef.current = phase;
  }, [phase]);

  const [showAlterFutureFx, setShowAlterFutureFx] = useState(false);
  const prevPhaseAlterRef = useRef(phase);
  useEffect(() => {
    if (prevPhaseAlterRef.current !== 'alter_future' && phase === 'alter_future') {
      setShowAlterFutureFx(true);
    }
    prevPhaseAlterRef.current = phase;
  }, [phase]);

  useEffect(() => {
    if (game?.startedAt && game.startedAt !== prevGameIdRef.current) {
      setShowBombFx(false);
      setBombDone(true);
      setBombFxFinished(true);

      prevGameIdRef.current = game.startedAt;
    }
  }, [game?.startedAt]);

  useEffect(() => {
    const currentIds = new Set(myHand.map(c => c.id));
    const added = [...currentIds].filter(id => !prevHandIdsRef.current.has(id));
    if (added.length > 0) {
      setNewCardIds(prev => {
        const next = new Set(prev);
        added.forEach(id => next.add(id));
        return next;
      });
      added.forEach((id, i) => {
        if (flipTimersRef.current[id]) clearTimeout(flipTimersRef.current[id]);
        flipTimersRef.current[id] = setTimeout(() => {
          setNewCardIds(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }, 900 + i * 80);
      });
    }
    prevHandIdsRef.current = currentIds;
  }, [myHand]);

  useEffect(() => {
    return () => { Object.values(flipTimersRef.current).forEach(clearTimeout); };
  }, []);

  const prevPhaseRef = useRef(phase);
  const prevAlivesRef = useRef(
    Object.fromEntries(Object.entries(players).map(([r, p]) => [r, p?.alive]))
  );

  const [showImplodeFx, setShowImplodeFx] = useState(false);
  const prevPhaseImplodeRef = useRef(phase);

  useEffect(() => {
    if (prevPhaseImplodeRef.current !== 'place_imploding' && phase === 'place_imploding') {
      setShowImplodeFx(true);
      setBombDone(false);
    }
    prevPhaseImplodeRef.current = phase;
  }, [phase]);

  const handleImplodeDone = useCallback(() => {
    setShowImplodeFx(false);
    setBombDone(true);
  }, []);

  useEffect(() => {
    const phaseChangedToDefuse = prevPhaseRef.current !== 'defuse' && phase === 'defuse';
    // Bất kỳ player nào chuyển sang dead mà trước đó còn sống
    const anyJustDied = Object.entries(players).some(([role, p]) => {
      const wasAlive = prevAlivesRef.current[role] !== false;
      return wasAlive && p?.alive === false;
    });
    if (phaseChangedToDefuse || anyJustDied) {
      setBombFxFinished(false);
      setShowBombFx(true);
      setBombDone(false);
    }
    prevPhaseRef.current = phase;
    // Cập nhật snapshot alive của tất cả players
    prevAlivesRef.current = Object.fromEntries(
      Object.entries(players).map(([r, p]) => [r, p?.alive])
    );
  }, [phase, players]);

  useEffect(() => {
    if (!gameOver) return;
    SoundManager.play(gameOver === myRole ? 'win' : 'lose');
    // KHÔNG setShowBombFx(false) ở đây — để explosion animation chạy hết
    // handleBombDone sẽ set bombDone=true sau 2800ms → game-over screen tự hiện
    // Chỉ tắt implode fx (nó không liên quan đến game-over gate)
    setShowImplodeFx(false);
  }, [gameOver, myRole]);

  const [cardFx, setCardFx] = useState(null);
  const lastFxIdRef = useRef(null);
  const fxTimerRef = useRef(null);
  const [showNopedFx, setShowNopedFx] = useState(false);
  const prevNopedRef = useRef(false);
  useEffect(() => {
    const isNoped = nopeWindow?.isCurrentlyNoped === true;
    if (isNoped && !prevNopedRef.current) setShowNopedFx(true);
    prevNopedRef.current = isNoped;
  }, [nopeWindow?.isCurrentlyNoped]);

  const [drawAnim, setDrawAnim] = useState(0);
  const [handKey, setHandKey] = useState(0);
  const [handOrder, setHandOrder] = useState(null);

  const handleShuffleHand = useCallback(() => {
    setHandOrder(prev => {
      const currentHand = prev || myHand;
      const shuffled = [...currentHand];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    });
    setHandKey(k => k + 1);
    SoundManager.play('shuffle');
  }, [myHand]);

  const prevDrawCountRef = useRef(drawPile.length);
  const drawTimerRef = useRef(null);

  useEffect(() => {
    const prev = prevDrawCountRef.current;
    if (drawPile.length < prev) {
      setDrawAnim(Date.now());
      if (drawTimerRef.current) clearTimeout(drawTimerRef.current);
      drawTimerRef.current = setTimeout(() => setDrawAnim(0), 650);
    }
    prevDrawCountRef.current = drawPile.length;
    return () => clearTimeout(drawTimerRef.current);
  }, [drawPile.length]);

  useEffect(() => {
    setHandOrder(prev => {
      // Chưa từng shuffle -> luôn dùng thứ tự thật
      if (!prev) return null;

      // Giữ lại các lá vẫn còn trên tay theo thứ tự đã shuffle
      const currentIds = new Set(myHand.map(c => c.id));
      const next = prev.filter(c => currentIds.has(c.id));

      // Thêm các lá mới (draw, favor, pair...) vào cuối
      const orderedIds = new Set(next.map(c => c.id));
      for (const card of myHand) {
        if (!orderedIds.has(card.id)) {
          next.push(card);
        }
      }

      // Nếu không còn khác gì thì giữ nguyên reference để tránh re-render
      if (
        next.length === prev.length &&
        next.every((c, i) => c.id === prev[i]?.id)
      ) {
        return prev;
      }

      return next;
    });
  }, [myHand]);

  const [catomicFx, setCatomicFx] = useState(null);

  const fxBusy =
    !bombFxFinished ||
    showImplodeFx ||
    !!catomicFx ||
    showSeeFutureFx ||
    showAlterFutureFx;

  useEffect(() => {
    if (!topDiscard) return;
    if (lastFxIdRef.current === topDiscard.id) return;
    lastFxIdRef.current = topDiscard.id;

    // Catomic Bomb gets its own dramatic full-screen effect instead of
    // the regular small card-play effect.
    if (topDiscard.type === CARD_TYPES.CATOMIC_BOMB) {
      setCatomicFx({ key: topDiscard.id });
      return;
    }

    const isCat = CAT_CARD_TYPES.has(topDiscard.type);
    const isActionCard = !isCat && topDiscard.type !== CARD_TYPES.EXPLODING_KITTEN && topDiscard.type !== CARD_TYPES.IMPLODING_KITTEN;
    if (!isActionCard) return;
    setCardFx({ key: topDiscard.id, type: topDiscard.type });
    if (fxTimerRef.current) clearTimeout(fxTimerRef.current);
    fxTimerRef.current = setTimeout(() => setCardFx(null), 1100);
    return () => clearTimeout(fxTimerRef.current);
  }, [topDiscard?.id]);

  const otherRoles = ALL_ROLES.filter(r => players[r] && r !== myRole);
  const posMap = OPP_POSITIONS[otherRoles.length] || ['north'];

  const displayHand = handOrder ?? myHand;

  const canNope = nopeWindow?.open && myHand.some(c => c.type === CARD_TYPES.NOPE);
  const nopeCard = myHand.find(c => c.type === CARD_TYPES.NOPE);

  // Mute toggle callback
  const handleMuteToggle = useCallback(() => {
    SoundManager.isMuted() ? SoundManager.unmute() : SoundManager.mute();
  }, []);

  const handleBombDone = useCallback(() => {
    setShowBombFx(false);
    setBombFxFinished(true);
    // Chỉ giữ bombDone=false nếu đang chờ defuse
    // Nếu không có defuse pending (player đã chết), set bombDone=true luôn
    setDefusePending(prev => {
      if (!prev) {
        // Không có defuse pending → player chết → unblock game-over screen
        setBombDone(true);
      }
      return prev;
    });
  }, []);

  if (gameOver && bombDone) {
    const winnerPlayer = players[gameOver];
    const isMe = gameOver === myRole;
    return (
      <div className="ek-root ek-gameover-root">
        <div className="ek-gameover-card">
          <div className="ek-gameover-burst">{isMe ? '🏆' : '💥'}</div>
          <h2 className="ek-gameover-name">{winnerPlayer?.name} Wins!</h2>
          <p className="ek-gameover-sub">{isMe ? 'You survived the kittens!' : 'Better luck next time.'}</p>
          <button className="ek-start-btn ek-start-ready" onClick={onRematch}>Play Again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="ek-root ek-game-root">
      {isSpectating && (
        <div className="ek-spectate-banner">
          💀 You exploded — Spectating the match · {aliveCount} players remaining
        </div>
      )}
      <div className="ek-game-layout">

        {/* ── Opponent ring ── */}
        <div className="ek-opponents-ring">
          {otherRoles.map((role, i) => {
            const p = players[role];
            const pos = posMap[i] || 'north';
            return (
              <OpponentSlot
                key={role}
                player={p}
                role={role}
                position={pos}
                isActive={game?.turn === role}
                isDead={!p?.alive}
              />
            );
          })}
        </div>

        {/* ── Center table ── */}
        <div className="ek-center-area">
          <div className="ek-table-felt-game">
            <div className="ek-piles-row">
              <div className="ek-pile-slot">
                {(() => {
                  const topCard = drawPile[drawPile.length - 1];
                  const isFaceUp = topCard?.faceUp === true;
                  return (
                    <div
                      className={`ek-pile-card ek-pile-draw ${myTurn && phase === 'play' ? 'ek-pile-clickable' : ''} ${drawAnim ? 'ek-pile-draw-pulse' : ''} ${isFaceUp ? 'ek-pile-faceup' : ''}`}
                      onClick={myTurn && phase === 'play' ? onDrawCard : undefined}
                    >
                      {isFaceUp ? (
                        <>
                          <img
                            src={topCard.image || '/Resources/exploding kitten/Imploding-Kitten.webp'}
                            alt="Imploding Kitten"
                            className="ek-card-img"
                            onError={e => { e.target.style.display = 'none'; }}
                          />
                          <div className="ek-pile-faceup-badge">👁 FACE UP</div>
                        </>
                      ) : (
                        <div className="ek-card-back">
                          <img
                            src="/Resources/exploding kitten/backcard.webp"
                            alt="Draw pile card back"
                            className="ek-card-back-img"
                            onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                          />
                          <span className="ek-card-back-icon" style={{ display: 'none' }}>🐱</span>
                        </div>
                      )}
                      {drawPile.length > 0 && <div className="ek-pile-count-badge">{drawPile.length}</div>}
                    </div>
                  );
                })()}
                <div className="ek-pile-name">Draw</div>
              </div>

              <div className="ek-pile-slot">
                {topDiscard ? (
                  <div className="ek-pile-card ek-pile-discard">
                    <img
                      src={topDiscard.image || ''}
                      alt={CARD_META[topDiscard.type]?.label || 'Card'}
                      className="ek-card-img"
                      onError={e => { e.target.style.display = 'none'; }}
                    />
                    <div className="ek-discard-label">{CARD_META[topDiscard.type]?.label}</div>
                  </div>
                ) : (
                  <div className="ek-pile-card ek-pile-empty"><span className="ek-pile-empty-text">Empty</span></div>
                )}
                <div className="ek-pile-name">Discard</div>
              </div>
            </div>

            {nopeWindow?.open && (
              <NopeWindowBanner
                nopeWindow={nopeWindow}
                pending={pending}
                players={players}
                canNope={canNope}
                nopeCard={nopeCard}
                onNope={() => { if (nopeCard) onCardClick(nopeCard); }}
              />
            )}

            {!nopeWindow?.open && (
              <div className={`ek-turn-chip ${myTurn ? 'ek-turn-mine' : 'ek-turn-wait'}`}>
                {myTurn ? '🎯 Your Turn — Play or Draw' : `⏳ ${players[game?.turn]?.name || '…'}'s Turn`}
              </div>
            )}

            {/* Only render the last 3 log entries (slice already done) */}
            <div className="ek-log-strip">
              {log.slice(0, 3).map((entry, i) => (
                <div key={i} className="ek-log-entry">{entry}</div>
              ))}
            </div>
          </div>
        </div>

        {/* ── My hand ── */}
        <div className="ek-my-zone">
          <div className="ek-my-info">
            <div className="ek-my-avatar">{players[myRole]?.name?.[0] || 'Y'}</div>
            <div className="ek-my-name">{players[myRole]?.name || 'You'}</div>
            <div className="ek-my-cardcount">{myHand.length} cards</div>
            {myTurn && <div className="ek-my-turn-dot" />}
            <button className="ek-mute-btn" onClick={handleMuteToggle}>
              {SoundManager.isMuted() ? '🔇' : '🔊'}
            </button>
          </div>

          <div className="ek-hand-and-actions">
            <button
              className="ek-shuffle-hand-btn"
              onClick={handleShuffleHand}
              title="Shuffle your hand"
            >
              <span className="ek-shuffle-hand-icon">🔀</span>
              <span className="ek-shuffle-hand-label">Shuffle</span>
            </button>
            <div className="ek-hand-fan">
              {displayHand.length > 0 ? displayHand.map((card, idx) => {
                const isSelected = selectedCards.some(s => s.id === card.id);
                const meta = CARD_META[card.type];
                const isNopeable = card.type === CARD_TYPES.NOPE && nopeWindow?.open;
                const isNew = newCardIds.has(card.id);
                // Only show "needs a pair" styling outside trade mode —
                // in trade mode, selecting multiple cat cards is intentional.
                const isAwaitingPair = isSelected && !tradeMode && CAT_CARD_TYPES.has(card.type);
                return (
                  <HandCard
                    key={card.id}
                    card={card}
                    meta={meta}
                    isSelected={isSelected}
                    isAwaitingPair={isAwaitingPair}
                    isNopeable={isNopeable}
                    isNew={isNew}
                    isDisabled={!myTurn && !isNopeable}
                    zIndex={isSelected ? 50 : idx}
                    onClick={onCardClick}
                  />
                );
              }) : (
                <div className="ek-hand-empty">No cards in hand</div>
              )}
            </div>

            {myTurn && phase === 'play' && (
              <div className="ek-action-strip">
                {selectedCards.length > 0 && !tradeMode && !CAT_CARD_TYPES.has(selectedCards[0]?.type) && (
                  <button className="ek-action-btn ek-action-play" onClick={onPlaySelected}>
                    ▶ Play {CARD_META[selectedCards[0]?.type]?.label || 'Card'}
                  </button>
                )}
                <button className="ek-action-btn ek-action-draw" onClick={onDrawCard}>Draw Card</button>
                <button
                  className="ek-action-btn ek-action-draw"
                  onClick={() => {
                    setTradeMode(t => !t);
                    setSelectedCards([]);
                  }}
                >
                  {tradeMode ? `Cancel (${selectedCards.length}/5)` : 'Trade defuse'}
                </button>

                {tradeMode && selectedCards.length === 5 && (
                  <button
                    className="ek-action-btn ek-action-play"
                    onClick={() => {
                      onTradeCatsForDefuse(selectedCards.map(c => c.id));
                      setSelectedCards([]);
                      setTradeMode(false);
                    }}
                  >
                    Confirm
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Phase Overlays ── */}
      {phase === 'defuse' && pending?.by === myRole && bombDone && !showDefuseFx && (
        <div className="ek-overlay-panel">
          <DefusePanel drawPile={drawPile} onPlaceBomb={onPlaceBomb} />
        </div>
      )}
      {phase === 'see_future' && game?.seeTheFuture?.forPlayer === myRole && !fxBusy && (
        <div className="ek-overlay-panel">
          <SeeFuturePanel cards={game?.seeTheFuture?.cards || []} onClose={onCloseFuture} />
        </div>
      )}
      {phase === 'alter_future' && game?.alterTheFuture?.forPlayer === myRole && !fxBusy && (
        <div className="ek-overlay-panel">
          <AlterFuturePanel cards={game?.alterTheFuture?.cards || []} onReorder={onReorderAlterFuture} />
        </div>
      )}
      {phase === 'favor_choose_target' && pending?.by === myRole && !fxBusy && (
        <div className="ek-overlay-panel">
          <FavorChooseTargetPanel players={players} myRole={myRole} onSelect={onSelectFavorTarget} />
        </div>
      )}
      {phase === 'favor_give' && pending?.target === myRole && !fxBusy && (
        <div className="ek-overlay-panel">
          <FavorGivePanel myHand={myHand} requesterName={players[pending?.by]?.name || '?'} onGive={onGiveCard} />
        </div>
      )}
      {phase === 'pair_target' && pending?.by === myRole && !fxBusy && (
        <div className="ek-overlay-panel">
          <PairTargetPanel players={players} myRole={myRole} onSteal={onStealCard} />
        </div>
      )}

      {phase === 'place_imploding' && pending?.by === myRole && !fxBusy && (
        <div className="ek-overlay-panel">
          <DefusePanel
            drawPile={drawPile}
            onPlaceBomb={onPlaceImploding}
            title="Place Imploding Kitten face-up"
            cardImage={pending?.bomb?.image || '/Resources/exploding kitten/Imploding-Kitten.webp'}
          />
        </div>
      )}

      {toast && <div className="ek-toast">{toast}</div>}
      {cardFx && <CardPlayEffect key={cardFx.key} type={cardFx.type} />}
      {showDefuseFx && (
        <DefuseFx onDone={() => {
          setShowDefuseFx(false);
          setBombDone(true); // ← panel chỉ hiện SAU KHI defuse FX xong
        }} />
      )}
      {catomicFx && <CatomicBombEffect key={catomicFx.key} onDone={() => setCatomicFx(null)} />}
      {showNopedFx && <NopedFlashEffect onDone={() => setShowNopedFx(false)} />}
      {showSeeFutureFx && <SeeFutureFx onDone={() => setShowSeeFutureFx(false)} />}
      {showAlterFutureFx && <AlterFutureFx onDone={() => setShowAlterFutureFx(false)} />}
      {showImplodeFx && (
        <ImplodingKittenEffect
          onDone={handleImplodeDone}
          cardImage={pending?.bomb?.image || '/Resources/exploding kitten/Imploding-Kitten.webp'}
        />
      )}
      {showBombFx && <BombExplosionEffect onDone={handleBombDone} />}
    </div>
  );
}

/* ─── HAND CARD (extracted & memoized) ──────────────────────────────── */
const HandCard = memo(function HandCard({ card, meta, isSelected, isAwaitingPair, isNopeable, isNew, isDisabled, zIndex, onClick }) {
  const handleClick = useCallback(() => onClick(card), [onClick, card]);
  return (
    <div
      className={`ek-hand-card${isSelected ? ' ek-hand-card-selected' : ''}${isAwaitingPair ? ' ek-hand-card-pairing' : ''}${isDisabled ? ' ek-hand-card-disabled' : ''}${isNopeable ? ' ek-hand-card-nopeable' : ''}${isNew ? ' ek-hand-card-new' : ''}`}
      style={{ '--card-color': meta?.color || '#888', zIndex }}
      onClick={handleClick}
    >
      <div className="ek-card-face ek-card-face-back">
        <img src="/Resources/exploding kitten/backcard.webp" alt="card back" className="ek-card-img" onError={e => { e.target.style.display = 'none'; }} />
      </div>
      <div className="ek-card-face ek-card-face-front">
        <img src={card.image || ''} alt={meta?.label || card.type} className="ek-card-img" onError={e => { e.target.style.display = 'none'; }} />
        <div className="ek-card-label-bar">{meta?.label || card.type}</div>
      </div>
      {isSelected && (
        <div className="ek-card-selected-badge">{isAwaitingPair ? '🔗' : '✓'}</div>
      )}
      {isAwaitingPair && <div className="ek-card-pair-hint">Chọn lá giống để ghép cặp</div>}
      {isNopeable && <div className="ek-nope-glow" />}
    </div>
  );
});

/* ─── CARD PLAY EFFECT ────────────────��──────────────────────────────── */
const CardPlayEffect = memo(function CardPlayEffect({ type }) {
  const meta = CARD_META[type];
  const color = meta?.color || '#FF9020';
  const images = meta?.images || [];
  const img = images[Math.floor(Math.random() * images.length)] || '';
  return (
    <div className="ek-fx-layer" style={{ '--fx-color': color }} aria-hidden="true">
      <div className="ek-fx-ring" />
      <div className="ek-fx-ring ek-fx-ring-2" />
      {[...Array(10)].map((_, i) => {
        const angle = (i / 10) * Math.PI * 2;
        const dist = 120 + (i % 3) * 36;
        return (
          <span key={i} className="ek-fx-spark" style={{ '--sx': `${Math.cos(angle) * dist}px`, '--sy': `${Math.sin(angle) * dist}px`, animationDelay: `${0.15 + (i % 4) * 0.03}s` }} />
        );
      })}
      <div className="ek-fx-card">
        {img && <img src={img} alt={meta?.label || type} onError={e => { e.target.style.display = 'none'; }} />}
        <div className="ek-fx-card-icon">{FX_ICON_MAP[type] || ''}</div>
      </div>
      <div className="ek-fx-label">{meta?.label || type}</div>
    </div>
  );
});

/* ─── NOPE PLAY EFFECT ────────────────��──────────────────────────────── */
const NopedFlashEffect = memo(function NopedFlashEffect({ onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 700);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="ek-noped-flash" aria-hidden="true">
      <span className="ek-noped-flash-text">🚫 NOPED!</span>
    </div>
  );
});

/* ─── CATOMIC BOMB RADIATION BURST EFFECT ────────────────────────────── */
const CATOMIC_PARTICLES = [...Array(18)];

const CatomicBombEffect = memo(function CatomicBombEffect({ onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2400);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="ek-catomic-overlay" aria-hidden="true">
      <div className="ek-catomic-flash" />
      <div className="ek-catomic-ring ek-catomic-ring-1" />
      <div className="ek-catomic-ring ek-catomic-ring-2" />
      <div className="ek-catomic-ring ek-catomic-ring-3" />
      <div className="ek-catomic-symbol">☢</div>
      {CATOMIC_PARTICLES.map((_, i) => {
        const angle = (i / CATOMIC_PARTICLES.length) * 360;
        const dist = 120 + (i % 4) * 60;
        return (
          <div
            key={i}
            className="ek-catomic-particle"
            style={{
              '--angle': `${angle}deg`,
              '--dist': `${dist}px`,
              '--delay': `${0.1 + (i % 5) * 0.05}s`,
            }}
          />
        );
      })}
      <div className="ek-catomic-text">
        <span className="ek-catomic-text-main">CATOMIC BOMB!</span>
        <span className="ek-catomic-text-sub">EVERYTHING CHANGES…</span>
      </div>
    </div>
  );
});

/* ─── SEE THE FUTURE — TIME RIFT EFFECT ────────────────────────────── */
const SEEFUTURE_PARTICLES = [...Array(16)];
const SeeFutureFx = memo(function SeeFutureFx({ onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1900);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="ek-seefuture-overlay" aria-hidden="true">
      <div className="ek-seefuture-flash" />
      <div className="ek-seefuture-eye">
        <div className="ek-seefuture-iris" />
        <div className="ek-seefuture-pupil" />
      </div>
      <div className="ek-seefuture-ring ek-seefuture-ring-1" />
      <div className="ek-seefuture-ring ek-seefuture-ring-2" />
      {SEEFUTURE_PARTICLES.map((_, i) => {
        const angle = (i / SEEFUTURE_PARTICLES.length) * 360;
        const dist = 90 + (i % 4) * 50;
        return (
          <div
            key={i}
            className="ek-seefuture-shard"
            style={{ '--angle': `${angle}deg`, '--dist': `${dist}px`, '--delay': `${0.05 + (i % 5) * 0.04}s` }}
          />
        );
      })}
      <div className="ek-seefuture-text">
        <span className="ek-seefuture-text-main">PEERING AHEAD…</span>
        <span className="ek-seefuture-text-sub">SEE THE FUTURE</span>
      </div>
    </div>
  );
});

/* ─── ALTER THE FUTURE — TEMPORAL VORTEX EFFECT ────────────────────── */
const ALTERFUTURE_FRAGMENTS = [...Array(14)];
const AlterFutureFx = memo(function AlterFutureFx({ onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="ek-alterfuture-overlay" aria-hidden="true">
      <div className="ek-alterfuture-flash" />
      <div className="ek-alterfuture-vortex">
        <div className="ek-alterfuture-spiral ek-alterfuture-spiral-1" />
        <div className="ek-alterfuture-spiral ek-alterfuture-spiral-2" />
        <div className="ek-alterfuture-spiral ek-alterfuture-spiral-3" />
      </div>
      {ALTERFUTURE_FRAGMENTS.map((_, i) => {
        const angle = (i / ALTERFUTURE_FRAGMENTS.length) * 360;
        const dist = 100 + (i % 4) * 55;
        return (
          <div
            key={i}
            className="ek-alterfuture-fragment"
            style={{ '--angle': `${angle}deg`, '--dist': `${dist}px`, '--delay': `${0.08 + (i % 5) * 0.05}s` }}
          >
            🃏
          </div>
        );
      })}
      <div className="ek-alterfuture-text">
        <span className="ek-alterfuture-text-main">REWRITING FATE…</span>
        <span className="ek-alterfuture-text-sub">ALTER THE FUTURE</span>
      </div>
    </div>
  );
});

/* ─── NOPE WINDOW BANNER ─────────────────────────────────────────────── */
const NopeWindowBanner = memo(function NopeWindowBanner({ nopeWindow, pending, players, canNope, nopeCard, onNope }) {
  const [timeLeft, setTimeLeft] = useState(5);

  useEffect(() => {
    // Only run interval when banner is visible
    const tick = () => {
      const left = Math.max(0, Math.ceil((nopeWindow.expiresAt - Date.now()) / 1000));
      setTimeLeft(left);
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [nopeWindow.expiresAt]);

  const byName = pending?.by ? players[pending.by]?.name : '?';
  const actionLabel = ACTION_LABEL_MAP[nopeWindow.pendingType] || nopeWindow.pendingType;
  const isNoped = nopeWindow.isCurrentlyNoped;

  return (
    <div className={`ek-nope-banner ${isNoped ? 'ek-nope-banner-noped' : 'ek-nope-banner-active'}`}>
      <div className="ek-nope-banner-row">
        <span className="ek-nope-banner-icon">{isNoped ? '🚫' : '⚡'}</span>
        <div className="ek-nope-banner-text">
          <strong>{byName}</strong> played <strong>{actionLabel}</strong>
          {isNoped ? <span className="ek-noped-label"> — NOPED!</span> : ''}
        </div>
        <div className="ek-nope-timer">{timeLeft}s</div>
      </div>
      {canNope ? (
        <button className="ek-nope-btn" onClick={onNope}>🚫 Nope it!</button>
      ) : (
        <div className="ek-nope-wait">Waiting for Nope…</div>
      )}
    </div>
  );
});

/* ─── FAVOR CHOOSE TARGET PANEL ─────────────────────────────────────── */
const FavorChooseTargetPanel = memo(function FavorChooseTargetPanel({ players, myRole, onSelect }) {
  const targets = Object.entries(players).filter(([role, p]) => role !== myRole && p?.alive !== false);
  return (
    <div className="ek-panel-inner">
      <div className="ek-panel-icon">🤲</div>
      <h3 className="ek-panel-title">Choose who to Favor</h3>
      <p className="ek-panel-sub">Pick a player — they must give you one of their cards</p>
      <div className="ek-target-list">
        {targets.map(([role, p]) => (
          <button key={role} className="ek-target-btn" onClick={() => onSelect(role)}>
            <span className="ek-target-avatar">{p.name[0]}</span>
            <span>{p.name}</span>
            <span className="ek-target-count">{(p.hand || []).length} cards</span>
          </button>
        ))}
      </div>
    </div>
  );
});

/* ─── FAVOR GIVE PANEL ───────────────────────────────────────────────── */
const FavorGivePanel = memo(function FavorGivePanel({ myHand, requesterName, onGive }) {
  return (
    <div className="ek-panel-inner">
      <div className="ek-panel-icon">🎁</div>
      <h3 className="ek-panel-title">{requesterName} wants a card!</h3>
      <p className="ek-panel-sub">Choose one card to give away</p>
      <div className="ek-favor-hand">
        {myHand.map(card => {
          const meta = CARD_META[card.type];
          return (
            <div key={card.id} className="ek-favor-card" onClick={() => onGive(card.id)}>
              <img src={card.image || ''} alt={meta?.label || card.type} className="ek-card-img" onError={e => { e.target.style.display = 'none'; }} />
              <div className="ek-card-label-bar">{meta?.label || card.type}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

/* ─── PAIR TARGET PANEL ──────────────────────────────────────────────── */
function PairTargetPanel({ players, myRole, onSteal }) {
  const [chosenTarget, setChosenTarget] = useState(null);
  const [hoverIdx, setHoverIdx] = useState(null);
  const targets = Object.entries(players).filter(([role, p]) => role !== myRole && p?.alive !== false);

  if (chosenTarget) {
    const targetPlayer = players[chosenTarget];
    const handCount = targetPlayer?.hand?.length || 0;
    return (
      <div className="ek-panel-inner">
        <div className="ek-panel-icon">🃏</div>
        <h3 className="ek-panel-title">Pick a card to steal</h3>
        <p className="ek-panel-sub">From {targetPlayer?.name} — cards stay face-down. Choose by position.</p>
        <div className="ek-steal-grid">
          {[...Array(handCount)].map((_, i) => (
            <button
              key={i}
              className={`ek-steal-card${hoverIdx === i ? ' ek-steal-card-hover' : ''}`}
              style={{ animationDelay: `${i * 0.05}s` }}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              onClick={() => onSteal(chosenTarget, i)}
            >
              <div className="ek-steal-card-back">
                <img src="/Resources/exploding kitten/backcard.webp" alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
              </div>
              <div className="ek-steal-card-num">#{i + 1}</div>
            </button>
          ))}
        </div>
        <button className="ek-action-btn ek-action-draw" style={{ width: '100%', marginTop: 14 }} onClick={() => setChosenTarget(null)}>
          ← Back to players
        </button>
      </div>
    );
  }

  return (
    <div className="ek-panel-inner">
      <div className="ek-panel-icon">🐱</div>
      <h3 className="ek-panel-title">Cat Pair — Steal a card!</h3>
      <p className="ek-panel-sub">Choose a player, then pick a specific face-down card</p>
      <div className="ek-target-list">
        {targets.map(([role, p]) => (
          <button key={role} className="ek-target-btn" onClick={() => setChosenTarget(role)} disabled={!p.hand || p.hand.length === 0}>
            <span className="ek-target-avatar">{p.name[0]}</span>
            <div className="ek-opp-mini-cards">
              {[...Array(Math.min(p.hand?.length || 0, 5))].map((_, i) => (
                <span key={i} className="ek-opp-mini-card">🐱</span>
              ))}
            </div>
            <div>
              <div>{p.name}</div>
              <div className="ek-target-count">{(p.hand || []).length} cards</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── OPPONENT SLOT ──────────────────────────────────────────────────── */
const OpponentSlot = memo(function OpponentSlot({ player, role, position, isActive, isDead }) {
  const hand = player?.hand || [];
  const displayCount = Math.min(hand.length, 7);
  return (
    <div className={`ek-opponent ek-opp-${position}${isActive ? ' ek-opponent-active' : ''}${isDead ? ' ek-opponent-dead' : ''}`}>
      <div className="ek-opp-info">
        <div className="ek-opp-avatar">{player?.name?.[0] || '?'}</div>
        <div>
          <div className="ek-opp-name">{player?.name}</div>
          <div className="ek-opp-cards">{hand.length} cards</div>
        </div>
      </div>
      <div className="ek-opp-hand">
        {[...Array(displayCount)].map((_, i) => (
          <div key={i} className="ek-opp-card" style={{ transform: `rotate(${(i - displayCount / 2) * 8}deg)` }}>
            <img src="/Resources/exploding kitten/backcard.webp" alt="Card Back" className="ek-opp-card-img" draggable={false} />
          </div>
        ))}
      </div>
      {isActive && <div className="ek-opp-pulse" />}
      {isDead && <div className="ek-opp-dead-mark">💥</div>}
    </div>
  );
}, (prev, next) => {
  // Custom comparator: only re-render when relevant props change
  return prev.isActive === next.isActive
    && prev.isDead === next.isDead
    && prev.position === next.position
    && (prev.player?.hand?.length === next.player?.hand?.length)
    && (prev.player?.name === next.player?.name);
});

/* ─── DEFUSE PANEL ───────────────────────────────────────────────────── */
const DefusePanel = memo(function DefusePanel({ drawPile, onPlaceBomb, title, icon, cardImage }) {
  const [pos, setPos] = useState(Math.floor(drawPile.length / 2));
  return (
    <div className="ek-panel-inner">
      {cardImage ? (
        <div className="ek-defuse-card-preview">
          <img src={cardImage} alt={title || 'Card'} className="ek-defuse-card-img" onError={e => { e.target.style.display = 'none'; }} />
        </div>
      ) : (
        <div className="ek-panel-icon">{icon ?? '💣'}</div>
      )}
      <h3 className="ek-panel-title">{title ?? `Place bomb at position ${pos}`}</h3>
      <input type="range" min="0" max={drawPile.length} value={pos} onChange={e => setPos(Number(e.target.value))} className="ek-range" />
      <div className="ek-range-labels"><span>Top</span><span>Bottom</span></div>
      <button className="ek-action-btn ek-action-play" style={{ width: '100%', marginTop: 12 }} onClick={() => onPlaceBomb(pos)}>
        Insert
      </button>
    </div>
  );
});

/* ─── SEE THE FUTURE PANEL ───────────────────────────────────────────── */
const SeeFuturePanel = memo(function SeeFuturePanel({ cards, onClose }) {
  return (
    <div className="ek-panel-inner ek-panel-wide">
      <div className="ek-panel-icon">🔮</div>
      <h3 className="ek-panel-title">Next {cards.length} cards</h3>
      <div className="ek-future-row">
        {cards.map((card, i) => {
          const meta = CARD_META[card.type];
          return (
            <div key={i} className="ek-future-item">
              <div className="ek-future-num">#{i + 1}</div>
              <img src={card.image || ''} alt={meta?.label} className="ek-card-img" onError={e => { e.target.style.display = 'none'; }} />
              <div className="ek-future-name">{meta?.label}</div>
            </div>
          );
        })}
      </div>
      <button className="ek-action-btn ek-action-draw" style={{ width: '100%', marginTop: 12 }} onClick={onClose}>Got it</button>
    </div>
  );
});

/* ─── ALTER THE FUTURE PANEL ─────────────────────────────────────────── */
const AlterFuturePanel = memo(function AlterFuturePanel({ cards, onReorder }) {
  const [reordered, setReordered] = useState(() => cards.map((c, i) => ({ ...c, _origIdx: i })));
  const [draggedIdx, setDraggedIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);

  const handleDragStart = (e, i) => {
    setDraggedIdx(i);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(i));
  };

  const handleDragOver = (e, i) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (i !== overIdx) setOverIdx(i);
  };

  const handleDrop = (e, targetIdx) => {
    e.preventDefault();
    e.stopPropagation();
    setReordered(prev => {
      if (draggedIdx === null || draggedIdx === targetIdx) return prev;
      const newOrder = [...prev];
      const [dragged] = newOrder.splice(draggedIdx, 1);
      newOrder.splice(targetIdx, 0, dragged);
      return newOrder;
    });
    setDraggedIdx(null);
    setOverIdx(null);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setOverIdx(null);
  };

  const handleConfirm = () => {
    onReorder(reordered.map(({ _origIdx, ...c }) => c));
  };

  return (
    <div className="ek-panel-inner ek-panel-wide">
      <div className="ek-panel-icon">✨</div>
      <h3 className="ek-panel-title">Rearrange the next 3 cards</h3>
      <p className="ek-panel-sub">Drag cards to reorder them</p>
      <div className="ek-future-row">
        {reordered.map((card, i) => {
          const meta = CARD_META[card.type];
          return (
            <div
              key={card._origIdx}
              className={`ek-future-item${draggedIdx === i ? ' ek-dragging' : ''}${overIdx === i && draggedIdx !== i ? ' ek-drag-over' : ''}`}
              draggable
              onDragStart={(e) => handleDragStart(e, i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDrop={(e) => handleDrop(e, i)}
              onDragEnd={handleDragEnd}
              style={{ cursor: 'grab', opacity: draggedIdx === i ? 0.5 : 1, touchAction: 'none' }}
            >
              <div className="ek-future-num">#{i + 1}</div>
              <img src={card.image || ''} alt={meta?.label} className="ek-card-img" draggable={false} onError={e => { e.target.style.display = 'none'; }} />
              <div className="ek-future-name">{meta?.label}</div>
            </div>
          );
        })}
      </div>
      <button className="ek-action-btn ek-action-play" style={{ width: '100%', marginTop: 12 }} onClick={handleConfirm}>Place Back</button>
    </div>
  );
});

/* ─── STYLES ─────────────────────────────────────────────────────────── */
function getStyles() {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&family=Nunito:wght@600;700;800;900&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --ek-fire: #FF5A1F;
      --ek-ember: #FF9020;
      --ek-gold: #FFD060;
      --ek-green: #3DD68C;
      --ek-blue: #5BB4F8;
      --ek-purple: #B87FFF;
      --ek-void: #07020F;
      --ek-ice: #BFE9FF;
      --ek-toxic: #C6FF4A;
      --ek-rad-yellow: #FFE45E;
      --ek-felt: #1A3A2A;
      --ek-felt-light: #254D38;
      --ek-felt-border: #2E6045;
      --ek-bg: #0D0D0D;
      --ek-surface: #181818;
      --ek-surface2: #222222;
      --ek-text: #F0EDE8;
      --ek-text-muted: #888880;
      --ek-card-w: 208px;
      --ek-card-h: 293px;
      --ek-pile-w: 116px;
      --ek-pile-h: 162px;
    }
    @media (max-width: 1024px) {
      :root {
        --ek-card-w: 182px;
        --ek-card-h: 256px;
      }
    }
    @media (max-width: 768px) {
      :root {
        --ek-card-w: 156px;
        --ek-card-h: 220px;
      }
    }
    @media (max-width: 480px) {
      :root {
        --ek-card-w: 130px;
        --ek-card-h: 183px;
      }
    }

    .ek-root {
      width: 100vw; height: 100vh;
      background: var(--ek-bg);
      color: var(--ek-text);
      font-family: 'Nunito', sans-serif;
      overflow: hidden; position: relative;
    }

    .ek-loading {
      display: flex; align-items: center; justify-content: center;
      width: 100vw; height: 100vh;
      font-size: 20px; color: var(--ek-ember);
      font-family: 'Bebas Neue', sans-serif; letter-spacing: 3px;
    }

    /* ── Mute button (replaces inline style) ── */
    .ek-mute-btn {
      background: none; border: none; cursor: pointer;
      font-size: 18px; margin-left: auto; color: var(--ek-text-muted);
      padding: 4px; line-height: 1;
    }
    .ek-mute-btn:hover { color: var(--ek-text); }

    /* ══ LOBBY ══ */
    .ek-lobby-root {
      display: flex; align-items: center; justify-content: center;
      background: radial-gradient(ellipse 140% 80% at 50% 110%, #3d1200 0%, #0D0D0D 60%);
    }
    .ek-lobby-sparks { position: fixed; inset: 0; pointer-events: none; overflow: hidden; }
    .ek-spark { position: absolute; width: 2px; border-radius: 1px; animation: sparkRise 3s ease-in infinite; bottom: 0; }
    .ek-spark-0 { height: 40px; background: var(--ek-fire); }
    .ek-spark-1 { height: 60px; background: var(--ek-ember); }
    .ek-spark-2 { height: 30px; background: var(--ek-gold); }
    .ek-spark-3 { height: 50px; background: #fff4; }
    @keyframes sparkRise {
      0% { transform: translateY(0) scaleX(1); opacity: 0.8; }
      60% { opacity: 0.6; }
      100% { transform: translateY(-100vh) scaleX(0.3); opacity: 0; }
    }
    .ek-lobby-inner {
      position: relative; z-index: 10;
      display: flex; flex-direction: column; align-items: center; gap: 40px;
      width: min(520px, 92vw);
    }
    .ek-lobby-brand { text-align: center; }
    .ek-brand-icon { font-size: 72px; filter: drop-shadow(0 0 30px rgba(255,90,31,0.6)); animation: brandBob 3s ease-in-out infinite; }
    @keyframes brandBob {
      0%, 100% { transform: translateY(0) rotate(-3deg); }
      50% { transform: translateY(-8px) rotate(3deg); }
    }
    .ek-brand-title { font-family: 'Bebas Neue', sans-serif; font-size: clamp(48px, 12vw, 80px); line-height: 0.9; letter-spacing: 4px; color: var(--ek-text); margin: 12px 0 8px; }
    .ek-brand-title span { background: linear-gradient(120deg, var(--ek-fire), var(--ek-gold)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .ek-brand-sub { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--ek-text-muted); letter-spacing: 3px; text-transform: uppercase; }
    .ek-lobby-forms { width: 100%; display: flex; flex-direction: column; gap: 12px; }
    .ek-form-card { background: rgba(30,18,8,0.8); border: 1px solid rgba(255,144,32,0.2); border-radius: 16px; padding: 20px; backdrop-filter: blur(8px); }
    .ek-form-tag { font-size: 10px; font-weight: 800; color: var(--ek-ember); text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px; }
    .ek-field { width: 100%; padding: 13px 16px; background: rgba(0,0,0,0.5); border: 1px solid #2a2016; border-radius: 10px; color: var(--ek-text); font-family: 'Nunito', sans-serif; font-size: 15px; font-weight: 600; outline: none; transition: border-color .2s, box-shadow .2s; }
    .ek-field:focus { border-color: var(--ek-fire); box-shadow: 0 0 0 3px rgba(255,90,31,0.15); }
    .ek-field::placeholder { color: #444; }
    .ek-field-code { font-family: 'DM Mono', monospace; letter-spacing: 4px; text-transform: uppercase; flex: 1; }
    .ek-form-row { display: flex; gap: 10px; flex-wrap: wrap; }
    .ek-join-group { flex: 1; display: flex; gap: 8px; min-width: 240px; }
    .ek-cta { padding: 14px 22px; border: none; border-radius: 12px; font-family: 'Nunito', sans-serif; font-size: 15px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all .2s; white-space: nowrap; }
    .ek-cta-fire { background: linear-gradient(130deg, #c02800, var(--ek-fire)); color: #fff; box-shadow: 0 6px 24px rgba(255,90,31,0.4); flex-shrink: 0; }
    .ek-cta-fire:hover { filter: brightness(1.1); transform: translateY(-1px); }
    .ek-cta-ghost { background: rgba(255,255,255,0.05); color: var(--ek-text); border: 1px solid rgba(255,255,255,0.1); flex-shrink: 0; }
    .ek-cta-ghost:hover { background: rgba(255,255,255,0.1); }
    .ek-cta-icon { font-size: 18px; }
    .ek-err-pill { background: rgba(255,80,80,0.15); border: 1px solid rgba(255,80,80,0.3); color: #ff8888; border-radius: 8px; padding: 10px 14px; font-size: 13px; text-align: center; }

    /* ══ ROOM ══ */
    .ek-room-root { display: flex; align-items: center; justify-content: center; background: radial-gradient(ellipse 120% 60% at 50% -10%, #1a3020 0%, #0D0D0D 55%); }
    .ek-room-wrap { position: relative; z-index: 10; width: min(600px, 94vw); display: flex; flex-direction: column; gap: 28px; padding: 0 20px; }
    .ek-room-header { display: flex; align-items: center; justify-content: space-between; width: 100%; margin-bottom: 8px; }
    .ek-room-title { font-family: 'Bebas Neue', sans-serif; font-size: 36px; letter-spacing: 2px; color: var(--ek-text); margin: 0; }
    .ek-back-btn { background: none; border: none; color: var(--ek-ember); font-family: 'Nunito', sans-serif; font-size: 14px; font-weight: 700; cursor: pointer; align-self: flex-start; padding: 0; }
    .ek-back-btn:hover { color: var(--ek-gold); }
    .ek-room-code-card { background: rgba(30,18,8,0.8); border: 1.5px solid rgba(255,144,32,0.3); border-radius: 20px; padding: 28px 24px; backdrop-filter: blur(8px); text-align: center; box-shadow: 0 8px 32px rgba(0,0,0,0.4); }
    .ek-room-eyebrow { font-family: 'DM Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 3px; color: var(--ek-text-muted); margin: 0 0 16px 0; }
    .ek-room-code-display-large { font-family: 'Bebas Neue', sans-serif; font-size: 72px; letter-spacing: 8px; background: linear-gradient(120deg, var(--ek-green), var(--ek-blue)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; cursor: pointer; display: inline-block; transition: transform .2s, filter .2s; line-height: 1; margin: 0; }
    .ek-room-code-display-large:hover { transform: scale(1.05); filter: brightness(1.2); }
    .ek-code-sub { font-family: 'DM Mono', monospace; font-size: 12px; color: var(--ek-text-muted); letter-spacing: 0.5px; margin: 12px 0 0 0; }
    .ek-players-section { width: 100%; }
    .ek-players-header { margin-bottom: 16px; }
    .ek-section-label { font-family: 'Nunito', sans-serif; font-size: 14px; font-weight: 800; color: var(--ek-gold); letter-spacing: 1px; margin: 0; text-transform: uppercase; }
    .ek-players-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; width: 100%; }
    @media (min-width: 700px) { .ek-players-grid { grid-template-columns: repeat(3, 1fr); gap: 12px; } }
    .ek-player-card { background: rgba(26,16,8,0.7); border: 2px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 18px 14px; text-align: center; transition: all .3s ease; position: relative; display: flex; flex-direction: column; align-items: center; gap: 12px; overflow: hidden; }
    .ek-player-card::before { content: ''; position: absolute; inset: 0; background: rgba(var(--player-color-rgb, 255,144,32), 0); pointer-events: none; transition: background .3s ease; }
    .ek-player-filled { background: linear-gradient(135deg, rgba(26,16,8,0.9) 0%, rgba(30,20,10,0.7) 100%); border-color: rgba(255,144,32,0.35); }
    .ek-player-filled:hover { border-color: rgba(255,144,32,0.6); box-shadow: 0 8px 24px rgba(255,90,31,0.2); transform: translateY(-2px); }
    .ek-player-self { border: 2px solid var(--ek-fire); background: linear-gradient(135deg, rgba(255,90,31,0.15) 0%, rgba(255,144,32,0.08) 100%); box-shadow: 0 0 24px rgba(255,90,31,0.25), inset 0 0 16px rgba(255,90,31,0.1); }
    .ek-player-empty { border-color: rgba(255,255,255,0.1); opacity: 0.6; }
    .ek-player-empty:hover { border-color: rgba(255,144,32,0.2); }
    .ek-player-slot-indicator { font-size: 9px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: var(--ek-text-muted); padding: 4px 10px; background: rgba(255,255,255,0.05); border-radius: 6px; }
    .ek-slot-label { color: rgba(255,255,255,0.6); }
    .ek-player-avatar { width: 56px; height: 56px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 800; background: linear-gradient(135deg, rgba(255,144,32,0.2), rgba(255,90,31,0.15)); border: 2px solid rgba(255,144,32,0.4); color: var(--ek-ember); z-index: 1; }
    .ek-player-empty .ek-player-avatar { opacity: 0.4; color: rgba(255,255,255,0.3); border-color: rgba(255,255,255,0.1); }
    .ek-player-details { width: 100%; z-index: 1; }
    .ek-player-name { font-size: 14px; font-weight: 700; color: var(--ek-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ek-player-empty .ek-player-name { color: var(--ek-text-muted); font-weight: 600; }
    .ek-player-you { font-size: 11px; font-family: 'DM Mono', monospace; color: var(--ek-green); font-weight: 800; letter-spacing: 1px; }
    .ek-player-waiting { font-size: 11px; color: var(--ek-text-muted); font-family: 'DM Mono', monospace; }
    .ek-room-action { display: flex; flex-direction: column; gap: 12px; align-items: center; margin-top: 12px; }
    .ek-host-info { font-size: 12px; color: var(--ek-text-muted); font-family: 'DM Mono', monospace; margin: 0; letter-spacing: 1px; }
    .ek-host-wait { text-align: center; font-size: 14px; color: var(--ek-text-muted); font-family: 'Nunito', sans-serif; font-weight: 600; margin: 0; }
    .ek-lobby-hint { text-align: center; font-size: 12px; color: var(--ek-text-muted); font-family: 'DM Mono', monospace; margin: 0; }
    .ek-start-btn { width: 100%; max-width: 320px; padding: 16px 24px; border: none; border-radius: 14px; font-family: 'Nunito', sans-serif; font-size: 16px; font-weight: 800; cursor: pointer; letter-spacing: .5px; transition: all .2s; }
    .ek-start-ready { background: linear-gradient(130deg, #c02800, var(--ek-fire)); color: #fff; box-shadow: 0 8px 28px rgba(255,90,31,0.4); }
    .ek-start-ready:hover { filter: brightness(1.1); transform: translateY(-2px); box-shadow: 0 12px 36px rgba(255,90,31,0.5); }
    .ek-start-wait { background: rgba(255,255,255,0.06); color: var(--ek-text-muted); cursor: not-allowed; }
    .ek-copied-toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: linear-gradient(120deg, var(--ek-green), #2aaa70); color: #fff; padding: 10px 22px; border-radius: 24px; font-size: 13px; font-weight: 700; box-shadow: 0 6px 20px rgba(61,214,140,0.4); z-index: 1000; }

    /* ══ GAME BOARD ══ */
    .ek-game-root { background: radial-gradient(ellipse 100% 60% at 50% 50%, #1a3020 0%, #0D0D0D 70%); }
    .ek-game-layout { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: 12px 16px; gap: 8px; }

    .ek-opponents-ring { width: 100%; display: flex; flex-direction: row; justify-content: center; align-items: flex-start; gap: 12px; flex-wrap: wrap; flex-shrink: 0; }
    .ek-opponent { display: flex; flex-direction: column; align-items: center; padding: 10px 12px 8px; gap: 6px; background: rgba(16,12,6,0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; position: relative; transition: all .3s; min-width: 120px; }
    .ek-opponent-active { border-color: var(--ek-fire); box-shadow: 0 0 20px rgba(255,90,31,0.3); }
    .ek-opponent-dead { opacity: 0.35; filter: grayscale(0.8); }
    .ek-opp-info { display: flex; align-items: center; gap: 8px; width: 100%; }
    .ek-opp-avatar { width: 36px; height: 36px; border-radius: 50%; background: rgba(255,144,32,0.15); border: 1.5px solid rgba(255,144,32,0.3); display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 800; color: var(--ek-ember); flex-shrink: 0; }
    .ek-opp-name { font-size: 13px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 90px; }
    .ek-opp-cards { font-size: 10px; color: var(--ek-text-muted); font-family: 'DM Mono', monospace; }
    .ek-opp-hand { display: flex; justify-content: center; height: 34px; position: relative; }
    .ek-opp-card { width: 22px; height: 32px; background: linear-gradient(160deg, #2a1a0a, #1a0a02); border: 1px solid rgba(255,144,32,0.25); border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 10px; margin-left: -7px; transform-origin: bottom center; }
    .ek-opp-card:first-child { margin-left: 0; }
    .ek-opp-card-img { width: 100%; height: 100%; display: block; object-fit: cover; }
    .ek-opp-pulse { position: absolute; inset: -4px; border-radius: 18px; border: 2px solid var(--ek-fire); animation: oppPulse 1.2s ease-in-out infinite; pointer-events: none; }
    @keyframes oppPulse { 0%,100% { opacity: .8; transform: scale(1); } 50% { opacity: .2; transform: scale(1.04); } }
    .ek-opp-dead-mark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 28px; }

    .ek-center-area { flex: 1; display: flex; align-items: center; justify-content: center; width: 100%; padding: 4px 0; }
    .ek-table-felt-game { width: min(480px, 90vw); background: radial-gradient(ellipse at center, #1e4530 0%, #122a1c 60%, #0c1e12 100%); border: 2px solid var(--ek-felt-border); border-radius: 24px; padding: 20px 20px 18px; box-shadow: inset 0 2px 0 rgba(255,255,255,0.04), 0 12px 40px rgba(0,0,0,0.6); display: flex; flex-direction: column; align-items: center; gap: 14px; }
    
    .ek-defuse-card-preview {
      display: flex; justify-content: center; margin-bottom: 16px;
    }
    .ek-defuse-card-img {
      width: 110px; height: 154px; object-fit: cover;
      border-radius: 12px;
      border: 3px solid rgba(176, 190, 197, 0.6);
      box-shadow: 0 0 20px rgba(176,190,197,0.4), 0 8px 24px rgba(0,0,0,0.6);
    }
    
    .ek-piles-row { display: flex; gap: 36px; align-items: flex-end; }
    .ek-pile-slot { display: flex; flex-direction: column; align-items: center; gap: 8px; position: relative; }
    .ek-pile-name { font-size: 10px; color: rgba(255,255,255,0.35); text-transform: uppercase; letter-spacing: 2px; font-family: 'DM Mono', monospace; }
    .ek-pile-card { width: var(--ek-pile-w); height: var(--ek-pile-h); border-radius: 10px; overflow: hidden; position: relative; border: 1px solid rgba(255,255,255,0.1); transition: transform .2s, box-shadow .2s; }
    .ek-pile-empty { width: var(--ek-pile-w); height: var(--ek-pile-h); border-radius: 10px; border: 1.5px dashed rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; }
    .ek-pile-empty-text { font-size: 10px; color: rgba(255,255,255,0.2); }
    .ek-pile-clickable { cursor: pointer; }
    .ek-pile-clickable:hover { transform: translateY(-5px) scale(1.05); box-shadow: 0 10px 28px rgba(61,214,140,0.35); border-color: var(--ek-green); }
    .ek-card-back { width: 100%; height: 100%; background: linear-gradient(160deg, #3d1200, #1a0800); border-radius: 9px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .ek-card-back-img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .ek-card-back-icon { font-size: 32px; opacity: 0.4; }
    .ek-card-img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .ek-pile-count-badge { position: absolute; bottom: 5px; right: 6px; background: rgba(0,0,0,0.75); color: #fff; font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 6px; font-family: 'DM Mono', monospace; }
    .ek-discard-label { position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(to top, rgba(0,0,0,0.9), transparent); padding: 6px 4px 4px; font-size: 9px; text-align: center; font-family: 'DM Mono', monospace; color: rgba(255,255,255,0.7); }

    /* ── Draw card animation ── */
    .ek-pile-draw-pulse { animation: drawPulse .35s ease; }
    @keyframes drawPulse { 0% { transform: scale(1); } 45% { transform: scale(0.92); } 100% { transform: scale(1); } }
    .ek-draw-fly {
      position: absolute; top: 0; left: 50%; width: var(--ek-pile-w); height: var(--ek-pile-h);
      margin-left: calc(var(--ek-pile-w) / -2); border-radius: 10px; overflow: hidden;
      pointer-events: none; z-index: 60; box-shadow: 0 14px 36px rgba(0,0,0,0.55);
      animation: drawFly .62s cubic-bezier(.3,.7,.3,1) forwards;
    }
    @keyframes drawFly {
      0%   { opacity: 0; transform: translateY(0) translateX(0) scale(1) rotate(0deg); }
      18%  { opacity: 1; }
      100% { opacity: 0; transform: translateY(180px) translateX(-30px) scale(1.25) rotate(-10deg); }
    }

    /* ── Nope Banner ── */
    .ek-nope-banner { width: 100%; border-radius: 14px; padding: 12px 16px; display: flex; flex-direction: column; gap: 10px; animation: nopeBannerIn .3s ease; }
    @keyframes nopeBannerIn { from { opacity: 0; transform: scale(.95); } to { opacity: 1; transform: scale(1); } }
    .ek-nope-banner-active { background: rgba(255, 90, 31, 0.15); border: 1.5px solid rgba(255, 90, 31, 0.5); }
    .ek-nope-banner-noped { background: rgba(255, 50, 50, 0.2); border: 1.5px solid rgba(255, 50, 50, 0.6); }
    .ek-nope-banner-row { display: flex; align-items: center; gap: 10px; }
    .ek-nope-banner-icon { font-size: 22px; }
    .ek-nope-banner-text { flex: 1; font-size: 13px; line-height: 1.4; }
    .ek-noped-label { color: #ff5555; font-weight: 800; }
    .ek-nope-timer { font-family: 'Bebas Neue', sans-serif; font-size: 24px; color: var(--ek-fire); letter-spacing: 1px; min-width: 28px; text-align: right; }
    .ek-nope-btn { width: 100%; padding: 10px 16px; border: none; border-radius: 10px; background: linear-gradient(130deg, #9b0000, #ff3030); color: #fff; font-family: 'Nunito', sans-serif; font-size: 14px; font-weight: 800; cursor: pointer; animation: nopePulse .8s ease-in-out infinite alternate; }
    @keyframes nopePulse { from { box-shadow: 0 0 8px rgba(255,50,50,0.4); } to { box-shadow: 0 0 20px rgba(255,50,50,0.8); } }
    .ek-nope-btn:hover { filter: brightness(1.15); }
    .ek-nope-wait { text-align: center; font-size: 11px; color: var(--ek-text-muted); font-family: 'DM Mono', monospace; }

    .ek-turn-chip { padding: 8px 18px; border-radius: 20px; font-size: 12px; font-weight: 700; letter-spacing: .3px; transition: all .3s; }
    .ek-turn-mine { background: rgba(61,214,140,0.18); border: 1px solid rgba(61,214,140,0.4); color: var(--ek-green); animation: turnPulse 1.4s ease-in-out infinite; }
    @keyframes turnPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(61,214,140,0.3); } 50% { box-shadow: 0 0 0 6px rgba(61,214,140,0); } }
    .ek-turn-wait { background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.06); color: var(--ek-text-muted); }
    .ek-log-strip { width: 100%; max-height: 56px; overflow: hidden; display: flex; flex-direction: column; gap: 2px; }
    .ek-log-entry { font-size: 10px; color: rgba(255,255,255,0.35); font-family: 'DM Mono', monospace; text-align: center; line-height: 1.4; }

    /* ── Phase Overlays ── */
    .ek-overlay-panel { position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(4px); }
    .ek-panel-inner { background: #1e1206; border: 1px solid rgba(255,144,32,0.3); border-radius: 20px; padding: 28px; width: min(380px, 92vw); text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.8); max-height: 90vh; overflow-y: auto; }
    .ek-panel-wide { width: min(520px, 94vw); }
    .ek-panel-icon { font-size: 48px; margin-bottom: 12px; }
    .ek-panel-title { font-size: 16px; font-weight: 800; color: var(--ek-ember); margin-bottom: 6px; }
    .ek-panel-sub { font-size: 12px; color: var(--ek-text-muted); font-family: 'DM Mono', monospace; margin-bottom: 16px; }
    .ek-range { width: 100%; margin-bottom: 6px; accent-color: var(--ek-fire); }
    .ek-range-labels { display: flex; justify-content: space-between; font-size: 10px; color: var(--ek-text-muted); font-family: 'DM Mono', monospace; margin-bottom: 4px; }
    .ek-future-row { display: flex; gap: 16px; justify-content: center; margin-bottom: 4px; flex-wrap: wrap; }
    .ek-future-item { display: flex; flex-direction: column; align-items: center; gap: 6px; }
    .ek-future-num { font-size: 13px; font-family: 'DM Mono', monospace; color: var(--ek-text-muted); }
    .ek-future-item img { width: 124px; height: 174px; object-fit: cover; border-radius: 12px; border: 2px solid rgba(255,255,255,0.12); box-shadow: 0 8px 24px rgba(0,0,0,0.5); transition: transform .2s, box-shadow .2s; }
    .ek-future-name { font-size: 12px; color: var(--ek-text); text-align: center; max-width: 124px; font-weight: 700; }
    .ek-dragging img { transform: scale(0.95); box-shadow: 0 12px 32px rgba(184,127,255,0.4); border-color: var(--ek-purple); }

    /* ── Target / Favor panels ── */
    .ek-target-list { display: flex; flex-direction: column; gap: 10px; }
    .ek-target-btn { display: flex; align-items: center; gap: 14px; padding: 14px 18px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; color: var(--ek-text); font-family: 'Nunito', sans-serif; font-size: 15px; font-weight: 700; cursor: pointer; text-align: left; transition: all .2s; }
    .ek-target-btn:hover:not(:disabled) { background: rgba(255,144,32,0.15); border-color: var(--ek-ember); transform: translateY(-1px); }
    .ek-target-btn:disabled { opacity: 0.4; cursor: default; }
    .ek-target-avatar { width: 40px; height: 40px; border-radius: 50%; background: rgba(255,144,32,0.2); border: 2px solid var(--ek-ember); display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 800; color: var(--ek-ember); flex-shrink: 0; }
    .ek-target-count { font-size: 11px; color: var(--ek-text-muted); font-family: 'DM Mono', monospace; margin-left: auto; }
    .ek-favor-hand { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-bottom: 4px; }
    .ek-favor-card { width: var(--ek-card-w); height: var(--ek-card-h); border-radius: 10px; overflow: hidden; border: 2px solid rgba(255,255,255,0.1); cursor: pointer; position: relative; transition: transform .18s, border-color .18s; flex-shrink: 0; }
    .ek-favor-card:hover { transform: translateY(-8px) scale(1.06); border-color: var(--ek-ember); }
    .ek-opp-mini-cards { display: flex; gap: 2px; }
    .ek-opp-mini-card { font-size: 14px; }

    .ek-fx-card-icon {
      position: absolute; bottom: 6px; right: 6px;
      font-size: 22px; filter: drop-shadow(0 2px 6px rgba(0,0,0,0.6));
      animation: fxIconPop .5s cubic-bezier(.34,1.56,.64,1) .2s backwards;
    }
    @keyframes fxIconPop { from { transform: scale(0) rotate(-30deg); opacity: 0; } to { transform: scale(1) rotate(0); opacity: 1; } }

    /* ── Steal panel ── */
    .ek-steal-grid { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; margin: 4px 0; max-height: 46vh; overflow-y: auto; padding: 6px; }
    .ek-steal-card { position: relative; width: 74px; height: 104px; padding: 0; border: none; background: none; cursor: pointer; border-radius: 10px; transform-origin: bottom center; animation: stealCardIn .4s cubic-bezier(.34,1.56,.64,1) backwards; transition: transform .18s cubic-bezier(.34,1.56,.64,1); }
    @keyframes stealCardIn { from { opacity: 0; transform: translateY(16px) rotateX(40deg); } to { opacity: 1; transform: translateY(0) rotateX(0); } }
    .ek-steal-card:hover, .ek-steal-card-hover { transform: translateY(-10px) scale(1.07); }
    .ek-steal-card-back { width: 100%; height: 100%; border-radius: 10px; background: linear-gradient(160deg, #3d1200, #1a0800); border: 2px solid rgba(255,144,32,0.35); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.06); transition: border-color .18s, box-shadow .18s; }
    .ek-steal-card:hover .ek-steal-card-back, .ek-steal-card-hover .ek-steal-card-back { border-color: var(--ek-ember); box-shadow: 0 8px 22px rgba(255,90,31,0.45), 0 0 0 2px var(--ek-ember); }
    .ek-steal-card-num { position: absolute; bottom: 4px; left: 0; right: 0; text-align: center; font-family: 'DM Mono', monospace; font-size: 9px; color: rgba(255,255,255,0.55); }

    /* ══ CARD FLIP ANIMATION ══ */
    .ek-hand-card {
      width: var(--ek-card-w);
      height: var(--ek-card-h);
      border-radius: 12px;
      border: 2px solid rgba(255,255,255,0.1);
      flex-shrink: 0;
      cursor: pointer;
      position: relative;
      transition: transform .18s cubic-bezier(.34,1.56,.64,1), border-color .18s, box-shadow .18s;
      /* GPU compositing hint for animated cards */
      will-change: transform;
    }

    .ek-card-face {
      position: absolute; inset: 0;
      border-radius: 10px; overflow: hidden;
    }

    .ek-card-face-back  { display: none; }
    .ek-card-face-front { display: block; z-index: 1; }

    .ek-hand-card.ek-hand-card-new .ek-card-face-back {
      display: block; z-index: 2;
      animation: faceHide 0.75s forwards;
    }
    .ek-hand-card.ek-hand-card-new .ek-card-face-front {
      display: block; z-index: 3;
      animation: faceReveal 0.75s forwards;
    }

    .ek-hand-card.ek-hand-card-new {
      animation: cardSlideIn 0.75s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }

    @keyframes cardSlideIn {
      0%   { transform: translateY(40px) scale(0.8); opacity: 0; }
      60%  { transform: translateY(-8px) scale(1.08); opacity: 1; }
      100% { transform: translateY(0px) scale(1); opacity: 1; }
    }

    @keyframes faceHide {
      0%  { transform: scaleX(1); opacity: 1; }
      40% { transform: scaleX(0); opacity: 1; }
      41% { transform: scaleX(0); opacity: 0; }
      100%{ transform: scaleX(0); opacity: 0; }
    }

    @keyframes faceReveal {
      0%  { transform: scaleX(0); opacity: 0; }
      40% { transform: scaleX(0); opacity: 0; }
      41% { transform: scaleX(0); opacity: 1; }
      100%{ transform: scaleX(1); opacity: 1; }
    }

    .ek-hand-card:hover:not(.ek-hand-card-disabled):not(.ek-hand-card-new) {
      transform: translateY(-18px) scale(1.08);
      border-color: var(--card-color, var(--ek-ember));
      box-shadow: 0 16px 36px rgba(0,0,0,0.6), 0 0 0 2px var(--card-color, var(--ek-ember));
    }
    .ek-hand-card-selected:not(.ek-hand-card-new) {
      transform: translateY(-26px) scale(1.1) !important;
      border-color: var(--card-color, var(--ek-fire)) !important;
      box-shadow: 0 0 0 2px var(--card-color, var(--ek-fire)), 0 20px 44px rgba(255,90,31,0.5) !important;
    }
    .ek-hand-card-disabled { opacity: 0.55; cursor: default; }
    .ek-hand-card-nopeable {
      opacity: 1 !important; cursor: pointer !important;
      border-color: rgba(255,50,50,0.6) !important;
      box-shadow: 0 0 14px rgba(255,50,50,0.5), 0 0 0 2px rgba(255,50,50,0.4) !important;
      animation: nopePulse .8s ease-in-out infinite alternate;
    }
    .ek-nope-glow { position: absolute; inset: 0; background: radial-gradient(ellipse at center, rgba(255,50,50,0.25) 0%, transparent 70%); pointer-events: none; z-index: 10; }

    /* ── Selected card: ring glow matching the card's own color, no white wash ── */
    .ek-hand-card-selected:not(.ek-hand-card-new) {
      transform: translateY(-26px) scale(1.1) !important;
      border-color: var(--card-color, var(--ek-fire)) !important;
      box-shadow:
        0 0 0 2px var(--card-color, var(--ek-fire)),
        0 0 26px color-mix(in srgb, var(--card-color, var(--ek-fire)) 60%, transparent),
        0 20px 44px rgba(0,0,0,0.55) !important;
    }
    .ek-hand-card-selected:not(.ek-hand-card-new)::after {
      content: '';
      position: absolute; inset: -6px;
      border-radius: 16px;
      border: 2px solid var(--card-color, var(--ek-fire));
      opacity: 0; pointer-events: none;
      animation: selectedRingPulse 1.6s ease-out infinite;
    }
    @keyframes selectedRingPulse {
      0%   { opacity: .65; transform: scale(1); }
      100% { opacity: 0;   transform: scale(1.18); }
    }

    /* ── Selected badge (✓ ready to play / 🔗 needs a pair) ── */
    .ek-card-selected-badge {
      position: absolute; top: -10px; right: -10px;
      width: 26px; height: 26px; border-radius: 50%;
      background: var(--card-color, var(--ek-fire));
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; color: #140a02; font-weight: 900;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5), 0 0 0 3px #0D0D0D;
      z-index: 20; pointer-events: none;
      animation: badgePop .3s cubic-bezier(.34,1.56,.64,1);
    }
    @keyframes badgePop {
      from { transform: scale(0) rotate(-25deg); opacity: 0; }
      to   { transform: scale(1) rotate(0deg);   opacity: 1; }
    }

    /* ── "Pick a matching card" hint for cat-card pairing ── */
    .ek-card-pair-hint {
      position: absolute; top: -34px; left: 50%; transform: translateX(-50%);
      background: rgba(20,12,4,0.95); border: 1px solid var(--card-color, var(--ek-gold));
      color: var(--ek-text); font-family: 'DM Mono', monospace; font-size: 9px;
      letter-spacing: .5px; white-space: nowrap; padding: 4px 10px; border-radius: 8px;
      z-index: 20; pointer-events: none; animation: pairHintIn .25s ease;
    }
    @keyframes pairHintIn {
      from { opacity: 0; transform: translate(-50%, 6px); }
      to   { opacity: 1; transform: translate(-50%, 0); }
    }

    /* ── Cat card selected and waiting for its pair: distinct dashed gold ring ── */
    .ek-hand-card-pairing:not(.ek-hand-card-new) {
      border-color: var(--ek-gold) !important;
      border-style: dashed !important;
      box-shadow:
        0 0 0 2px var(--ek-gold),
        0 0 26px rgba(255,208,96,0.55),
        0 20px 44px rgba(0,0,0,0.55) !important;
    }
    .ek-hand-card-pairing:not(.ek-hand-card-new)::after {
      border-color: var(--ek-gold);
      border-style: dashed;
    }
    .ek-hand-empty { color: rgba(255,255,255,0.2); font-size: 13px; font-family: 'DM Mono', monospace; padding: 24px; align-self: center; }

    /* ══ MY HAND ══ */
    .ek-my-zone { width: 100%; flex-shrink: 0; background: linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%); border-top: 1px solid rgba(255,255,255,0.06); padding: 10px 16px 14px; display: flex; flex-direction: column; align-items: center; gap: 10px; }
    .ek-my-info { display: flex; align-items: center; gap: 10px; width: 100%; justify-content: center; }
    .ek-my-avatar { width: 34px; height: 34px; border-radius: 50%; background: rgba(255,90,31,0.15); border: 1.5px solid var(--ek-fire); display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 800; color: var(--ek-fire); }
    .ek-my-name { font-size: 14px; font-weight: 800; }
    .ek-my-cardcount { font-size: 10px; color: var(--ek-text-muted); font-family: 'DM Mono', monospace; }
    .ek-my-turn-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--ek-green); box-shadow: 0 0 8px var(--ek-green); animation: oppPulse 1s infinite; }

    .ek-hand-and-actions { display: flex; flex-direction: row; align-items: flex-end; gap: 16px; width: 100%; justify-content: center; overflow-x: auto; padding: 8px 16px; scrollbar-width: none; -ms-overflow-style: none; }
    .ek-hand-and-actions::-webkit-scrollbar { display: none; }
    
    .ek-hand-fan { display: flex; flex-direction: row; justify-content: center; gap: 10px; padding: 0; flex: 1; min-height: calc(var(--ek-card-h) + 20px); align-items: flex-end; }

    .ek-action-strip { display: flex; flex-direction: column; gap: 10px; flex-shrink: 0; }
    @media (max-width: 1024px) and (min-width: 641px) {
      .ek-action-strip { flex-direction: row; gap: 8px; }
    }
    @media (max-width: 640px) {
      .ek-action-strip { flex-direction: column; gap: 8px; }
    }
    .ek-action-btn { padding: 16px 24px; border: none; border-radius: 12px; font-family: 'Nunito', sans-serif; font-size: 14px; font-weight: 800; cursor: pointer; transition: all .2s; text-transform: uppercase; letter-spacing: .6px; white-space: nowrap; }
    @media (min-width: 1025px) {
      .ek-action-btn { min-width: 160px; }
    }
    @media (max-width: 768px) {
      .ek-action-btn { min-width: 140px; font-size: 13px; padding: 14px 20px; }
    }
    @media (max-width: 480px) {
      .ek-action-btn { min-width: 100%; font-size: 12px; padding: 12px 18px; }
    }
    .ek-action-play { background: linear-gradient(130deg, #c02800, var(--ek-fire)); color: #fff; box-shadow: 0 6px 24px rgba(255,90,31,0.5); }
    .ek-action-play:hover { filter: brightness(1.15); transform: translateY(-2px); box-shadow: 0 8px 32px rgba(255,90,31,0.6); }
    .ek-action-play:active { transform: translateY(0); }
    .ek-action-draw { background: rgba(255,255,255,0.06); color: var(--ek-text); border: 1.5px solid rgba(255,255,255,0.15); }
    .ek-action-draw:hover { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.25); transform: translateY(-2px); box-shadow: 0 6px 20px rgba(255,255,255,0.1); }
    .ek-action-draw:active { transform: translateY(0); }

    /* ── Action FX ── */
    .ek-fx-layer { position: fixed; inset: 0; z-index: 200; pointer-events: none; display: flex; align-items: center; justify-content: center; }
    .ek-fx-card { width: 130px; height: 182px; border-radius: 14px; overflow: hidden; border: 3px solid var(--fx-color, var(--ek-ember)); box-shadow: 0 0 40px var(--fx-color, var(--ek-ember)), 0 18px 50px rgba(0,0,0,0.6); animation: fxCardPlay 1.05s cubic-bezier(.2,.8,.3,1) forwards; }
    .ek-fx-card img { width: 100%; height: 100%; object-fit: cover; }
    @keyframes fxCardPlay {
      0%   { opacity: 0; transform: translateY(120px) scale(.5) rotate(-12deg); }
      22%  { opacity: 1; transform: translateY(0) scale(1.12) rotate(3deg); }
      58%  { opacity: 1; transform: translateY(0) scale(1) rotate(0deg); }
      100% { opacity: 0; transform: translateY(-60px) scale(.85) rotate(0deg); }
    }
    .ek-fx-ring { position: absolute; width: 130px; height: 130px; border-radius: 50%; border: 4px solid var(--fx-color, var(--ek-ember)); animation: fxRing 1s ease-out forwards; animation-delay: .15s; opacity: 0; }
    .ek-fx-ring-2 { animation-delay: .32s; }
    @keyframes fxRing { 0% { opacity: .8; transform: scale(.3); } 100% { opacity: 0; transform: scale(3.2); } }
    .ek-fx-label { position: absolute; bottom: 26%; font-family: 'Bebas Neue', sans-serif; font-size: 38px; letter-spacing: 3px; color: #fff; text-shadow: 0 2px 18px var(--fx-color, var(--ek-ember)), 0 0 30px var(--fx-color, var(--ek-ember)); animation: fxLabel 1.05s ease-out forwards; }
    @keyframes fxLabel {
      0%   { opacity: 0; transform: translateY(20px) scale(.7); }
      28%  { opacity: 1; transform: translateY(0) scale(1); }
      70%  { opacity: 1; }
      100% { opacity: 0; transform: translateY(-14px) scale(1.05); }
    }
    .ek-fx-spark { position: absolute; width: 8px; height: 8px; border-radius: 50%; background: var(--fx-color, var(--ek-ember)); box-shadow: 0 0 10px var(--fx-color, var(--ek-ember)); animation: fxSpark .9s ease-out forwards; }
    @keyframes fxSpark {
      0%   { opacity: 1; transform: translate(0,0) scale(1); }
      100% { opacity: 0; transform: translate(var(--sx), var(--sy)) scale(.3); }
    }

    /* ══ BOMB EXPLOSION EFFECT ══ */
    .ek-bomb-overlay {
      position: fixed; inset: 0; z-index: 300;
      display: flex; align-items: center; justify-content: center;
      pointer-events: none;
      animation: bombShake 0.55s cubic-bezier(.36,.07,.19,.97) forwards;
      /* Promote to own compositor layer */
      will-change: transform;
    }
    @keyframes bombShake {
      0%  { transform: translate(0,0) rotate(0deg); }
      10% { transform: translate(-8px, -4px) rotate(-1.5deg); }
      20% { transform: translate(10px, 5px) rotate(1.5deg); }
      30% { transform: translate(-9px, 2px) rotate(-1deg); }
      40% { transform: translate(8px, -5px) rotate(1deg); }
      50% { transform: translate(-5px, 4px) rotate(-.5deg); }
      60% { transform: translate(4px, -3px) rotate(.5deg); }
      70% { transform: translate(-3px, 2px) rotate(-.2deg); }
      80% { transform: translate(2px, -1px) rotate(.1deg); }
      100%{ transform: translate(0,0) rotate(0deg); }
    }

    .ek-bomb-flash {
      position: absolute; inset: 0;
      background: radial-gradient(ellipse at center, rgba(255,230,100,0.95) 0%, rgba(255,80,0,0.7) 40%, transparent 70%);
      animation: bombFlash 0.7s ease-out forwards;
      z-index: 1;
    }
    @keyframes bombFlash { 0% { opacity: 0; } 8% { opacity: 1; } 35% { opacity: 0.6; } 100% { opacity: 0; } }

    .ek-bomb-ring { position: absolute; border-radius: 50%; border: 4px solid rgba(255, 140, 0, 0.8); z-index: 4; pointer-events: none; animation: bombRingExpand 0.9s cubic-bezier(0.1, 0.5, 0.3, 1) forwards; }
    .ek-bomb-ring-1 { width: 60px; height: 60px; animation-delay: 0.05s; border-color: rgba(255, 220, 50, 0.9); border-width: 5px; }
    .ek-bomb-ring-2 { width: 60px; height: 60px; animation-delay: 0.18s; border-color: rgba(255, 100, 0, 0.7); border-width: 3px; }
    .ek-bomb-ring-3 { width: 60px; height: 60px; animation-delay: 0.33s; border-color: rgba(255, 50, 0, 0.5); border-width: 2px; }
    @keyframes bombRingExpand { 0% { opacity: 1; transform: scale(0.1); } 60% { opacity: 0.7; } 100% { opacity: 0; transform: scale(8); } }

    .ek-bomb-particle {
      position: absolute;
      width: var(--size, 10px); height: var(--size, 10px);
      border-radius: 50%;
      background: radial-gradient(circle, #fff7a0, #ff6600, #cc2200);
      box-shadow: 0 0 8px #ff4400, 0 0 20px #ff2200;
      z-index: 5;
      animation: bombParticle 0.95s cubic-bezier(0.1, 0.8, 0.3, 1) var(--delay, 0s) forwards;
    }
    @keyframes bombParticle {
      0%   { opacity: 1; transform: translate(0, 0) scale(1); }
      100% { opacity: 0; transform: rotate(var(--angle)) translateX(var(--dist)) scale(0.3); }
    }

    .ek-bomb-card-slam { position: relative; z-index: 8; animation: bombCardSlam 2.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
    @keyframes bombCardSlam {
      0%   { transform: scale(0) rotate(-20deg); opacity: 0; }
      12%  { transform: scale(1.5) rotate(5deg); opacity: 1; }
      22%  { transform: scale(1.2) rotate(-3deg); opacity: 1; }
      32%  { transform: scale(1.3) rotate(2deg); opacity: 1; }
      55%  { transform: scale(1.25) rotate(0deg); opacity: 1; }
      80%  { transform: scale(1.25) rotate(0deg); opacity: 1; }
      100% { transform: scale(0.8) rotate(-5deg); opacity: 0; }
    }
    .ek-bomb-card-inner { width: 160px; height: 224px; border-radius: 16px; overflow: hidden; border: 3px solid #ff4400; box-shadow: 0 0 0 2px #ff8800, 0 0 40px #ff4400, 0 0 80px rgba(255,68,0,0.6), 0 24px 60px rgba(0,0,0,0.8); position: relative; }
    .ek-bomb-card-inner img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .ek-bomb-emoji { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 72px; background: rgba(0,0,0,0.4); animation: bombEmojiPulse 0.4s ease-in-out 0.12s 3 alternate; }
    @keyframes bombEmojiPulse { from { transform: scale(1); filter: brightness(1); } to { transform: scale(1.2); filter: brightness(1.5); } }

    .ek-bomb-text { position: absolute; z-index: 9; top: 14%; display: flex; flex-direction: column; align-items: center; gap: 4px; animation: bombTextBurst 2.5s ease forwards; pointer-events: none; }
    @keyframes bombTextBurst {
      0%   { opacity: 0; transform: scale(0.3) translateY(20px); }
      18%  { opacity: 1; transform: scale(1.15) translateY(-4px); }
      30%  { transform: scale(1) translateY(0); }
      72%  { opacity: 1; }
      100% { opacity: 0; transform: scale(0.9) translateY(-20px); }
    }
    .ek-bomb-text-main { font-family: 'Bebas Neue', sans-serif; font-size: clamp(64px, 15vw, 96px); letter-spacing: 6px; color: #fff; text-shadow: 0 0 20px #ff4400, 0 0 40px #ff2200, 0 0 80px #ff0000, 4px 4px 0 #8b0000, -4px -4px 0 #cc2200; line-height: 1; }
    .ek-bomb-text-sub { font-family: 'Bebas Neue', sans-serif; font-size: clamp(16px, 4vw, 22px); letter-spacing: 4px; color: #ff9933; text-shadow: 0 0 12px #ff4400; }

    .ek-bomb-ember { position: absolute; bottom: 0; left: var(--ex, 50%); width: var(--size, 4px); height: var(--size, 4px); border-radius: 50%; background: radial-gradient(circle, #ffee88, #ff6600); box-shadow: 0 0 6px #ff4400; z-index: 6; animation: emberFloat 1.8s ease-out var(--delay, 0s) forwards; }
    @keyframes emberFloat {
      0%   { opacity: 1; transform: translateY(0) translateX(0) scale(1); }
      40%  { opacity: 0.9; }
      100% { opacity: 0; transform: translateY(-80vh) scale(0.3); }
    }

    .ek-toast { position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%); background: linear-gradient(120deg, #c02800, var(--ek-fire)); color: #fff; padding: 11px 22px; border-radius: 24px; font-size: 13px; font-weight: 700; box-shadow: 0 6px 20px rgba(255,90,31,0.4); z-index: 999; animation: toastIn .25s ease; pointer-events: none; }
    .ek-spectate-banner {
      position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
      background: rgba(0,0,0,0.72); border: 1px solid rgba(255,255,255,0.15);
      color: var(--ek-text); padding: 9px 20px; border-radius: 22px;
      font-size: 12px; font-weight: 700; font-family: 'DM Mono', monospace;
      letter-spacing: .5px; z-index: 50; backdrop-filter: blur(6px);
      display: flex; align-items: center; gap: 8px; white-space: nowrap;
      box-shadow: 0 6px 20px rgba(0,0,0,0.4);
      animation: toastIn .25s ease;
    }
    @keyframes toastIn { from { opacity: 0; transform: translateX(-50%) translateY(8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }

    .ek-gameover-root { display: flex; align-items: center; justify-content: center; background: radial-gradient(ellipse 100% 80% at 50% 50%, #1a1400, #0D0D0D 70%); }
    .ek-gameover-card { text-align: center; padding: 56px 40px; background: linear-gradient(180deg, #1e1508, #0d0d0d); border: 1px solid rgba(255,208,96,0.2); border-radius: 24px; box-shadow: 0 24px 80px rgba(0,0,0,0.8); width: min(400px, 90vw); }
    .ek-gameover-burst { font-size: 80px; margin-bottom: 16px; animation: burstIn .6s cubic-bezier(.34,1.56,.64,1); }
    @keyframes burstIn { from { transform: scale(0.2) rotate(-20deg); opacity: 0; } to { transform: scale(1) rotate(0deg); opacity: 1; } }
    .ek-gameover-name { font-family: 'Bebas Neue', sans-serif; font-size: 52px; letter-spacing: 2px; background: linear-gradient(120deg, var(--ek-fire), var(--ek-gold)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 8px; }
    .ek-gameover-sub { font-size: 13px; color: var(--ek-text-muted); font-family: 'DM Mono', monospace; margin-bottom: 28px; }

    .ek-noped-flash {
      position: fixed; inset: 0; z-index: 250;
      display: flex; align-items: center; justify-content: center;
      background: rgba(255,30,30,0.18);
      animation: nopedFlashBg .7s ease-out forwards; pointer-events: none;
    }
    @keyframes nopedFlashBg { 0% { opacity: 0; } 15% { opacity: 1; } 100% { opacity: 0; } }
    .ek-noped-flash-text {
      font-family: 'Bebas Neue', sans-serif; font-size: clamp(40px, 10vw, 72px);
      letter-spacing: 6px; color: #ff5050;
      text-shadow: 0 0 30px #ff0000, 0 0 60px #ff0000;
      animation: nopedTextPop .7s cubic-bezier(.34,1.56,.64,1) forwards;
    }
    @keyframes nopedTextPop {
      0% { transform: scale(.3) rotate(-15deg); opacity: 0; }
      30% { transform: scale(1.2) rotate(5deg); opacity: 1; }
      60% { transform: scale(1) rotate(0); opacity: 1; }
      100% { transform: scale(1) rotate(0); opacity: 0; }
    }

    /* ══ IMPLODING KITTEN SINGULARITY EFFECT ══ */
    .ek-implode-overlay {
      position: fixed; inset: 0; z-index: 300;
      display: flex; align-items: center; justify-content: center;
      pointer-events: none;
    }

    .ek-implode-void {
      position: absolute; width: 40px; height: 40px; border-radius: 50%;
      background: radial-gradient(circle, #000 0%, var(--ek-void) 45%, rgba(184,127,255,0.25) 70%, transparent 100%);
      box-shadow: 0 0 80px 40px rgba(184,127,255,0.25);
      z-index: 1;
      animation: implodeVoidGrow 2.6s cubic-bezier(.2,.7,.3,1) forwards;
    }
    @keyframes implodeVoidGrow {
      0%   { transform: scale(0.2); opacity: 0; }
      35%  { transform: scale(10);  opacity: 1; }
      70%  { transform: scale(13);  opacity: 1; }
      100% { transform: scale(2);   opacity: 0; }
    }

    .ek-implode-ring {
      position: absolute; border-radius: 50%; border: 3px solid var(--ek-purple);
      z-index: 2; pointer-events: none;
      animation: implodeRingCollapse 1.1s cubic-bezier(.6,0,.8,.2) forwards;
    }
    .ek-implode-ring-1 { width: 480px; height: 480px; border-color: var(--ek-blue); }
    .ek-implode-ring-2 { width: 620px; height: 620px; border-color: var(--ek-purple); animation-delay: .15s; }
    .ek-implode-ring-3 { width: 760px; height: 760px; border-color: #fff; animation-delay: .3s; }
    @keyframes implodeRingCollapse {
      0%   { opacity: 0;  transform: scale(1); }
      20%  { opacity: .8; }
      100% { opacity: 0;  transform: scale(0.05); }
    }

    .ek-implode-particle {
      position: absolute;
      width: var(--size, 6px); height: var(--size, 6px); border-radius: 50%;
      background: radial-gradient(circle, #fff, var(--ek-blue), var(--ek-purple));
      box-shadow: 0 0 10px var(--ek-purple);
      z-index: 3;
      animation: implodeParticlePull 1.3s cubic-bezier(.5,0,.9,.4) var(--delay, 0s) forwards;
    }
    @keyframes implodeParticlePull {
      0%   { opacity: 1; transform: rotate(var(--angle)) translateX(var(--dist)) scale(1); }
      100% { opacity: 0; transform: rotate(var(--angle)) translateX(0) scale(0); }
    }

    .ek-implode-card-pull {
      position: relative; z-index: 5;
      animation: implodeCardSuck 2.6s cubic-bezier(.5,0,.7,.3) forwards;
    }
    @keyframes implodeCardSuck {
      0%   { transform: scale(0)    rotate(180deg); opacity: 0; }
      20%  { transform: scale(1.3)  rotate(0deg);   opacity: 1; }
      35%  { transform: scale(1.15) rotate(-4deg);  opacity: 1; }
      70%  { transform: scale(1.1)  rotate(0deg);   opacity: 1; filter: brightness(1) saturate(1); }
      100% { transform: scale(0)    rotate(540deg); opacity: 0; filter: brightness(0.2) saturate(0); }
    }
    .ek-implode-card-inner {
      width: 160px; height: 224px; border-radius: 16px; overflow: hidden;
      border: 3px solid var(--ek-purple);
      box-shadow: 0 0 0 2px var(--ek-blue), 0 0 50px var(--ek-purple), 0 24px 60px rgba(0,0,0,0.8);
    }
    .ek-implode-card-inner img { width: 100%; height: 100%; object-fit: cover; display: block; }

    .ek-implode-text {
      position: absolute; z-index: 6; bottom: 16%;
      display: flex; flex-direction: column; align-items: center; gap: 6px;
      animation: implodeTextIn 2.6s ease forwards; pointer-events: none; text-align: center;
    }
    @keyframes implodeTextIn {
      0%   { opacity: 0; transform: scale(.6) translateY(20px); letter-spacing: 20px; filter: blur(8px); }
      25%  { opacity: 1; transform: scale(1)  translateY(0);    letter-spacing: 6px;  filter: blur(0); }
      75%  { opacity: 1; }
      100% { opacity: 0; transform: scale(.9) translateY(-12px); }
    }
    .ek-implode-text-main {
      font-family: 'Bebas Neue', sans-serif; font-size: clamp(48px, 12vw, 84px);
      letter-spacing: 6px; color: var(--ek-ice);
      text-shadow: 0 0 20px var(--ek-purple), 0 0 50px var(--ek-blue), 0 0 90px #fff;
    }
    .ek-implode-text-sub {
      font-family: 'DM Mono', monospace; font-size: clamp(11px, 2.6vw, 14px);
      letter-spacing: 3px; color: var(--ek-purple); text-shadow: 0 0 12px var(--ek-purple);
    }

    /* ── Face-up card on draw pile ── */
    .ek-pile-faceup {
      border-color: #b0bec5 !important;
      box-shadow: 0 0 16px rgba(176,190,197,0.6), 0 0 0 2px #b0bec5 !important;
      animation: implodingPulse 1.4s ease-in-out infinite;
    }
    @keyframes implodingPulse {
      0%,100% { box-shadow: 0 0 10px rgba(176,190,197,0.4), 0 0 0 2px #b0bec5; }
      50% { box-shadow: 0 0 24px rgba(176,190,197,0.9), 0 0 0 3px #eceff1; }
    }
    .ek-pile-faceup-badge {
      position: absolute; top: 5px; left: 0; right: 0;
      text-align: center; font-size: 8px; font-weight: 800;
      font-family: 'DM Mono', monospace; color: #b0bec5;
      letter-spacing: 1px; text-transform: uppercase;
      text-shadow: 0 0 8px rgba(176,190,197,0.8);
    }

    /* ── Shuffle hand button ── */
    .ek-shuffle-hand-btn {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 4px; padding: 10px 8px;
      background: rgba(255,255,255,0.05);
      border: 1.5px solid rgba(255,255,255,0.12);
      border-radius: 14px; cursor: pointer; color: var(--ek-text-muted);
      font-family: 'Nunito', sans-serif;
      transition: all .2s; flex-shrink: 0;
      min-width: 52px; align-self: center;
    }
    .ek-shuffle-hand-btn:hover {
      background: rgba(255,208,96,0.12);
      border-color: var(--ek-gold);
      color: var(--ek-gold);
      transform: scale(1.08);
      box-shadow: 0 4px 16px rgba(255,208,96,0.25);
    }
    .ek-shuffle-hand-btn:active { transform: scale(0.96); }
    .ek-shuffle-hand-icon { font-size: 22px; display: block; transition: transform .35s; }
    .ek-shuffle-hand-btn:hover .ek-shuffle-hand-icon { transform: rotate(180deg); }
    .ek-shuffle-hand-label {
      font-size: 9px; font-weight: 800; letter-spacing: 1px;
      text-transform: uppercase; line-height: 1;
    }

    /* ══ CATOMIC BOMB RADIATION BURST EFFECT ══ */
    .ek-catomic-overlay {
      position: fixed; inset: 0; z-index: 300;
      display: flex; align-items: center; justify-content: center;
      pointer-events: none;
      animation: catomicShake 0.6s cubic-bezier(.36,.07,.19,.97) forwards;
    }
    @keyframes catomicShake {
      0%   { transform: translate(0,0); }
      20%  { transform: translate(6px,-6px) rotate(.5deg); }
      40%  { transform: translate(-8px,4px) rotate(-.5deg); }
      60%  { transform: translate(5px,-3px); }
      80%  { transform: translate(-3px,2px); }
      100% { transform: translate(0,0); }
    }

    .ek-catomic-flash {
      position: absolute; inset: 0; z-index: 1;
      background: radial-gradient(ellipse at center, rgba(255,255,180,0.95) 0%, rgba(198,255,74,0.55) 40%, transparent 75%);
      animation: catomicFlash .8s ease-out forwards;
    }
    @keyframes catomicFlash {
      0%   { opacity: 0; }
      10%  { opacity: 1; }
      40%  { opacity: .5; }
      100% { opacity: 0; }
    }

    .ek-catomic-ring {
      position: absolute; border-radius: 50%; border: 4px solid var(--ek-toxic);
      width: 70px; height: 70px;
      z-index: 3; pointer-events: none;
      animation: catomicRingExpand 1.4s cubic-bezier(.1,.5,.3,1) forwards;
    }
    .ek-catomic-ring-1 { border-color: var(--ek-rad-yellow); }
    .ek-catomic-ring-2 { border-color: var(--ek-toxic); animation-delay: .15s; }
    .ek-catomic-ring-3 { border-color: rgba(255,255,255,0.7); animation-delay: .3s; }
    @keyframes catomicRingExpand {
      0%   { opacity: 1;  transform: scale(0.3); }
      70%  { opacity: .6; }
      100% { opacity: 0;  transform: scale(14); }
    }

    .ek-catomic-symbol {
      position: relative; z-index: 5;
      font-size: clamp(80px, 20vw, 160px);
      color: var(--ek-toxic);
      text-shadow: 0 0 30px var(--ek-toxic), 0 0 70px var(--ek-rad-yellow);
      animation: catomicSymbolSpin 2.4s cubic-bezier(.2,.8,.3,1) forwards;
    }
    @keyframes catomicSymbolSpin {
      0%   { transform: scale(0)    rotate(-180deg); opacity: 0; }
      25%  { transform: scale(1.3)  rotate(30deg);   opacity: 1; }
      45%  { transform: scale(1)    rotate(0deg);    opacity: 1; }
      85%  { transform: scale(1)    rotate(360deg);  opacity: 1; }
      100% { transform: scale(0.6)  rotate(380deg);  opacity: 0; }
    }

    .ek-catomic-particle {
      position: absolute; width: 9px; height: 9px; border-radius: 2px;
      background: linear-gradient(135deg, var(--ek-rad-yellow), var(--ek-toxic));
      box-shadow: 0 0 10px var(--ek-toxic);
      z-index: 4;
      animation: catomicParticleFly 1.2s cubic-bezier(.1,.7,.3,1) var(--delay, 0s) forwards;
    }
    @keyframes catomicParticleFly {
      0%   { opacity: 1; transform: translate(0,0) scale(1); }
      100% { opacity: 0; transform: rotate(var(--angle)) translateX(var(--dist)) scale(0.3); }
    }

    .ek-catomic-text {
      position: absolute; z-index: 6; top: 16%;
      display: flex; flex-direction: column; align-items: center; gap: 6px;
      animation: catomicTextIn 2.4s ease forwards; pointer-events: none; text-align: center;
    }
    @keyframes catomicTextIn {
      0%   { opacity: 0; transform: scale(.4) translateY(-20px); }
      20%  { opacity: 1; transform: scale(1.1) translateY(0); }
      35%  { transform: scale(1); }
      75%  { opacity: 1; }
      100% { opacity: 0; transform: scale(.9) translateY(-14px); }
    }
    .ek-catomic-text-main {
      font-family: 'Bebas Neue', sans-serif; font-size: clamp(40px, 11vw, 80px);
      letter-spacing: 6px; color: #fff;
      text-shadow: 0 0 20px var(--ek-toxic), 0 0 50px var(--ek-rad-yellow), 4px 4px 0 #4a6b00;
    }
    .ek-catomic-text-sub {
      font-family: 'DM Mono', monospace; font-size: clamp(12px, 3vw, 16px);
      letter-spacing: 4px; color: var(--ek-toxic); text-shadow: 0 0 12px var(--ek-toxic);
    }

    /* ══ SEE THE FUTURE — TIME RIFT ══ */
    .ek-seefuture-overlay {
      position: fixed; inset: 0; z-index: 300;
      display: flex; align-items: center; justify-content: center;
      pointer-events: none;
    }
    .ek-seefuture-flash {
      position: absolute; inset: 0;
      background: radial-gradient(ellipse at center, rgba(91,180,248,0.5) 0%, rgba(184,127,255,0.25) 45%, transparent 75%);
      animation: seefutureFlash 1.9s ease-out forwards;
    }
    @keyframes seefutureFlash { 0% { opacity: 0; } 12% { opacity: 1; } 50% { opacity: .4; } 100% { opacity: 0; } }

    .ek-seefuture-eye {
      position: relative; z-index: 4;
      width: 140px; height: 80px; border-radius: 50%;
      background: radial-gradient(ellipse at center, rgba(20,30,50,0.9), rgba(10,15,30,0.95));
      border: 3px solid var(--ek-blue);
      box-shadow: 0 0 40px var(--ek-blue), 0 0 80px rgba(91,180,248,0.4);
      display: flex; align-items: center; justify-content: center;
      animation: seefutureEyeOpen 1.9s cubic-bezier(.2,.8,.3,1) forwards;
      overflow: hidden;
    }
    @keyframes seefutureEyeOpen {
      0%   { transform: scaleY(0) scaleX(0.3); opacity: 0; }
      25%  { transform: scaleY(1) scaleX(1); opacity: 1; }
      75%  { transform: scaleY(1) scaleX(1); opacity: 1; }
      100% { transform: scaleY(0) scaleX(0.3); opacity: 0; }
    }
    .ek-seefuture-iris {
      width: 64px; height: 64px; border-radius: 50%;
      background: radial-gradient(circle, var(--ek-ice) 0%, var(--ek-blue) 55%, var(--ek-purple) 100%);
      box-shadow: 0 0 24px var(--ek-blue);
      animation: seefutureIrisSpin 2.4s linear infinite;
      position: relative;
    }
    @keyframes seefutureIrisSpin { from { filter: hue-rotate(0deg); } to { filter: hue-rotate(360deg); } }
    .ek-seefuture-pupil {
      position: absolute; width: 24px; height: 24px; border-radius: 50%;
      background: #07020F; box-shadow: 0 0 12px #000 inset;
      animation: seefutureBlink 1.9s ease-in-out forwards;
    }
    @keyframes seefutureBlink {
      0%, 100% { transform: scaleY(1); }
      45%, 55% { transform: scaleY(0.1); }
    }

    .ek-seefuture-ring {
      position: absolute; border-radius: 50%; border: 3px solid var(--ek-blue);
      z-index: 2; pointer-events: none;
      animation: seefutureRingExpand 1.9s cubic-bezier(.1,.5,.3,1) forwards;
    }
    .ek-seefuture-ring-1 { width: 160px; height: 160px; }
    .ek-seefuture-ring-2 { width: 160px; height: 160px; border-color: var(--ek-purple); animation-delay: .25s; }
    @keyframes seefutureRingExpand {
      0%   { opacity: .9; transform: scale(0.4) rotate(0deg); }
      100% { opacity: 0; transform: scale(6) rotate(180deg); }
    }

    .ek-seefuture-shard {
      position: absolute; width: 8px; height: 18px; border-radius: 2px;
      background: linear-gradient(180deg, var(--ek-ice), var(--ek-blue));
      box-shadow: 0 0 10px var(--ek-blue);
      z-index: 3;
      animation: seefutureShardFly 1.5s cubic-bezier(.1,.7,.3,1) var(--delay, 0s) forwards;
    }
    @keyframes seefutureShardFly {
      0%   { opacity: 0; transform: rotate(var(--angle)) translateX(0) scale(0.4); }
      20%  { opacity: 1; }
      100% { opacity: 0; transform: rotate(var(--angle)) translateX(var(--dist)) scale(1); }
    }

    .ek-seefuture-text {
      position: absolute; z-index: 6; bottom: 18%;
      display: flex; flex-direction: column; align-items: center; gap: 6px;
      animation: seefutureTextIn 1.9s ease forwards; pointer-events: none; text-align: center;
    }
    @keyframes seefutureTextIn {
      0%   { opacity: 0; transform: translateY(20px) scale(.7); }
      25%  { opacity: 1; transform: translateY(0) scale(1); }
      75%  { opacity: 1; }
      100% { opacity: 0; transform: translateY(-10px) scale(.95); }
    }
    .ek-seefuture-text-main {
      font-family: 'Bebas Neue', sans-serif; font-size: clamp(32px, 8vw, 60px);
      letter-spacing: 5px; color: var(--ek-ice);
      text-shadow: 0 0 16px var(--ek-blue), 0 0 40px var(--ek-purple);
    }
    .ek-seefuture-text-sub {
      font-family: 'DM Mono', monospace; font-size: clamp(11px, 2.6vw, 14px);
      letter-spacing: 4px; color: var(--ek-blue); text-shadow: 0 0 10px var(--ek-blue);
    }

    /* ══ ALTER THE FUTURE — TEMPORAL VORTEX ══ */
    .ek-alterfuture-overlay {
      position: fixed; inset: 0; z-index: 300;
      display: flex; align-items: center; justify-content: center;
      pointer-events: none;
      animation: alterfutureShake 0.6s cubic-bezier(.36,.07,.19,.97) forwards;
    }
    @keyframes alterfutureShake {
      0%   { transform: translate(0,0) rotate(0deg); }
      25%  { transform: translate(4px,-4px) rotate(.4deg); }
      50%  { transform: translate(-5px,3px) rotate(-.4deg); }
      75%  { transform: translate(3px,-2px) rotate(.2deg); }
      100% { transform: translate(0,0) rotate(0deg); }
    }
    .ek-alterfuture-flash {
      position: absolute; inset: 0;
      background: radial-gradient(ellipse at center, rgba(184,127,255,0.5) 0%, rgba(91,180,248,0.2) 50%, transparent 75%);
      animation: alterfutureFlash 2s ease-out forwards;
    }
    @keyframes alterfutureFlash { 0% { opacity: 0; } 12% { opacity: 1; } 50% { opacity: .35; } 100% { opacity: 0; } }

    .ek-alterfuture-vortex {
      position: relative; z-index: 4; width: 200px; height: 200px;
      display: flex; align-items: center; justify-content: center;
    }
    .ek-alterfuture-spiral {
      position: absolute; border-radius: 50%;
      border: 3px solid var(--ek-purple);
      border-top-color: var(--ek-ice);
      border-right-color: transparent;
      animation: alterfutureSpiralSpin 2s cubic-bezier(.4,0,.2,1) forwards;
    }
    .ek-alterfuture-spiral-1 { width: 200px; height: 200px; }
    .ek-alterfuture-spiral-2 { width: 130px; height: 130px; border-color: var(--ek-blue); border-top-color: var(--ek-gold); animation-delay: .1s; animation-direction: reverse; }
    .ek-alterfuture-spiral-3 { width: 70px; height: 70px; animation-delay: .2s; }
    @keyframes alterfutureSpiralSpin {
      0%   { transform: scale(0) rotate(0deg); opacity: 0; }
      20%  { opacity: 1; }
      80%  { opacity: 1; }
      100% { transform: scale(1.4) rotate(720deg); opacity: 0; }
    }

    .ek-alterfuture-fragment {
      position: absolute; font-size: 22px; z-index: 3;
      filter: drop-shadow(0 0 8px var(--ek-purple));
      animation: alterfutureFragmentOrbit 1.7s cubic-bezier(.3,.7,.3,1) var(--delay, 0s) forwards;
    }
    @keyframes alterfutureFragmentOrbit {
      0%   { opacity: 0; transform: rotate(var(--angle)) translateX(0) scale(0.3) rotate(0deg); }
      25%  { opacity: 1; }
      100% { opacity: 0; transform: rotate(calc(var(--angle) + 200deg)) translateX(var(--dist)) scale(1) rotate(360deg); }
    }

    .ek-alterfuture-text {
      position: absolute; z-index: 6; bottom: 18%;
      display: flex; flex-direction: column; align-items: center; gap: 6px;
      animation: alterfutureTextIn 2s ease forwards; pointer-events: none; text-align: center;
    }
    @keyframes alterfutureTextIn {
      0%   { opacity: 0; transform: scale(.5) translateY(20px); letter-spacing: 16px; filter: blur(6px); }
      25%  { opacity: 1; transform: scale(1) translateY(0); letter-spacing: 5px; filter: blur(0); }
      75%  { opacity: 1; }
      100% { opacity: 0; transform: scale(.95) translateY(-10px); }
    }
    .ek-alterfuture-text-main {
      font-family: 'Bebas Neue', sans-serif; font-size: clamp(30px, 7.5vw, 56px);
      letter-spacing: 5px; color: var(--ek-ice);
      text-shadow: 0 0 16px var(--ek-purple), 0 0 40px var(--ek-blue);
    }
    .ek-alterfuture-text-sub {
      font-family: 'DM Mono', monospace; font-size: clamp(11px, 2.6vw, 14px);
      letter-spacing: 4px; color: var(--ek-purple); text-shadow: 0 0 10px var(--ek-purple);
    }

    /* ── Reduced motion support ── */
    @media (prefers-reduced-motion: reduce) {
      .ek-spark, .ek-brand-icon, .ek-opp-pulse, .ek-my-turn-dot,
      .ek-turn-mine, .ek-hand-card-nopeable, .ek-nope-btn,
      .ek-bomb-overlay, .ek-draw-fly, .ek-fx-layer,
      .ek-hand-card-selected::after,
      .ek-implode-overlay, .ek-implode-void, .ek-implode-ring,
      .ek-implode-particle, .ek-implode-card-pull, .ek-implode-text,
      .ek-catomic-overlay, .ek-catomic-flash, .ek-catomic-ring,
      .ek-catomic-symbol, .ek-catomic-particle, .ek-catomic-text,
      .ek-seefuture-overlay, .ek-seefuture-flash, .ek-seefuture-eye,
      .ek-seefuture-iris, .ek-seefuture-pupil, .ek-seefuture-ring,
      .ek-seefuture-shard, .ek-seefuture-text,
      .ek-alterfuture-overlay, .ek-alterfuture-flash, .ek-alterfuture-spiral,
      .ek-alterfuture-fragment, .ek-alterfuture-text { animation: none !important; }
      .ek-hand-card, .ek-favor-card, .ek-steal-card,
      .ek-pile-card, .ek-target-btn { transition: none !important; }
    }

    @media (max-width: 600px) {
      :root { --ek-card-w: 84px; --ek-card-h: 118px; --ek-pile-w: 72px; --ek-pile-h: 101px; }
      .ek-table-felt-game { padding: 14px 12px; gap: 10px; }
      .ek-game-layout { padding: 8px 10px; gap: 6px; }
    }
  `;
}