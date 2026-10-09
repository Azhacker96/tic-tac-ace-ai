import type { CSSProperties } from "react";

/**
 * Visual definitions for shop cosmetics, keyed by the item's `preview` value.
 * Prices/ownership live on the server; this file only knows how to draw them.
 * Add a new skin: insert a shop_items row and add its preview key here.
 */
export const BOARD_SKINS: Record<string, CSSProperties> = {
  ice: {
    "--board-bg": "oklch(0.36 0.07 230)",
    "--board-line": "oklch(0.62 0.1 215)",
    "--cell-bg": "oklch(0.28 0.06 232)",
  } as CSSProperties,
  jungle: {
    "--board-bg": "oklch(0.34 0.08 150)",
    "--board-line": "oklch(0.55 0.12 140)",
    "--cell-bg": "oklch(0.26 0.06 155)",
  } as CSSProperties,
  royal: {
    "--board-bg": "oklch(0.3 0.08 300)",
    "--board-line": "oklch(0.8 0.14 85)",
    "--cell-bg": "oklch(0.24 0.07 300)",
  } as CSSProperties,
  cyber: {
    "--board-bg": "oklch(0.2 0.06 300)",
    "--board-line": "oklch(0.8 0.2 330)",
    "--cell-bg": "oklch(0.16 0.05 280)",
  } as CSSProperties,
  chalk: {
    "--board-bg": "oklch(0.3 0.03 160)",
    "--board-line": "oklch(0.92 0.01 100)",
    "--cell-bg": "oklch(0.26 0.03 160)",
  } as CSSProperties,
  gold: {
    "--board-bg": "oklch(0.28 0.04 80)",
    "--board-line": "oklch(0.85 0.15 88)",
    "--cell-bg": "oklch(0.2 0.03 80)",
  } as CSSProperties,
  wood: {
    "--board-bg": "oklch(0.42 0.08 55)",
    "--board-line": "oklch(0.3 0.06 50)",
    "--cell-bg": "oklch(0.55 0.09 65)",
  } as CSSProperties,
};

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
