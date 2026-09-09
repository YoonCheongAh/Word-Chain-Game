import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { auth, googleProvider, db } from "../firebase";
import { ref, onValue, set, update } from "firebase/database";

const AuthContext = createContext(null);

const STORAGE_KEY = "pa_anon_name";
const DEFAULT_AVATAR = "/none.png";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [profile, setProfile] = useState(null);
  const profileRef = useRef(null);

  const isGoogle = !!user && user.providerData?.some(p => p.providerId === "google.com");
  const isAnonymous = !!user && user.isAnonymous;
  const isLoggedIn = !!user;

  const activeProfile = user ? profile : null;
  const displayName = activeProfile?.name || user?.displayName || "";
  const avatar = activeProfile?.avatar || (isGoogle ? user?.photoURL : "") || DEFAULT_AVATAR;

  /* Sync auth state; auto sign-in anonymously if nothing present */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        try {
          const cred = await signInAnonymously(auth);
          setUser(cred.user);
        } finally {
          setInitializing(false);
        }
      } else {
        setInitializing(false);
      }
    });
    return () => unsub();
  }, []);

  /* Subscribe to the user profile in RTDB, and migrate a previously stored
     anonymous display name if present. */
  useEffect(() => {
    if (!user) return;
    const ref_ = ref(db, `users/${user.uid}`);
    profileRef.current = ref_;
    const unsub = onValue(ref_, (snap) => {
      if (snap.exists()) {
        setProfile(snap.val());
      } else {
        // First time for this (maybe anonymous) account.
        const stored = (() => {
          try { return localStorage.getItem(STORAGE_KEY) || ""; } catch { return ""; }
        })();
        const isG = user.providerData?.some(p => p.providerId === "google.com");
        const initName = isG ? user.displayName || "" : stored || "";
        const initAvatar = isG ? user.photoURL || "" : "";
        const init = { name: initName, avatar: initAvatar };
        set(profileRef.current, init).catch(() => { /* ignore */ });
        setProfile(init);
      }
    });
    return () => unsub();
  }, [user]);

  /* Google sign-in. Preserves the user's chosen display name from the RTDB
     profile (or the anonymous local storage name) into the new account. */
  const signInWithGoogle = useCallback(async () => {
    if (!auth.currentUser) return;
    try {
      const myName = displayName || "";
      const cred = await signInWithPopup(auth, googleProvider);
      const gUser = cred.user;
      const alias = myName || gUser.displayName || "";
      const aliasRef = ref(db, `users/${gUser.uid}`);
      try { await set(aliasRef, { name: alias, avatar: gUser.photoURL || "" }); } catch { /* ignore */ }
      localStorage.removeItem(STORAGE_KEY);
      return gUser;
    } catch (e) {
      if (e?.code === "auth/popup-closed-by-user" || e?.code === "auth/cancelled-popup-request") return null;
      throw e;
    }
  }, [displayName]);

  /* Sign the Google account out, back to an anonymous session. */
  const signOutToAnonymous = useCallback(async () => {
    await signOut(auth);
    try { const c = await signInAnonymously(auth); return c.user; } catch { return null; }
  }, []);

  /* Edit the display name (used when anonymous / not Google). Persisted to the
     local store as a fallback so the name survives even before Firebase writes
     settle, and written to RTDB. */
  const updateDisplayName = useCallback(async (name) => {
    const clean = String(name || "").trim();
    if (!user) return;
    try { localStorage.setItem(STORAGE_KEY, clean); } catch { /* ignore */ }
    if (profileRef.current) {
      try { await update(profileRef.current, { name: clean }); } catch { /* ignore */ }
    }
    setProfile(prev => ({ ...(prev || {}), name: clean }));
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        auth,
        user,
        initializing,
        isGoogle,
        isAnonymous,
        isLoggedIn,
        displayName,
        avatar,
        profile: activeProfile,
        signInWithGoogle,
        signOutToAnonymous,
        updateDisplayName,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
