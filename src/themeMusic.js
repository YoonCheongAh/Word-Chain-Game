/**
 * themeMusic.js — trình phát nhạc nền (theme song) dùng chung cho các game.
 * Một Audio element lặp vô hạn, tắt/bật theo trạng thái muted của game.
 */

let audio = null;
let muted = false;

function ensureAudio(src) {
  if (!audio) {
    audio = new Audio(src);
    audio.loop = true;
    audio.volume = 0.45;
    audio.preload = "auto";
    audio.setAttribute("data-src", src);
  } else if (audio.getAttribute("data-src") !== src) {
    audio.pause();
    audio.src = src;
    audio.load();
    audio.setAttribute("data-src", src);
  }
  return audio;
}

function tryPlay(a) {
  const p = a.play();
  if (p !== undefined) {
    p.catch(() => {
      // Autoplay bị chặn → thử lại ở lần tương tác kế tiếp
      const resume = () => {
        try { a.play(); } catch { /* ignore */ }
        window.removeEventListener("pointerdown", resume);
      };
      window.addEventListener("pointerdown", resume, { once: true });
    });
  }
}

/**
 * Phát nhạc nền cho game hiện tại (tự động thay nhạc cũ nếu khác src).
 * @param {string} src Đường dẫn file nhạc trong /public
 */
export function playThemeMusic(src) {
  if (typeof window === "undefined") return;
  const a = ensureAudio(src);
  if (muted) { a.pause(); return; }
  tryPlay(a);
}

/** Dừng và giải phóng nhạc nền (thường gọi khi rời game). */
export function stopThemeMusic() {
  if (!audio) return;
  try {
    audio.pause();
    audio.src = "";
    audio.load();
  } catch { /* ignore */ }
  audio = null;
}

/** Bật/tắt nhạc nền theo trạng thái mute của game. */
export function setThemeMusicMuted(value) {
  muted = !!value;
  if (!audio) return;
  if (muted) {
    audio.pause();
  } else {
    tryPlay(audio);
  }
}

export function isThemeMusicMuted() {
  return muted;
}