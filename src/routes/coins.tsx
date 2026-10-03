import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { CoinBadge } from "@/components/CoinBadge";
import { EmptyState, RequiresGoogle, Screen } from "@/components/Screen";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { TX_LABELS, formatCountdown, useRefreshCoins, useTransactions, useWallet, type Wallet } from "@/lib/coins";
import { sfx } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { friendlyError } from "@/lib/validation";

export const Route = createFileRoute("/coins")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Rewards & Coins — Tic Tac Arcade" },
      { name: "description", content: "Claim daily and weekly coin bonuses and review your coin history." },
      { property: "og:title", content: "Rewards & Coins — Tic Tac Arcade" },
      { property: "og:description", content: "Daily and weekly bonuses and coin history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CoinsScreen,
});

function BonusCard({ kind, wallet, now }: { kind: "daily" | "weekly"; wallet: Wallet; now: number }) {
  const qc = useQueryClient();
  const refresh = useRefreshCoins();
  const [busy, setBusy] = useState(false);
  const next = kind === "daily" ? wallet.daily_next : wallet.weekly_next;
  const amount = kind === "daily" ? wallet.daily_amount : wallet.weekly_amount;
  const nextMs = next ? new Date(next).getTime() : 0;
  const available = !next || nextMs <= now;

  const claim = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("claim_bonus", { p_kind: kind });
    setBusy(false);
    if (error) {
      toast.error(friendlyError(error, "Couldn't claim the bonus"));
      void refresh();
      return;
    }
    qc.setQueriesData({ queryKey: ["coins"], predicate: (q) => q.queryKey[2] === "wallet" }, data);
    void refresh();
    try { sfx.coin(); } catch { /* audio optional */ }
    toast.success(`+${amount} coins`);
  };

  return (
    <div className={cn("rounded-2xl border p-4", available ? "border-primary bg-primary/10" : "border-border bg-surface")}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{kind === "daily" ? "Daily Bonus" : "Weekly Bonus"}</p>
      <p className="mt-1 font-display text-2xl">🪙 {amount}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {available ? "Ready to claim" : `Next in ${formatCountdown(nextMs, now)}`}
      </p>
      <button
        type="button"
        onClick={claim}
        disabled={!available || busy}
        className="mt-3 flex w-full items-center justify-center rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : available ? "Claim" : "Claimed"}
      </button>
    </div>
  );
}

function CoinsScreen() {
  const { identity } = useApp();
  const wallet = useWallet();
  const txs = useTransactions();
  const [now, setNow] = useState(() => Date.now());
  const [skew, setSkew] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    if (wallet.data) setSkew(new Date(wallet.data.server_now).getTime() - Date.now());
  }, [wallet.data]);

  if (identity && identity.kind !== "google") {
    return (
      <Screen title="Rewards & Coins">
        <RequiresGoogle feature="Coins and rewards" />
      </Screen>
    );
  }

  return (
    <Screen title="Rewards & Coins" subtitle="Virtual coins · no real-money value" action={<CoinBadge link={false} />}>
      {wallet.isError ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Couldn&apos;t load your wallet. Check your connection.
        </div>
      ) : !wallet.data ? (
        <div className="flex justify-center py-10"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <BonusCard kind="daily" wallet={wallet.data} now={now + skew} />
            <BonusCard kind="weekly" wallet={wallet.data} now={now + skew} />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl border border-border bg-surface p-3 text-center text-xs">
            <div><p className="font-display text-lg text-success">+{wallet.data.earned}</p><p className="text-muted-foreground">Earned</p></div>
            <div><p className="font-display text-lg text-destructive">-{wallet.data.spent}</p><p className="text-muted-foreground">Spent</p></div>
            <div><p className="font-display text-lg">+{wallet.data.win_reward} / -{wallet.data.loss_penalty}</p><p className="text-muted-foreground">Online win / loss</p></div>
          </div>
        </>
      )}

      <h2 className="mb-2 mt-6 font-display text-base">Coin history</h2>
      {txs.isLoading ? (
        <div className="flex justify-center py-6"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
      ) : !txs.data || txs.data.length === 0 ? (
        <EmptyState icon="🪙" title="No transactions yet" />
      ) : (
        <ul className="grid gap-2">
          {txs.data.map((t) => (
            <li key={t.id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{TX_LABELS[t.type] ?? t.type}</p>
                <p className="text-[11px] text-muted-foreground">{new Date(t.created_at).toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className={cn("font-display", t.amount > 0 ? "text-success" : t.amount < 0 ? "text-destructive" : "text-muted-foreground")}>
                  {t.amount > 0 ? `+${t.amount}` : t.amount}
                </p>
                <p className="text-[11px] text-muted-foreground">Bal {t.balance_after}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-6 text-center text-[11px] text-muted-foreground">
        Online match results earn or cost coins. Offline games don&apos;t, so coins can&apos;t be farmed.
      </p>
    </Screen>
  );
}
