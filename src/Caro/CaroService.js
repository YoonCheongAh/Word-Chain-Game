import { db } from "../firebase";
import { ref, set, get, update } from "firebase/database";

export const BOARD_SIZE = 19;
export const WIN_COUNT  = 5;

export const MODE_FREE  = "free";
export const MODE_BLOCK = "block";

const EMPTY = 0;

// ─── WIN DETECTION ────────────────────────────────────────────────────────────
export function checkWin(board, row, col, player, mode) {
  const DIRS = [[0,1],[1,0],[1,1],[1,-1]];
  for (const [dr, dc] of DIRS) {
    const result = countLine(board, row, col, dr, dc, player);
    if (mode === MODE_FREE) {
      if (result.count >= WIN_COUNT) return true;
    } else {
      if (result.count >= WIN_COUNT && result.openEnds >= 1) return true;
    }
  }
  return false;
}

function countLine(board, row, col, dr, dc, player) {
  let count = 1;
  let openEnds = 0;

  let r = row + dr, c = col + dc;
  while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === player) {
    count++; r += dr; c += dc;
  }
  if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && isEmptyCell(board[r][c])) openEnds++;

  r = row - dr; c = col - dc;
  while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === player) {
    count++; r -= dr; c -= dc;
  }
  if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && isEmptyCell(board[r][c])) openEnds++;

  return { count, openEnds };
}

function isEmptyCell(val) {
  return !val || val === EMPTY;
}

export function emptyBoard() {
  return Array(BOARD_SIZE * BOARD_SIZE).fill(EMPTY);
}

export function flatToGrid(flat) {
  const grid = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    grid.push(flat.slice(r * BOARD_SIZE, (r + 1) * BOARD_SIZE));
  }
  return grid;
}

export function cellIdx(row, col) {
  return row * BOARD_SIZE + col;
}

// ─── ROOM OPERATIONS ─────────────────────────────────────────────────────────
function genRoomId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export async function createCaroRoom(hostName, mode) {
  const roomId = genRoomId();
  await set(ref(db, `rooms/${roomId}`), {
    status: "waiting",
    gameType: "caro",
    players: {
      player1: { name: hostName, score: 0, online: true },
    },
    caro: { mode },
    createdAt: Date.now(),
  });
  return roomId;
}

export async function joinCaroRoom(roomId, playerName) {
  const snap = await get(ref(db, `rooms/${roomId}`));
  if (!snap.exists()) throw new Error("Phòng không tồn tại!");

  const room = snap.val();
  if (room.status === "playing")    throw new Error("Game đang diễn ra!");
  if (room.status === "dissolved")  throw new Error("Phòng đã đóng!");
  if (room.gameType !== "caro")     throw new Error("Phòng này không phải caro!");

  const players = room.players || {};
  if (Object.keys(players).length >= 2) throw new Error("Phòng đã đầy (2/2)!");

  await update(ref(db, `rooms/${roomId}`), {
    "players/player2": { name: playerName, score: 0, online: true },
    status: "ready",
  });

  return "player2";
}

export async function startCaroGame(roomId) {
  const snap = await get(ref(db, `rooms/${roomId}`));
  const room = snap.val();
  const mode = room.caro?.mode ?? MODE_FREE;
  const players = room.players || {};
  const roles = Object.keys(players);

  const roundNumber = (room.caro?.roundNumber ?? 0) + 1;
  const swap = roundNumber % 2 === 0;

  const symbols = {};
  roles.forEach((r, i) => {
    let base = i % 2 === 0 ? "X" : "O";
    symbols[r] = swap ? (base === "X" ? "O" : "X") : base;
  });

  const firstRole = roles.find(r => symbols[r] === "X") ?? roles[0];

  await update(ref(db, `rooms/${roomId}`), {
    status: "playing",
    "caro/board": emptyBoard(),
    "caro/currentTurn": firstRole,
    "caro/symbols": symbols,
    "caro/winner": null,
    "caro/winnerRole": null,
    "caro/moveCount": 0,
    "caro/lastMove": null,
    "caro/moveHistory": [],
    "caro/roundOver": false,
    "caro/rematch": null,
    "caro/undoRequest": null,
    "caro/roundNumber": roundNumber,
    "caro/turnStartedAt": Date.now(),
  });
}

export async function makeMove(roomId, playerRole, row, col) {
  const snap = await get(ref(db, `rooms/${roomId}`));
  const room = snap.val();
  const caro = room.caro;

  if (!caro || caro.roundOver) return;
  if (caro.currentTurn !== playerRole) return;

  const idx = cellIdx(row, col);
  const boardRaw = caro.board ?? [];

  if (!isEmptyCell(boardRaw[idx])) return;

  const symbol = caro.symbols[playerRole];

  const newBoard = Array(BOARD_SIZE * BOARD_SIZE).fill(EMPTY);
  for (let i = 0; i < newBoard.length; i++) {
    if (!isEmptyCell(boardRaw[i])) newBoard[i] = boardRaw[i];
  }
  newBoard[idx] = symbol;

  const grid = flatToGrid(newBoard);
  const mode = caro.mode ?? MODE_FREE;
  const won = checkWin(grid, row, col, symbol, mode);

  const roles = Object.keys(room.players);
  const currentIdx = roles.indexOf(playerRole);
  const nextRole = roles[(currentIdx + 1) % roles.length];
  const moveEntry = { row, col, role: playerRole, symbol };
  const newHistory = [...(caro.moveHistory ?? []), moveEntry];
  const moveCount = newHistory.length;
  const isDraw = !won && newBoard.every(v => !isEmptyCell(v));

  const updates = {
    "caro/board": newBoard,
    "caro/lastMove": { row, col, role: playerRole },
    "caro/moveCount": moveCount,
    "caro/moveHistory": newHistory,
    "caro/undoRequest": null, // xóa request cũ nếu có khi đi nước mới
  };

  if (won) {
    updates["caro/winner"] = symbol;
    updates["caro/winnerRole"] = playerRole;
    updates["caro/roundOver"] = true;
  } else if (isDraw) {
    updates["caro/winner"] = "draw";
    updates["caro/roundOver"] = true;
  } else {
    updates["caro/currentTurn"] = nextRole;
    updates["caro/turnStartedAt"] = Date.now();
  }

  if (won) {
    updates[`players/${playerRole}/score`] = (room.players[playerRole]?.score ?? 0) + 1;
  }

  await update(ref(db, `rooms/${roomId}`), updates);
}

// ─── UNDO ─────────────────────────────────────────────────────────────────────

// Người đang chờ (không phải lượt mình) gửi yêu cầu đi lại
export async function requestUndo(roomId, playerRole) {
  await update(ref(db, `rooms/${roomId}`), {
    "caro/undoRequest": playerRole,
  });
}

// Đối thủ phản hồi: accept=true thì xóa nước cuối của requester, trả lượt về
export async function respondUndo(roomId, accept) {
  if (!accept) {
    await update(ref(db, `rooms/${roomId}`), { "caro/undoRequest": null });
    return;
  }

  const snap = await get(ref(db, `rooms/${roomId}`));
  const room = snap.val();
  const caro = room.caro;
  if (!caro || !caro.undoRequest) return;

  const requester = caro.undoRequest;
  const history = caro.moveHistory ?? [];

  // Tìm nước cuối cùng của requester và xóa đi
  let removedIdx = -1;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === requester) { removedIdx = i; break; }
  }
  if (removedIdx === -1) {
    await update(ref(db, `rooms/${roomId}`), { "caro/undoRequest": null });
    return;
  }

  const newHistory = history.filter((_, i) => i !== removedIdx);

  // Rebuild board từ history mới
  const newBoard = emptyBoard();
  newHistory.forEach(({ row, col, symbol }) => {
    newBoard[cellIdx(row, col)] = symbol;
  });

  const lastEntry = newHistory.length > 0 ? newHistory[newHistory.length - 1] : null;

  await update(ref(db, `rooms/${roomId}`), {
    "caro/board": newBoard,
    "caro/moveHistory": newHistory,
    "caro/moveCount": newHistory.length,
    "caro/lastMove": lastEntry ? { row: lastEntry.row, col: lastEntry.col, role: lastEntry.role } : null,
    "caro/currentTurn": requester,
    "caro/turnStartedAt": Date.now(),
    "caro/undoRequest": null,
  });
}

// ─── REMATCH / PRESENCE ──────────────────────────────────────────────────────

export async function requestCaroRematch(roomId, playerRole) {
  await update(ref(db, `rooms/${roomId}`), {
    [`caro/rematch/${playerRole}`]: true,
  });
  const snap = await get(ref(db, `rooms/${roomId}`));
  const room = snap.val();
  const rematch = room.caro?.rematch || {};
  const players = room.players || {};
  const allReady = Object.keys(players).every(r => rematch[r] === true);
  if (allReady) await startCaroGame(roomId);
}

export async function setCaroPlayerOnline(roomId, playerRole, online) {
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
  } catch (e) {}
}