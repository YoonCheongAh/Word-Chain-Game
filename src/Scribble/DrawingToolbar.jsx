import { useEffect, useState } from "react";
import { PALETTE } from "./scribbleService";

/* ─────────────────────────────────────────────
   DrawingToolbar — toolbar vẽ đầy đủ cho DRAWER
   (mục 3.4). 5 nhóm: công cụ / cỡ nét / màu /
   undo-redo-clear / hình cơ bản, cộng nút chat.
   Phím tắt: 1/2/3 (tool), Shift+1/2/3 (cỡ nét),
   Q/W/E (hình), Ctrl+Z/Y/D (undo/redo/clear). Khi
   bật "hiện số phím tắt màu", dãy số 1..0 chọn màu.

   Icon: một bộ SVG line-icon nhất quán (thay cho
   emoji trước đây, vốn không đồng bộ về style/kích
   thước giữa các hệ điều hành/trình duyệt).
───────────────────────────────────────────── */

/* Bộ icon dạng outline, 24x24, dùng currentColor để tự đổi màu theo trạng thái nút. */
function Icon({ name }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };
  switch (name) {
    case "pen":
      return (
        <svg {...common}>
          <path d="M4 20l1.1-4.2a2 2 0 0 1 .53-.92L15.6 5 19 8.4 9.06 18.36a2 2 0 0 1-.92.53L4 20Z" />
          <path d="M13.5 7.1 16.9 10.5" />
        </svg>
      );
    case "eraser":
      return (
        <svg {...common}>
          <path d="M18.5 13.3 9.9 21.3H5.4l-2.6-2.6a2 2 0 0 1 0-2.8l9.8-9.8a2 2 0 0 1 2.8 0l4.1 4.1a2 2 0 0 1 0 2.8Z" />
          <path d="M8.8 12.4 12.9 16.5" />
          <path d="M5.4 21.3H19" />
        </svg>
      );
    case "fill":
      return (
        <svg {...common}>
          <path d="M4.5 11.5 12 4l7.5 7.5a3.8 3.8 0 0 1 0 5.4l-2.1 2.1a3.8 3.8 0 0 1-5.4 0l-7.5-7.5Z" />
          <path d="M2.5 11.5h13" />
          <circle cx="18.5" cy="17.5" r="2.3" />
        </svg>
      );
    case "circle":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
    case "square":
      return (
        <svg {...common}>
          <rect x="4.5" y="4.5" width="15" height="15" rx="1.5" />
        </svg>
      );
    case "triangle":
      return (
        <svg {...common}>
          <path d="M12 4.5 20.5 19.5H3.5Z" />
        </svg>
      );
    case "undo":
      return (
        <svg {...common}>
          <path d="M7 8 3 12l4 4" />
          <path d="M3 12h11a5.5 5.5 0 1 1 0 11H8" />
        </svg>
      );
    case "redo":
      return (
        <svg {...common}>
          <path d="M17 8l4 4-4 4" />
          <path d="M21 12H10a5.5 5.5 0 1 0 0 11h7" />
        </svg>
      );
    case "trash":
      return (
        <svg {...common}>
          <path d="M4.5 7h15" />
          <path d="M9 7V4.8c0-.7.6-1.3 1.3-1.3h3.4c.7 0 1.3.6 1.3 1.3V7" />
          <path d="M6.5 7 7.4 20a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4L17.5 7" />
          <path d="M10.3 11v6.3M13.7 11v6.3" />
        </svg>
      );
    case "chat":
      return (
        <svg {...common}>
          <path d="M4 5.5h16v10.5H9.5L5 20v-4H4Z" />
        </svg>
      );
    case "keys":
      return (
        <svg {...common}>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path d="M7 10h.01M11 10h.01M15 10h.01M17 10h.01M7 14h10" />
        </svg>
      );
    default:
      return null;
  }
}

const TOOLS = [
  { id: "pen", label: "Bút chì", key: "1", icon: "pen" },
  { id: "eraser", label: "Tẩy", key: "2", icon: "eraser" },
  { id: "fill", label: "Đổ màu", key: "3", icon: "fill" },
];
const SHAPES = [
  { id: "circle", label: "Tròn", key: "Q", icon: "circle" },
  { id: "square", label: "Vuông", key: "W", icon: "square" },
  { id: "triangle", label: "Tam giác", key: "E", icon: "triangle" },
];
const SIZE_HINTS = ["nhỏ", "vừa", "to"];

export default function DrawingToolbar({
  activeTool,
  onToolChange,
  activeColor,
  onColorChange,
  activeSize,
  onSizeChange,
  onUndo,
  onRedo,
  onClear,
  canUndo = false,
  canRedo = false,
  onToggleChat,
}) {
  const [showColorKeys, setShowColorKeys] = useState(false);
  const [customColor, setCustomColor] = useState("#000000");

  useEffect(() => {
    const handler = (e) => {
      const t = e.target;
      if (t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.ctrlKey || e.metaKey) {
        const k = e.key.toLowerCase();
        if (k === "z") { e.preventDefault(); onUndo(); }
        else if (k === "y") { e.preventDefault(); onRedo(); }
        else if (k === "d") { e.preventDefault(); onClear(); }
        return;
      }
      if (showColorKeys) {
        const n = Number(e.key);
        if (!Number.isNaN(n) && n >= 0 && n <= 9 && PALETTE[n]) {
          e.preventDefault();
          onColorChange(PALETTE[n]);
        }
        return;
      }
      if (e.shiftKey && (e.key === "1" || e.key === "2" || e.key === "3")) {
        e.preventDefault();
        onSizeChange(Number(e.key) - 1);
        return;
      }
      if (e.key === "1") onToolChange("pen");
      else if (e.key === "2") onToolChange("eraser");
      else if (e.key === "3") onToolChange("fill");
      else if (e.key === "q" || e.key === "Q") onToolChange("circle");
      else if (e.key === "w" || e.key === "W") onToolChange("square");
      else if (e.key === "e" || e.key === "E") onToolChange("triangle");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showColorKeys, onToolChange, onSizeChange, onUndo, onRedo, onClear, onColorChange]);

  return (
    <div className="sb-tb">
      {/* 1 · Công cụ */}
      <div className="sb-tb-group">
        {TOOLS.map(t => (
          <button
            key={t.id}
            className={`sb-tb-btn${activeTool === t.id ? " on" : ""}`}
            onClick={() => onToolChange(t.id)}
            title={`${t.label} (${t.key})`}
          >
            <span className="sb-tb-ic"><Icon name={t.icon} /></span>
            <kbd>{t.key}</kbd>
          </button>
        ))}
      </div>

      {/* 2 · Cỡ nét */}
      <div className="sb-tb-group sb-tb-sizes">
        {[0, 1, 2].map(i => (
          <button
            key={i}
            className={`sb-tb-btn sb-size-btn${activeSize === i ? " on" : ""}`}
            onClick={() => onSizeChange(i)}
            title={`Cỡ ${SIZE_HINTS[i]} (Shift+${i + 1})`}
          >
            <span className="sb-size-dot" style={{ width: [8, 14, 20][i], height: [8, 14, 20][i] }} />
            <kbd>⇧{i + 1}</kbd>
          </button>
        ))}
      </div>

      {/* 3 · Bảng màu */}
      <div className="sb-tb-group sb-tb-colors">
        <button
          className={`sb-tb-btn sb-key-toggle${showColorKeys ? " on" : ""}`}
          onClick={() => setShowColorKeys(v => !v)}
          title="Hiện số phím tắt màu"
        >
          <span className="sb-tb-ic"><Icon name="keys" /></span>
        </button>
        <label className="sb-tb-btn sb-color-pick" title="Chọn màu tuỳ chỉnh">
          <input
            type="color"
            value={customColor}
            onChange={e => { setCustomColor(e.target.value); onColorChange(e.target.value); }}
          />
        </label>
        {PALETTE.map((c, i) => (
          <button
            key={c}
            className={`sb-swatch${activeColor === c ? " on" : ""}`}
            style={{ background: c, borderColor: c === "#ffffff" ? "#b9b9b9" : "transparent" }}
            onClick={() => onColorChange(c)}
            title={showColorKeys ? `${c} (${i === 10 ? 0 : i})` : c}
          >
            {showColorKeys && <span className="sb-swatch-k">{i === 10 ? 0 : i}</span>}
          </button>
        ))}
      </div>

      {/* 4 · Undo / Redo / Xoá */}
      <div className="sb-tb-group">
        <button className="sb-tb-btn" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          <span className="sb-tb-ic"><Icon name="undo" /></span>
          <kbd>Ctrl+Z</kbd>
        </button>
        <button className="sb-tb-btn" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)">
          <span className="sb-tb-ic"><Icon name="redo" /></span>
          <kbd>Ctrl+Y</kbd>
        </button>
        <button className="sb-tb-btn sb-clr" onClick={onClear} title="Xoá toàn bộ (Ctrl+D)">
          <span className="sb-tb-ic"><Icon name="trash" /></span>
          <kbd>Ctrl+D</kbd>
        </button>
      </div>

      {/* 5 · Hình cơ bản */}
      <div className="sb-tb-group">
        {SHAPES.map(s => (
          <button
            key={s.id}
            className={`sb-tb-btn${activeTool === s.id ? " on" : ""}`}
            onClick={() => onToolChange(s.id)}
            title={`${s.label} (${s.key})`}
          >
            <span className="sb-tb-ic"><Icon name={s.icon} /></span>
            <kbd>{s.key}</kbd>
          </button>
        ))}
      </div>

      <button className="sb-tb-btn sb-chat-btn" onClick={onToggleChat} title="Chat / lịch sử đoán">
        <span className="sb-tb-ic"><Icon name="chat" /></span>
      </button>
    </div>
  );
}