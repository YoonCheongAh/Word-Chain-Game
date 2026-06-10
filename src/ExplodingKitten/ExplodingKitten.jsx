'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ref, onValue, update } from 'firebase/database';
import { db } from '../firebase';
import { createRoom, joinRoom, listenRoom, setPlayerOnline } from '../roomService';
import { SoundManager } from './ExplodingKittenSound';
import {
  startGame, drawCard, playCard, placeBombAfterDefuse,
  giveFavorCard, stealPairCard, closeSeeTheFuture, requestRematch,
  resolveNopeWindow,
  CARD_META, CARD_TYPES, CAT_CARD_TYPES, getCardImageStable,
} from './ExplodingKittenService';

export default function ExplodingKitten() {
  const [screen, setScreen] = useState('lobby');
  const [name, setName] = useState('');
  const [inputRoomId, setInputRoomId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [myRole, setMyRole] = useState('');
  const [roomData, setRoomData] = useState(null);
  const [err, setErr] = useState('');
  const [toast, setToast] = useState('');
  const [selectedCards, setSelectedCards] = useState([]); // array of card ids
  const nopeTimerRef = useRef(null);

  const game = roomData?.game;
  const players = roomData?.players || {};
  const myPlayer = players[myRole];
  const myHand = myPlayer?.hand || [];
  const myTurn = game?.turn === myRole;
  const phase = game?.phase || 'play';
  const pending = game?.pendingAction;
  const nopeWindow = game?.nopeWindow;

  useEffect(() => {
    const id = 'ek-styles';
    if (!document.getElementById(id)) {
      const style = document.createElement('style');
      style.id = id;
      style.textContent = getStyles();
      document.head.appendChild(style);
    }
  }, []);

  useEffect(() => {
    if (!roomId) return;
    const unsub = listenRoom(roomId, data => setRoomData(data));
    return () => unsub?.();
  }, [roomId]);

  useEffect(() => {
    if (!roomData) return;
    if (roomData.status === 'playing' && screen !== 'game') setScreen('game');
    if (roomData.status === 'dissolved') resetToLobby();
    if ((roomData.status === 'waiting' || roomData.status === 'ready') && screen === 'lobby' && roomId) {
      setScreen('room');
    }
  }, [roomData?.status]);

  // Nope window timer: only the action owner resolves it
  useEffect(() => {
    if (!nopeWindow?.open || !pending) return;
    if (pending.by !== myRole) return; // only the card player drives the timer

    if (nopeTimerRef.current) clearTimeout(nopeTimerRef.current);
    const delay = Math.max(0, (nopeWindow.expiresAt || 0) - Date.now());
    nopeTimerRef.current = setTimeout(() => {
      resolveNopeWindow(roomId);
    }, delay + 300); // small buffer

    return () => clearTimeout(nopeTimerRef.current);
  }, [nopeWindow?.expiresAt, nopeWindow?.open, pending?.by, myRole, roomId]);

  useEffect(() => {
    if (myTurn) SoundManager.play('myTurn');
  }, [game?.turn]);

  const showToast = useCallback((msg, duration = 2500) => {
    setToast(msg);
    setTimeout(() => setToast(''), duration);
  }, []);

  const resetToLobby = () => {
    setScreen('lobby');
    setRoomId('');
    setMyRole('');
    setRoomData(null);
    setErr('');
    setSelectedCards([]);
  };

  const handleCreate = async () => {
    if (!name.trim()) return setErr('Enter your name!');
    setErr('');
    const id = await createRoom(name.trim());
    setRoomId(id);
    setMyRole('player1');
    setScreen('room');
  };

  const handleJoin = async () => {
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
  };

  const handleStartGame = () => startGame(roomId);
  const handleDrawCard = () => {
    SoundManager.play('draw');
    drawCard(roomId, myRole);
  };

  const handleCardClick = (card) => {
    SoundManager.play(SoundManager.soundForCard(card.type));
    // Anyone can play Nope during nope window
    if (card.type === CARD_TYPES.NOPE) {
      if (!nopeWindow?.open) {
        showToast('No action to Nope right now!');
        return;
      }
      playCard(roomId, myRole, card.id, {});
      setSelectedCards([]);
      return;
    }

    if (!myTurn) {
      showToast('Not your turn!');
      return;
    }
    if (phase !== 'play') {
      showToast('Finish the current action first!');
      return;
    }

    // Cat card pairing logic
    if (CAT_CARD_TYPES.has(card.type)) {
      const alreadySelected = selectedCards[0];
      if (alreadySelected?.id === card.id) {
        // Deselect
        setSelectedCards([]);
        return;
      }
      if (alreadySelected?.type === card.type) {
        // Two matching cats selected → play as pair
        playCard(roomId, myRole, alreadySelected.id, { isPair: true });
        setSelectedCards([]);
        return;
      }
      // Select this cat (replacing any previous selection)
      setSelectedCards([card]);
      showToast(`Select another ${CARD_META[card.type]?.label} to play as pair`);
      return;
    }

    // Non-cat cards: single select toggle
    if (selectedCards[0]?.id === card.id) {
      setSelectedCards([]);
    } else {
      setSelectedCards([card]);
    }
  };

  const handlePlaySelected = () => {
    const card = selectedCards[0];
    if (!card) return;

    if (CAT_CARD_TYPES.has(card.type)) {
      showToast(`Select another ${CARD_META[card.type]?.label} to play as pair!`);
      return;
    }

    if (card.type === CARD_TYPES.FAVOR) {
      // Favor needs target selection first — trigger favor_choose_target phase via service
      playCard(roomId, myRole, card.id, {});
      setSelectedCards([]);
      return;
    }

    playCard(roomId, myRole, card.id, {});
    setSelectedCards([]);
  };

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
        onPlaceBomb={(pos) => placeBombAfterDefuse(roomId, myRole, pos)}
        onGiveCard={(cId) => giveFavorCard(roomId, myRole, cId)}
        onStealCard={(target, cardIndex) => stealPairCard(roomId, myRole, target, cardIndex)}
        onChooseFavorTarget={(targetRole) => playCard(roomId, myRole, pending?.favorCardId || '', { targetRole })}
        onSelectFavorTarget={(targetRole) => {
          // Called from FavorTargetPanel; pending already has the card consumed
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
        }}
        onCloseFuture={() => closeSeeTheFuture(roomId)}
        onRematch={() => requestRematch(roomId, myRole)}
        toast={toast}
        showToast={showToast}
        roomId={roomId}
      />
    );
  }

  return <div className="ek-loading">Loading...</div>;
}

/* ─── LOBBY ─────────────────────────────────────────────────────────── */
function LobbyScreen({ onCreateRoom, onJoinRoom, name, setName, inputRoomId, setInputRoomId, err }) {
  return (
    <div className="ek-root ek-lobby-root">
      <div className="ek-lobby-sparks" aria-hidden="true">
        {[...Array(12)].map((_, i) => (
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
              <button className="ek-cta ek-cta-ghost" onClick={onJoinRoom}>
                Join →
              </button>
            </div>
          </div>

          {err && <div className="ek-err-pill">{err}</div>}
        </div>
      </div>
    </div>
  );
}

/* ─── ROOM SCREEN ────────────────────────────────────────────────────── */
const SLOT_COLORS = ['#FF6B35', '#5DCAA5', '#85B7EB', '#C385EB'];
const SLOT_LABELS = ['HOST', 'P2', 'P3', 'P4'];

function RoomScreen({ roomData, roomId, myRole, onStart, onBack }) {
  const [copied, setCopied] = useState(false);
  const players = roomData?.players || {};
  const isHost = myRole === 'player1';
  const playerCount = Object.keys(players).length;
  const slots = ['player1', 'player2', 'player3', 'player4'];

  const copyCode = () => {
    navigator.clipboard?.writeText(roomId).catch(() => { });
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="ek-root ek-room-root">
      <div className="ek-room-wrap">
        <button className="ek-back-btn" onClick={onBack}>← Back</button>

        <div className="ek-room-header-block">
          <p className="ek-room-eyebrow">Room Code</p>
          <div className="ek-room-code-display" onClick={copyCode} title="Click to copy">
            {roomId}
            <span className="ek-copy-hint">{copied ? '✓ Copied!' : 'click to copy'}</span>
          </div>
          <p className="ek-room-player-count">{playerCount} / 4 players</p>
        </div>

        <div className="ek-table-preview">
          <div className="ek-table-felt">
            <div className="ek-table-center-logo">🐱💣</div>
            {slots.map((slot, i) => {
              const p = players[slot];
              const angle = (i / 4) * 360;
              const rad = (angle * Math.PI) / 180;
              const r = 110;
              const x = 50 + (r / 2) * Math.sin(rad);
              const y = 50 - (r / 2) * Math.cos(rad) * 0.5;
              return (
                <div
                  key={slot}
                  className={`ek-seat ${p ? 'ek-seat-filled' : 'ek-seat-empty'} ${slot === myRole ? 'ek-seat-me' : ''}`}
                  style={{ left: `${x}%`, top: `${y}%`, '--seat-color': SLOT_COLORS[i] }}
                >
                  <div className="ek-seat-avatar">
                    {p ? (p.name[0].toUpperCase()) : (i + 1)}
                  </div>
                  <div className="ek-seat-info">
                    <div className="ek-seat-name">{p ? p.name : 'Waiting…'}</div>
                    <div className="ek-seat-badge" style={{ color: SLOT_COLORS[i] }}>
                      {SLOT_LABELS[i]}{slot === myRole ? ' · You' : ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {isHost ? (
          <button
            className={`ek-start-btn ${playerCount >= 2 ? 'ek-start-ready' : 'ek-start-wait'}`}
            onClick={onStart}
            disabled={playerCount < 2}
          >
            {playerCount < 2 ? `Waiting for players… (${playerCount}/4)` : `▶ Start Game (${playerCount} players)`}
          </button>
        ) : (
          <p className="ek-host-wait">Waiting for host to start…</p>
        )}
      </div>

      {copied && <div className="ek-copied-toast">✓ Copied to clipboard!</div>}
    </div>
  );
}

/* ─── GAME BOARD ─────────────────────────────────────────────────────── */
function GameBoardScreen({
  game, players, myRole, myHand, myTurn, phase, pending, nopeWindow,
  selectedCards, onCardClick, onPlaySelected, onDrawCard,
  onPlaceBomb, onGiveCard, onStealCard, onSelectFavorTarget,
  onCloseFuture, onRematch, toast, showToast, roomId,
}) {
  const gameOver = game?.winner;
  const drawPile = game?.drawPile || [];
  const discardPile = game?.discardPile || [];
  const topDiscard = discardPile[discardPile.length - 1];
  const log = game?.log || [];

  // ── Action / function card play effect ──
  // Fire a flashy animation whenever a new action card lands on the discard pile.
  const [cardFx, setCardFx] = useState(null);
  const lastFxIdRef = useRef(null);
  const fxTimerRef = useRef(null);

  // ── Draw card animation ──
  // Trigger a flying-card animation whenever the draw pile shrinks (a card was drawn).
  const [drawAnim, setDrawAnim] = useState(0);
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
    if (gameOver) SoundManager.play(gameOver === myRole ? 'win' : 'lose');
  }, [gameOver]);

  useEffect(() => {
    if (!topDiscard) return;
    if (lastFxIdRef.current === topDiscard.id) return;
    lastFxIdRef.current = topDiscard.id;

    // Only animate action / function cards (everything except the cat cards & defuse).
    const isCat = CAT_CARD_TYPES.has(topDiscard.type);
    const isActionCard =
      !isCat &&
      topDiscard.type !== CARD_TYPES.DEFUSE &&
      topDiscard.type !== CARD_TYPES.EXPLODING_KITTEN;
    if (!isActionCard) return;

    setCardFx({ key: topDiscard.id, type: topDiscard.type });
    if (fxTimerRef.current) clearTimeout(fxTimerRef.current);
    fxTimerRef.current = setTimeout(() => setCardFx(null), 1100);
    return () => clearTimeout(fxTimerRef.current);
  }, [topDiscard?.id]);


  const allRoles = ['player1', 'player2', 'player3', 'player4', 'player5'];
  const otherRoles = allRoles.filter(r => players[r] && r !== myRole);

  const positionSets = { 1: ['north'], 2: ['northwest', 'northeast'], 3: ['northwest', 'north', 'northeast'], 4: ['west', 'northwest', 'northeast', 'east'] };
  const posMap = positionSets[otherRoles.length] || ['north'];

  // Can this player Nope right now?
  const canNope = nopeWindow?.open && myHand.some(c => c.type === CARD_TYPES.NOPE);
  const nopeCard = myHand.find(c => c.type === CARD_TYPES.NOPE);

  if (gameOver) {
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
                <div
                  className={`ek-pile-card ek-pile-draw ${myTurn && phase === 'play' ? 'ek-pile-clickable' : ''} ${drawAnim ? 'ek-pile-draw-pulse' : ''}`}
                  onClick={myTurn && phase === 'play' ? onDrawCard : undefined}
                >
                  <div className="ek-card-back">
                    <img
                      src="/Resources/exploding kitten/backcard.png"
                      alt="Draw pile card back"
                      className="ek-card-back-img"
                      onError={e => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                    <span className="ek-card-back-icon" style={{ display: 'none' }}>🐱</span>
                  </div>
                  <div className="ek-pile-count-badge">{drawPile.length}</div>
                </div>
                {/* Flying card animation when a card is drawn */}
                {drawAnim && (
                  <div className="ek-draw-fly" key={drawAnim}>
                    <img
                      src="/Resources/exploding kitten/backcard.png"
                      alt=""
                      className="ek-card-back-img"
                      onError={e => { e.target.style.display = 'none'; }}
                    />
                  </div>
                )}
                <div className="ek-pile-name">Draw</div>
              </div>

              <div className="ek-pile-slot">
                {topDiscard ? (
                  <div className="ek-pile-card ek-pile-discard">
                    <img
                      src={(CARD_META[topDiscard.type]?.images || [])[0] || ''}
                      alt={CARD_META[topDiscard.type]?.label || 'Card'}
                      className="ek-card-img"
                      onError={e => { e.target.style.display = 'none'; }}
                    />
                    <div className="ek-discard-label">{CARD_META[topDiscard.type]?.label}</div>
                  </div>
                ) : (
                  <div className="ek-pile-card ek-pile-empty">
                    <span className="ek-pile-empty-text">Empty</span>
                  </div>
                )}
                <div className="ek-pile-name">Discard</div>
              </div>
            </div>

            {/* Nope window banner */}
            {nopeWindow?.open && (
              <NopeWindowBanner
                nopeWindow={nopeWindow}
                pending={pending}
                players={players}
                canNope={canNope}
                nopeCard={nopeCard}
                onNope={() => {
                  if (nopeCard) onCardClick(nopeCard);
                }}
              />
            )}

            {/* Turn indicator (only shown when no nope window) */}
            {!nopeWindow?.open && (
              <div className={`ek-turn-chip ${myTurn ? 'ek-turn-mine' : 'ek-turn-wait'}`}>
                {myTurn
                  ? '🎯 Your Turn — Play or Draw'
                  : `⏳ ${players[game?.turn]?.name || '…'}'s Turn`}
              </div>
            )}

            {/* Log */}
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
            <button
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, marginLeft: 'auto', color: 'var(--ek-text-muted)' }}
              onClick={() => SoundManager.isMuted() ? SoundManager.unmute() : SoundManager.mute()}
            >
              {SoundManager.isMuted() ? '🔇' : '🔊'}
            </button>
          </div>

          <div className="ek-hand-fan">
            {myHand.length > 0 ? myHand.map((card, idx) => {
              const isSelected = selectedCards.some(s => s.id === card.id);
              const meta = CARD_META[card.type];
              // Highlight Nope cards when nope window is open
              const isNopeable = card.type === CARD_TYPES.NOPE && nopeWindow?.open;
              return (
                <div
                  key={card.id}
                  className={`ek-hand-card ${isSelected ? 'ek-hand-card-selected' : ''} ${(!myTurn && !isNopeable) ? 'ek-hand-card-disabled' : ''} ${isNopeable ? 'ek-hand-card-nopeable' : ''}`}
                  style={{ '--card-color': meta?.color || '#888', zIndex: isSelected ? 50 : idx }}
                  onClick={() => onCardClick(card)}
                >
                  <img
                    src={(meta?.images || [])[0] || ''}
                    alt={meta?.label || card.type}
                    className="ek-card-img"
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                  <div className="ek-card-label-bar">{meta?.label || card.type}</div>
                  {isSelected && <div className="ek-card-selected-glow" />}
                  {isNopeable && <div className="ek-nope-glow" />}
                </div>
              );
            }) : (
              <div className="ek-hand-empty">No cards in hand</div>
            )}
          </div>

          {/* Action buttons */}
          {myTurn && phase === 'play' && (
            <div className="ek-action-strip">
              {selectedCards.length > 0 && (
                <button className="ek-action-btn ek-action-play" onClick={onPlaySelected}>
                  ▶ Play {CARD_META[selectedCards[0]?.type]?.label || 'Card'}
                  {CAT_CARD_TYPES.has(selectedCards[0]?.type) ? ' (need pair)' : ''}
                </button>
              )}
              <button className="ek-action-btn ek-action-draw" onClick={onDrawCard}>
                Draw Card
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Phase Overlays ── */}
      {phase === 'defuse' && (
        <div className="ek-overlay-panel">
          <DefusePanel drawPile={drawPile} onPlaceBomb={onPlaceBomb} />
        </div>
      )}
      {phase === 'see_future' && game?.seeTheFuture?.forPlayer === myRole && (
        <div className="ek-overlay-panel">
          <SeeFuturePanel cards={game?.seeTheFuture?.cards || []} onClose={onCloseFuture} />
        </div>
      )}
      {/* Favor: active player's turn to choose who gets favored */}
      {phase === 'favor_choose_target' && pending?.by === myRole && (
        <div className="ek-overlay-panel">
          <FavorChooseTargetPanel
            players={players}
            myRole={myRole}
            onSelect={onSelectFavorTarget}
          />
        </div>
      )}
      {/* Favor: target must give a card */}
      {phase === 'favor_give' && pending?.target === myRole && (
        <div className="ek-overlay-panel">
          <FavorGivePanel
            myHand={myHand}
            requesterName={players[pending?.by]?.name || '?'}
            onGive={onGiveCard}
          />
        </div>
      )}
      {/* Pair: attacker chooses who to steal from */}
      {phase === 'pair_target' && pending?.by === myRole && (
        <div className="ek-overlay-panel">
          <PairTargetPanel
            players={players}
            myRole={myRole}
            onSteal={onStealCard}
          />
        </div>
      )}

      {toast && <div className="ek-toast">{toast}</div>}

      {/* Action / function card visual effect */}
      {cardFx && <CardPlayEffect key={cardFx.key} type={cardFx.type} />}
    </div>
  );
}

/* ─── CARD PLAY EFFECT ───────────────────────────────────────────────── */
function CardPlayEffect({ type }) {
  const meta = CARD_META[type];
  const color = meta?.color || '#FF9020';
  const img = (meta?.images || [])[0] || '';
  const sparks = [...Array(10)];
  return (
    <div className="ek-fx-layer" style={{ '--fx-color': color }} aria-hidden="true">
      <div className="ek-fx-ring" />
      <div className="ek-fx-ring ek-fx-ring-2" />
      {sparks.map((_, i) => {
        const angle = (i / sparks.length) * Math.PI * 2;
        const dist = 120 + (i % 3) * 36;
        return (
          <span
            key={i}
            className="ek-fx-spark"
            style={{
              '--sx': `${Math.cos(angle) * dist}px`,
              '--sy': `${Math.sin(angle) * dist}px`,
              animationDelay: `${0.15 + (i % 4) * 0.03}s`,
            }}
          />
        );
      })}
      <div className="ek-fx-card">
        {img && (
          <img
            src={img || "/placeholder.svg"}
            alt={meta?.label || type}
            onError={e => { e.target.style.display = 'none'; }}
          />
        )}
      </div>
      <div className="ek-fx-label">{meta?.label || type}</div>
    </div>
  );
}

/* ─── NOPE WINDOW BANNER ─────────────────────────────────────────────── */
function NopeWindowBanner({ nopeWindow, pending, players, canNope, nopeCard, onNope }) {
  const [timeLeft, setTimeLeft] = useState(5);

  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, Math.ceil((nopeWindow.expiresAt - Date.now()) / 1000));
      setTimeLeft(left);
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [nopeWindow.expiresAt]);

  const byName = pending?.by ? players[pending.by]?.name : '?';
  const actionLabel = {
    attack: 'Attack',
    skip: 'Skip',
    favor: 'Favor',
    shuffle: 'Shuffle',
    see_the_future: 'See the Future',
    pair: 'Cat Pair steal',
  }[nopeWindow.pendingType] || nopeWindow.pendingType;

  const nopeCount = 0; // we just show current state
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
      {canNope && (
        <button className="ek-nope-btn" onClick={onNope}>
          🚫 Nope it!
        </button>
      )}
      {!canNope && <div className="ek-nope-wait">Waiting for Nope…</div>}
    </div>
  );
}

/* ─── FAVOR CHOOSE TARGET PANEL ─────────────────────────────────────── */
function FavorChooseTargetPanel({ players, myRole, onSelect }) {
  const targets = Object.entries(players).filter(
    ([role, p]) => role !== myRole && p?.alive !== false
  );
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
}

/* ─── FAVOR GIVE PANEL ───────────────────────────────────────────────── */
function FavorGivePanel({ myHand, requesterName, onGive }) {
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
              <img
                src={(meta?.images || [])[0] || ''}
                alt={meta?.label || card.type}
                className="ek-card-img"
                onError={e => { e.target.style.display = 'none'; }}
              />
              <div className="ek-card-label-bar">{meta?.label || card.type}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── PAIR TARGET PANEL ──────────────────────────────────────────────── */
function PairTargetPanel({ players, myRole, onSteal }) {
  // Two-step flow: 1) choose a player, 2) choose a specific face-down card.
  const [chosenTarget, setChosenTarget] = useState(null);
  const [hoverIdx, setHoverIdx] = useState(null);

  const targets = Object.entries(players).filter(
    ([role, p]) => role !== myRole && p?.alive !== false
  );

  // Step 2 — pick a specific face-down card from the chosen target
  if (chosenTarget) {
    const targetPlayer = players[chosenTarget];
    const handCount = targetPlayer?.hand?.length || 0;
    return (
      <div className="ek-panel-inner">
        <div className="ek-panel-icon">🃏</div>
        <h3 className="ek-panel-title">Pick a card to steal</h3>
        <p className="ek-panel-sub">
          From {targetPlayer?.name} — cards stay face-down. Choose by position.
        </p>

        <div className="ek-steal-grid">
          {[...Array(handCount)].map((_, i) => (
            <button
              key={i}
              className={`ek-steal-card ${hoverIdx === i ? 'ek-steal-card-hover' : ''}`}
              style={{ animationDelay: `${i * 0.05}s` }}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              onClick={() => onSteal(chosenTarget, i)}
            >
              <div className="ek-steal-card-back">
                <span className="ek-steal-card-icon">🐱</span>
                <span className="ek-steal-card-q">?</span>
              </div>
              <div className="ek-steal-card-num">#{i + 1}</div>
            </button>
          ))}
        </div>

        <button
          className="ek-action-btn ek-action-draw"
          style={{ width: '100%', marginTop: 14 }}
          onClick={() => setChosenTarget(null)}
        >
          ← Back to players
        </button>
      </div>
    );
  }

  // Step 1 — choose which player to steal from
  return (
    <div className="ek-panel-inner">
      <div className="ek-panel-icon">🐱</div>
      <h3 className="ek-panel-title">Cat Pair — Steal a card!</h3>
      <p className="ek-panel-sub">Choose a player, then pick a specific face-down card</p>
      <div className="ek-target-list">
        {targets.map(([role, p]) => (
          <button
            key={role}
            className="ek-target-btn"
            onClick={() => setChosenTarget(role)}
            disabled={!p.hand || p.hand.length === 0}
          >
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
function OpponentSlot({ player, role, position, isActive, isDead }) {
  const hand = player?.hand || [];
  return (
    <div className={`ek-opponent ek-opp-${position} ${isActive ? 'ek-opponent-active' : ''} ${isDead ? 'ek-opponent-dead' : ''}`}>
      <div className="ek-opp-info">
        <div className="ek-opp-avatar">{player?.name?.[0] || '?'}</div>
        <div>
          <div className="ek-opp-name">{player?.name}</div>
          <div className="ek-opp-cards">{hand.length} cards</div>
        </div>
      </div>
      <div className="ek-opp-hand">
        {[...Array(Math.min(hand.length, 7))].map((_, i) => (
          <div key={i} className="ek-opp-card" style={{ transform: `rotate(${(i - Math.min(hand.length, 7) / 2) * 8}deg)` }}>
            <span className="ek-opp-card-icon">🐱</span>
          </div>
        ))}
      </div>
      {isActive && <div className="ek-opp-pulse" />}
      {isDead && <div className="ek-opp-dead-mark">💥</div>}
    </div>
  );
}

/* ─── DEFUSE PANEL ───────────────────────────────────────────────────── */
function DefusePanel({ drawPile, onPlaceBomb }) {
  const [pos, setPos] = useState(Math.floor(drawPile.length / 2));
  return (
    <div className="ek-panel-inner">
      <div className="ek-panel-icon">💣</div>
      <h3 className="ek-panel-title">Place bomb at position {pos}</h3>
      <input
        type="range" min="0" max={drawPile.length} value={pos}
        onChange={e => setPos(Number(e.target.value))}
        className="ek-range"
      />
      <div className="ek-range-labels">
        <span>Top</span><span>Bottom</span>
      </div>
      <button className="ek-action-btn ek-action-play" style={{ width: '100%', marginTop: 12 }} onClick={() => onPlaceBomb(pos)}>
        Insert Bomb
      </button>
    </div>
  );
}

/* ─── SEE THE FUTURE PANEL ───────────────────────────────────────────── */
function SeeFuturePanel({ cards, onClose }) {
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
              <img src={(meta?.images || [])[0] || ''} alt={meta?.label} className="ek-card-img" onError={e => { e.target.style.display = 'none'; }} />
              <div className="ek-future-name">{meta?.label}</div>
            </div>
          );
        })}
      </div>
      <button className="ek-action-btn ek-action-draw" style={{ width: '100%', marginTop: 12 }} onClick={onClose}>
        Got it
      </button>
    </div>
  );
}

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
      --ek-felt: #1A3A2A;
      --ek-felt-light: #254D38;
      --ek-felt-border: #2E6045;
      --ek-bg: #0D0D0D;
      --ek-surface: #181818;
      --ek-surface2: #222222;
      --ek-text: #F0EDE8;
      --ek-text-muted: #888880;
      --ek-card-w: 132px;
      --ek-card-h: 186px;
      --ek-pile-w: 116px;
      --ek-pile-h: 162px;
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
    .ek-room-wrap { position: relative; z-index: 10; width: min(560px, 94vw); display: flex; flex-direction: column; gap: 20px; }
    .ek-back-btn { background: none; border: none; color: var(--ek-ember); font-family: 'Nunito', sans-serif; font-size: 14px; font-weight: 700; cursor: pointer; align-self: flex-start; padding: 0; }
    .ek-back-btn:hover { color: var(--ek-gold); }
    .ek-room-header-block { text-align: center; }
    .ek-room-eyebrow { font-family: 'DM Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 3px; color: var(--ek-text-muted); margin-bottom: 8px; }
    .ek-room-code-display { font-family: 'Bebas Neue', sans-serif; font-size: 64px; letter-spacing: 12px; background: linear-gradient(120deg, var(--ek-green), var(--ek-blue)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; cursor: pointer; display: flex; flex-direction: column; align-items: center; line-height: 1; transition: transform .15s; }
    .ek-room-code-display:hover { transform: scale(1.03); }
    .ek-copy-hint { font-family: 'DM Mono', monospace; font-size: 10px; color: var(--ek-text-muted); letter-spacing: 1px; -webkit-text-fill-color: var(--ek-text-muted); }
    .ek-room-player-count { font-size: 12px; color: var(--ek-text-muted); font-family: 'DM Mono', monospace; margin-top: 6px; }
    .ek-table-preview { position: relative; height: 280px; background: var(--ek-felt); border: 2px solid var(--ek-felt-border); border-radius: 140px; overflow: hidden; }
    .ek-table-felt { position: absolute; inset: 0; background: radial-gradient(ellipse at center, var(--ek-felt-light) 0%, var(--ek-felt) 80%); }
    .ek-table-center-logo { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 40px; opacity: 0.25; }
    .ek-seat { position: absolute; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; gap: 4px; z-index: 5; }
    .ek-seat-avatar { width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 800; background: var(--ek-surface); border: 2px solid var(--seat-color, #888); color: var(--seat-color, #888); transition: all .2s; }
    .ek-seat-filled .ek-seat-avatar { background: color-mix(in srgb, var(--seat-color) 15%, transparent); }
    .ek-seat-me .ek-seat-avatar { box-shadow: 0 0 16px var(--seat-color, #888); }
    .ek-seat-info { text-align: center; }
    .ek-seat-name { font-size: 11px; font-weight: 700; color: var(--ek-text); white-space: nowrap; max-width: 80px; overflow: hidden; text-overflow: ellipsis; }
    .ek-seat-badge { font-size: 9px; font-family: 'DM Mono', monospace; font-weight: 500; letter-spacing: 1px; }
    .ek-seat-empty .ek-seat-avatar { opacity: 0.3; }
    .ek-seat-empty .ek-seat-name { color: var(--ek-text-muted); }
    .ek-start-btn { width: 100%; padding: 16px; border: none; border-radius: 14px; font-family: 'Nunito', sans-serif; font-size: 16px; font-weight: 800; cursor: pointer; letter-spacing: .5px; transition: all .2s; }
    .ek-start-ready { background: linear-gradient(130deg, #c02800, var(--ek-fire)); color: #fff; box-shadow: 0 8px 28px rgba(255,90,31,0.4); }
    .ek-start-ready:hover { filter: brightness(1.1); transform: translateY(-1px); }
    .ek-start-wait { background: rgba(255,255,255,0.06); color: var(--ek-text-muted); cursor: not-allowed; }
    .ek-host-wait { text-align: center; font-size: 13px; color: var(--ek-text-muted); font-family: 'DM Mono', monospace; }
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
    .ek-opp-card-icon { font-size: 9px; opacity: 0.6; }
    .ek-opp-pulse { position: absolute; inset: -4px; border-radius: 18px; border: 2px solid var(--ek-fire); animation: oppPulse 1.2s ease-in-out infinite; pointer-events: none; }
    @keyframes oppPulse { 0%,100% { opacity: .8; transform: scale(1); } 50% { opacity: .2; transform: scale(1.04); } }
    .ek-opp-dead-mark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 28px; }

    .ek-center-area { flex: 1; display: flex; align-items: center; justify-content: center; width: 100%; padding: 4px 0; }
    .ek-table-felt-game { width: min(480px, 90vw); background: radial-gradient(ellipse at center, #1e4530 0%, #122a1c 60%, #0c1e12 100%); border: 2px solid var(--ek-felt-border); border-radius: 24px; padding: 20px 20px 18px; box-shadow: inset 0 2px 0 rgba(255,255,255,0.04), 0 12px 40px rgba(0,0,0,0.6); display: flex; flex-direction: column; align-items: center; gap: 14px; }

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
    .ek-nope-banner {
      width: 100%;
      border-radius: 14px;
      padding: 12px 16px;
      display: flex; flex-direction: column; gap: 10px;
      animation: nopeBannerIn .3s ease;
    }
    @keyframes nopeBannerIn { from { opacity: 0; transform: scale(.95); } to { opacity: 1; transform: scale(1); } }
    .ek-nope-banner-active {
      background: rgba(255, 90, 31, 0.15);
      border: 1.5px solid rgba(255, 90, 31, 0.5);
    }
    .ek-nope-banner-noped {
      background: rgba(255, 50, 50, 0.2);
      border: 1.5px solid rgba(255, 50, 50, 0.6);
    }
    .ek-nope-banner-row { display: flex; align-items: center; gap: 10px; }
    .ek-nope-banner-icon { font-size: 22px; }
    .ek-nope-banner-text { flex: 1; font-size: 13px; line-height: 1.4; }
    .ek-noped-label { color: #ff5555; font-weight: 800; }
    .ek-nope-timer {
      font-family: 'Bebas Neue', sans-serif; font-size: 24px;
      color: var(--ek-fire); letter-spacing: 1px; min-width: 28px; text-align: right;
    }
    .ek-nope-btn {
      width: 100%; padding: 10px 16px; border: none; border-radius: 10px;
      background: linear-gradient(130deg, #9b0000, #ff3030);
      color: #fff; font-family: 'Nunito', sans-serif;
      font-size: 14px; font-weight: 800; cursor: pointer;
      animation: nopePulse .8s ease-in-out infinite alternate;
    }
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
    .ek-future-item img { width: 124px; height: 174px; object-fit: cover; border-radius: 12px; border: 2px solid rgba(255,255,255,0.12); box-shadow: 0 8px 24px rgba(0,0,0,0.5); }
    .ek-future-name { font-size: 12px; color: var(--ek-text); text-align: center; max-width: 124px; font-weight: 700; }

    /* ── Target / Favor panels ── */
    .ek-target-list { display: flex; flex-direction: column; gap: 10px; }
    .ek-target-btn { display: flex; align-items: center; gap: 14px; padding: 14px 18px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; color: var(--ek-text); font-family: 'Nunito', sans-serif; font-size: 15px; font-weight: 700; cursor: pointer; text-align: left; transition: all .2s; }
    .ek-target-btn:hover:not(:disabled) { background: rgba(255,144,32,0.15); border-color: var(--ek-ember); transform: translateY(-1px); }
    .ek-target-btn:disabled { opacity: 0.4; cursor: default; }
    .ek-target-avatar { width: 40px; height: 40px; border-radius: 50%; background: rgba(255,144,32,0.2); border: 2px solid var(--ek-ember); display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 800; color: var(--ek-ember); flex-shrink: 0; }
    .ek-target-count { font-size: 11px; color: var(--ek-text-muted); font-family: 'DM Mono', monospace; margin-left: auto; }

    /* Favor give hand */
    .ek-favor-hand { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-bottom: 4px; }
    .ek-favor-card { width: var(--ek-card-w); height: var(--ek-card-h); border-radius: 10px; overflow: hidden; border: 2px solid rgba(255,255,255,0.1); cursor: pointer; position: relative; transition: transform .18s, border-color .18s; flex-shrink: 0; }
    .ek-favor-card:hover { transform: translateY(-8px) scale(1.06); border-color: var(--ek-ember); }

    /* Pair target mini cards */
    .ek-opp-mini-cards { display: flex; gap: 2px; }
    .ek-opp-mini-card { font-size: 14px; }

    /* ── Steal: pick a specific face-down card ── */
    .ek-steal-grid {
      display: flex; flex-wrap: wrap; gap: 12px; justify-content: center;
      margin: 4px 0; max-height: 46vh; overflow-y: auto; padding: 6px;
    }
    .ek-steal-card {
      position: relative; width: 74px; height: 104px; padding: 0;
      border: none; background: none; cursor: pointer;
      border-radius: 10px; transform-origin: bottom center;
      animation: stealCardIn .4s cubic-bezier(.34,1.56,.64,1) backwards;
      transition: transform .18s cubic-bezier(.34,1.56,.64,1);
    }
    @keyframes stealCardIn { from { opacity: 0; transform: translateY(16px) rotateX(40deg); } to { opacity: 1; transform: translateY(0) rotateX(0); } }
    .ek-steal-card:hover, .ek-steal-card-hover { transform: translateY(-10px) scale(1.07); }
    .ek-steal-card-back {
      width: 100%; height: 100%; border-radius: 10px;
      background: linear-gradient(160deg, #3d1200, #1a0800);
      border: 2px solid rgba(255,144,32,0.35);
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.06); transition: border-color .18s, box-shadow .18s;
    }
    .ek-steal-card:hover .ek-steal-card-back, .ek-steal-card-hover .ek-steal-card-back {
      border-color: var(--ek-ember);
      box-shadow: 0 8px 22px rgba(255,90,31,0.45), 0 0 0 2px var(--ek-ember);
    }
    .ek-steal-card-icon { font-size: 26px; opacity: 0.5; }
    .ek-steal-card-q { font-family: 'Bebas Neue', sans-serif; font-size: 22px; color: rgba(255,144,32,0.7); letter-spacing: 1px; }
    .ek-steal-card-num { position: absolute; bottom: 4px; left: 0; right: 0; text-align: center; font-family: 'DM Mono', monospace; font-size: 9px; color: rgba(255,255,255,0.55); }

    /* ── Action / function card play effect (flying card + ring burst) ── */
    .ek-fx-layer { position: fixed; inset: 0; z-index: 200; pointer-events: none; display: flex; align-items: center; justify-content: center; }
    .ek-fx-card {
      width: 130px; height: 182px; border-radius: 14px; overflow: hidden;
      border: 3px solid var(--fx-color, var(--ek-ember));
      box-shadow: 0 0 40px var(--fx-color, var(--ek-ember)), 0 18px 50px rgba(0,0,0,0.6);
      animation: fxCardPlay 1.05s cubic-bezier(.2,.8,.3,1) forwards;
    }
    .ek-fx-card img { width: 100%; height: 100%; object-fit: cover; }
    @keyframes fxCardPlay {
      0%   { opacity: 0; transform: translateY(120px) scale(.5) rotate(-12deg); }
      22%  { opacity: 1; transform: translateY(0) scale(1.12) rotate(3deg); }
      58%  { opacity: 1; transform: translateY(0) scale(1) rotate(0deg); }
      100% { opacity: 0; transform: translateY(-60px) scale(.85) rotate(0deg); }
    }
    .ek-fx-ring {
      position: absolute; width: 130px; height: 130px; border-radius: 50%;
      border: 4px solid var(--fx-color, var(--ek-ember));
      animation: fxRing 1s ease-out forwards; animation-delay: .15s; opacity: 0;
    }
    .ek-fx-ring-2 { animation-delay: .32s; }
    @keyframes fxRing {
      0%   { opacity: .8; transform: scale(.3); }
      100% { opacity: 0; transform: scale(3.2); }
    }
    .ek-fx-label {
      position: absolute; bottom: 26%; font-family: 'Bebas Neue', sans-serif;
      font-size: 38px; letter-spacing: 3px; color: #fff;
      text-shadow: 0 2px 18px var(--fx-color, var(--ek-ember)), 0 0 30px var(--fx-color, var(--ek-ember));
      animation: fxLabel 1.05s ease-out forwards;
    }
    @keyframes fxLabel {
      0%   { opacity: 0; transform: translateY(20px) scale(.7); }
      28%  { opacity: 1; transform: translateY(0) scale(1); }
      70%  { opacity: 1; }
      100% { opacity: 0; transform: translateY(-14px) scale(1.05); }
    }
    .ek-fx-spark {
      position: absolute; width: 8px; height: 8px; border-radius: 50%;
      background: var(--fx-color, var(--ek-ember));
      box-shadow: 0 0 10px var(--fx-color, var(--ek-ember));
      animation: fxSpark .9s ease-out forwards;
    }
    @keyframes fxSpark {
      0%   { opacity: 1; transform: translate(0,0) scale(1); }
      100% { opacity: 0; transform: translate(var(--sx), var(--sy)) scale(.3); }
    }

    /* ══ MY HAND ══ */
    .ek-my-zone { width: 100%; flex-shrink: 0; background: linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%); border-top: 1px solid rgba(255,255,255,0.06); padding: 10px 16px 14px; display: flex; flex-direction: column; align-items: center; gap: 10px; }
    .ek-my-info { display: flex; align-items: center; gap: 10px; width: 100%; justify-content: center; }
    .ek-my-avatar { width: 34px; height: 34px; border-radius: 50%; background: rgba(255,90,31,0.15); border: 1.5px solid var(--ek-fire); display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 800; color: var(--ek-fire); }
    .ek-my-name { font-size: 14px; font-weight: 800; }
    .ek-my-cardcount { font-size: 10px; color: var(--ek-text-muted); font-family: 'DM Mono', monospace; }
    .ek-my-turn-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--ek-green); box-shadow: 0 0 8px var(--ek-green); animation: oppPulse 1s infinite; }

    .ek-hand-fan { display: flex; flex-direction: row; justify-content: center; gap: 8px; overflow-x: auto; padding: 8px 12px 6px; scrollbar-width: none; -ms-overflow-style: none; width: 100%; min-height: calc(var(--ek-card-h) + 28px); align-items: flex-end; }
    .ek-hand-fan::-webkit-scrollbar { display: none; }

    .ek-hand-card { width: var(--ek-card-w); height: var(--ek-card-h); border-radius: 12px; overflow: hidden; border: 2px solid rgba(255,255,255,0.1); flex-shrink: 0; cursor: pointer; position: relative; transition: transform .18s cubic-bezier(.34,1.56,.64,1), border-color .18s, box-shadow .18s; }
    .ek-hand-card:hover:not(.ek-hand-card-disabled) { transform: translateY(-14px) scale(1.06); border-color: var(--card-color, var(--ek-ember)); box-shadow: 0 12px 28px rgba(0,0,0,0.55), 0 0 0 1px var(--card-color, var(--ek-ember)); }
    .ek-hand-card-selected { transform: translateY(-22px) scale(1.08) !important; border-color: var(--card-color, var(--ek-fire)) !important; box-shadow: 0 0 0 2px var(--card-color, var(--ek-fire)), 0 16px 36px rgba(255,90,31,0.45) !important; }
    .ek-hand-card-disabled { opacity: 0.55; cursor: default; }
    /* Nopeable card highlight — glows red when nope window is open */
    .ek-hand-card-nopeable { opacity: 1 !important; cursor: pointer !important; border-color: rgba(255,50,50,0.6) !important; box-shadow: 0 0 14px rgba(255,50,50,0.5), 0 0 0 2px rgba(255,50,50,0.4) !important; animation: nopePulse .8s ease-in-out infinite alternate; }
    .ek-hand-card .ek-card-img { width: 100%; height: 100%; object-fit: cover; }
    .ek-card-selected-glow { position: absolute; inset: 0; background: radial-gradient(ellipse at center, rgba(255,255,255,0.12) 0%, transparent 70%); pointer-events: none; }
    .ek-nope-glow { position: absolute; inset: 0; background: radial-gradient(ellipse at center, rgba(255,50,50,0.25) 0%, transparent 70%); pointer-events: none; }
    .ek-card-label-bar { position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(to top, rgba(0,0,0,0.92), transparent); padding: 14px 6px 5px; font-size: 9px; text-align: center; font-family: 'DM Mono', monospace; color: rgba(255,255,255,0.8); letter-spacing: .5px; }
    .ek-hand-empty { color: rgba(255,255,255,0.2); font-size: 13px; font-family: 'DM Mono', monospace; padding: 24px; align-self: center; }

    .ek-action-strip { display: flex; gap: 10px; width: 100%; justify-content: center; max-width: 480px; }
    .ek-action-btn { flex: 1; max-width: 220px; padding: 13px 20px; border: none; border-radius: 12px; font-family: 'Nunito', sans-serif; font-size: 14px; font-weight: 800; cursor: pointer; transition: all .2s; text-transform: uppercase; letter-spacing: .5px; }
    .ek-action-play { background: linear-gradient(130deg, #c02800, var(--ek-fire)); color: #fff; box-shadow: 0 4px 18px rgba(255,90,31,0.4); }
    .ek-action-play:hover { filter: brightness(1.12); transform: translateY(-1px); }
    .ek-action-draw { background: rgba(255,255,255,0.06); color: var(--ek-text); border: 1px solid rgba(255,255,255,0.12); }
    .ek-action-draw:hover { background: rgba(255,255,255,0.1); }

    .ek-toast { position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%); background: linear-gradient(120deg, #c02800, var(--ek-fire)); color: #fff; padding: 11px 22px; border-radius: 24px; font-size: 13px; font-weight: 700; box-shadow: 0 6px 20px rgba(255,90,31,0.4); z-index: 999; animation: toastIn .25s ease; pointer-events: none; }
    @keyframes toastIn { from { opacity: 0; transform: translateX(-50%) translateY(8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }

    .ek-gameover-root { display: flex; align-items: center; justify-content: center; background: radial-gradient(ellipse 100% 80% at 50% 50%, #1a1400, #0D0D0D 70%); }
    .ek-gameover-card { text-align: center; padding: 56px 40px; background: linear-gradient(180deg, #1e1508, #0d0d0d); border: 1px solid rgba(255,208,96,0.2); border-radius: 24px; box-shadow: 0 24px 80px rgba(0,0,0,0.8); width: min(400px, 90vw); }
    .ek-gameover-burst { font-size: 80px; margin-bottom: 16px; animation: burstIn .6s cubic-bezier(.34,1.56,.64,1); }
    @keyframes burstIn { from { transform: scale(0.2) rotate(-20deg); opacity: 0; } to { transform: scale(1) rotate(0deg); opacity: 1; } }
    .ek-gameover-name { font-family: 'Bebas Neue', sans-serif; font-size: 52px; letter-spacing: 2px; background: linear-gradient(120deg, var(--ek-fire), var(--ek-gold)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 8px; }
    .ek-gameover-sub { font-size: 13px; color: var(--ek-text-muted); font-family: 'DM Mono', monospace; margin-bottom: 28px; }

    @media (max-width: 600px) {
      :root { --ek-card-w: 84px; --ek-card-h: 118px; --ek-pile-w: 72px; --ek-pile-h: 101px; }
      .ek-table-felt-game { padding: 14px 12px; gap: 10px; }
      .ek-game-layout { padding: 8px 10px; gap: 6px; }
    }
  `;
}
