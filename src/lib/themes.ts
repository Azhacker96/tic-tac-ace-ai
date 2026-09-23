export type ThemeId = "classic" | "neon" | "midnight" | "minimal";

export interface ThemeDef {
  id: ThemeId;
  name: string;
  description: string;
  /** Small swatch used in the theme picker. */
  swatch: [string, string, string];
}

export const THEMES: ThemeDef[] = [
  {
    id: "classic",
    name: "Classic",
    description: "Warm arcade wood and amber",
    swatch: ["oklch(0.28 0.05 45)", "oklch(0.78 0.16 70)", "oklch(0.72 0.14 200)"],
  },
  {
    id: "neon",
    name: "Neon",
    description: "Electric grid, glowing marks",
    swatch: ["oklch(0.18 0.06 285)", "oklch(0.82 0.19 190)", "oklch(0.75 0.24 340)"],
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Deep navy, cool contrast",
    swatch: ["oklch(0.16 0.03 250)", "oklch(0.72 0.13 235)", "oklch(0.8 0.12 85)"],
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Clean paper and ink",
    swatch: ["oklch(0.96 0.005 90)", "oklch(0.3 0.02 260)", "oklch(0.6 0.16 25)"],
  },
];

export const DEFAULT_THEME: ThemeId = "classic";

export function isThemeId(value: unknown): value is ThemeId {
  return THEMES.some((t) => t.id === value);
}

export function applyTheme(theme: ThemeId) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset["theme"] = theme;
}
