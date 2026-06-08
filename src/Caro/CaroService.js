import { db } from "../firebase";
import { ref, set, get, update, onValue } from "firebase/database";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
export const BOARD_SIZE = 15;
export const WIN_COUNT  = 5;

// Game mode types
export const MODE_FREE  = "free";   // Caro tự do (không chặn 2 đầu)
export const MODE_BLOCK = "block";  // Caro chặn 2 đầu (cần chính xác 5, không bị chặn cả 2 đầu)

// ─── WIN DETECTION ────────────────────────────────────────────────────────────
/**
 * Check if placing at (row, col) wins the game.
 * mode = "free"  → 5 in a row is always a win (including 6+)
 * mode = "block" → exactly-5 AND at least one open end required
 */
export function checkWin(board, row, col, player, mode) {
  const DIRS = [[0,1],[1,0],[1,1],[1,-1]];

  for (const [dr, dc] of DIRS) {
    const result = countLine(board, row, col, dr, dc, player);
    if (mode === MODE_FREE) {
      if (result.count >= WIN_COUNT) return true;
    } else {
      // MODE_BLOCK: cần đúng 5 và ít nhất 1 đầu mở
      if (result.count >= WIN_COUNT && result.openEnds >= 1) return true;
    }
  }
  return false;
}

function countLine(board, row, col, dr, dc, player) {
  let count = 1;
  let openEnds = 0;

  // Forward direction
  let r = row + dr, c = col + dc;
  while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === player) {
    count++; r += dr; c += dc;
  }
  if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === null) openEnds++;

  // Backward direction
  r = row - dr; c = col - dc;
  while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === player) {
    count++; r -= dr; c -= dc;
  }
  if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === null) openEnds++;

  return { count, openEnds };
}

/**
 * Build empty board (15x15 of nulls, stored as flat array for Firebase compat)
 */
export function emptyBoard() {
  return Array(BOARD_SIZE * BOARD_SIZE).fill(null);
}

export function flatToGrid(flat) {
  const grid = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    grid.push(flat.slice(r * BOARD_SIZE, (r + 1) * BOARD_SIZE));
  }
  return grid;
}

export function gridToFlat(grid) {
  return grid.flat();
}

export function cellIdx(row, col) {
  return row * BOARD_SIZE + col;
}

// ─── ROOM OPERATIONS ─────────────────────────────────────────────────────────
export async function createCaroRoom(hostName, mode) {
  const { createRoom } = await import("../roomService");
  const roomId = await createRoom(hostName);
  // Tag this room as caro with selected mode
  await update(ref(db, `rooms/${roomId}`), {
    gameType: "caro",
    "caro/mode": mode,
  });
  return roomId;
}

export async function startCaroGame(roomId) {
  const snap = await get(ref(db, `rooms/${roomId}`));
  const room = snap.val();
  const mode = room.caro?.mode ?? MODE_FREE;
  const players = room.players || {};
  const roles = Object.keys(players);

  // Assign symbols: player1 = X (black), player2 = O (white), 3/4 wait
  const symbols = {};
  roles.forEach((r, i) => { symbols[r] = i % 2 === 0 ? "X" : "O"; });

  await update(ref(db, `rooms/${roomId}`), {
    status: "playing",
    "caro/board": emptyBoard(),
    "caro/currentTurn": roles[0],
    "caro/symbols": symbols,
    "caro/winner": null,
    "caro/winnerRole": null,
    "caro/winLine": null,
    "caro/moveCount": 0,
    "caro/lastMove": null,
    "caro/roundOver": false,
    "caro/rematch": null,
  });
}

export async function makeMove(roomId, playerRole, row, col) {
  const snap = await get(ref(db, `rooms/${roomId}`));
  const room = snap.val();
  const caro = room.caro;

  if (!caro || caro.roundOver) return;
  if (caro.currentTurn !== playerRole) return;

  const idx = cellIdx(row, col);
  if (caro.board[idx] !== null) return;

  const symbol = caro.symbols[playerRole];
  const newBoard = [...caro.board];
  newBoard[idx] = symbol;

  const grid = flatToGrid(newBoard);
  const mode = caro.mode ?? MODE_FREE;
  const won = checkWin(grid, row, col, symbol, mode);

  const roles = Object.keys(room.players);
  const currentIdx = roles.indexOf(playerRole);
  const nextRole = roles[(currentIdx + 1) % roles.length];
  const moveCount = (caro.moveCount ?? 0) + 1;
  const isDraw = !won && moveCount >= BOARD_SIZE * BOARD_SIZE;

  const updates = {
    "caro/board": newBoard,
    "caro/lastMove": { row, col, role: playerRole },
    "caro/moveCount": moveCount,
  };

  if (won) {
    updates["caro/winner"] = symbol;
    updates["caro/winnerRole"] = playerRole;
    updates["caro/roundOver"] = true;
    // Update score
    const currentScore = room.players[playerRole]?.score ?? 0;
    updates[`players/${playerRole}/score`] = currentScore + 1;
  } else if (isDraw) {
    updates["caro/winner"] = "draw";
    updates["caro/roundOver"] = true;
  } else {
    updates["caro/currentTurn"] = nextRole;
  }

  await update(ref(db, `rooms/${roomId}`), updates);
}

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