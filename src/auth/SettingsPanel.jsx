import React, { useState } from "react";
import { useAuth } from "./AuthContext";
import UserAvatar from "../components/UserAvatar";

const STS = `
  .pa-modal-backdrop {
    position: fixed; inset: 0; z-index: 500;
    background: rgba(5,5,10,0.72); backdrop-filter: blur(6px);
    display: flex; align-items: center; justify-content: center;
    padding: 20px;
  }
  .pa-modal {
    width: 100%; max-width: 340px;
    background: linear-gradient(180deg, #16161f, #0e0e16);
    border: 1px solid rgba(255,255,255,.1); border-radius: 18px;
    padding: 22px; box-shadow: 0 30px 80px rgba(0,0,0,.6);
    animation: paIn .25s ease;
  }
  @keyframes paIn { from{opacity:0; transform:translateY(14px) scale(.97);} to{opacity:1; transform:none;} }
  .pa-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:18px; }
  .pa-title { font-family:'Press Start 2P',cursive; font-size:11px; color:#f2f0ec; letter-spacing:1px; }
  .pa-close { background:none; border:1px solid rgba(255,255,255,.12); color:#a0a0b4; border-radius:8px; font-size:14px; line-height:1; padding:5px 9px; cursor:pointer; font-family:'Space Mono',monospace; }
  .pa-close:hover { color:#fff; border-color:rgba(255,255,255,.3); }
  .pa-profile { display:flex; align-items:center; gap:14px; margin-bottom:20px; }
  .pa-avatar {
    width:64px; height:64px; border-radius:50%; flex-shrink:0;
    display:flex; align-items:center; justify-content:center;
    font-size:24px; font-weight:800; color:#00e5a0;
    background:linear-gradient(135deg,#0f3d2e,#155c45);
    box-shadow:inset 0 0 0 2px rgba(255,255,255,.08);
  }
  .pa-identity { min-width:0; }
  .pa-name-view { font-family:'Orbitron',sans-serif; font-size:15px; font-weight:800; color:#f2f0ec; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .pa-badge { font-family:'Space Mono',monospace; font-size:9px; margin-top:4px; letter-spacing:1px; }
  .pa-badge-google { color:#7aa7ff; }
  .pa-badge-anon { color:#64d96a; }
  .pa-label { font-family:'Space Mono',monospace; font-size:10px; color:#7a7a92; text-transform:uppercase; letter-spacing:1.5px; margin-bottom:8px; }
  .pa-input {
    width:100%; background:rgba(7,7,12,.7); border:1px solid #2a2a35;
    border-radius:10px; color:#f2f0ec; font-family:'Space Mono',monospace;
    font-size:14px; padding:11px 12px; outline:none; margin-bottom:12px;
  }
  .pa-input:focus:not(:disabled){ border-color:#00e5a0; box-shadow:0 0 0 3px rgba(0,229,160,.15); }
  .pa-input:disabled {
    opacity:.45; cursor:not-allowed; color:#7a7a92;
    background:rgba(30,30,40,.4);
  }
  .pa-btn {
    width:100%; display:block; padding:12px; border-radius:10px; border:none;
    font-family:'Orbitron',sans-serif; font-size:12px; font-weight:700; cursor:pointer;
    transition:filter .15s, transform .1s;
  }
  .pa-btn:active{ transform:scale(.98); }
  .pa-btn-google { background:linear-gradient(120deg,#4285F4,#2b7ae9); color:#fff; margin-bottom:8px; }
  .pa-btn-save { background:linear-gradient(120deg,#00e5a0,#25c089); color:#052; margin-bottom:8px; }
  .pa-btn-google:disabled, .pa-btn-save:disabled { opacity:.5; cursor:not-allowed; }
  .pa-btn-ghost { background:rgba(255,255,255,.04); color:#e05c5c; border:1px solid rgba(224,92,92,.3); }
  .pa-err { font-family:'Space Mono',monospace; font-size:11px; color:#ff7676; margin:10px 0 0; text-align:center; }
  .pa-success { font-family:'Space Mono',monospace; font-size:11px; color:#64d96a; margin:10px 0 0; text-align:center; }
  .pa-note { font-family:'Space Mono',monospace; font-size:9px; color:#555; line-height:1.6; margin-top:16px; text-align:center; }
`;

export default function SettingsPanel({ onClose }) {
  const { displayName, avatar, isGoogle, updateDisplayName, signInWithGoogle, signOutToAnonymous } = useAuth();
  const [draft, setDraft] = useState(displayName);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [signing, setSigning] = useState(false);

  React.useEffect(() => {
    if (!document.getElementById("pa-styles")) {
      const el = document.createElement("style");
      el.id = "pa-styles";
      el.textContent = STS;
      document.head.appendChild(el);
    }
    return () => document.getElementById("pa-styles")?.remove();
  }, []);

  async function handleSave() {
    if (!draft.trim()) return setErr("Tên không được để trống!");
    setErr(""); setSaving(true);
    try {
      await updateDisplayName(draft);
      setOk("✓ Đã lưu tên hiển thị");
      setTimeout(() => setOk(""), 1500);
    } catch { setErr("Lưu thất bại!"); }
    setSaving(false);
  }

  async function handleGoogle() {
    setSigning(true); setErr("");
    try { await signInWithGoogle(); } catch { setErr("Đăng nhập Google thất bại!"); }
    setSigning(false);
  }

  async function handleSignOut() {
    setSigning(true); setErr("");
    try { await signOutToAnonymous(); } catch { setErr("Đăng xuất thất bại!"); }
    setSigning(false);
  }

  return (
    <div className="pa-modal-backdrop" onClick={onClose}>
      <div className="pa-modal" onClick={e => e.stopPropagation()}>
        <div className="pa-head">
          <div className="pa-title">Cài đặt</div>
          <button className="pa-close" onClick={onClose}>✕</button>
        </div>

        <div className="pa-profile">
          <UserAvatar name={displayName} avatar={avatar} className="pa-avatar" />
          <div className="pa-identity">
            <div className="pa-name-view">{displayName || "Người chơi ẩn danh"}</div>
            <div className={`pa-badge ${isGoogle ? "pa-badge-google" : "pa-badge-anon"}`}>
              {isGoogle ? "● GOOGLE ACCOUNT" : "● ANONYMOUS"}
            </div>
          </div>
        </div>

        <div className="pa-label">Tên hiển thị</div>
        <input
          className="pa-input"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Nhập tên hiển thị..."
          onKeyDown={e => { if (e.key === "Enter") handleSave(); }}
        />
        <button className="pa-btn pa-btn-save" onClick={handleSave} disabled={saving || !draft.trim()}>
          {saving ? "Đang lưu..." : "Lưu tên"}
        </button>

        {isGoogle ? (
          <button className="pa-btn pa-btn-ghost" onClick={handleSignOut} disabled={signing}>
            {signing ? "Đang đăng xuất..." : "Đăng xuất (chơi ẩn danh)"}
          </button>
        ) : (
          <button className="pa-btn pa-btn-google" onClick={handleGoogle} disabled={signing}>
            {signing ? "Đang đăng nhập..." : "Đăng nhập bằng Google"}
          </button>
        )}

        {err && <p className="pa-err">{err}</p>}
        {ok && <p className="pa-success">{ok}</p>}
        <p className="pa-note">
          Không đăng nhập bạn vẫn chơi được (ẩn danh).<br />
          Đăng nhập Google để đồng bộ tên &amp; ảnh đại diện.
        </p>
      </div>
    </div>
  );
}
