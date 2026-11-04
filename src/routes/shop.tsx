import { createFileRoute } from "@tanstack/react-router";
import { Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { CoinBadge } from "@/components/CoinBadge";
import { EmptyState, RequiresGoogle, Screen } from "@/components/Screen";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { sfx } from "@/lib/sound";
import {
  CATEGORY_LABELS,
  useIapProducts,
  useInventory,
  useRefreshCoins,
  useShopItems,
  useWallet,
  type ShopCategory,
  type ShopItem,
} from "@/lib/coins";
import { BoardCorners } from "@/components/game/BoardDecor";
import { boardTheme, frameStyle, pieceGlyphs } from "@/lib/cosmetics";
import { cn } from "@/lib/utils";
import { friendlyError } from "@/lib/validation";

export const Route = createFileRoute("/shop")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Shop — Tic Tac Arcade" },
      { name: "description", content: "Spend virtual coins on board skins, X/O skins, avatars and player frames." },
      { property: "og:title", content: "Shop — Tic Tac Arcade" },
      { property: "og:description", content: "Cosmetic skins, avatars and frames for coins." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Shop,
});

const CATS: ShopCategory[] = ["board", "pieces", "avatar", "frame", "other"];

function Preview({ item }: { item: ShopItem }) {
  if (item.category === "board") {
    const t = boardTheme(item.preview);
    const sample = ["X", "", "O", "", "X", "", "O", "", ""];
    return (
      <div style={t.frame} className="relative w-full overflow-hidden rounded-xl p-2">
        <BoardCorners decor={t.decor} accent={t.accent} size={12} />
        <div className="relative mx-auto grid w-[86%] grid-cols-3 gap-1">
          {sample.map((v, i) => (
            <span key={i} style={t.cell} className="flex aspect-square items-center justify-center rounded-md font-display text-base leading-none">
              {v === "X" ? <span className="text-mark-x">✕</span> : v === "O" ? <span className="text-mark-o">◯</span> : null}
            </span>
          ))}
        </div>
      </div>
    );
  }
  if (item.category === "pieces") {
    const [x, o] = pieceGlyphs(item.preview);
    return <span className="text-2xl"><span className="text-mark-x">{x}</span><span className="text-mark-o">{o}</span></span>;
  }
  if (item.category === "frame") {
    return <span style={frameStyle(item.preview)} className="flex size-12 items-center justify-center rounded-2xl bg-background text-2xl">🙂</span>;
  }
  return <span className="text-4xl">{item.preview}</span>;
}

function Shop() {
  const { identity, refreshProfile } = useApp();
  const items = useShopItems();
  const inv = useInventory();
  const wallet = useWallet();
  const refresh = useRefreshCoins();
  const [cat, setCat] = useState<ShopCategory | "bundles">("board");
  const iap = useIapProducts();
  const [busy, setBusy] = useState<string | null>(null);

  if (identity && identity.kind !== "google") {
    return (
      <Screen title="Shop">
        <RequiresGoogle feature="The Shop" />
      </Screen>
    );
  }

  const owned = new Map((inv.data ?? []).map((r) => [r.item_id, r]));
  const list = (items.data ?? []).filter((i) => i.category === cat && (i.active || owned.has(i.id)));
  const usedCats = CATS.filter((c) => c !== "other" || (items.data ?? []).some((i) => i.category === "other"));

  const afford = (item: ShopItem) =>
    item.gem_price != null ? (wallet.data?.gems ?? 0) >= item.gem_price : (wallet.data?.balance ?? 0) >= item.price;
  const buy = async (item: ShopItem) => {
    if (!afford(item)) {
      toast.error(item.gem_price != null ? "Not enough gems" : "Not enough coins");
      return;
    }
    setBusy(item.id);
    const { error } = await supabase.rpc("purchase_item", { p_item: item.id });
    setBusy(null);
    await refresh();
    if (error) toast.error(friendlyError(error, "Purchase failed"));
    else {
      sfx.coin();
      toast.success(`${item.name} unlocked`);
    }
  };

  const equip = async (item: ShopItem, on: boolean) => {
    setBusy(item.id);
    const { error } = await supabase.rpc("equip_item", { p_item: item.id, p_on: on });
    setBusy(null);
    await refresh();
    if (item.category === "avatar") await refreshProfile();
    if (error) toast.error(friendlyError(error, "Couldn't equip that item"));
    else toast.success(on ? `${item.name} equipped` : `${item.name} unequipped`);
  };

  return (
    <Screen title="Shop" subtitle="Cosmetics only · virtual coins" action={<CoinBadge />}>
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {usedCats.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCat(c)}
            className={cn(
              "shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold",
              cat === c ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-muted-foreground",
            )}
          >
            {CATEGORY_LABELS[c]}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCat("bundles")}
          className={cn(
            "shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold",
            cat === "bundles" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-muted-foreground",
          )}
        >
          💎 Gems & Bundles
        </button>
      </div>

      {cat === "bundles" ? (
        iap.isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <ul className="grid gap-2.5">
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
                      {p.ad_free
                        ? "No forced ads · instant 2x bonuses without videos"
                        : [p.coins ? `🪙 ${p.coins}` : null, p.gems ? `💎 ${p.gems}` : null].filter(Boolean).join(" + ")}
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
            <p className="mt-1 text-center text-[11px] text-muted-foreground">
              Paid through Google Play in the Android app. Gems can&apos;t be exchanged for coins.
            </p>
          </ul>
        )
      ) : items.isLoading || inv.isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
      ) : items.isError ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">Couldn&apos;t load the shop.</div>
      ) : list.length === 0 ? (
        <EmptyState icon="🛍️" title="Nothing here yet" description="New cosmetics are coming soon." />
      ) : (
        <ul className="grid grid-cols-2 gap-2.5">
          {list.map((item) => {
            const row = owned.get(item.id);
            const canAfford = afford(item);
            return (
              <li key={item.id} className={cn("flex flex-col items-center gap-2 rounded-2xl border bg-surface p-3 text-center", row?.equipped ? "border-primary" : "border-border")}>
                <div className={cn("flex items-center justify-center", item.category === "board" ? "w-full" : "h-16")}><Preview item={item} /></div>
                <p className="w-full truncate text-sm font-semibold">{item.name}</p>
                {row ? (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => equip(item, !row.equipped)}
                    className={cn(
                      "flex w-full items-center justify-center gap-1 rounded-xl py-2 text-xs font-semibold disabled:opacity-60",
                      row.equipped ? "border border-border" : "bg-primary text-primary-foreground",
                    )}
                  >
                    {busy === item.id ? <Loader2 className="size-4 animate-spin" /> : row.equipped ? <><Check className="size-3.5" /> Equipped · Remove</> : "Equip"}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy !== null || !canAfford}
                    onClick={() => buy(item)}
                    className="flex w-full items-center justify-center rounded-xl bg-primary py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {busy === item.id ? <Loader2 className="size-4 animate-spin" /> : item.gem_price != null ? `💎 ${item.gem_price}` : `🪙 ${item.price}`}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Screen>
  );
}
