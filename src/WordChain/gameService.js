import { db } from "../firebase";
import { ref, set, update, get } from "firebase/database";

export async function isValidWord(word) {
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
    return res.ok;
  } catch {
    return false;
  }
}

const STARTER_WORDS = [
  "apple", "dragon", "elephant", "jungle", "ocean",
  "planet", "rocket", "silver", "tiger", "winter",
  "brave", "castle", "flame", "glory", "honey",
  "knight", "lemon", "maple", "noble", "orbit",
];

function getNextLivingPlayer(players, currentRole) {
  const order = ["player1", "player2", "player3", "player4"];
  const currentIdx = order.indexOf(currentRole);
  for (let i = 1; i <= 4; i++) {
    const candidate = order[(currentIdx + i) % 4];
    if (players[candidate] && players[candidate].lives > 0) {
      return candidate;
    }
  }
  return currentRole;
}

export async function startGame(roomId) {
  const firstWord = STARTER_WORDS[Math.floor(Math.random() * STARTER_WORDS.length)];
  await update(ref(db, `rooms/${roomId}`), {
    status: "playing",
    "game/chain": [firstWord],
    "game/usedWords": { [firstWord]: true },
    "game/currentLetter": firstWord[firstWord.length - 1],
    "game/turn": "player1",
    "game/winner": null,
    "game/startedAt": Date.now(),
    "game/turnStartedAt": Date.now(),
  });
}

export async function submitWord(roomId, word, currentPlayer) {
  const snapshot = await get(ref(db, `rooms/${roomId}`));
  const room = snapshot.val();
  const game = room.game;
  const players = room.players;

  const nextPlayer = getNextLivingPlayer(players, currentPlayer);
  const newChain = [...(game.chain || []), word];

  await update(ref(db, `rooms/${roomId}/game`), {
    chain: newChain,
    usedWords: { ...(game.usedWords || {}), [word]: true },
    currentLetter: word[word.length - 1],
    turn: nextPlayer,
    turnStartedAt: Date.now(),
  });
}

export async function timeoutTurn(roomId, currentPlayer) {
  const snapshot = await get(ref(db, `rooms/${roomId}`));
  const room = snapshot.val();
  if (!room || room.status !== "playing") return;
  if (room.game?.turn !== currentPlayer) return;

  // Trừ máu
  await loseLife(roomId, currentPlayer);

  // Kiểm tra lại sau loseLife (có thể game đã kết thúc hoặc lượt đã chuyển)
  const snapshot2 = await get(ref(db, `rooms/${roomId}`));
  const room2 = snapshot2.val();
  if (!room2 || room2.status !== "playing") return;
  // Nếu loseLife đã chuyển lượt sang người khác thì dừng, không đổi chữ
  if (room2.game?.turn !== currentPlayer) return;

  // Giữ nguyên lượt, đổi chữ mới + tăng timeoutCount để trigger timer reset
  const alphabet = "abcdefghijklmnoprstw";
  const newLetter = alphabet[Math.floor(Math.random() * alphabet.length)];

  await update(ref(db, `rooms/${roomId}/game`), {
    currentLetter: newLetter,
    turnStartedAt: Date.now(),
    timeoutCount: (room2.game?.timeoutCount ?? 0) + 1,
  });
}

export async function loseLife(roomId, player) {
  const snapshot = await get(ref(db, `rooms/${roomId}/players/${player}/lives`));
  const lives = (snapshot.val() ?? 1) - 1;
  await set(ref(db, `rooms/${roomId}/players/${player}/lives`), lives);

  if (lives <= 0) {
    const playersSnap = await get(ref(db, `rooms/${roomId}/players`));
    const players = playersSnap.val();
    const alive = Object.entries(players).filter(([, p]) => p.lives > 0);

    if (alive.length <= 1) {
      const winner = alive[0]?.[0] ?? null;
      await set(ref(db, `rooms/${roomId}/status`), "finished");
      await set(ref(db, `rooms/${roomId}/game/winner`), winner);
    } else {
      const playersWithUpdated = { ...players, [player]: { ...players[player], lives: 0 } };
      const nextPlayer = getNextLivingPlayer(playersWithUpdated, player);
      await update(ref(db, `rooms/${roomId}/game`), {
        turn: nextPlayer,
        turnStartedAt: Date.now(),
      });
    }
  }
}

export async function requestRematch(roomId, playerRole) {
  await set(ref(db, `rooms/${roomId}/players/${playerRole}/rematch`), true);

  const snap = await get(ref(db, `rooms/${roomId}/players`));
  const players = snap.val();
  const allWant = Object.values(players).every(p => p.rematch === true);

  if (allWant) {
    const resetPlayers = {};
    Object.entries(players).forEach(([role]) => {
      resetPlayers[`players/${role}/lives`] = 3;
      resetPlayers[`players/${role}/rematch`] = false;
    });
    const firstWord = STARTER_WORDS[Math.floor(Math.random() * STARTER_WORDS.length)];
    await update(ref(db, `rooms/${roomId}`), {
      ...resetPlayers,
      status: "playing",
      "game/chain": [firstWord],
      "game/usedWords": { [firstWord]: true },
      "game/currentLetter": firstWord[firstWord.length - 1],
      "game/turn": "player1",
      "game/winner": null,
      "game/startedAt": Date.now(),
      "game/turnStartedAt": Date.now(),
    });
  }
}