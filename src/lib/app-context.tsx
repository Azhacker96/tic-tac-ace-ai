import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { setSfxEnabled } from "@/lib/sound";
import { applyTheme, type ThemeId } from "@/lib/themes";
import {
  DEFAULT_SETTINGS,
  bumpStats,
  clearGuest,
  clearMode,
  loadGuest,
  loadMode,
  loadSettings,
  loadStats,
  makePlayerId,
  saveGuest,
  saveMode,
  saveSettings,
  type AppSettings,
  type GuestProfile,
  type LocalStats,
} from "@/lib/local-store";

export interface DbProfile {
  id: string;
  player_id: string;
  nickname: string;
  avatar: string;
  wins: number;
  losses: number;
  draws: number;
  appear_offline: boolean;
  avatar_type: "app" | "google";
  avatar_url: string | null;
}

export type AccountKind = "none" | "guest" | "google";

export interface Identity {
  kind: Exclude<AccountKind, "none">;
  userId: string | null;
  playerId: string;
  nickname: string;
  /** Effective avatar: an app avatar id, or a Google picture https URL. */
  avatar: string;
  /** Always the app avatar id (fallback when the picture fails). */
  appAvatar: string;
  avatarType: "app" | "google";
  googleAvatarUrl: string | null;
  stats: LocalStats;
}

interface AppState {
  ready: boolean;
  session: Session | null;
  profile: DbProfile | null;
  guest: GuestProfile | null;
  /** Signed in with Google but has not chosen a nickname yet. */
  needsSetup: boolean;
  identity: Identity | null;
  settings: AppSettings;
  online: boolean;
  signInWithGoogle: () => Promise<{ error?: string; redirected?: boolean }>;
  createGuest: (nickname: string, avatar: string) => void;
  completeProfile: (nickname: string, avatar: string) => Promise<void>;
  updateProfile: (patch: { nickname?: string; avatar?: string; avatar_type?: "app" | "google" }) => Promise<void>;
  setAppearOffline: (value: boolean) => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => void;
  setTheme: (theme: ThemeId) => void;
  recordResult: (result: "win" | "loss" | "draw") => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<DbProfile | null>(null);
  const [guest, setGuest] = useState<GuestProfile | null>(null);
  const [stats, setStats] = useState<LocalStats>({ wins: 0, losses: 0, draws: 0 });
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [online, setOnline] = useState(true);
  const [profileChecked, setProfileChecked] = useState(false);
  const linkingGuest = useRef<GuestProfile | null>(null);

  /* ---------- boot: settings, guest profile, local stats ---------- */
  useEffect(() => {
    const s = loadSettings();
    setSettings(s);
    applyTheme(s.theme);
    setSfxEnabled(s.sfx);
    setGuest(loadGuest());
    setStats(loadStats());
    setOnline(navigator.onLine);

    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("id, player_id, nickname, avatar, avatar_type, avatar_url, wins, losses, draws, appear_offline")
      .eq("id", userId)
      .maybeSingle();
    setProfile((data as DbProfile | null) ?? null);
    setProfileChecked(true);
    return (data as DbProfile | null) ?? null;
  }, []);

  /* ---------- auth session ---------- */
  useEffect(() => {
    let active = true;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      setSession(next);
      if (!next) {
        setProfile(null);
        setProfileChecked(true);
      }
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session ?? null);
      if (!data.session) setProfileChecked(true);
      setReady(true);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    setProfileChecked(false);
    void fetchProfile(session.user.id).then(async (existing) => {
      // A guest who just linked Google keeps their nickname, ID and stats.
      const pending = linkingGuest.current ?? loadGuest();
      if (existing) {
        // Returning user: same profile; refresh their Google picture.
        const { error } = await supabase.rpc("ensure_profile", {});
        if (!error) await fetchProfile(session.user.id);
      } else if (pending) {
        const localStats = loadStats();
        const { data, error } = await supabase.rpc("ensure_profile", {
          p_nickname: pending.nickname,
          p_avatar: pending.avatar,
          p_player_id: pending.playerId,
        });
        if (!error && data) {
          await supabase.rpc("merge_guest_stats", {
            p_wins: localStats.wins,
            p_losses: localStats.losses,
            p_draws: localStats.draws,
          });
          clearGuest();
          setGuest(null);
          linkingGuest.current = null;
          await fetchProfile(session.user.id);
        }
      }
      saveMode("google");
    });
  }, [session?.user?.id, fetchProfile, session?.user]);

  /* ---------- presence heartbeat ---------- */
  useEffect(() => {
    if (!session?.user || !profile) return;
    const beat = () => {
      void supabase.rpc("heartbeat");
    };
    beat();
    const id = window.setInterval(beat, 45_000);
    return () => window.clearInterval(id);
  }, [session?.user, profile]);

  /* ---------- actions ---------- */
  const signInWithGoogle = useCallback(async () => {
    linkingGuest.current = loadGuest();
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) return { error: result.error.message || "Google sign-in failed" };
      if (result.redirected) return { redirected: true };
      return {};
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Google sign-in failed" };
    }
  }, []);

  const createGuest = useCallback((nickname: string, avatar: string) => {
    const g: GuestProfile = {
      playerId: makePlayerId(),
      nickname: nickname.trim(),
      avatar,
      createdAt: new Date().toISOString(),
    };
    saveGuest(g);
    saveMode("guest");
    setGuest(g);
  }, []);

  const completeProfile = useCallback(
    async (nickname: string, avatar: string) => {
      const { error } = await supabase.rpc("ensure_profile", {
        p_nickname: nickname.trim(),
        p_avatar: avatar,
      });
      if (error) throw error;
      if (session?.user) await fetchProfile(session.user.id);
    },
    [session?.user, fetchProfile],
  );

  const updateProfile = useCallback(
    async (patch: { nickname?: string; avatar?: string; avatar_type?: "app" | "google" }) => {
      if (session?.user && profile) {
        const { error } = await supabase
          .from("profiles")
          .update(patch)
          .eq("id", session.user.id);
        if (error) throw error;
        await fetchProfile(session.user.id);
        return;
      }
      const current = loadGuest();
      if (current) {
        const { avatar_type: _ignored, ...guestPatch } = patch;
        const next = { ...current, ...guestPatch };
        saveGuest(next);
        setGuest(next);
      }
    },
    [session?.user, profile, fetchProfile],
  );

  const persistSettings = useCallback((next: AppSettings) => {
    setSettings(next);
    saveSettings(next);
    applyTheme(next.theme);
    setSfxEnabled(next.sfx);
  }, []);

  const updateSettings = useCallback(
    (patch: Partial<AppSettings>) => {
      persistSettings({ ...loadSettings(), ...patch });
    },
    [persistSettings],
  );

  const setTheme = useCallback((theme: ThemeId) => updateSettings({ theme }), [updateSettings]);

  const setAppearOffline = useCallback(
    async (value: boolean) => {
      updateSettings({ appearOffline: value });
      if (session?.user) {
        await supabase.from("profiles").update({ appear_offline: value }).eq("id", session.user.id);
        await fetchProfile(session.user.id);
      }
    },
    [session?.user, updateSettings, fetchProfile],
  );

  const recordResult = useCallback(
    async (result: "win" | "loss" | "draw") => {
      setStats(bumpStats(result));
      if (session?.user && profile) {
        await supabase.rpc("record_game_result", { p_result: result });
        await fetchProfile(session.user.id);
      }
    },
    [session?.user, profile, fetchProfile],
  );

  const refreshProfile = useCallback(async () => {
    if (session?.user) await fetchProfile(session.user.id);
  }, [session?.user, fetchProfile]);

  const signOut = useCallback(async () => {
    clearMode();
    clearGuest();
    setGuest(null);
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  }, []);

  const identity = useMemo<Identity | null>(() => {
    if (profile) {
      return {
        kind: "google",
        userId: profile.id,
        playerId: profile.player_id,
        nickname: profile.nickname,
        avatar: profile.avatar_type === "google" && profile.avatar_url ? profile.avatar_url : profile.avatar,
        appAvatar: profile.avatar,
        avatarType: profile.avatar_type === "google" && profile.avatar_url ? "google" : "app",
        googleAvatarUrl: profile.avatar_url,
        stats: { wins: profile.wins, losses: profile.losses, draws: profile.draws },
      };
    }
    if (guest && loadMode() !== "google") {
      return {
        kind: "guest",
        userId: null,
        playerId: guest.playerId,
        nickname: guest.nickname,
        avatar: guest.avatar,
        appAvatar: guest.avatar,
        avatarType: "app",
        googleAvatarUrl: null,
        stats,
      };
    }
    if (guest && !session) {
      return {
        kind: "guest",
        userId: null,
        playerId: guest.playerId,
        nickname: guest.nickname,
        avatar: guest.avatar,
        appAvatar: guest.avatar,
        avatarType: "app",
        googleAvatarUrl: null,
        stats,
      };
    }
    return null;
  }, [profile, guest, stats, session]);

  const value: AppState = {
    ready,
    session,
    profile,
    guest,
    needsSetup: Boolean(session?.user) && profileChecked && !profile,
    identity,
    settings,
    online,
    signInWithGoogle,
    createGuest,
    completeProfile,
    updateProfile,
    setAppearOffline,
    updateSettings,
    setTheme,
    recordResult,
    refreshProfile,
    signOut,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}
