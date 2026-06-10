import { db } from "../firebase";
import { ref, update, get } from "firebase/database";

export const LUDO_COLORS = ["r", "g", "y", "b"];

// ─── BOARD DATA ───────────────────────────────────────────────────────────────
// POINTS[i] = [row, col] — derived from jQuery source by swapping [col, row]
// Board is a 15×15 grid (600px / 40px per cell)
// getPawnPixel in LudoApp uses pt[0]=row(Y), pt[1]=col(X)
export const POINTS = [
    // Main path: indices 0–54
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 6],           // 0–6   (left side going right, row 8)
    [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6],             // 7–12  (going down col 6)
    [14, 7], [14, 8],                                         // 13–14 (bottom-right corner)
    [13, 8], [12, 8], [11, 8], [10, 8], [9, 8], [8, 8],              // 15–20 (going up col 8)
    [8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14],             // 21–26 (going right row 8)
    [7, 14], [6, 14],                                         // 27–28 (right corner)
    [6, 13], [6, 12], [6, 11], [6, 10], [6, 9], [6, 8],              // 29–34 (going left row 6)
    [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],                  // 35–40 (going up col 8)
    [0, 7], [0, 6],                                           // 41–42 (top-left corner)
    [1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 6],                  // 43–48 (going down col 6)
    [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0],                  // 49–54 (going left row 6)
    // Index 55: entry to red home column
    [7, 0],                                                 // 55
    // Red home column: row 7, cols 1–6 (indices 56–61)
    [7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6],                  // 56–61
    // Green home column: col 7, rows 13–8 (indices 62–67)
    [13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7],              // 62–67
    // Yellow home column: row 7, cols 13–8 (indices 68–73)
    [7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8],              // 68–73
    // Blue home column: col 7, rows 1–6 (indices 74–79)
    [1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7],                  // 74–79
    // Red (bottom-left)
    [10, 1], [10, 4], [13, 1], [13, 4],   // 80–83

    // Green (bottom-right)
    [10, 10], [10, 13], [13, 10], [13, 13], // 84–87

    // Yellow (top-right)
    [1, 10], [1, 13], [4, 10], [4, 13],   // 88–91

    // Blue (top-left)
    [1, 1], [1, 4], [4, 1], [4, 4],       // 92–95
];

export const START_POSITIONS = {
    r: [80, 81, 82, 83],
    g: [84, 85, 86, 87],
    y: [88, 89, 90, 91],
    b: [92, 93, 94, 95],
};

// Full path each color travels (62 steps: 56 common + 6 home column)
export const PATH = {
    r: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61],
    g: [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 62, 63, 64, 65, 66, 67],
    y: [28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 68, 69, 70, 71, 72, 73],
    b: [42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79],
};

// Star/safe squares where pawns cannot be captured
export const SAFE_SQUARES = new Set([0, 8, 13, 21, 26, 34, 39, 47, 52]);

// ─── PURE GAME LOGIC ─────────────────────────────────────────────────────────

export function rollDie() {
    return Math.floor(Math.random() * 6) + 1;
}

export function isSecondChance(dice) {
    if (!dice || dice.length === 0) return false;
    if (dice.length === 1) return dice[0] === 6 || dice[0] === 1;
    // Two dice: doubles, or 1+6 / 6+1
    return (
        dice[0] === dice[1] ||
        (dice[0] === 1 && dice[1] === 6) ||
        (dice[0] === 6 && dice[1] === 1)
    );
}

export function shouldPassTurn(dice) {
    return !isSecondChance(dice);
}

/**
 * Calculate all legal moves for the current player.
 * @param {Array}  pawns      - array of pawn objects for current player
 * @param {Array}  dice       - rolled dice values e.g. [4]
 * @param {string} color      - 'r'|'g'|'y'|'b'
 * @param {object} cachePath  - map of boardPosition → {id, color, slot} | null
 * @returns {Array} moves     - [{pawnId, startIndex, distance, captureId}]
 */
export function calcAvailableMoves(pawns, dice, color, cachePath) {
    const moves = [];
    const pathArr = PATH[color];
    const diceSum = dice.reduce((a, b) => a + b, 0);
    const canEnter = isSecondChance(dice);

    for (const pawn of pawns) {
        if (pawn.complete) continue;

        // ----- INACTIVE pawn (still in the yard) -----
        if (!pawn.active) {
            if (!canEnter) continue;                     // need 6 or 1 to enter
            const entryPos = pathArr[0];
            const blocker = cachePath?.[entryPos];
            if (!blocker || blocker === null) {
                // empty entry square → can enter
                moves.push({ pawnId: pawn.id, startIndex: 0, distance: 0, captureId: null });
            } else if (blocker.color !== color && !SAFE_SQUARES.has(entryPos)) {
                // enemy on entry and it's NOT a safe square → can capture
                moves.push({ pawnId: pawn.id, startIndex: 0, distance: 0, captureId: blocker.id });
            }
            // own pawn on entry OR enemy on a safe entry → blocked
            continue;
        }

        // ----- ACTIVE pawn (already on the track) -----
        const curIdx = pathArr.indexOf(pawn.position);
        if (curIdx === -1) continue;                     // should never happen
        const newIdx = curIdx + diceSum;
        if (newIdx >= pathArr.length) continue;          // overshoot → illegal

        let blocked = false;
        let captureId = null;

        // sweep every square we would pass over (including the landing square)
        for (let i = curIdx + 1; i <= newIdx; i++) {
            const sq = pathArr[i];
            const occ = cachePath?.[sq];

            if (!occ || occ === null) continue;          // empty → fine

            if (occ.color === color) {
                // own pawn blocks the path
                blocked = true;
                break;
            }
            if (i < newIdx) {
                // enemy in the middle → cannot jump over
                blocked = true;
                break;
            }
            // i === newIdx → enemy exactly on the landing square
            if (SAFE_SQUARES.has(sq)) {
                // landing on a safe square with an enemy → treat as blocked
                blocked = true;
                break;
            }
            // enemy on a normal square → we can capture it
            captureId = occ.id;
        }

        if (blocked) continue;                           // move not possible
        moves.push({ pawnId: pawn.id, startIndex: curIdx + 1, distance: diceSum, captureId });
    }

    return moves;
}

// ─── FIREBASE FUNCTIONS ───────────────────────────────────────────────────────

export async function startLudoGame(roomId) {
    const snap = await get(ref(db, `rooms/${roomId}`));
    const room = snap.val();
    const players = room.players || {};
    const playerSlots = Object.keys(players);

    const SLOT_COLORS = ["r", "g", "y", "b"];
    const colorMap = {};
    playerSlots.forEach((slot, i) => {
        colorMap[slot] = SLOT_COLORS[i];
    });

    const playerData = {};
    playerSlots.forEach(slot => {
        const color = colorMap[slot];
        playerData[slot] = {
            color,
            score: 0,
            pawns: START_POSITIONS[color].map((pos, i) => ({
                id: i + 1,
                color,
                active: false,
                position: pos,
                complete: false,
            })),
        };
    });

    await update(ref(db, `rooms/${roomId}`), {
        status: "playing",
        ludo: {
            playerData,
            colorMap,
            currentTurn: playerSlots[0],
            dice: [],
            phase: "roll",
            roundOver: false,
            winner: null,
            cachePath: {},
            rematch: {},
        },
    });
}

export async function rollDiceFirebase(roomId, role) {
    const snap = await get(ref(db, `rooms/${roomId}/ludo`));
    const ludo = snap.val();
    if (!ludo || ludo.currentTurn !== role || ludo.phase !== "roll") return;

    const dice = [rollDie()];
    await update(ref(db, `rooms/${roomId}/ludo`), {
        dice,
        phase: "move",
        lastRolledBy: role,
    });
}

export async function movePawn(roomId, role, move) {
    const snap = await get(ref(db, `rooms/${roomId}/ludo`));
    const ludo = snap.val();
    if (!ludo) return;

    const pd = ludo.playerData[role];
    const color = pd.color;
    const pathArr = PATH[color];
    const dice = ludo.dice;
    const diceSum = dice.reduce((a, b) => a + b, 0);
    const newCache = { ...(ludo.cachePath || {}) };

    // Clone pawns
    const pawns = pd.pawns.map(p => ({ ...p }));
    const pawnIdx = pawns.findIndex(p => p.id === move.pawnId);
    const pawn = { ...pawns[pawnIdx] };

    // Remove pawn from old cache position
    if (pawn.active) {
        newCache[pawn.position] = null;
    }

    if (!pawn.active) {
        // Entering the board
        pawn.active = true;
        pawn.position = pathArr[0];
    } else {
        // Move forward
        const curIdx = pathArr.indexOf(pawn.position);
        const newIdx = curIdx + diceSum;
        pawn.position = pathArr[newIdx];

        // Last position in path = home center → complete
        if (newIdx === pathArr.length - 1) {
            pawn.complete = true;
            pawn.active = false;
            // Don't occupy the final (shared center) square in cache
        }
    }

    // Place pawn in new cache position (unless complete)
    if (!pawn.complete) {
        newCache[pawn.position] = { id: pawn.id, color, slot: role };
    }

    pawns[pawnIdx] = pawn;

    const updates = {};

    // Handle capture
    if (move.captureId && !SAFE_SQUARES.has(pawn.position)) {
        for (const [slot, slotPd] of Object.entries(ludo.playerData)) {
            if (slot === role) continue;
            const capIdx = slotPd.pawns.findIndex(
                p => p.id === move.captureId && p.color === slotPd.color
            );
            if (capIdx < 0) continue;

            const capPawn = { ...slotPd.pawns[capIdx] };
            newCache[capPawn.position] = null;
            capPawn.active = false;
            capPawn.position = START_POSITIONS[slotPd.color][capPawn.id - 1];

            const newSlotPawns = slotPd.pawns.map((p, i) => (i === capIdx ? capPawn : p));
            updates[`ludo/playerData/${slot}/pawns`] = newSlotPawns;
            break;
        }
    }

    updates[`ludo/playerData/${role}/pawns`] = pawns;
    updates[`ludo/cachePath`] = newCache;

    // Check win
    const allComplete = pawns.every(p => p.complete);
    if (allComplete) {
        updates[`ludo/roundOver`] = true;
        updates[`ludo/winner`] = role;
        updates[`ludo/phase`] = "done";
        updates[`ludo/playerData/${role}/score`] = (pd.score || 0) + 1;
    } else {
        // Determine next turn
        const pass = shouldPassTurn(dice);
        if (pass) {
            const playerSlots = Object.keys(ludo.playerData);
            const curIdx = playerSlots.indexOf(role);
            const nextIdx = (curIdx + 1) % playerSlots.length;
            updates[`ludo/currentTurn`] = playerSlots[nextIdx];
        }
        // If not passing (rolled 6 or 1), same player rolls again
        updates[`ludo/dice`] = [];
        updates[`ludo/phase`] = "roll";
    }

    await update(ref(db, `rooms/${roomId}`), updates);
}

export async function passTurnFirebase(roomId, role) {
    const snap = await get(ref(db, `rooms/${roomId}/ludo`));
    const ludo = snap.val();
    if (!ludo) return;

    const playerSlots = Object.keys(ludo.playerData);
    const curIdx = playerSlots.indexOf(role);
    const nextIdx = (curIdx + 1) % playerSlots.length;

    await update(ref(db, `rooms/${roomId}/ludo`), {
        currentTurn: playerSlots[nextIdx],
        dice: [],
        phase: "roll",
    });
}

export async function requestLudoRematch(roomId, role) {
    await update(ref(db, `rooms/${roomId}/ludo/rematch`), { [role]: true });

    const snap = await get(ref(db, `rooms/${roomId}`));
    const room = snap.val();
    const playerCount = Object.keys(room.players || {}).length;
    const rematchCount = Object.keys(room.ludo?.rematch || {}).length + 1;

    if (rematchCount >= playerCount) {
        await startLudoGame(roomId);
    }
}