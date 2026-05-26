import { db } from "./firebase";
import { ref, set, get, update, onValue, remove, onDisconnect } from "firebase/database";

function genRoomId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export async function createRoom(hostName) {
  const roomId = genRoomId();
  await set(ref(db, `rooms/${roomId}`), {
    status: "waiting",
    players: {
      player1: { name: hostName, lives: 3, online: true, rematch: false },
    },
    game: null,
    createdAt: Date.now(),
  });

  // FIX Bug 1: onDisconnect tự dissolve nếu mất kết nối đột ngột
  onDisconnect(ref(db, `rooms/${roomId}/status`)).set("dissolved");

  return roomId;
}

export async function joinRoom(roomId, playerName) {
  const snap = await get(ref(db, `rooms/${roomId}`));
  if (!snap.exists()) throw new Error("Phòng không tồn tại!");

  const room = snap.val();
  if (room.status === "playing") throw new Error("Game đang diễn ra!");
  if (room.status === "dissolved") throw new Error("Phòng đã đóng!");

  const players = room.players || {};
  const slots = ["player1", "player2", "player3", "player4"];
  const taken = Object.keys(players);
  if (taken.length >= 4) throw new Error("Phòng đã đầy (4/4)!");

  const nextSlot = slots.find(s => !taken.includes(s));

  // FIX Bug 3: Gộp tất cả thành 1 atomic write duy nhất
  const updates = {};
  updates[`players/${nextSlot}/name`] = playerName;
  updates[`players/${nextSlot}/lives`] = 3;
  updates[`players/${nextSlot}/online`] = true;
  updates[`players/${nextSlot}/rematch`] = false;

  const newCount = taken.length + 1;
  if (newCount >= 2) updates["status"] = "ready";

  await update(ref(db, `rooms/${roomId}`), updates);

  // onDisconnect cho người join
  onDisconnect(ref(db, `rooms/${roomId}/status`)).set("dissolved");

  return nextSlot;
}

export function listenRoom(roomId, callback) {
  const r = ref(db, `rooms/${roomId}`);
  // FIX Bug 2: Trả về null-safe, không crash khi phòng bị xóa
  const unsub = onValue(r, snap => {
    callback(snap.exists() ? snap.val() : null);
  });
  return unsub;
}

export async function setPlayerOnline(roomId, playerRole, online) {
  if (!roomId || !playerRole) return;
  try {
    await update(ref(db, `rooms/${roomId}/players/${playerRole}`), { online });
    if (!online) {
      const snap = await get(ref(db, `rooms/${roomId}`));
      const room = snap.val();
      if (room && room.status !== "finished") {
        await update(ref(db, `rooms/${roomId}`), { status: "dissolved" });
      }
    }
  } catch (e) {
    // Ignore lỗi network khi tab đóng
  }
}

export async function deleteRoom(roomId) {
  await remove(ref(db, `rooms/${roomId}`));
}