import { AvatarGlyph } from "@/components/AvatarGlyph";

import { cn } from "@/lib/utils";

interface PlayerChipProps {
  name: string;
  symbol: "X" | "O";
  avatar?: string | undefined;
  active?: boolean | undefined;
  subtitle?: string | undefined;
  badge?: string | undefined;
}

export function PlayerChip({
  name,
  symbol,
  avatar,
  active,
  subtitle,
  badge,
}: PlayerChipProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl border p-2.5 transition-all",
        active
          ? "border-primary bg-primary/15 shadow-[0_0_0_1px_var(--color-primary)]"
          : "border-border bg-surface opacity-80",
      )}
    >
      <div className="flex size-9 shrink-0 overflow-hidden items-center justify-center rounded-xl bg-background text-lg">
        {avatar ? <AvatarGlyph avatar={avatar} /> : symbol === "X" ? "✕" : "◯"}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{name}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {subtitle ?? `Plays ${symbol}`}
        </p>
      </div>
      <span
        className={cn(
          "font-display text-lg",
          symbol === "X" ? "text-mark-x" : "text-mark-o",
        )}
      >
        {symbol === "X" ? "✕" : "◯"}
      </span>
      {badge ? (
        <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-foreground">
          {badge}
        </span>
      ) : null}
    </div>
  );
}
