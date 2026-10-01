import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";

/**
 * Virtual coins (no real-money value). All amounts, prices and rules live on
 * the server (`coin_config`, `shop_items` + SECURITY DEFINER RPCs). The client
 * only reads balances and calls RPCs — it never decides an amount.
 */
export interface Wallet {
  balance: number;
  earned: number;
  spent: number;
  daily_amount: number;
  weekly_amount: number;
  win_reward: number;
  loss_penalty: number;
  daily_next: string | null;
  weekly_next: string | null;
  server_now: string;
}

export interface CoinTx {
  id: string;
  amount: number;
  balance_after: number;
  type: string;
  reference: string | null;
  created_at: string;
}

export type ShopCategory = "board" | "pieces" | "avatar" | "frame" | "other";

export interface ShopItem {
  id: string;
  name: string;
  category: ShopCategory;
  preview: string;
  price: number;
  active: boolean;
  sort: number;
}

export interface InventoryRow {
  item_id: string;
  equipped: boolean;
  purchased_at: string;
}

export const TX_LABELS: Record<string, string> = {
  signup_bonus: "Signup Bonus",
  daily_bonus: "Daily Bonus",
  weekly_bonus: "Weekly Bonus",
  game_win: "Game Win",
  game_loss: "Game Loss",
  game_draw: "Game Draw",
  shop_purchase: "Shop Purchase",
};

export const CATEGORY_LABELS: Record<ShopCategory, string> = {
  board: "Board Skins",
  pieces: "X/O Skins",
  avatar: "Avatars",
  frame: "Player Frames",
  other: "Other",
};

function useCoinUser() {
  const { identity } = useApp();
  const userId = identity?.kind === "google" ? identity.userId : null;
  return userId;
}

export function useWallet() {
  const userId = useCoinUser();
  return useQuery({
    queryKey: ["coins", userId, "wallet"],
    enabled: Boolean(userId),
    staleTime: 10_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_wallet");
      if (error) throw error;
      return data as unknown as Wallet;
    },
  });
}

export function useTransactions() {
  const userId = useCoinUser();
  return useQuery({
    queryKey: ["coins", userId, "transactions"],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coin_transactions")
        .select("id, amount, balance_after, type, reference, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as CoinTx[];
    },
  });
}

export function useShopItems() {
  const userId = useCoinUser();
  return useQuery({
    queryKey: ["coins", userId, "shop"],
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shop_items")
        .select("id, name, category, preview, price, active, sort")
        .order("sort");
      if (error) throw error;
      return (data ?? []) as ShopItem[];
    },
  });
}

export function useInventory() {
  const userId = useCoinUser();
  return useQuery({
    queryKey: ["coins", userId, "inventory"],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_inventory")
        .select("item_id, equipped, purchased_at");
      if (error) throw error;
      return (data ?? []) as InventoryRow[];
    },
  });
}

/** Equipped cosmetic preview keys by category, e.g. { board: "ice", pieces: "🔥|💧" }. */
export function useEquipped(): Partial<Record<ShopCategory, string>> {
  const items = useShopItems().data;
  const inv = useInventory().data;
  const out: Partial<Record<ShopCategory, string>> = {};
  if (!items || !inv) return out;
  for (const row of inv) {
    if (!row.equipped) continue;
    const item = items.find((i) => i.id === row.item_id);
    if (item) out[item.category] = item.preview;
  }
  return out;
}

export function useRefreshCoins() {
  const qc = useQueryClient();
  return useCallback(() => qc.invalidateQueries({ queryKey: ["coins"] }), [qc]);
}

export function formatCountdown(targetMs: number, nowMs: number): string {
  const s = Math.max(0, Math.floor((targetMs - nowMs) / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
