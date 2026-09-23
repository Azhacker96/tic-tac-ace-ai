import { cn } from "@/lib/utils";
import type { Player } from "@/lib/game/engine";

export function SymbolPicker({
  value,
  onChange,
  label = "Your mark",
  disabled,
}: {
  value: Player;
  onChange: (p: Player) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {(["X", "O"] as Player[]).map((symbol) => (
          <button
            key={symbol}
            type="button"
            disabled={disabled}
            onClick={() => onChange(symbol)}
            className={cn(
              "flex items-center justify-center gap-2 rounded-2xl border py-3 font-display text-xl active:scale-95 disabled:opacity-50",
              value === symbol
                ? "border-primary bg-primary/15"
                : "border-border bg-surface",
              symbol === "X" ? "text-mark-x" : "text-mark-o",
            )}
          >
            {symbol === "X" ? "✕" : "◯"}
            <span className="font-sans text-sm text-foreground">
              {symbol === "X" ? "goes first" : "goes second"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
