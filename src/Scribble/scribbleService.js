import { db } from "../firebase";
import { ref, set, get, update, remove, push, runTransaction, onValue } from "firebase/database";
import { WORD_PACKAGES } from "./words";

/* ─────────────────────────────────────────────
   Scribble It — Service (Firebase Realtime DB)
   Mọi thao tác game đọc/ghi vào nhánh
   rooms/{roomId}/game (state lượt − từ − điểm),
   rooms/{roomId}/strokes (nét vẽ, tách riêng để
   không re-render nặng) và rooms/{roomId}/chat.

   Tầng `game` DÙNG CHUNG `game: null` của roomService
   như WordChain — không viết lại logic tạo phòng/slot.
───────────────────────────────────────────── */

export const MODE_CLASSIC = "classic";

export const WORD_CHOICE_SECONDS = 15;   // giới hạn chọn từ (mục 2.2)
export const ROUND_END_MS = 4500;        // hiện đáp án trước khi chuyển lượt

export const MAX_SCORE = 100;
export const MIN_SCORE = 10;
export const DRAWER_CUT = 0.5;      // người vẽ nhận 50% tổng điểm người đoán kiếm được
export const ORDER_BONUS = [15, 10, 5];  // bonus thứ tự đoán 1st/2nd/3rd

export const CUSTOM_CATEGORY = "Gói tuỳ chỉnh";
export const SLOT_ORDER = ["player1", "player2", "player3", "player4", "player5", "player6"];

/* Difficulty: ảnh hưởng thời gian lượt vẽ + nhịp mở gợi ý chữ cái */
export const DIFFICULTY = {
  easy:   { label: "Dễ",   duration: 150, hintInterval: 9000,  maxReveals: 6, hearts: 5 },
  normal: { label: "Vừa",  duration: 120, hintInterval: 12000, maxReveals: 4, hearts: 4 },
  hard:   { label: "Khó",  duration: 90,  hintInterval: 15000, maxReveals: 3, hearts: 3 },
};

/* Cỡ nét lưu dưới dạng tỉ lệ (0..1) theo min(canvas w,h) để mọi client
   có kích thước màn hình khác nhau vẫn ra nét tương đối giống nhau */
export const SIZE_LEVELS = [0.006, 0.012, 0.02];

export const PALETTE = [
  "#000000", "#7f7f7f", "#d9d9d9", "#ffffff",
  "#b5121b", "#e76f00", "#f2d50f", "#9acd32",
  "#2f9e44", "#13b5a9", "#2f9ece", "#1f5fc0",
  "#5f3dc4", "#9c36b5", "#e64980", "#ff8fab",
  "#866e01", "#6b4f2a", "#95613b", "#c18153",
  "#4dabf7", "#74c0fc", "#a5d8ff", "#dee2e6",
];

/* ── Tiện ích ─────────────────────────────── */

// So khớp đáp án: bỏ sign/dấu cách thừa, không phân biệt hoa/thường/dấu.
export function normalizeAnswer(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function letterCount(word) {
  return String(word || "")
    .split("")
    .filter(c => c !== " " && c !== "\u00a0").length;
}

// Trả về mảng các từ, mỗi từ là mảng { ch, revealed } để render ô gạch dưới.
export function getMaskLayout(word, hints = []) {
  const hinted = new Set(hints || []);
  let i = 0;
  return String(word || "")
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w.split("").map(ch => {
      const revealed = hinted.has(i);
      i += 1;
      return { ch, revealed };
    }));
}

export function maskWord(word, hints = []) {
  return getMaskLayout(word, hints)
    .map(w => w.map(l => (l.revealed ? l.ch : "_")).join(" "))
    .join("   ");
}

/* ── Chọn từ (mục 2.2 & 2.3) ──────────────── */

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function lengthFilter(difficultyId) {
  if (difficultyId === "easy") return c => letterCount(c.word) <= 10;
  if (difficultyId === "hard") return c => letterCount(c.word) >= 8;
  return () => true;
}

function pickWordChoicesFor(game) {
  const diff = game.difficulty || "normal";
  const used = new Set((game.usedWords || []).map(w => normalizeAnswer(w)));
  const customs = Array.isArray(game.customWords) ? game.customWords.map(s => String(s).trim()).filter(Boolean) : [];
  // Chế độ ngẫu nhiên: bỏ qua chọn chủ đề → rút từ TẤT CẢ các gói có sẵn.
  const pkgIds = game.randomTopic ? Object.keys(WORD_PACKAGES) : (game.wordPackages || []);

  // Gom từ theo chủ đề: mỗi gói từ = 1 chủ đề, danh sách tuỳ chỉnh = 1 chủ đề riêng.
  const groups = [];
  const pushGroup = (category, words) => {
    const list = words
      .filter(c => !used.has(normalizeAnswer(c.word)))
      .filter(lengthFilter(diff));
    if (list.length) groups.push({ category, words: shuffle(list) });
  };
  pkgIds.forEach(id => {
    const pkg = WORD_PACKAGES[id];
    if (pkg) pushGroup(pkg.label, pkg.words.map(w => ({ word: w, category: pkg.label })));
  });
  if (!game.randomTopic && customs.length) pushGroup(CUSTOM_CATEGORY, customs.map(w => ({ word: w, category: CUSTOM_CATEGORY })));

  // Cạn từ đã dùng trong các nhóm → bỏ lọc used nhưng vẫn giữ 3 chủ đề khác nhau.
  if (!groups.length) {
    pkgIds.forEach(id => {
      const pkg = WORD_PACKAGES[id];
      if (pkg) pushGroup(pkg.label, pkg.words.map(w => ({ word: w, category: pkg.label })));
    });
    if (!game.randomTopic && customs.length) pushGroup(CUSTOM_CATEGORY, customs.map(w => ({ word: w, category: CUSTOM_CATEGORY })));
  }
  if (!groups.length) return [];

  const chosen = [];
  const order = shuffle(groups.map((_, i) => i));
  // Lần 1: mỗi gói 1 từ → 3 từ thuộc 3 chủ đề khác nhau.
  let k = 0;
  while (chosen.length < 3 && k < order.length) {
    const g = groups[order[k]];
    const w = g.words.shift();
    if (w) chosen.push({ word: w.word, category: g.category });
    k += 1;
  }
  // Lần 2: ít hơn 3 chủ đề → vét thêm từ các nhóm còn lại để luôn đủ 3.
  let s = 0;
  while (chosen.length < 3 && s < groups.length * 4) {
    const g = groups[s % groups.length];
    const w = g.words.shift();
    if (w) chosen.push({ word: w.word, category: g.category });
    s += 1;
  }
  const seen = new Set();
  return chosen.filter(c => {
    const key = normalizeAnswer(c.word);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Random 3 từ + đặt deadline chọn từ. Transaction để tránh 2 client ghi đè.
export async function pickWordChoices(roomId) {
  const result = await runTransaction(ref(db, `rooms/${roomId}/game`), (game) => {
    if (!game) return;
    if (game.phase !== "choosingWord") return;
    const choices = pickWordChoicesFor(game);
    if (!choices.length) return;
    game.wordChoices = choices;
    game.wordChoiceDeadline = Date.now() + WORD_CHOICE_SECONDS * 1000;
    return game;
  });
  return result?.snapshot?.val();
}

function startDrawingState(game, word, category) {
  game.wordChoices = [];
  game.wordChoiceDeadline = 0;
  game.usedWords = [...(game.usedWords || []), word];
  game.currentWord = word;
  game.currentWordCategory = category;
  game.phase = "drawing";
  game.roundStartedAt = Date.now();
  game.roundDuration = DIFFICULTY[game.difficulty].duration;
  game.hintsRevealed = [];
  game.correctGuessers = [];
  game.correctOrder = [];
  game.currentWordMasked = maskWord(word, []);
  game.guessFeedback = null;
  // Mỗi lượt: mỗi người đoán riêng có N tim theo độ khó; sai/gần đúng -1.
  const maxHearts = DIFFICULTY[game.difficulty]?.hearts ?? 5;
  game.hearts = {};
  (game.turnOrder || []).forEach(s => {
    if (s !== game.drawerSlot) game.hearts[s] = maxHearts;
  });
}

// Drawer chọn từ (hoặc system auto-chọn hộ khi hết giờ).
export async function chooseWord(roomId, slot, choice) {
  const result = await runTransaction(ref(db, `rooms/${roomId}/game`), (game) => {
    if (!game || game.phase !== "choosingWord" || game.drawerSlot !== slot) return;
    const valid = (game.wordChoices || []).find(c => c.word === choice?.word);
    if (!valid) return;
    startDrawingState(game, valid.word, valid.category);
    return game;
  });
  return result?.snapshot?.val();
}

// Client nào phát hiện deadline chọn từ đã hết trước sẽ gọi hàm này —
// transaction idempotent nên nhiều client cùng gọi vẫn an toàn, lượt không bị treo.
export async function autoChooseWordIfExpired(roomId) {
  const result = await runTransaction(ref(db, `rooms/${roomId}/game`), (game) => {
    if (!game || game.phase !== "choosingWord") return;
    if (!game.wordChoiceDeadline || Date.now() < game.wordChoiceDeadline) return;
    const choices = game.wordChoices || [];
    if (!choices.length) return;
    const pick = choices[Math.floor(Math.random() * choices.length)];
    startDrawingState(game, pick.word, pick.category);
    return game;
  });
  return result?.snapshot?.val();
}

/* ── Bắt đầu / Rematch ────────────────────── */

export async function startScribbleGame(roomId, settings = {}) {
  const snap = await get(ref(db, `rooms/${roomId}`));
  const room = snap.val();
  if (!room) return null;
  const players = room.players || {};
  const roles = SLOT_ORDER.filter(r => players[r]);
  if (roles.length < 2) return null;

  const difficulty = DIFFICULTY[settings.difficulty] ? settings.difficulty : "normal";
  const scores = {};
  roles.forEach(r => { scores[r] = 0; });

  const game = {
    type: "scribble",
    mode: settings.mode || MODE_CLASSIC,
    maxRounds: Math.max(1, Math.min(6, Number(settings.maxRounds) || 3)),
    difficulty,
    wordPackages: settings.wordPackages || [],
    randomTopic: !!settings.randomTopic,
    customWords: (settings.customWords || []).slice(0, 60),
    turnOrder: roles,
    turnIndex: 0,
    drawerSlot: roles[0],
    round: 1,
    phase: "choosingWord",
    wordChoices: [],
    wordChoiceDeadline: Date.now() + WORD_CHOICE_SECONDS * 1000,
    currentWord: null,
    currentWordCategory: null,
    currentWordMasked: "",
    roundDuration: DIFFICULTY[difficulty].duration,
    roundStartedAt: 0,
    hintsRevealed: [],
    usedWords: [],
    scores,
    correctGuessers: [],
    correctOrder: [],
    typingIndicator: {},
    roundEndAt: 0,
    guessFeedback: null,
  };

  const reset = {};
  roles.forEach(r => { reset[`players/${r}/rematch`] = false; });

  await update(ref(db, `rooms/${roomId}`), { status: "playing", game, ...reset });
  await pickWordChoices(roomId);
  return roomId;
}

// Dùng lại field `rematch` có sẵn trong player. Khi cả phòng sẵn sàng → chơi lại.
export async function requestScribbleRematch(roomId, slot) {
  await set(ref(db, `rooms/${roomId}/players/${slot}/rematch`), true);
  const snap = await get(ref(db, `rooms/${roomId}`));
  const room = snap.val();
  if (!room) return false;
  const players = room.players || {};
  const allReady = Object.keys(players).every(r => players[r]?.rematch === true);
  if (!allReady) return false;
  const g = room.game || {};
  await startScribbleGame(roomId, {
    mode: g.mode || MODE_CLASSIC,
    maxRounds: g.maxRounds || 3,
    difficulty: g.difficulty || "normal",
    wordPackages: g.wordPackages || [],
    randomTopic: !!g.randomTopic,
    customWords: g.customWords || [],
  });
  return true;
}

/* ── Nét vẽ ───────────────────────────────── */

export async function pushStroke(roomId, stroke) {
  await push(ref(db, `rooms/${roomId}/strokes`), {
    tool: stroke.tool || "pen",
    points: stroke.points || [],
    from: stroke.from || null,
    to: stroke.to || null,
    color: stroke.color || "#000000",
    size: stroke.size ?? SIZE_LEVELS[1],
    slot: stroke.slot || "",
    undone: false,
    ts: Date.now(),
  });
}

// Ghi đè liên tục (throttle ~40–60ms ở client) để các client theo dõi
// thấy nét vẽ gần như tức thời; dọn khi nhả chuột.
export async function setLiveStroke(roomId, slot, stroke) {
  await set(ref(db, `rooms/${roomId}/strokes/_live/${slot}`), {
    tool: stroke.tool,
    points: stroke.points,
    from: stroke.from || null,
    to: stroke.to || null,
    color: stroke.color,
    size: stroke.size,
    slot,
    ts: Date.now(),
  });
}

export async function clearLiveStroke(roomId, slot) {
  await remove(ref(db, `rooms/${roomId}/strokes/_live/${slot}`));
}

async function isDrawer(roomId, slot) {
  const snap = await get(ref(db, `rooms/${roomId}/game/drawerSlot`));
  return snap.val() === slot;
}

// Undo/Redo KHÔNG xoá stroke khỏi DB — chỉ set undone:true/false để
// renderer bỏ qua khi replay; chỉ drawer được phép gọi.
export async function undoLastStroke(roomId, slot) {
  if (!(await isDrawer(roomId, slot))) return;
  const snap = await get(ref(db, `rooms/${roomId}/strokes`));
  const entries = Object.entries(snap.val() || {}).filter(([k]) => !k.startsWith("_"));
  entries.sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const last = [...entries].reverse().find(([, s]) => !s.undone);
  if (last) await update(ref(db, `rooms/${roomId}/strokes/${last[0]}`), { undone: true });
}

export async function redoStroke(roomId, slot) {
  if (!(await isDrawer(roomId, slot))) return;
  const snap = await get(ref(db, `rooms/${roomId}/strokes`));
  const entries = Object.entries(snap.val() || {}).filter(([k]) => !k.startsWith("_"));
  entries.sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const last = [...entries].reverse().find(([, s]) => s.undone);
  if (last) await update(ref(db, `rooms/${roomId}/strokes/${last[0]}`), { undone: false });
}

export async function clearStrokes(roomId, slot) {
  if (!(await isDrawer(roomId, slot))) return;
  await remove(ref(db, `rooms/${roomId}/strokes`));
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[m][n];
}

/* ── Đoán & điểm (mục 2.4) ────────────────── */

// Mọi người đoán của lượt này đều "xong": đoán đúng hoặc hết tim → kết thúc vòng,
// đổi từ mới. Nhờ vậy phòng 2 người (1 vẽ 1 đoán) không bị treo vì đoán hết tim.
function allGuessersDone(game) {
  const max = DIFFICULTY[game.difficulty]?.hearts ?? 5;
  const guessers = (game.turnOrder || []).filter(s => s !== game.drawerSlot);
  if (!guessers.length) return false;
  return guessers.every(s =>
    (game.correctGuessers || []).includes(s) ||
    (Number.isFinite(game.hearts?.[s]) ? game.hearts[s] : max) <= 0
  );
}

// So khớp đáp án, tính điểm giảm dần theo thời gian + bonus thứ tự đoán,
// cộng kickback cho drawer. Transaction → ai bấm Enter trước thì tính trước.
// Trả về { status, game } với status:
//   correct = đúng hẳn (ghi nhận điểm)
//   close   = gần đúng (trừ 1 tim, chưa ghi điểm)
//   wrong   = sai hẳn (trừ 1 tim, chưa ghi điểm)
//   invalid / already = lượt không hợp lệ hoặc đã đoán đúng rồi
//   locked  = hết tim rồi (không được đoán nữa)
export async function submitGuess(roomId, slot, text) {
  const result = await runTransaction(ref(db, `rooms/${roomId}/game`), (game) => {
    if (!game) return;
    const guessNorm = normalizeAnswer(text);
    const at = Date.now();
    if (game.phase !== "drawing" || slot === game.drawerSlot) {
      game.guessFeedback = { slot, code: "invalid", at };
      return game;
    }
    if ((game.correctGuessers || []).includes(slot)) {
      game.guessFeedback = { slot, code: "already", at };
      return game;
    }
    const maxHearts = DIFFICULTY[game.difficulty]?.hearts ?? 5;
    if (!game.hearts) game.hearts = {};
    if (!Number.isFinite(game.hearts[slot])) game.hearts[slot] = maxHearts;
    // Hết tim → khóa người này lại, không trừ gì nữa.
    if (game.hearts[slot] <= 0) {
      game.guessFeedback = { slot, code: "locked", at };
      return game;
    }
    const ansNorm = normalizeAnswer(game.currentWord);
    if (!guessNorm || !ansNorm) {
      game.guessFeedback = { slot, code: "invalid", at };
      return game;
    }
    if (guessNorm !== ansNorm) {
      const dist = levenshtein(guessNorm, ansNorm);
      const closeTh = Math.max(1, Math.min(2, Math.floor(ansNorm.length / 2)));
      // Sai hoặc gần đúng → -1 tim (mỗi người chơi riêng).
      game.hearts[slot] = Math.max(0, game.hearts[slot] - 1);
      game.guessFeedback = { slot, code: dist > 0 && dist <= closeTh ? "close" : "wrong", at };
      // Hết tim của lượt người cuối còn đoán được → kết thúc vòng, đổi từ mới (không điểm).
      if (allGuessersDone(game)) {
        game.phase = "roundEnd";
        game.roundEndAt = Date.now();
      }
      return game;
    }

    const total = game.roundDuration || DIFFICULTY[game.difficulty].duration;
    const elapsed = Number(game.roundStartedAt) ? (Date.now() - Number(game.roundStartedAt)) / 1000 : 0;
    const ratio = Math.max(0, Math.min(1, (total - elapsed) / total));
    const pts = Math.round(MIN_SCORE + (MAX_SCORE - MIN_SCORE) * ratio);
    const orderLen = (game.correctOrder || []).length;
    const bonus = ORDER_BONUS[Math.min(orderLen, ORDER_BONUS.length - 1)] || 0;

    game.scores = game.scores || {};
    game.scores[slot] = (game.scores[slot] || 0) + pts + bonus;
    // Người vẽ nhận một phần theo mức điểm người đoán kiếm được → công bằng hơn so với cố định.
    game.scores[game.drawerSlot] = (game.scores[game.drawerSlot] || 0) + Math.round((pts + bonus) * DRAWER_CUT);
    game.correctGuessers = [...(game.correctGuessers || []), slot];
    game.correctOrder = [...(game.correctOrder || []), slot];
    game.guessFeedback = { slot, code: "correct", at };

    if (allGuessersDone(game)) {
      game.phase = "roundEnd";
      game.roundEndAt = Date.now();
    }
    return game;
  });

  const snap = result?.snapshot?.val();
  if (!snap) return null;
  const mine = snap.guessFeedback && snap.guessFeedback.slot === slot ? snap.guessFeedback.code : null;
  return { status: mine, game: snap };
}

// Bong bóng "..." — client tự ẩn nếu ts đã cũ quá 2–3s (không cần xoá).
const typingLastWrite = {};
export async function setTypingIndicator(roomId, slot) {
  const now = Date.now();
  if (typingLastWrite[slot] && now - typingLastWrite[slot] < 400) return;
  typingLastWrite[slot] = now;
  try {
    await set(ref(db, `rooms/${roomId}/game/typingIndicator/${slot}`), now);
  } catch { /* ignore */ }
}

export async function clearTypingIndicator(roomId, slot) {
  typingLastWrite[slot] = 0;
  try {
    await set(ref(db, `rooms/${roomId}/game/typingIndicator/${slot}`), null);
  } catch { /* ignore */ }
}

/* ── Gợi ý & chuyển lượt ──────────────────── */

// Mở dần ký tự làm gợi ý theo nhịp difficulty.
export async function revealHint(roomId) {
  const result = await runTransaction(ref(db, `rooms/${roomId}/game`), (game) => {
    if (!game || game.phase !== "drawing" || !game.currentWord) return;
    const positions = [];
    game.currentWord.split("").forEach((ch, i) => { if (ch !== " ") positions.push(i); });
    const diff = DIFFICULTY[game.difficulty] || DIFFICULTY.normal;
    const revealed = new Set(game.hintsRevealed || []);
    if (revealed.size >= Math.min(diff.maxReveals, positions.length)) return;
    const available = positions.filter(i => !revealed.has(i));
    if (!available.length) return;
    const pick = available[Math.floor(Math.random() * available.length)];
    game.hintsRevealed = [...revealed, pick].sort((a, b) => a - b);
    game.currentWordMasked = maskWord(game.currentWord, game.hintsRevealed);
    return game;
  });
  return result?.snapshot?.val();
}

/* TIMER AUTHORITY — quy ước ghi rõ để tránh nhiều client cùng ghi đè:
   client của HOST (player1) chịu trách nhiệm tick nhịp 1 giây và gọi:
     - autoChooseWordIfExpired  (hết giờ chọn từ)
     - revealHint               (mở gợi ý theo lịch)
     - advanceTurn              (hết giờ vẽ / hết thời gian hiện đáp án)
   Transaction khiến các lệnh này idempotent, nên drawer cũng gọi fallback
   autoChooseWordIfExpired nếu host mất kết nối — lượt không bao giờ treo. */

export async function advanceTurn(roomId) {
  const result = await runTransaction(ref(db, `rooms/${roomId}/game`), (game) => {
    if (!game || game.phase === "finished") return;
    const order = game.turnOrder || [];
    if (!order.length) return;
    let ti = ((game.turnIndex ?? 0) + 1) % order.length;
    let round = game.round || 1;
    if (ti === 0) round += 1;
    if (round > (game.maxRounds || 3)) {
      game.phase = "finished";
      game.turnIndex = ti;
      game.round = round - 1;
      game.roundEndAt = 0;
      return game;
    }
    game.turnIndex = ti;
    game.round = round;
    game.drawerSlot = order[ti];
    game.phase = "choosingWord";
    game.wordChoices = [];
    game.wordChoiceDeadline = Date.now() + WORD_CHOICE_SECONDS * 1000;
    game.currentWord = null;
    game.currentWordCategory = null;
    game.currentWordMasked = "";
    game.hintsRevealed = [];
    game.correctGuessers = [];
    game.correctOrder = [];
    game.typingIndicator = {};
    game.roundEndAt = 0;
    game.guessFeedback = null;
    game.roundStartedAt = 0;
    game.roundDuration = DIFFICULTY[game.difficulty].duration;
    return game;
  });

  const g = result?.snapshot?.val();
  if (!g) return null;
  // Dọn nét vẽ cũ trước mỗi lượt mới (renders bỏ qua undone=true nên không xoá lẻ)
  await remove(ref(db, `rooms/${roomId}/strokes`)).catch(() => { /* best effort */ });
  if (g.phase === "finished") {
    await update(ref(db, `rooms/${roomId}`), { status: "finished" });
  } else if (g.drawerSlot) {
    await pickWordChoices(roomId);
  }
  return g;
}

/* ── Chat ─────────────────────────────────── */

export async function sendChatMessage(roomId, slot, name, text, type = "chat") {
  const clean = String(text || "").trim();
  if (!clean) return;
  await push(ref(db, `rooms/${roomId}/chat`), { slot, name, text: clean, type, ts: Date.now() });
}

/* ── Listeners ────────────────────────────── */

export function listenGame(roomId, cb) {
  return onValue(ref(db, `rooms/${roomId}/game`), snap => {
    cb(snap.exists() ? snap.val() : null);
  });
}

export function listenStrokes(roomId, cb) {
  return onValue(ref(db, `rooms/${roomId}/strokes`), snap => {
    const val = snap.exists() ? snap.val() : {};
    const keys = Object.keys(val);
    const list = keys
      .filter(k => !k.startsWith("_"))
      .sort((a, b) => (a < b ? -1 : 1))
      .map(k => ({ key: k, ...val[k] }));
    const liveKey = keys.find(k => k.startsWith("_"));
    cb({
      list,
      live: liveKey ? { key: liveKey, slot: val[liveKey].slot, ...val[liveKey] } : null,
    });
  });
}

export function listenChat(roomId, cb) {
  return onValue(ref(db, `rooms/${roomId}/chat`), snap => {
    const val = snap.exists() ? snap.val() : {};
    const msgs = Object.keys(val)
      .sort((a, b) => (a < b ? -1 : 1))
      .map(k => ({ key: k, ...val[k] }));
    cb(msgs);
  });
}