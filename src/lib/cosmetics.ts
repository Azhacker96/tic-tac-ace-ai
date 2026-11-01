import type { CSSProperties } from "react";

/**
 * Visual definitions for shop cosmetics, keyed by the item's `preview` value.
 * Prices/ownership live on the server; this file only knows how to draw them.
 * Add a new skin: insert a shop_items row and add its preview key here.
 */
export type BoardDecor = "bevel" | "hud" | "leaf" | "star" | "rivet" | "frost" | "chalk" | "gold";

export interface BoardTheme {
  /** Outer board frame (texture + border + glow). */
  frame: CSSProperties;
  /** Each square's surface. */
  cell: CSSProperties;
  /** Corner ornament style + colour. */
  decor: BoardDecor;
  accent: string;
}

const svg = (s: string) => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;

const CARBON = svg(
  `<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8'><rect width='4' height='4' fill='white' opacity='.035'/><rect x='4' y='4' width='4' height='4' fill='white' opacity='.035'/></svg>`,
);
const SCAN = "repeating-linear-gradient(0deg, oklch(1 0 0 / 0.04) 0 1px, transparent 1px 3px)";
const STARS = svg(
  `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><g fill='white'><circle cx='10' cy='20' r='.8'/><circle cx='60' cy='8' r='1.2'/><circle cx='95' cy='40' r='.7'/><circle cx='30' cy='75' r='1'/><circle cx='80' cy='95' r='.8'/><circle cx='110' cy='110' r='1.1'/><circle cx='50' cy='50' r='.5'/></g></svg>`,
);
const FIREFLY = svg(
  `<svg xmlns='http://www.w3.org/2000/svg' width='90' height='90'><g fill='%23ffe08a'><circle cx='12' cy='30' r='1.2' opacity='.7'/><circle cx='70' cy='14' r='.9' opacity='.6'/><circle cx='50' cy='70' r='1.4' opacity='.5'/><circle cx='84' cy='60' r='.8' opacity='.7'/></g></svg>`,
).replace("%2523", "%23");
const WOOD = "repeating-linear-gradient(92deg, oklch(0.3 0.05 50) 0 6px, oklch(0.27 0.045 48) 6px 9px, oklch(0.32 0.055 52) 9px 15px)";
const CHALK_DUST = svg(
  `<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'><g fill='white' opacity='.06'><circle cx='5' cy='9' r='1'/><circle cx='40' cy='20' r='1.5'/><circle cx='22' cy='47' r='1'/><circle cx='53' cy='52' r='.8'/></g></svg>`,
);

const glow = (c: string, a = 0.55) => `0 0 0 1px ${c}, 0 0 18px color-mix(in oklab, ${c} ${a * 100}%, transparent)`;

export const BOARD_THEMES: Record<string, BoardTheme> = {
  default: {
    decor: "bevel",
    accent: "oklch(0.8 0.12 210)",
    frame: {
      background: `${CARBON}, linear-gradient(160deg, oklch(0.28 0.02 250), oklch(0.18 0.015 250))`,
      border: "1px solid oklch(0.45 0.03 240)",
      boxShadow: "inset 0 1px 0 oklch(1 0 0 / 0.12), inset 0 -2px 0 oklch(0 0 0 / 0.4), 0 10px 30px -10px oklch(0 0 0 / 0.7)",
    },
    cell: {
      background: "linear-gradient(160deg, oklch(0.24 0.02 250), oklch(0.17 0.015 250))",
      boxShadow: "inset 0 1px 0 oklch(1 0 0 / 0.07), inset 0 0 0 1px oklch(0.8 0.12 210 / 0.18)",
    },
  },
  cyber: {
    decor: "hud",
    accent: "oklch(0.85 0.18 195)",
    frame: {
      background: `${SCAN}, linear-gradient(oklch(0.85 0.18 195 / 0.06) 1px, transparent 1px) 0 0/16px 16px, linear-gradient(90deg, oklch(0.85 0.18 195 / 0.06) 1px, transparent 1px) 0 0/16px 16px, radial-gradient(circle at 30% 0%, oklch(0.35 0.15 320), oklch(0.12 0.05 280) 70%)`,
      border: "1px solid oklch(0.75 0.24 330)",
      boxShadow: `${glow("oklch(0.75 0.24 330)")}, inset 0 0 24px oklch(0.85 0.18 195 / 0.25)`,
    },
    cell: {
      background: "linear-gradient(160deg, oklch(0.18 0.06 285 / 0.9), oklch(0.12 0.04 270 / 0.9))",
      boxShadow: "inset 0 0 0 1px oklch(0.85 0.18 195 / 0.6), inset 0 0 12px oklch(0.85 0.18 195 / 0.25), 0 0 8px oklch(0.75 0.24 330 / 0.35)",
    },
  },
  jungle: {
    decor: "leaf",
    accent: "oklch(0.82 0.14 95)",
    frame: {
      background: `${FIREFLY}, radial-gradient(circle at 50% 120%, oklch(0.45 0.12 140 / 0.6), transparent 60%), ${WOOD}`,
      border: "2px solid oklch(0.55 0.11 130)",
      boxShadow: "inset 0 0 0 3px oklch(0.3 0.06 140), inset 0 0 30px oklch(0.15 0.05 140 / 0.8), 0 0 16px oklch(0.82 0.14 95 / 0.25)",
    },
    cell: {
      background: "radial-gradient(circle at 50% 30%, oklch(0.32 0.07 145), oklch(0.2 0.05 150))",
      boxShadow: "inset 0 0 0 2px oklch(0.6 0.1 110 / 0.7), inset 0 2px 6px oklch(0 0 0 / 0.5)",
    },
  },
  royal: {
    decor: "star",
    accent: "oklch(0.85 0.15 85)",
    frame: {
      background: `${STARS}, radial-gradient(ellipse at 20% 20%, oklch(0.45 0.2 320 / 0.7), transparent 55%), radial-gradient(ellipse at 80% 80%, oklch(0.4 0.18 260 / 0.8), transparent 60%), oklch(0.13 0.06 280)`,
      border: "1px solid oklch(0.85 0.15 85)",
      boxShadow: `${glow("oklch(0.85 0.15 85)", 0.4)}, inset 0 0 0 4px oklch(0.13 0.06 280), inset 0 0 0 5px oklch(0.85 0.15 85 / 0.5)`,
    },
    cell: {
      background: `${STARS}, radial-gradient(circle, oklch(0.22 0.09 285 / 0.85), oklch(0.12 0.06 280 / 0.9))`,
      boxShadow: "inset 0 0 0 1px oklch(0.85 0.15 85 / 0.65), 0 0 6px oklch(0.85 0.15 85 / 0.3)",
    },
  },
  wood: {
    decor: "rivet",
    accent: "oklch(0.75 0.13 65)",
    frame: {
      background: `radial-gradient(circle at 50% 0%, oklch(0.75 0.13 65 / 0.18), transparent 60%), ${WOOD}`,
      border: "3px solid oklch(0.6 0.12 60)",
      boxShadow: "inset 0 0 0 2px oklch(0.35 0.07 55), inset 0 0 0 5px oklch(0.68 0.13 55 / 0.6), 0 8px 24px -8px oklch(0 0 0 / 0.8)",
    },
    cell: {
      background: "linear-gradient(160deg, oklch(0.42 0.06 60), oklch(0.3 0.05 55))",
      boxShadow: "inset 0 0 0 2px oklch(0.62 0.13 55), inset 0 0 0 4px oklch(0.35 0.06 50), inset 0 3px 8px oklch(0 0 0 / 0.5)",
    },
  },
  ice: {
    decor: "frost",
    accent: "oklch(0.92 0.08 210)",
    frame: {
      background: "radial-gradient(ellipse at 30% 0%, oklch(0.75 0.14 170 / 0.35), transparent 55%), radial-gradient(ellipse at 90% 100%, oklch(0.7 0.15 260 / 0.35), transparent 60%), linear-gradient(160deg, oklch(0.42 0.08 225), oklch(0.22 0.06 235))",
      border: "1px solid oklch(0.92 0.08 210 / 0.8)",
      boxShadow: `${glow("oklch(0.9 0.1 210)", 0.45)}, inset 0 1px 0 oklch(1 0 0 / 0.4)`,
    },
    cell: {
      background: "linear-gradient(135deg, oklch(0.55 0.08 220 / 0.55), oklch(0.3 0.07 230 / 0.6) 60%, oklch(0.45 0.08 215 / 0.5))",
      boxShadow: "inset 0 0 0 1px oklch(0.95 0.06 210 / 0.6), inset 0 1px 0 oklch(1 0 0 / 0.35), inset 0 -6px 12px oklch(0.2 0.06 240 / 0.4)",
      backdropFilter: "blur(2px)",
    },
  },
  chalk: {
    decor: "chalk",
    accent: "oklch(0.95 0.01 100)",
    frame: {
      background: `${CHALK_DUST}, radial-gradient(ellipse at 40% 30%, oklch(0.4 0.04 160), oklch(0.27 0.035 165))`,
      border: "6px solid oklch(0.48 0.08 60)",
      boxShadow: "inset 0 0 0 1px oklch(0.3 0.05 55), inset 0 0 24px oklch(0 0 0 / 0.45), 0 0 0 1px oklch(0.35 0.06 55)",
    },
    cell: {
      background: "oklch(0.33 0.035 162 / 0.6)",
      border: "2px dashed oklch(0.92 0.01 100 / 0.55)",
      boxShadow: "inset 0 0 10px oklch(0.95 0 0 / 0.05)",
    },
  },
  gold: {
    decor: "gold",
    accent: "oklch(0.86 0.15 88)",
    frame: {
      background: "linear-gradient(135deg, oklch(1 0 0 / 0.07), transparent 40%), radial-gradient(circle at 50% 0%, oklch(0.25 0.01 80), oklch(0.1 0.005 80))",
      border: "2px solid oklch(0.82 0.15 85)",
      boxShadow: "inset 0 0 0 3px oklch(0.12 0.01 80), inset 0 0 0 4px oklch(0.7 0.13 80), 0 0 20px oklch(0.82 0.15 85 / 0.35)",
    },
    cell: {
      background: "linear-gradient(145deg, oklch(0.2 0.01 80), oklch(0.11 0.005 80))",
      boxShadow: "inset 0 0 0 1.5px oklch(0.85 0.15 88), inset 0 1px 0 oklch(0.95 0.1 95 / 0.6), inset 0 -2px 0 oklch(0.5 0.1 70), 0 2px 6px oklch(0 0 0 / 0.6)",
    },
  },
};

export function boardTheme(preview: string | undefined): BoardTheme {
  return (preview && BOARD_THEMES[preview]) || BOARD_THEMES.default;
}

/** Kept for compatibility with older imports. */
export const BOARD_SKINS: Record<string, CSSProperties> = Object.fromEntries(
  Object.entries(BOARD_THEMES).map(([k, t]) => [k, t.frame]),
);

export function pieceGlyphs(preview: string | undefined): [string, string] {
  if (preview && preview.includes("|")) {
    const [x, o] = preview.split("|");
    return [x ?? "✕", o ?? "◯"];
  }
  return ["✕", "◯"];
}

export const FRAME_STYLES: Record<string, CSSProperties> = {
  gold: { boxShadow: "0 0 0 3px oklch(0.82 0.16 85), 0 0 14px oklch(0.82 0.16 85 / 0.6)" },
  neon: { boxShadow: "0 0 0 3px oklch(0.85 0.2 190), 0 0 16px oklch(0.75 0.24 340 / 0.7)" },
  fire: { boxShadow: "0 0 0 3px oklch(0.7 0.22 35), 0 0 16px oklch(0.8 0.18 60 / 0.7)" },
  laurel: { boxShadow: "0 0 0 2px oklch(0.6 0.12 140), 0 0 0 5px oklch(0.82 0.16 85), 0 0 14px oklch(0.82 0.16 85 / 0.5)" },
  spark: { boxShadow: "0 0 0 3px oklch(0.9 0.18 100), 0 0 18px oklch(0.75 0.2 250 / 0.8)" },
  ring: { boxShadow: "0 0 0 3px oklch(0.75 0.25 330), 0 0 0 6px oklch(0.85 0.2 190)" },
  diamond: { boxShadow: "0 0 0 3px oklch(0.92 0.06 220), 0 0 22px oklch(0.85 0.12 220 / 0.9)" },
};

export function frameStyle(preview: string | undefined): CSSProperties | undefined {
  return preview ? FRAME_STYLES[preview] : undefined;
}
