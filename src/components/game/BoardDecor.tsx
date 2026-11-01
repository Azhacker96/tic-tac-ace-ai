import type { BoardDecor } from "@/lib/cosmetics";

const GLYPH: Record<BoardDecor, string | null> = {
  bevel: null,
  hud: null,
  leaf: "❦",
  star: "✦",
  rivet: null,
  frost: "❄",
  chalk: null,
  gold: "◆",
};

/** Four themed corner ornaments drawn over a board frame. Purely decorative. */
export function BoardCorners({ decor, accent, size = 18 }: { decor: BoardDecor; accent: string; size?: number }) {
  if (decor === "chalk") return null;
  const pos = ["left-1 top-1", "right-1 top-1 rotate-90", "right-1 bottom-1 rotate-180", "left-1 bottom-1 -rotate-90"];
  return (
    <>
      {pos.map((p) => (
        <span key={p} aria-hidden className={`pointer-events-none absolute ${p} flex items-center justify-center`} style={{ width: size, height: size }}>
          {decor === "hud" || decor === "bevel" ? (
            <span
              className="block size-full"
              style={{
                borderTop: `2px solid ${accent}`,
                borderLeft: `2px solid ${accent}`,
                opacity: decor === "bevel" ? 0.5 : 1,
                filter: decor === "hud" ? `drop-shadow(0 0 4px ${accent})` : undefined,
              }}
            />
          ) : decor === "rivet" ? (
            <span
              className="block rounded-full"
              style={{
                width: size * 0.45,
                height: size * 0.45,
                background: `radial-gradient(circle at 35% 35%, oklch(0.95 0.08 80), ${accent} 55%, oklch(0.35 0.07 55))`,
                boxShadow: "0 1px 2px oklch(0 0 0 / 0.6)",
              }}
            />
          ) : (
            <span style={{ color: accent, fontSize: size * 0.75, lineHeight: 1, textShadow: `0 0 6px ${accent}` }}>{GLYPH[decor]}</span>
          )}
        </span>
      ))}
    </>
  );
}
