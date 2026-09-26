import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type Outcome = "win" | "loss" | "draw";

interface ResultSheetProps {
  open: boolean;
  outcome: Outcome;
  headline: string;
  detail?: string | undefined;
  stats?: { wins: number; losses: number; draws: number } | undefined;
  children?: ReactNode;
}

const COPY: Record<Outcome, { emoji: string; tone: string }> = {
  win: { emoji: "🏆", tone: "text-success" },
  loss: { emoji: "💥", tone: "text-destructive" },
  draw: { emoji: "🤝", tone: "text-accent" },
};

export function ResultSheet({
  open,
  outcome,
  headline,
  detail,
  stats,
  children,
}: ResultSheetProps) {
  if (!open) return null;
  const { emoji, tone } = COPY[outcome];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 backdrop-blur-sm">
      <div className="safe-bottom w-full max-w-[34rem] animate-rise rounded-t-3xl border-t border-border bg-surface px-5 pt-6">
        <div className="text-center">
          <div className="text-5xl">{emoji}</div>
          <h2 className={cn("mt-2 font-display text-2xl", tone)}>{headline}</h2>
          {detail ? <p className="mt-1 text-sm text-muted-foreground">{detail}</p> : null}
        </div>

        {stats ? (
          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            {[
              { label: "Wins", value: stats.wins },
              { label: "Losses", value: stats.losses },
              { label: "Draws", value: stats.draws },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-background p-3">
                <p className="font-display text-xl">{s.value}</p>
                <p className="text-[11px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-5 grid gap-2 pb-5">{children}</div>
      </div>
    </div>
  );
}
