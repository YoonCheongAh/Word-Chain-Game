/**
 * themeMusic.js — trình phát nhạc nền (theme song) dùng chung cho các game.
 * Một Audio element lặp vô hạn, tắt/bật theo trạng thái muted của game.
 */

let audio = null;
let muted = false;
let playRequest = 0;
let resumeHandler = null;

function clearResumeHandler() {
  if (typeof window !== "undefined" && resumeHandler) {
    window.removeEventListener("pointerdown", resumeHandler);
  }
  resumeHandler = null;
}

function ensureAudio(src) {
  if (!src) return null;
  if (!audio) {
    audio = new Audio(src);
    audio.loop = true;
    audio.volume = 0.45;
    audio.preload = "auto";
    audio.setAttribute("data-src", src);
  } else if (audio.getAttribute("data-src") !== src) {
    clearResumeHandler();
    playRequest += 1;
    audio.pause();
    audio.src = src;
    audio.load();
    audio.setAttribute("data-src", src);
  }
  return audio;
}

function scheduleResume(a, requestId, source) {
  if (audio !== a || requestId !== playRequest || muted) return;
  if (a.getAttribute("data-src") !== source || !a.getAttribute("src")) return;
  if (resumeHandler) return;

  const handler = () => {
    if (resumeHandler === handler) resumeHandler = null;
    if (audio !== a || requestId !== playRequest || muted) return;
    if (a.getAttribute("data-src") !== source || !a.getAttribute("src")) return;
    try {
      const retry = a.play();
      retry?.catch(() => {});
    } catch {
      return;
    }
  };

  resumeHandler = handler;
  window.addEventListener("pointerdown", handler, { once: true });
}

function tryPlay(a) {
  if (!a || audio !== a || muted) return;
  clearResumeHandler();
  const requestId = ++playRequest;
  const source = a.getAttribute("data-src");
  if (!source || !a.getAttribute("src")) return;

  try {
    const promise = a.play();
    promise?.catch(() => scheduleResume(a, requestId, source));
  } catch {
    scheduleResume(a, requestId, source);
  }
}

/**
 * Phát nhạc nền cho game hiện tại (tự động thay nhạc cũ nếu khác src).
 * @param {string} src Đường dẫn file nhạc trong /public
 */
export function playThemeMusic(src) {
  if (typeof window === "undefined") return;
  let a;
  try {
    a = ensureAudio(src);
  } catch {
    return;
  }
  if (!a) return;
  if (muted) {
    clearResumeHandler();
    playRequest += 1;
    a.pause();
    return;
  }
  tryPlay(a);
}

/** Dừng và giải phóng nhạc nền (thường gọi khi rời game). */
export function stopThemeMusic() {
  clearResumeHandler();
  playRequest += 1;
  const currentAudio = audio;
  audio = null;
  if (!currentAudio) return;
  try {
    currentAudio.pause();
    currentAudio.removeAttribute("src");
    currentAudio.load();
  } catch { /* ignore */ }
}

/** Bật/tắt nhạc nền theo trạng thái mute của game. */
export function setThemeMusicMuted(value) {
  muted = !!value;
  if (!audio) return;
  if (muted) {
    clearResumeHandler();
    playRequest += 1;
    audio.pause();
  } else {
    tryPlay(audio);
  }
}

export function isThemeMusicMuted() {
  return muted;
}