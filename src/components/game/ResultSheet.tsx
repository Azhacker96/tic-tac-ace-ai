import { useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";


import { Confetti } from "@/components/game/Confetti";
import { noteGameFinished } from "@/lib/ads";
import { claimAdReward, useRefreshCoins, useWallet } from "@/lib/coins";
import { sfx } from "@/lib/sound";
import { cn } from "@/lib/utils";

export type Outcome = "win" | "loss" | "draw";

interface ResultSheetProps {
  open: boolean;
  outcome: Outcome;
  headline: string;
  detail?: string | undefined;
  stats?: { wins: number; losses: number; draws: number } | undefined;
  children?: ReactNode;
  /** Server reference of an online win (match:id:round) — enables the 2x coins bonus. */
  winRef?: string | undefined;
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
  winRef,
}: ResultSheetProps) {
  const wallet = useWallet();
  const refresh = useRefreshCoins();
  const adFree = wallet.data?.ad_free ?? false;
  const counted = useRef(false);
  const [doubled, setDoubled] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) { counted.current = false; return; }
    if (counted.current) return;
    counted.current = true;
    noteGameFinished(adFree, wallet.data?.interstitial_every ?? 3);
  }, [open, adFree, wallet.data?.interstitial_every]);

  if (!open) return null;
  const canDouble = outcome === "win" && winRef && doubled !== winRef && wallet.data && wallet.data.ad_rewards_left > 0;
  const double = async () => {
    if (!winRef) return;
    setBusy(true);
    const r = await claimAdReward("double_win", adFree, winRef);
    setBusy(false);
    if (!r.ok) { toast.error(r.error); return; }
    setDoubled(winRef);
    void refresh();
    try { sfx.coin(); } catch { /* optional */ }
    toast.success(`+${wallet.data?.win_reward ?? 0} bonus coins`);
  };
  const { emoji, tone } = COPY[outcome];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 backdrop-blur-sm">
      {outcome === "win" ? <Confetti /> : null}
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

        <div className="mt-5 grid gap-2 pb-5">
          {canDouble ? (
            <button
              type="button"
              onClick={double}
              disabled={busy}
              className="flex items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3.5 font-semibold text-accent-foreground disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : adFree ? "👑 Claim 2x coins" : "🎬 Watch ad · 2x coins"}
            </button>
          ) : null}
          {children}
        </div>
      </div>
    </div>
  );
}
