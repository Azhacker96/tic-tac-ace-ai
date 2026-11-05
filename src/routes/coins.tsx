import { useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { CoinBadge } from "@/components/CoinBadge";
import { RequiresGoogle, Screen } from "@/components/Screen";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { formatCountdown, useIapProducts, useRefreshCoins, useWallet, type Wallet } from "@/lib/coins";
import { sfx } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { friendlyError } from "@/lib/validation";

export const Route = createFileRoute("/coins")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Rewards & Coins — Tic Tac Arcade" },
      { name: "description", content: "Claim daily and weekly coin bonuses and browse gem packs and bundles." },
      { property: "og:title", content: "Rewards & Coins — Tic Tac Arcade" },
      { property: "og:description", content: "Daily and weekly bonuses, gems and bundles." },
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
    if (!wallet.ad_free) {
      const { showAd } = await import("@/lib/ads");
      const watched = await showAd("rewarded");
      if (!watched) {
        setBusy(false);
        toast.error("Watch the full ad to claim your bonus");
        return;
      }
    }
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
        {busy ? <Loader2 className="size-4 animate-spin" /> : !available ? "Claimed" : wallet.ad_free ? "👑 Claim" : "🎬 Watch ad · Claim"}
      </button>
    </div>
  );
}

function CoinsScreen() {
  const { identity } = useApp();
  const wallet = useWallet();
  const iap = useIapProducts();
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
    <Screen title="Rewards & Coins" subtitle="Daily bonuses & special packs" action={<CoinBadge link={false} />}>
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

      <div className="mb-2 mt-6 flex items-center justify-between">
        <h2 className="font-display text-base">💎 Gems & Bundles</h2>
        <Link to="/shop" className="text-xs font-semibold text-primary">Open Shop</Link>
      </div>
      {iap.isLoading ? (
        <div className="flex justify-center py-6"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <ul className="grid gap-2">
          {(iap.data ?? []).map((p) => {
            const owned = p.ad_free && wallet.data?.ad_free;
            return (
              <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
                <span className="text-3xl">{p.ad_free ? "👑" : p.coins > 0 ? "🎁" : "💎"}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-semibold">
                    {p.name}
                    {p.badge ? <span className="rounded-md bg-accent px-1.5 py-0.5 text-[10px] text-accent-foreground">{p.badge}</span> : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.ad_free ? "No forced ads · instant bonuses" : [p.coins ? `🪙 ${p.coins}` : null, p.gems ? `💎 ${p.gems}` : null].filter(Boolean).join(" + ")}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={Boolean(owned)}
                  onClick={() => toast.info("Purchases open in the Android app via Google Play.")}
                  className="shrink-0 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {owned ? "Owned" : p.price_label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Screen>
  );
}
