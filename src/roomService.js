import { db } from "./firebase";
import { ref, set, get, onValue } from "firebase/database";

// Tạo mã phòng ngẫu nhiên 6 ký tự
function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Tạo phòng mới
export async function createRoom(playerName) {
  const roomId = generateRoomId();

  await set(ref(db, `rooms/${roomId}`), {
    status: "waiting",
    players: {
      player1: { name: playerName, lives: 3, ready: false }
    },
    game: {
      chain: [],
      currentLetter: "",
      turn: "player1"
    },
    createdAt: Date.now()
  });

  return roomId;
}

// Join phòng
export async function joinRoom(roomId, playerName) {
  const snapshot = await get(ref(db, `rooms/${roomId}`));

  if (!snapshot.exists()) {
    throw new Error("Phòng không tồn tại!");
  }

  const room = snapshot.val();

  if (room.status !== "waiting") {
    throw new Error("Phòng đã đầy hoặc đang chơi!");
  }

  if (room.players?.player2) {
    throw new Error("Phòng đã có 2 người!");
  }

  await set(ref(db, `rooms/${roomId}/players/player2`), {
    name: playerName,
    lives: 3,
    ready: false
  });

  await set(ref(db, `rooms/${roomId}/status`), "ready");

  return true;
}

// Lắng nghe thay đổi của phòng realtime
export function listenRoom(roomId, callback) {
  const roomRef = ref(db, `rooms/${roomId}`);
  return onValue(roomRef, (snapshot) => {
    callback(snapshot.val());
  });
}