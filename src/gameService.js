import { db } from "./firebase";
import { ref, set, update, get } from "firebase/database";

// Validate từ qua Dictionary API (miễn phí, không cần key)
export async function isValidWord(word) {
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
    return res.ok;
  } catch {
    return false;
  }
}

// Bắt đầu game - AI chọn từ đầu tiên ngẫu nhiên
export async function startGame(roomId) {
  const starters = ["apple", "dragon", "elephant", "jungle", "ocean", "planet", "rocket", "silver", "tiger", "winter"];
  const firstWord = starters[Math.floor(Math.random() * starters.length)];

  await update(ref(db, `rooms/${roomId}`), {
    status: "playing",
    "game/chain": [firstWord],
    "game/usedWords": { [firstWord]: true },
    "game/currentLetter": firstWord[firstWord.length - 1],
    "game/turn": "player1"
  });
}

// Gửi từ lên database
export async function submitWord(roomId, word, currentPlayer) {
  const snapshot = await get(ref(db, `rooms/${roomId}/game`));
  const game = snapshot.val();

  const nextPlayer = currentPlayer === "player1" ? "player2" : "player1";
  const newChain = [...(game.chain || []), word];

  await update(ref(db, `rooms/${roomId}/game`), {
    chain: newChain,
    usedWords: { ...(game.usedWords || {}), [word]: true },
    currentLetter: word[word.length - 1],
    turn: nextPlayer
  });
}

// Trừ mạng khi sai
export async function loseLife(roomId, player) {
  const snapshot = await get(ref(db, `rooms/${roomId}/players/${player}/lives`));
  const lives = snapshot.val() - 1;

  await set(ref(db, `rooms/${roomId}/players/${player}/lives`), lives);

  if (lives <= 0) {
    await set(ref(db, `rooms/${roomId}/status`), "finished");
    await set(ref(db, `rooms/${roomId}/game/winner`),
      player === "player1" ? "player2" : "player1"
    );
  }
}