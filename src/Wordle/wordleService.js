import { db } from "../firebase";
import { ref, set, update, get, onValue } from "firebase/database";

export const WORD_LIST = [
  "about","above","abuse","actor","acute","admit","adopt","adult","after","again",
  "agent","agree","ahead","alarm","album","alert","alike","align","alive","alley",
  "allow","alone","along","alter","angel","anger","angle","angry","anime","ankle",
  "annex","antic","anvil","aorta","apple","apply","arena","argue","arise","armor",
  "aroma","arose","array","arrow","aside","attic","audio","audit","avoid","awake",
  "award","aware","awful","badly","baker","basic","basis","batch","beach","began",
  "begin","being","below","bench","bible","birth","black","blade","blame","bland",
  "blank","blast","blaze","bleed","blend","bless","blind","block","blood","bloom",
  "blown","blues","blunt","board","boost","booth","bound","boxer","brace","brain",
  "brand","brave","bread","break","breed","brick","bride","brief","bring","broad",
  "broke","brook","brown","brush","buddy","build","built","bulge","bunch","burst",
  "buyer","cabin","camel","candy","cargo","carry","catch","cause","chain","chair",
  "chaos","charm","chart","chase","cheap","check","cheek","chess","chest","chief",
  "child","china","choir","chunk","civic","civil","claim","class","clean","clear",
  "clerk","click","cliff","climb","cling","clock","clone","close","cloud","coach",
  "coast","color","comes","comic","comma","coral","count","court","cover","crack",
  "craft","crash","crazy","cream","crime","crisp","cross","crowd","crown","cruel",
  "crush","curve","cyber","daily","dance","dated","debut","decay","decor","decoy",
  "delay","delta","dense","depth","derby","devil","disco","dodge","doing","doubt",
  "dough","draft","drain","drama","drank","drawl","drawn","dream","dress","drift",
  "drill","drink","drive","drops","drove","drunk","dryer","dummy","dusty","dying",
  "eager","eagle","early","earth","eight","elite","email","empty","enemy","enjoy",
  "enter","entry","equal","error","essay","ethos","event","every","exact","exist",
  "extra","fable","faint","faith","false","fancy","fatal","fault","feast","fence",
  "fever","field","fiery","fifth","fifty","fight","final","first","fixed","flame",
  "flash","flask","fleet","flesh","float","floor","focus","force","forge","forth",
  "forum","found","frail","frame","frank","fraud","fresh","front","froze","fruit",
  "funny","fuzzy","ghost","giant","given","gland","glare","glass","gloom","gloss",
  "glove","going","grace","grade","grain","grand","grant","grasp","grass","graze",
  "great","green","greet","grief","grill","grind","groan","groin","groom","group",
  "grove","grown","gruff","guard","guess","guide","guilt","guise","gusto","haiku",
  "handy","harsh","haven","heart","heavy","hence","herbs","hinge","hippo","hoard",
  "honor","horse","hotel","house","human","humor","hurry","hyper","ideal","image",
  "inbox","index","indie","inner","input","issue","ivory","joker","joint","joust",
  "judge","juice","jumbo","karma","kayak","knife","knock","known","label","lance",
  "laser","later","laugh","layer","learn","lease","legal","lemon","level","light",
  "limit","lingo","liver","local","lodge","logic","loopy","lower","loyal","lucky",
  "lunar","lying","magic","major","maker","manor","maple","match","maxim","mayor",
  "media","merit","micro","might","mimic","minor","minus","model","money","month",
  "moral","motor","motto","mount","mouse","mouth","moved","movie","music","naive",
  "naked","nasty","naval","nerve","never","night","ninja","noble","noise","north",
  "noted","novel","nurse","nymph","occur","ocean","offer","often","olive","omega",
  "onset","order","other","outer","oxide","ozone","paint","panic","paper","party",
  "pasta","patch","pause","peace","peach","pearl","pedal","penny","phase","phone",
  "photo","piano","pilot","pinch","pitch","pixel","pizza","place","plain","plane",
  "plant","plate","plaza","plead","pluck","plumb","plume","plump","point","polar",
  "polka","poppy","power","press","price","pride","prime","print","prior","prize",
  "probe","proof","prose","proud","prove","psalm","pulse","punch","pupil","queen",
  "query","queue","quick","quiet","quota","quote","rabbi","radio","rainy","rally",
  "ranch","range","rapid","ratio","reach","react","realm","rebel","recap","refer",
  "reign","relax","remix","repay","reply","rerun","reset","resin","retro","rider",
  "ridge","right","risky","rival","river","rivet","robot","rocky","rouge","rough",
  "round","route","royal","rugby","ruler","rumor","rural","rusty","sadly","saint",
  "salon","sauce","scale","scary","scene","scout","scrap","screw","sedan","seize",
  "sense","serve","seven","shade","shall","shame","shape","share","shark","sharp",
  "shelf","shell","shift","shine","shirt","shock","shoot","shore","short","shout",
  "shown","shrug","sight","sigma","silly","since","sixth","sixty","sized","skill",
  "skull","slate","sleep","slick","slide","slope","smart","smash","smell","smile",
  "smoke","snake","solar","solid","solve","sorry","south","space","spark","speak",
  "speed","spend","spill","spine","spite","split","spoon","sport","spray","squad",
  "stack","staff","stage","stain","stair","stake","stale","stand","stark","start",
  "state","stays","steam","steel","steep","stern","stick","still","stock","stone",
  "stood","store","storm","story","stout","straw","strip","study","stuff","style",
  "sugar","suite","sunny","super","surge","swamp","swear","sweet","swept","swift",
  "sword","sworn","synth","table","taken","taste","teach","tears","teeth","theme",
  "thick","thing","think","third","those","three","threw","throw","tiger","tight",
  "timer","tired","title","today","token","total","touch","tough","toxic","trace",
  "track","trade","trail","train","trait","trash","treat","trend","trial","tribe",
  "trick","tried","troop","trove","truce","truly","trump","trunk","trust","truth",
  "tumor","twice","twist","ultra","uncle","under","unify","union","unity","until",
  "upper","upset","urban","usage","usual","utter","valid","value","valve","vapor",
  "vault","veins","verse","viral","virus","visit","visor","vista","vital","vivid",
  "vocal","voice","voter","wagon","waste","watch","water","weary","weave","weird",
  "whale","wheat","wheel","where","which","while","white","whole","whose","wield",
  "witty","woman","women","world","worry","worse","worst","worth","would","wound",
  "wrath","wrist","wrong","yacht","yearn","yield","young","yours","youth","zebra",
  "zesty","zonal"
];

function pickWords(count = 5) {
  const shuffled = [...WORD_LIST].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function checkGuess(guess, answer) {
  const result = Array(5).fill("absent");
  const answerArr = answer.split("");
  const guessArr = guess.split("");
  const used = Array(5).fill(false);
  for (let i = 0; i < 5; i++) {
    if (guessArr[i] === answerArr[i]) { result[i] = "correct"; used[i] = true; }
  }
  for (let i = 0; i < 5; i++) {
    if (result[i] === "correct") continue;
    for (let j = 0; j < 5; j++) {
      if (!used[j] && guessArr[i] === answerArr[j]) { result[i] = "present"; used[j] = true; break; }
    }
  }
  return result;
}

// WORD_TIME: time per word in ms (3 minutes)
export const WORD_TIME_MS = 180000;
export const MAX_SCORE_PER_WORD = 1000;
export const MAX_GUESSES = 5; // 5 lần đoán

export async function startWordleGame(roomId) {
  const words = pickWords(5);
  const snap = await get(ref(db, `rooms/${roomId}/players`));
  const players = snap.val();

  const playerData = {};
  Object.keys(players).forEach(role => {
    playerData[role] = {
      guesses: [],
      score: 0,
      wordDone: false,
      done: false,
      wordsCompleted: 0,
    };
  });

  await update(ref(db, `rooms/${roomId}`), {
    status: "playing",
    "wordle/words": words,
    "wordle/currentWordIdx": 0,
    "wordle/wordStartedAt": Date.now(),
    "wordle/playerData": playerData,
    "wordle/roundOver": false,
    "wordle/rematch": null,
  });
}

/**
 * Submit a guess for the current word.
 * If player solves/exhausts attempts → mark wordDone.
 * If ALL players wordDone → advance to next word (or end round).
 */
export async function submitGuess(roomId, playerRole, guess) {
  const snap = await get(ref(db, `rooms/${roomId}`));
  const room = snap.val();
  const wordle = room.wordle;
  const pd = wordle.playerData[playerRole];

  if (pd.wordDone || pd.done) return;

  const wordIdx = wordle.currentWordIdx ?? 0;
  const answer = wordle.words[wordIdx];
  const result = checkGuess(guess.toLowerCase(), answer);
  const isSolved = result.every(r => r === "correct");

  const newGuesses = [...(pd.guesses || []), { word: guess.toLowerCase(), result }];
  const exhausted = newGuesses.length >= MAX_GUESSES;
  const wordDone = isSolved || exhausted;

  // Score: time-based, only on solve
  let wordScore = 0;
  if (isSolved) {
    const elapsed = Date.now() - wordle.wordStartedAt;
    wordScore = Math.max(0, Math.round(MAX_SCORE_PER_WORD * (1 - elapsed / WORD_TIME_MS)));
  }

  const updates = {};
  updates[`wordle/playerData/${playerRole}/guesses`] = newGuesses;
  updates[`wordle/playerData/${playerRole}/wordDone`] = wordDone;
  if (wordDone) {
    updates[`wordle/playerData/${playerRole}/score`] = (pd.score || 0) + wordScore;
    updates[`wordle/playerData/${playerRole}/wordsCompleted`] = (pd.wordsCompleted || 0) + 1;
  }

  await update(ref(db, `rooms/${roomId}`), updates);

  // Check if ALL players finished current word
  const snap2 = await get(ref(db, `rooms/${roomId}/wordle/playerData`));
  const allPD = snap2.val();
  const allWordDone = Object.values(allPD).every(p => p.wordDone);

  if (allWordDone) {
    await advanceWord(roomId, wordIdx, wordle.words, allPD);
  }
}

/**
 * Xử lý hết giờ: mark tất cả player chưa xong là wordDone (0 điểm), rồi chuyển từ mới.
 * Chỉ được gọi bởi player1 (host) để tránh race condition.
 */
export async function handleWordTimeout(roomId) {
  const snap = await get(ref(db, `rooms/${roomId}`));
  const room = snap.val();
  const wordle = room?.wordle;
  if (!wordle || wordle.roundOver) return;

  // Kiểm tra thực sự hết giờ (tránh trigger nhầm khi reconnect)
  const elapsed = Date.now() - wordle.wordStartedAt;
  if (elapsed < WORD_TIME_MS - 2000) return; // buffer 2s

  const wordIdx = wordle.currentWordIdx ?? 0;
  const allPD = wordle.playerData;

  // Mark wordDone=true cho tất cả người chưa xong (không cộng điểm)
  const updates = {};
  Object.entries(allPD).forEach(([role, pd]) => {
    if (!pd.wordDone) {
      updates[`wordle/playerData/${role}/wordDone`] = true;
      updates[`wordle/playerData/${role}/wordsCompleted`] = (pd.wordsCompleted || 0) + 1;
    }
  });

  if (Object.keys(updates).length > 0) {
    await update(ref(db, `rooms/${roomId}`), updates);
  }

  // Lấy lại playerData mới nhất rồi advance
  const snap2 = await get(ref(db, `rooms/${roomId}/wordle/playerData`));
  const updatedPD = snap2.val();
  await advanceWord(roomId, wordIdx, wordle.words, updatedPD);
}

/**
 * Chuyển sang từ tiếp theo hoặc kết thúc game.
 */
async function advanceWord(roomId, wordIdx, words, allPD) {
  const nextIdx = wordIdx + 1;
  const hasMoreWords = nextIdx < words.length;

  if (hasMoreWords) {
    const resetUpdates = {
      "wordle/currentWordIdx": nextIdx,
      "wordle/wordStartedAt": Date.now(),
    };
    Object.keys(allPD).forEach(role => {
      resetUpdates[`wordle/playerData/${role}/guesses`] = [];
      resetUpdates[`wordle/playerData/${role}/wordDone`] = false;
    });
    await update(ref(db, `rooms/${roomId}`), resetUpdates);
  } else {
    const doneUpdates = { "wordle/roundOver": true };
    Object.keys(allPD).forEach(role => {
      doneUpdates[`wordle/playerData/${role}/done`] = true;
    });
    await update(ref(db, `rooms/${roomId}`), doneUpdates);
  }
}

export async function requestWordleRematch(roomId, playerRole) {
  await set(ref(db, `rooms/${roomId}/wordle/rematch/${playerRole}`), true);
  const snap = await get(ref(db, `rooms/${roomId}`));
  const room = snap.val();
  const rematch = room.wordle?.rematch || {};
  const players = room.players || {};
  const allReady = Object.keys(players).every(r => rematch[r] === true);
  if (allReady) await startWordleGame(roomId);
}

export { pickWords };