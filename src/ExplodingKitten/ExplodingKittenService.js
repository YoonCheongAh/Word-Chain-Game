import { db } from "../firebase";
import { ref, set, update, get, runTransaction } from "firebase/database";

// ─── Card definitions ───────────────────────────────────────────────────────

export const CARD_TYPES = {
  EXPLODING_KITTEN: "exploding_kitten",
  DEFUSE: "defuse",
  ATTACK: "attack",
  SKIP: "skip",
  FAVOR: "favor",
  SHUFFLE: "shuffle",
  SEE_THE_FUTURE: "see_the_future",
  ALTER_THE_FUTURE: "alter_the_future",
  NOPE: "nope",
  TACOCAT: "tacocat",
  CATTERMELON: "cattermelon",
  HAIRY_POTATO_CAT: "hairy_potato_cat",
  BEARD_CAT: "beard_cat",
  RAINBOW_CAT: "rainbow_cat",
};

export const CAT_CARD_TYPES = new Set([
  CARD_TYPES.TACOCAT,
  CARD_TYPES.CATTERMELON,
  CARD_TYPES.HAIRY_POTATO_CAT,
  CARD_TYPES.BEARD_CAT,
  CARD_TYPES.RAINBOW_CAT,
]);

// Cards that can be Noped (cat pairs also can be noped)
export const NOPEABLE_TYPES = new Set([
  CARD_TYPES.ATTACK,
  CARD_TYPES.SKIP,
  CARD_TYPES.FAVOR,
  CARD_TYPES.SHUFFLE,
  CARD_TYPES.SEE_THE_FUTURE,
  CARD_TYPES.ALTER_THE_FUTURE,
  CARD_TYPES.TACOCAT,
  CARD_TYPES.CATTERMELON,
  CARD_TYPES.HAIRY_POTATO_CAT,
  CARD_TYPES.BEARD_CAT,
  CARD_TYPES.RAINBOW_CAT,
]);

export const CARD_META = {
  [CARD_TYPES.EXPLODING_KITTEN]: {
    label: "Exploding Kitten",
    desc: "Nổ tung! Dùng Defuse để thoát.",
    images: [
      "/Resources/exploding kitten/bomb_1.webp",
      "/Resources/exploding kitten/bomb_2.webp",
      "/Resources/exploding kitten/bomb_3.webp",
    ],
    color: "#ff4444",
    bg: "#3d0a0a",
  },
  [CARD_TYPES.DEFUSE]: {
    label: "Defuse",
    desc: "Ngăn Exploding Kitten. Cắm lại bom vào bài.",
    images: [
      "/Resources/exploding kitten/defuse_1.webp",
      "/Resources/exploding kitten/defuse_2.webp",
    ],
    color: "#00e5a0",
    bg: "#0c2c20",
  },
  [CARD_TYPES.ATTACK]: {
    label: "Attack",
    desc: "Kết thúc lượt. Người tiếp theo chơi 2 lượt.",
    images: [
      "/Resources/exploding kitten/attack_1.webp",
      "/Resources/exploding kitten/attack_2.webp",
    ],
    color: "#ff8844",
    bg: "#3d1a00",
  },
  [CARD_TYPES.SKIP]: {
    label: "Skip",
    desc: "Kết thúc lượt mà không cần rút bài.",
    images: ["/Resources/exploding kitten/skip_1.webp"],
    color: "#64d96a",
    bg: "#0c2c14",
  },
  [CARD_TYPES.FAVOR]: {
    label: "Favor",
    desc: "Ép người khác cho bạn 1 lá bài.",
    images: [
      "/Resources/exploding kitten/favor_1.webp",
      "/Resources/exploding kitten/favor_2.webp",
    ],
    color: "#f0c040",
    bg: "#2c2000",
  },
  [CARD_TYPES.SHUFFLE]: {
    label: "Shuffle",
    desc: "Xáo trộn toàn bộ bài rút.",
    images: ["/Resources/exploding kitten/shuffle_1.webp"],
    color: "#aa88ff",
    bg: "#1a0c3d",
  },
  [CARD_TYPES.SEE_THE_FUTURE]: {
    label: "See The Future",
    desc: "Nhìn trộm 3 lá bài trên đỉnh.",
    images: [
      "/Resources/exploding kitten/see-the-future_1.webp",
      "/Resources/exploding kitten/see-the-future-2.webp",
    ],
    color: "#5ab4ff",
    bg: "#0c1e38",
  },
  [CARD_TYPES.ALTER_THE_FUTURE]: {
    label: "Alter The Future",
    desc: "Nhìn 3 lá bài rồi sắp xếp lại thứ tự.",
    images: ["/Resources/exploding kitten/alter_the_future_1.webp"],
    color: "#b87fff",
    bg: "#2c0c38",
  },
  [CARD_TYPES.NOPE]: {
    label: "Nope",
    desc: "Hủy bất kỳ thẻ nào (trừ Bomb/Defuse).",
    images: [
      "/Resources/exploding kitten/nope_1.webp",
      "/Resources/exploding kitten/nope_2.webp",
    ],
    color: "#ff5a5a",
    bg: "#3d0c0c",
  },
  [CARD_TYPES.TACOCAT]: {
    label: "Tacocat",
    desc: "Mèo taco. Ghép đôi để ăn cắp bài.",
    images: ["/Resources/exploding kitten/taco_cat.webp"],
    color: "#ffaa44",
    bg: "#3d1e00",
  },
  [CARD_TYPES.CATTERMELON]: {
    label: "Cattermelon",
    desc: "Mèo dưa hấu. Ghép đôi để ăn cắp bài.",
    images: ["/Resources/exploding kitten/melon_cat.webp"],
    color: "#64d96a",
    bg: "#0c2c14",
  },
  [CARD_TYPES.HAIRY_POTATO_CAT]: {
    label: "Hairy Potato Cat",
    desc: "Mèo khoai tây. Ghép đôi để ăn cắp bài.",
    images: ["/Resources/exploding kitten/shit_cat.webp"],
    color: "#c8a060",
    bg: "#2c1e08",
  },
  [CARD_TYPES.BEARD_CAT]: {
    label: "Beard Cat",
    desc: "Mèo râu. Ghép đôi để ăn cắp bài.",
    images: ["/Resources/exploding kitten/beard_cat.webp"],
    color: "#88aaff",
    bg: "#0c1838",
  },
  [CARD_TYPES.RAINBOW_CAT]: {
    label: "Rainbow Cat",
    desc: "Mèo cầu vồng. Ghép đôi để ăn cắp bài.",
    images: ["/Resources/exploding kitten/rainbowcat.webp"],
    color: "#ff88dd",
    bg: "#3d0c2c",
  },
};

export function getCardImage(type) {
  const meta = CARD_META[type];
  if (!meta) return "/Resources/exploding kitten/backcard.webp";
  const imgs = meta.images;
  return imgs[Math.floor(Math.random() * imgs.length)];
}

export function getCardImageStable(type, seed = 0) {
  const meta = CARD_META[type];
  if (!meta) return "/Resources/exploding kitten/backcard.webp";
  const imgs = meta.images;
  return imgs[seed % imgs.length];
}

function createCard(type, index = 0) {
  const images = CARD_META[type]?.images || [];
  const image =
    images.length > 0
      ? images[Math.floor(Math.random() * images.length)]
      : "/Resources/exploding kitten/backcard.webp";

  return {
    type,
    image,
    id: `${type}_${index}_${Math.random().toString(36).slice(2)}`,
  };
}

// ─── Deck builder ────────────────────────────────────────────────────────────

function buildBaseDeck(playerCount) {
  const deck = [];
  const add = (type, count) => {
    for (let i = 0; i < count; i++) {
      deck.push(createCard(type, i));
    }
  };
  // Action cards — scaled to player count
  add(CARD_TYPES.ATTACK, playerCount);
  add(CARD_TYPES.SKIP, playerCount);
  add(CARD_TYPES.FAVOR, playerCount);
  add(CARD_TYPES.SHUFFLE, Math.max(4, playerCount - 1));
  add(CARD_TYPES.SEE_THE_FUTURE, playerCount);
  add(CARD_TYPES.ALTER_THE_FUTURE, 1);
  add(CARD_TYPES.NOPE, playerCount + 1);
  // Cat cards — 4 × playerCount spread equally across the 5 types
  // Each type gets floor(total/5); the remainder is distributed to the first types
  const totalCats = 4 * playerCount;
  const basePerType = Math.floor(totalCats / 5);
  const remainder = totalCats % 5;
  const catTypes = [
    CARD_TYPES.TACOCAT,
    CARD_TYPES.CATTERMELON,
    CARD_TYPES.HAIRY_POTATO_CAT,
    CARD_TYPES.RAINBOW_CAT,
    CARD_TYPES.BEARD_CAT,
  ];
  catTypes.forEach((type, i) => add(type, basePerType + (i < remainder ? 1 : 0)));
  return deck;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Turn helpers ────────────────────────────────────────────────────────────

function getNextLivingPlayer(players, currentRole) {
  const order = Object.keys(players).sort();
  const alive = order.filter(r => players[r] && players[r].alive !== false);
  if (alive.length === 0) return currentRole;
  const idx = alive.indexOf(currentRole);
  if (idx === -1) return alive[0];
  return alive[(idx + 1) % alive.length];
}

function anyPlayerHasNope(players, excludeRole = null) {
  return Object.entries(players || {}).some(([role, p]) => {
    if (role === excludeRole) return false;
    if (p?.alive === false) return false;
    return (p?.hand || []).some(c => c.type === CARD_TYPES.NOPE);
  });
}

function buildResolutionUpdates(pending, game) {
  switch (pending.type) {
    case "skip":
    case "attack":
      return {
        "game/phase": "play",
        "game/pendingAction": null,
        "game/nopeWindow": null,
        "game/nopeChain": [],
        "game/turn": pending.resolvedTurn,
        "game/attackStack": pending.resolvedAttackStack,
      };
    case "shuffle":
      return {
        "game/phase": "play",
        "game/pendingAction": null,
        "game/nopeWindow": null,
        "game/nopeChain": [],
      };
    case "see_the_future":
      return {
        "game/seeTheFuture": { cards: pending.top3, forPlayer: pending.by },
        "game/phase": "see_future",
        "game/pendingAction": null,
        "game/nopeWindow": null,
        "game/nopeChain": [],
      };
    case "alter_the_future":
      return {
        "game/alterTheFuture": { cards: pending.top3, forPlayer: pending.by },
        "game/phase": "alter_future",
        "game/pendingAction": null,
        "game/nopeWindow": null,
        "game/nopeChain": [],
      };
    case "favor":
      return {
        "game/phase": "favor_give",
        "game/nopeWindow": null,
        "game/nopeChain": [],
      };
    case "pair":
      return {
        "game/phase": "pair_target",
        "game/nopeWindow": null,
        "game/nopeChain": [],
      };
    case "trade_cats": {
      const updates = {
        "game/phase": "play",
        "game/pendingAction": null,
        "game/nopeWindow": null,
        "game/nopeChain": [],
      };

      if (pending.defuseCard) {
        updates[`players/${pending.by}/hand`] = [
          ...pending.handAfterDiscard,
          pending.defuseCard,
        ];
        updates["game/drawPile"] = pending.drawPileAfterRemoval;
        return updates;
      }
      return updates;
    }
    default:
      return {
        "game/phase": "play",
        "game/pendingAction": null,
        "game/nopeWindow": null,
        "game/nopeChain": [],
      };
  }
}

// Updates để khôi phục trạng thái trước đó khi 1 pending action bị Nope.
function buildNopedRestoreUpdates(pending, game) {
  return {
    "game/phase": "play",
    "game/pendingAction": null,
    "game/nopeWindow": null,
    "game/nopeChain": [],
    "game/turn": pending.savedTurn || game.turn,
    "game/attackStack": pending.savedAttackStack ?? game.attackStack,
  };
}

// ─── Game actions ────────────────────────────────────────────────────────────

export async function startGame(roomId) {
  const snap = await get(ref(db, `rooms/${roomId}/players`));
  const players = snap.val();
  const roles = Object.keys(players).sort();
  const playerCount = roles.length;

  let deck = shuffle(buildBaseDeck(playerCount));

  // Total defuses = playerCount + 2; each player gets 1, rest go into the draw pile
  const totalDefuses = playerCount + 3;
  const extraDefuses = totalDefuses - playerCount; // always 2

  const hands = {};
  for (const role of roles) {
    hands[role] = [];
    for (let i = 0; i < 6; i++) {
      hands[role].push(deck.shift());
    }
    hands[role].push({
      ...createCard(CARD_TYPES.DEFUSE),
      id: `defuse_deal_${role}`
    });
  }

  const bombs = [];
  for (let i = 0; i < playerCount - 1; i++) {
    bombs.push({
      ...createCard(CARD_TYPES.EXPLODING_KITTEN),
      id: `bomb_${i}`
    });
  }

  for (let i = 0; i < extraDefuses; i++) {
    deck.push({
      ...createCard(CARD_TYPES.DEFUSE),
      id: `defuse_extra_${i}`
    });
  }

  deck = shuffle([...deck, ...bombs]);

  const startRole = roles[Math.floor(Math.random() * roles.length)];

  const playerUpdates = {};
  for (const role of roles) {
    playerUpdates[`players/${role}/hand`] = hands[role];
    playerUpdates[`players/${role}/alive`] = true;
  }

  await update(ref(db, `rooms/${roomId}`), {
    ...playerUpdates,
    status: "playing",
    "game/drawPile": deck,
    "game/discardPile": [],
    "game/turn": startRole,
    "game/attackStack": 0,
    "game/pendingAction": null,
    "game/seeTheFuture": null,
    "game/nopeChain": [],
    "game/nopeWindow": null, // null = no nope window open
    "game/winner": null,
    "game/log": [`Game started! ${players[startRole].name} goes first.`],
    "game/phase": "play",
  });
}

export async function playCard(roomId, playerRole, cardId, extraData = {}) {
  const snap = await get(ref(db, `rooms/${roomId}`));
  const room = snap.val();
  const { game, players } = room;
  const hand = players[playerRole].hand || [];
  const cardIdx = hand.findIndex(c => c.id === cardId);
  if (cardIdx === -1) return;
  const card = hand[cardIdx];
  const newHand = hand.filter((_, i) => i !== cardIdx);
  const discard = [...(game.discardPile || []), card];
  const logBase = `${players[playerRole].name} played ${CARD_META[card.type]?.label ?? card.type}.`;

  // ── NOPE: can be played by ANYONE during a nope window ──
  if (card.type === CARD_TYPES.NOPE) {
    const prev = game.pendingAction;
    if (!prev) return; // nothing to nope

    const nopeChain = [...(game.nopeChain || []), { by: playerRole, cardId: card.id }];
    const nopeCount = nopeChain.length;
    const isEffective = nopeCount % 2 === 1; // odd = action canceled

    const logMsg = isEffective
      ? `🚫 ${players[playerRole].name} Noped! Action canceled.`
      : `↩️ ${players[playerRole].name} Noped the Nope! Action restored.`;

    const updatedPlayers = { ...players, [playerRole]: { ...players[playerRole], hand: newHand } };
    const canCounterNope = anyPlayerHasNope(updatedPlayers, playerRole);

    if (canCounterNope) {
      // Còn người có thể counter-nope → mở/giữ nope window như cũ
      await update(ref(db, `rooms/${roomId}`), {
        [`players/${playerRole}/hand`]: newHand,
        "game/discardPile": discard,
        "game/nopeChain": nopeChain,
        "game/nopeWindow": {
          open: true,
          expiresAt: Date.now() + 5000,
          pendingType: prev.type,
          isCurrentlyNoped: isEffective,
        },
        "game/phase": isEffective
          ? "nope_window"
          : (prev?.nopeWindowPhase || "play"),
        "game/log": [logMsg, ...(game.log || [])].slice(0, 20),
      });
    } else {
      // Không ai còn Nope → resolve ngay, khỏi chờ
      const resolutionUpdates = isEffective
        ? buildNopedRestoreUpdates(prev, game)
        : buildResolutionUpdates(prev, game);

      const logEntries = isEffective
        ? ["🚫 Action was Noped!", logMsg, ...(game.log || [])]
        : [logMsg, ...(game.log || [])];

      await update(ref(db, `rooms/${roomId}`), {
        [`players/${playerRole}/hand`]: newHand,
        "game/discardPile": discard,
        ...resolutionUpdates,
        "game/log": logEntries.slice(0, 20),
      });
    }
    return;
  }

  // ── PAIR CAT CARDS ──
  if (CAT_CARD_TYPES.has(card.type) && extraData.isPair) {
    const partnerIdx = hand.findIndex(c => c.type === card.type && c.id !== cardId);
    if (partnerIdx === -1) return; // no pair
    const partnerCard = hand[partnerIdx];
    const finalHand = newHand.filter(c => c.id !== partnerCard.id);
    const pairDiscard = [...(game.discardPile || []), card, partnerCard];
    const logMsg = `${players[playerRole].name} played a pair of ${CARD_META[card.type]?.label ?? card.type}!`;

    const pendingObj = {
      type: "pair",
      by: playerRole,
      cardType: card.type,
      savedAttackStack: game.attackStack || 0,
      savedTurn: game.turn,
      nopeWindowPhase: "pair_target",
    };

    const updatedPlayers = { ...players, [playerRole]: { ...players[playerRole], hand: finalHand } };
    const canNope = anyPlayerHasNope(updatedPlayers, playerRole);

    if (canNope) {
      await update(ref(db, `rooms/${roomId}`), {
        [`players/${playerRole}/hand`]: finalHand,
        "game/discardPile": pairDiscard,
        "game/phase": "pair_target",
        "game/nopeChain": [],
        "game/nopeWindow": {
          open: true,
          expiresAt: Date.now() + 5000,
          pendingType: "pair",
          isCurrentlyNoped: false,
        },
        "game/pendingAction": pendingObj,
        "game/log": [logMsg, ...(game.log || [])].slice(0, 20),
      });
    } else {
      await update(ref(db, `rooms/${roomId}`), {
        [`players/${playerRole}/hand`]: finalHand,
        "game/discardPile": pairDiscard,
        "game/pendingAction": pendingObj,
        ...buildResolutionUpdates(pendingObj, game),
        "game/log": [logMsg, ...(game.log || [])].slice(0, 20),
      });
    }
    return;
  }

  // ── SINGLE CAT CARD: do nothing, show hint ──
  if (CAT_CARD_TYPES.has(card.type)) {
    // Restore card to hand — don't consume it
    return;
  }

  switch (card.type) {
    case CARD_TYPES.SKIP: {
      const turnsOwed = Math.max(0, (game.attackStack || 0) - 1);
      const nextPlayer = turnsOwed > 0 ? playerRole : getNextLivingPlayer(players, playerRole);
      const pendingObj = {
        type: "skip",
        by: playerRole,
        resolvedTurn: nextPlayer,
        resolvedAttackStack: turnsOwed,
        savedAttackStack: game.attackStack || 0,
        savedTurn: game.turn,
        nopeWindowPhase: "play",
      };

      const updatedPlayers = { ...players, [playerRole]: { ...players[playerRole], hand: newHand } };
      const canNope = anyPlayerHasNope(updatedPlayers, playerRole);

      if (canNope) {
        await update(ref(db, `rooms/${roomId}`), {
          [`players/${playerRole}/hand`]: newHand,
          "game/discardPile": discard,
          "game/turn": nextPlayer,
          "game/attackStack": turnsOwed,
          "game/phase": "nope_window",
          "game/nopeChain": [],
          "game/nopeWindow": {
            open: true,
            expiresAt: Date.now() + 5000,
            pendingType: "skip",
            isCurrentlyNoped: false,
          },
          "game/pendingAction": pendingObj,
          "game/log": [logBase + " Turn skipped.", ...(game.log || [])].slice(0, 20),
        });
      } else {
        await update(ref(db, `rooms/${roomId}`), {
          [`players/${playerRole}/hand`]: newHand,
          "game/discardPile": discard,
          ...buildResolutionUpdates(pendingObj, game),
          "game/log": [logBase + " Turn skipped.", ...(game.log || [])].slice(0, 20),
        });
      }
      break;
    }

    case CARD_TYPES.ATTACK: {
      const nextPlayer = getNextLivingPlayer(players, playerRole);
      const newStack = (game.attackStack || 0) + 2;
      const pendingObj = {
        type: "attack",
        by: playerRole,
        resolvedTurn: nextPlayer,
        resolvedAttackStack: newStack,
        savedAttackStack: game.attackStack || 0,
        savedTurn: game.turn,
        nopeWindowPhase: "play",
      };

      const updatedPlayers = { ...players, [playerRole]: { ...players[playerRole], hand: newHand } };
      const canNope = anyPlayerHasNope(updatedPlayers, playerRole);
      const logMsg = logBase + ` ${players[nextPlayer].name} must take ${newStack} turns!`;

      if (canNope) {
        await update(ref(db, `rooms/${roomId}`), {
          [`players/${playerRole}/hand`]: newHand,
          "game/discardPile": discard,
          "game/phase": "nope_window",
          "game/nopeChain": [],
          "game/nopeWindow": {
            open: true,
            expiresAt: Date.now() + 5000,
            pendingType: "attack",
            isCurrentlyNoped: false,
          },
          "game/pendingAction": pendingObj,
          "game/log": [logMsg, ...(game.log || [])].slice(0, 20),
        });
      } else {
        await update(ref(db, `rooms/${roomId}`), {
          [`players/${playerRole}/hand`]: newHand,
          "game/discardPile": discard,
          ...buildResolutionUpdates(pendingObj, game),
          "game/log": [logMsg, ...(game.log || [])].slice(0, 20),
        });
      }
      break;
    }

    case CARD_TYPES.FAVOR: {
      const { targetRole } = extraData;
      if (!targetRole) {
        // Phase: active player chooses who to favor (giữ nguyên, không có nope window)
        await update(ref(db, `rooms/${roomId}`), {
          [`players/${playerRole}/hand`]: newHand,
          "game/discardPile": discard,
          "game/phase": "favor_choose_target",
          "game/nopeChain": [],
          "game/nopeWindow": null,
          "game/pendingAction": {
            type: "favor",
            by: playerRole,
            savedAttackStack: game.attackStack || 0,
            savedTurn: game.turn,
            nopeWindowPhase: "play",
          },
          "game/log": [logBase, ...(game.log || [])].slice(0, 20),
        });
      } else {
        const pendingObj = {
          type: "favor",
          by: playerRole,
          target: targetRole,
          savedAttackStack: game.attackStack || 0,
          savedTurn: game.turn,
          nopeWindowPhase: "favor_give",
        };
        const canNope = anyPlayerHasNope(players, playerRole); // hand đã được trừ ở step 1
        const logMsg = logBase + ` ${players[targetRole].name} must give a card.`;

        if (canNope) {
          await update(ref(db, `rooms/${roomId}`), {
            "game/phase": "nope_window",
            "game/nopeChain": [],
            "game/nopeWindow": {
              open: true,
              expiresAt: Date.now() + 5000,
              pendingType: "favor",
              isCurrentlyNoped: false,
            },
            "game/pendingAction": pendingObj,
            "game/log": [logMsg, ...(game.log || [])].slice(0, 20),
          });
        } else {
          await update(ref(db, `rooms/${roomId}`), {
            "game/pendingAction": pendingObj,
            ...buildResolutionUpdates(pendingObj, game),
            "game/log": [logMsg, ...(game.log || [])].slice(0, 20),
          });
        }
      }
      break;
    }

    case CARD_TYPES.SHUFFLE: {
      const shuffled = shuffle(game.drawPile || []);
      const pendingObj = {
        type: "shuffle",
        by: playerRole,
        shuffledPile: shuffled,
        originalPile: game.drawPile || [],
        savedAttackStack: game.attackStack || 0,
        savedTurn: game.turn,
        nopeWindowPhase: "play",
      };

      const updatedPlayers = { ...players, [playerRole]: { ...players[playerRole], hand: newHand } };
      const canNope = anyPlayerHasNope(updatedPlayers, playerRole);

      if (canNope) {
        await update(ref(db, `rooms/${roomId}`), {
          [`players/${playerRole}/hand`]: newHand,
          "game/discardPile": discard,
          "game/drawPile": shuffled,
          "game/phase": "nope_window",
          "game/nopeChain": [],
          "game/nopeWindow": {
            open: true,
            expiresAt: Date.now() + 5000,
            pendingType: "shuffle",
            isCurrentlyNoped: false,
          },
          "game/pendingAction": pendingObj,
          "game/log": [logBase, ...(game.log || [])].slice(0, 20),
        });
      } else {
        await update(ref(db, `rooms/${roomId}`), {
          [`players/${playerRole}/hand`]: newHand,
          "game/discardPile": discard,
          "game/drawPile": shuffled,
          ...buildResolutionUpdates(pendingObj, game),
          "game/log": [logBase, ...(game.log || [])].slice(0, 20),
        });
      }
      break;
    }

    case CARD_TYPES.SEE_THE_FUTURE: {
      const top3 = (game.drawPile || []).slice(-3).reverse();
      const pendingObj = {
        type: "see_the_future",
        by: playerRole,
        top3,
        savedAttackStack: game.attackStack || 0,
        savedTurn: game.turn,
        nopeWindowPhase: "play",
      };

      const updatedPlayers = { ...players, [playerRole]: { ...players[playerRole], hand: newHand } };
      const canNope = anyPlayerHasNope(updatedPlayers, playerRole);

      if (canNope) {
        await update(ref(db, `rooms/${roomId}`), {
          [`players/${playerRole}/hand`]: newHand,
          "game/discardPile": discard,
          "game/phase": "nope_window",
          "game/nopeChain": [],
          "game/nopeWindow": {
            open: true,
            expiresAt: Date.now() + 5000,
            pendingType: "see_the_future",
            isCurrentlyNoped: false,
          },
          "game/pendingAction": pendingObj,
          "game/log": [logBase, ...(game.log || [])].slice(0, 20),
        });
      } else {
        await update(ref(db, `rooms/${roomId}`), {
          [`players/${playerRole}/hand`]: newHand,
          "game/discardPile": discard,
          ...buildResolutionUpdates(pendingObj, game),
          "game/log": [logBase, ...(game.log || [])].slice(0, 20),
        });
      }
      break;
    }

    case CARD_TYPES.ALTER_THE_FUTURE: {
      const top3 = (game.drawPile || []).slice(-3).reverse();
      const pendingObj = {
        type: "alter_the_future",
        by: playerRole,
        top3,
        savedAttackStack: game.attackStack || 0,
        savedTurn: game.turn,
        nopeWindowPhase: "play",
      };

      const updatedPlayers = { ...players, [playerRole]: { ...players[playerRole], hand: newHand } };
      const canNope = anyPlayerHasNope(updatedPlayers, playerRole);
      const logMsg = logBase + " Peek at 3 cards and rearrange!";

      if (canNope) {
        await update(ref(db, `rooms/${roomId}`), {
          [`players/${playerRole}/hand`]: newHand,
          "game/discardPile": discard,
          "game/phase": "nope_window",
          "game/nopeChain": [],
          "game/nopeWindow": {
            open: true,
            expiresAt: Date.now() + 5000,
            pendingType: "alter_the_future",
            isCurrentlyNoped: false,
          },
          "game/pendingAction": pendingObj,
          "game/log": [logMsg, ...(game.log || [])].slice(0, 20),
        });
      } else {
        await update(ref(db, `rooms/${roomId}`), {
          [`players/${playerRole}/hand`]: newHand,
          "game/discardPile": discard,
          ...buildResolutionUpdates(pendingObj, game),
          "game/log": [logMsg, ...(game.log || [])].slice(0, 20),
        });
      }
      break;
    }

    default:
      return;
  }
}

// Called when nope window expires (client-side timer calls this)
export async function resolveNopeWindow(roomId) {
  const snap = await get(ref(db, `rooms/${roomId}`));
  const room = snap.val();
  const { game } = room;
  const pending = game?.pendingAction;
  const nopeWindow = game?.nopeWindow;

  if (!nopeWindow?.open || !pending) return;

  const nopeCount = (game.nopeChain || []).length;
  const isNoped = nopeCount % 2 === 1;

  if (isNoped) {
    // Action was noped — restore state before the card was played
    await update(ref(db, `rooms/${roomId}`), {
      ...buildNopedRestoreUpdates(pending, game),
      "game/log": ["🚫 Action was Noped!", ...(game.log || [])].slice(0, 20),
    });
    return;
  }

  // Not noped — resolve the action
  await update(ref(db, `rooms/${roomId}`), buildResolutionUpdates(pending, game));
}

export async function drawCard(roomId, playerRole) {
  const snap = await get(ref(db, `rooms/${roomId}`));
  const room = snap.val();
  const { game, players } = room;
  if (!game || game.turn !== playerRole) return;

  const drawPile = [...(game.drawPile || [])];
  if (drawPile.length === 0) return;

  const drawnCard = drawPile.pop();
  const hand = [...(players[playerRole].hand || [])];
  const attackStack = game.attackStack || 0;

  if (drawnCard.type === CARD_TYPES.EXPLODING_KITTEN) {
    const defuseIdx = hand.findIndex(c => c.type === CARD_TYPES.DEFUSE);
    if (defuseIdx !== -1) {
      const newHand = hand.filter((_, i) => i !== defuseIdx);
      const discard = [...(game.discardPile || []), hand[defuseIdx]];
      const logMsg = `${players[playerRole].name} drew the Exploding Kitten! Used Defuse 💣`;
      await update(ref(db, `rooms/${roomId}`), {
        [`players/${playerRole}/hand`]: newHand,
        "game/drawPile": drawPile,
        "game/discardPile": discard,
        "game/phase": "defuse",
        "game/nopeWindow": null,
        "game/pendingAction": { type: "defuse", by: playerRole, bomb: drawnCard },
        "game/log": [logMsg, ...(game.log || [])].slice(0, 20),
      });
    } else {
      const logMsg = `💥 ${players[playerRole].name} exploded! No defuse!`;
      const newAttackStack = Math.max(0, attackStack - 1);
      const newPlayers = {
        ...players,
        [playerRole]: { ...players[playerRole], alive: false },
      };
      const nextPlayer = getNextLivingPlayer(newPlayers, playerRole);
      const aliveRoles = Object.keys(players).filter(
        r => r !== playerRole && players[r].alive !== false
      );

      const updates = {
        [`players/${playerRole}/alive`]: false,
        [`players/${playerRole}/hand`]: [],
        "game/drawPile": drawPile,
        "game/discardPile": [...(game.discardPile || []), drawnCard],
        "game/turn": nextPlayer,
        "game/attackStack": newAttackStack,
        "game/phase": "play",
        "game/nopeWindow": null,
        "game/log": [logMsg, ...(game.log || [])].slice(0, 20),
      };

      if (aliveRoles.length <= 1) {
        updates["game/winner"] = aliveRoles[0] || null;
        updates["status"] = "finished";
      }
      await update(ref(db, `rooms/${roomId}`), updates);
    }
  } else {
    const newHand = [...hand, drawnCard];
    const newAttackStack = Math.max(0, attackStack - 1);
    const nextPlayer =
      newAttackStack > 0 ? playerRole : getNextLivingPlayer(players, playerRole);
    const logMsg = `${players[playerRole].name} drew a card.`;
    await update(ref(db, `rooms/${roomId}`), {
      [`players/${playerRole}/hand`]: newHand,
      "game/drawPile": drawPile,
      "game/turn": nextPlayer,
      "game/attackStack": newAttackStack,
      "game/phase": "play",
      "game/nopeWindow": null,
      "game/log": [logMsg, ...(game.log || [])].slice(0, 20),
    });
  }
}

export async function placeBombAfterDefuse(roomId, playerRole, position) {
  const snap = await get(ref(db, `rooms/${roomId}`));
  const room = snap.val();
  const { game, players } = room;
  const drawPile = [...(game.drawPile || [])];
  const bomb = game.pendingAction?.bomb;
  if (!bomb) return;

  // The deck is drawn from the END of the array (drawPile.pop()), so the
  // visual "top" of the deck is the last element. `position` comes from the UI
  // where 0 = top of the deck. Convert it to the correct array index so that
  // position 0 places the bomb on top (drawn next).
  const fromTop = Math.max(0, Math.min(position, drawPile.length));
  const insertIdx = drawPile.length - fromTop;
  drawPile.splice(insertIdx, 0, bomb);

  const attackStack = game.attackStack || 0;
  const newAttackStack = Math.max(0, attackStack - 1);
  const nextPlayer =
    newAttackStack > 0 ? playerRole : getNextLivingPlayer(players, playerRole);
  const logMsg = `${players[playerRole].name} placed the bomb back. 😅`;

  await update(ref(db, `rooms/${roomId}`), {
    "game/drawPile": drawPile,
    "game/turn": nextPlayer,
    "game/attackStack": newAttackStack,
    "game/phase": "play",
    "game/pendingAction": null,
    "game/nopeWindow": null,
    "game/log": [logMsg, ...(game.log || [])].slice(0, 20),
  });
}

// Target gives a specific card they choose to the favor requester
export async function giveFavorCard(roomId, giverRole, cardId) {
  const snap = await get(ref(db, `rooms/${roomId}`));
  const room = snap.val();
  const { game, players } = room;
  const pending = game.pendingAction;
  if (!pending || pending.type !== "favor") return;

  const giverHand = [...(players[giverRole].hand || [])];
  const cardIdx = giverHand.findIndex(c => c.id === cardId);
  if (cardIdx === -1) return;
  const card = giverHand[cardIdx];
  const newGiverHand = giverHand.filter((_, i) => i !== cardIdx);
  const receiverHand = [...(players[pending.by].hand || []), card];
  const logMsg = `${players[giverRole].name} gave ${CARD_META[card.type]?.label ?? card.type} to ${players[pending.by].name}.`;

  // Favor doesn't end the turn — the requester continues their turn
  // (and still needs to draw a card eventually), same as a Cat Pair steal.
  await update(ref(db, `rooms/${roomId}`), {
    [`players/${giverRole}/hand`]: newGiverHand,
    [`players/${pending.by}/hand`]: receiverHand,
    "game/phase": "play",
    "game/pendingAction": null,
    "game/nopeWindow": null,
    "game/turn": pending.by,
    "game/attackStack": game.attackStack || 0,
    "game/log": [logMsg, ...(game.log || [])].slice(0, 20),
  });
}

export async function tradeFiveCatsForDefuse(roomId, playerRole, cardIds) {
  const snap = await get(ref(db, `rooms/${roomId}`));
  const room = snap.val();
  const { game, players } = room;
  if (!game || game.turn !== playerRole || game.phase !== "play") return;

  const hand = [...(players[playerRole].hand || [])];
  if (cardIds.length !== 5) return;

  const cardsToDiscard = [];
  for (const id of cardIds) {
    const c = hand.find(h => h.id === id);
    if (!c || !CAT_CARD_TYPES.has(c.type)) return;
    cardsToDiscard.push(c);
  }

  const newHand = hand.filter(c => !cardIds.includes(c.id));
  const discard = [...(game.discardPile || []), ...cardsToDiscard];
  const drawPile = [...(game.drawPile || [])];
  const defuseIdx = drawPile.findIndex(c => c.type === CARD_TYPES.DEFUSE);

  let defuseCard = null;
  let drawPileAfterRemoval = drawPile;
  let logMsg;
  if (defuseIdx !== -1) {
    drawPileAfterRemoval = [...drawPile];
    [defuseCard] = drawPileAfterRemoval.splice(defuseIdx, 1);
    logMsg = `${players[playerRole].name} Trade 5 cats different for defuse`;
  } else {
    logMsg = `${players[playerRole].name} No defuse in the deck`;
  }

  const pendingObj = {
    type: "trade_cats",
    by: playerRole,
    handAfterDiscard: newHand,
    defuseCard,
    drawPileAfterRemoval,
    savedAttackStack: game.attackStack || 0,
    savedTurn: game.turn,
    nopeWindowPhase: "play",
  };

  const updatedPlayers = { ...players, [playerRole]: { ...players[playerRole], hand: newHand } };
  const canNope = anyPlayerHasNope(updatedPlayers, playerRole);

  if (canNope) {
    await update(ref(db, `rooms/${roomId}`), {
      [`players/${playerRole}/hand`]: newHand,
      "game/discardPile": discard,
      "game/phase": "nope_window",
      "game/nopeChain": [],
      "game/nopeWindow": {
        open: true,
        expiresAt: Date.now() + 5000,
        pendingType: "trade_cats",
        isCurrentlyNoped: false,
      },
      "game/pendingAction": pendingObj,
      "game/log": [logMsg, ...(game.log || [])].slice(0, 20),
    });
  } else {
    await update(ref(db, `rooms/${roomId}`), {
      [`players/${playerRole}/hand`]: newHand,
      "game/discardPile": discard,
      ...buildResolutionUpdates(pendingObj, game),
      "game/log": [logMsg, ...(game.log || [])].slice(0, 20),
    });
  }
}

// Pair steal: thief chose a target AND a specific (face-down) card position to steal.
// cardIndex is the position the thief picked while the card was still face-down.
// Falls back to random only if no valid index is provided (backwards compatible).
export async function stealPairCard(roomId, thiefRole, targetRole, cardIndex = null) {
  const snap = await get(ref(db, `rooms/${roomId}`));
  const room = snap.val();
  const { game, players } = room;

  if (!players[targetRole] || players[targetRole].alive === false) return;

  const targetHand = [...(players[targetRole].hand || [])];
  if (targetHand.length === 0) return;

  const validIndex =
    Number.isInteger(cardIndex) && cardIndex >= 0 && cardIndex < targetHand.length;
  const stolenIdx = validIndex ? cardIndex : Math.floor(Math.random() * targetHand.length);
  const stolen = targetHand[stolenIdx];
  const newTargetHand = targetHand.filter((_, i) => i !== stolenIdx);
  const thiefHand = [...(players[thiefRole].hand || []), stolen];
  const logMsg = `${players[thiefRole].name} stole a card from ${players[targetRole].name}! Still must draw.`;

  // Playing a cat pair does NOT end the turn — only drawing does.
  // Keep the turn on the thief (and the attack stack unchanged) so the player
  // is still required to draw a card afterward.
  await update(ref(db, `rooms/${roomId}`), {
    [`players/${thiefRole}/hand`]: thiefHand,
    [`players/${targetRole}/hand`]: newTargetHand,
    "game/phase": "play",
    "game/pendingAction": null,
    "game/nopeWindow": null,
    "game/turn": thiefRole,
    "game/attackStack": game.attackStack || 0,
    "game/log": [logMsg, ...(game.log || [])].slice(0, 20),
  });
}

export async function closeSeeTheFuture(roomId) {
  await update(ref(db, `rooms/${roomId}/game`), {
    seeTheFuture: null,
    phase: "play",
    nopeWindow: null,
  });
}

export async function reorderAlterTheFuture(roomId, playerRole, reorderedCards) {
  const snap = await get(ref(db, `rooms/${roomId}`));
  const room = snap.val();
  const { game } = room;

  if (!game || game.turn !== playerRole) return;

  // The reorderedCards come from the UI in display order (top to bottom)
  // We need to put them back on the draw pile in reverse order so they draw in the correct sequence
  const drawPile = [...(game.drawPile || [])];

  // Remove the top 3 cards that were revealed
  drawPile.pop();
  drawPile.pop();
  drawPile.pop();

  // Add the reordered cards back in reverse order (so they draw in the player's chosen order)
  for (let i = reorderedCards.length - 1; i >= 0; i--) {
    drawPile.push(reorderedCards[i]);
  }

  await update(ref(db, `rooms/${roomId}`), {
    "game/drawPile": drawPile,
    "game/alterTheFuture": null,
    "game/phase": "play",
    "game/pendingAction": null,
    "game/nopeWindow": null,
  });
}

export async function requestRematch(roomId, playerRole) {
  const playersRef = ref(db, `rooms/${roomId}/players`);
  await set(ref(db, `rooms/${roomId}/players/${playerRole}/rematch`), true);

  await runTransaction(playersRef, (players) => {
    if (!players) return players;
    const allWant = Object.values(players).every(p => p.rematch === true);
    if (!allWant) return players;
    const reset = { ...players };
    Object.keys(reset).forEach(role => {
      reset[role] = { ...reset[role], rematch: false };
    });
    return reset;
  });

  const snap = await get(playersRef);
  const players = snap.val();
  const anyStillSet = Object.values(players).some(p => p.rematch === true);

  if (!anyStillSet) {
    await update(ref(db, `rooms/${roomId}`), { status: "waiting", game: null });
    await startGame(roomId);
  }
}