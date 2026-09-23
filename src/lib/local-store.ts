import { DEFAULT_THEME, isThemeId, type ThemeId } from "./themes";

/**
 * Everything in this module works with no network and no account: the guest
 * profile, local statistics and device settings. Signed-in players mirror the
 * same shape from the backend.
 */

export interface GuestProfile {
  playerId: string;
  nickname: string;
  avatar: string;
  createdAt: string;
}

export interface LocalStats {
  wins: number;
  losses: number;
  draws: number;
}

export interface AppSettings {
  music: boolean;
  sfx: boolean;
  theme: ThemeId;
  appearOffline: boolean;
}

const KEYS = {
  guest: "ttt.guest.profile",
  stats: "ttt.local.stats",
  settings: "ttt.settings",
  mode: "ttt.mode",
} as const;

export const DEFAULT_SETTINGS: AppSettings = {
  music: false,
  sfx: true,
  theme: DEFAULT_THEME,
  appearOffline: false,
};

export const EMPTY_STATS: LocalStats = { wins: 0, losses: 0, draws: 0 };

function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked — settings simply won't persist */
  }
}

export function makePlayerId(): string {
  const alphabet = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let out = "";
  for (let i = 0; i < 8; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export const loadGuest = () => read<GuestProfile>(KEYS.guest);
export const saveGuest = (p: GuestProfile) => write(KEYS.guest, p);
export const clearGuest = () => {
  if (typeof window !== "undefined") window.localStorage.removeItem(KEYS.guest);
};

export function loadStats(): LocalStats {
  return { ...EMPTY_STATS, ...(read<LocalStats>(KEYS.stats) ?? {}) };
}
export const saveStats = (s: LocalStats) => write(KEYS.stats, s);
export const clearStats = () => {
  if (typeof window !== "undefined") window.localStorage.removeItem(KEYS.stats);
};

export function loadSettings(): AppSettings {
  const stored = read<Partial<AppSettings>>(KEYS.settings) ?? {};
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    theme: isThemeId(stored.theme) ? stored.theme : DEFAULT_SETTINGS.theme,
  };
}
export const saveSettings = (s: AppSettings) => write(KEYS.settings, s);

/** "guest" | "google" — which sign-in path the player last chose. */
export function loadMode(): "guest" | "google" | null {
  return read<"guest" | "google">(KEYS.mode);
}
export const saveMode = (m: "guest" | "google") => write(KEYS.mode, m);
export const clearMode = () => {
  if (typeof window !== "undefined") window.localStorage.removeItem(KEYS.mode);
};

export function bumpStats(result: "win" | "loss" | "draw"): LocalStats {
  const stats = loadStats();
  const next: LocalStats = {
    wins: stats.wins + (result === "win" ? 1 : 0),
    losses: stats.losses + (result === "loss" ? 1 : 0),
    draws: stats.draws + (result === "draw" ? 1 : 0),
  };
  saveStats(next);
  return next;
}
