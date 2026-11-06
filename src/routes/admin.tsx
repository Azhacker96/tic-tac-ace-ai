import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Screen } from "@/components/Screen";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { DEFAULT_SETTINGS, fetchAppSettings, useIsAdmin, type AppSettings } from "@/lib/app-settings";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Panel — Tic Tac Arcade" },
      { name: "description", content: "Admin-only dashboard for game analytics, players, economy and app configuration." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Admin Panel — Tic Tac Arcade" },
      { property: "og:description", content: "Admin-only game management dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

const TABS = [
  ["stats", "📊 Stats"],
  ["players", "👥 Players"],
  ["economy", "💰 Economy"],
  ["store", "🛒 Store"],
  ["ads", "📢 Ads & IAP"],
  ["app", "⚙️ App"],
] as const;
type Tab = (typeof TABS)[number][0];

const input = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm";
const btn = "rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50";
const btn2 = "rounded-xl border border-border px-3 py-2 text-xs font-semibold";

async function rpc<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase.rpc as unknown as (f: string, a?: object) => Promise<{ data: T; error: { message: string } | null }>)(fn, args);
  if (error) throw new Error(error.message);
  return data;
}
async function run(p: Promise<unknown>, ok = "Saved") {
  try { await p; toast.success(ok); return true; } catch (e) { toast.error((e as Error).message); return false; }
}

function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="mb-4 rounded-2xl border border-border bg-surface p-4">
      {title ? <h2 className="mb-3 text-sm font-semibold">{title}</h2> : null}
      {children}
    </section>
  );
}

function AdminPage() {
  const { session } = useApp();
  const { data: isAdmin, isLoading } = useIsAdmin(!!session?.user);
  const [tab, setTab] = useState<Tab>("stats");

  if (!session?.user || (!isLoading && !isAdmin)) {
    return (
      <Screen title="Admin">
        <Card>
          <p className="text-sm text-muted-foreground">This area is for admins only.</p>
          <Link to="/home" className={cn(btn2, "mt-3 inline-block")}>Back home</Link>
        </Card>
      </Screen>
    );
  }
  if (isLoading) return <Screen title="Admin"><p className="text-sm text-muted-foreground">Checking access…</p></Screen>;

  return (
    <Screen title="Admin Panel" backTo="/settings">
      <div className="-mx-1 mb-4 flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={cn("shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold",
              tab === id ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
            {label}
          </button>
        ))}
      </div>
      {tab === "stats" && <Stats />}
      {tab === "players" && <Players />}
      {tab === "economy" && <Economy />}
      {tab === "store" && <Store />}
      {tab === "ads" && <AdsIap />}
      {tab === "app" && <AppTab />}
    </Screen>
  );
}

/* ---------------- Stats ---------------- */
function Stats() {
  const { data, refetch, isFetching } = useQuery({ queryKey: ["admin", "stats"], queryFn: () => rpc<Record<string, number>>("admin_analytics") });
  const items: [string, string][] = [
    ["players", "Total players"], ["new_today", "New today"], ["online_now", "Online now"],
    ["active_today", "Active today"], ["active_week", "Active this week"], ["matches_total", "Online matches"],
    ["matches_today", "Matches today"], ["coins_total", "Coins in wallets"], ["gems_total", "Gems in wallets"],
    ["ad_free_users", "Ad-Free players"], ["ads_today", "Ad bonuses today"], ["shop_sales", "Store items owned"],
  ];
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {items.map(([k, l]) => (
          <div key={k} className="rounded-2xl border border-border bg-surface p-3">
            <p className="text-[11px] text-muted-foreground">{l}</p>
            <p className="font-display text-xl">{data ? (data[k] ?? 0).toLocaleString() : "…"}</p>
          </div>
        ))}
      </div>
      <button className={cn(btn2, "mt-3")} onClick={() => void refetch()} disabled={isFetching}>Refresh</button>
    </>
  );
}

/* ---------------- Players ---------------- */
interface UserRow { user_id: string; email: string | null; player_id: string; nickname: string; wins: number; losses: number; draws: number; coins: number; gems: number; ad_free: boolean; last_seen: string; is_admin: boolean }

function Players() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const qc = useQueryClient();
  const { data, isFetching } = useQuery({ queryKey: ["admin", "users", search], queryFn: () => rpc<UserRow[]>("admin_list_users", { p_search: search, p_limit: 50 }) });
  const [open, setOpen] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "users"] });

  return (
    <>
      <form className="mb-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); setSearch(q); }}>
        <input className={input} placeholder="Nickname, Player ID or email" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className={btn}>Search</button>
      </form>
      {isFetching && !data ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      <div className="grid gap-2">
        {(data ?? []).map((u) => (
          <div key={u.user_id} className="rounded-2xl border border-border bg-surface p-3">
            <button className="flex w-full items-center gap-2 text-left" onClick={() => setOpen(open === u.user_id ? null : u.user_id)}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{u.nickname} {u.is_admin ? "🛡️" : ""} {u.ad_free ? "👑" : ""}</p>
                <p className="truncate text-[11px] text-muted-foreground">{u.player_id} · {u.email ?? "—"}</p>
              </div>
              <div className="text-right text-xs">
                <p>🪙 {u.coins}</p><p>💎 {u.gems}</p>
              </div>
            </button>
            {open === u.user_id ? <PlayerActions u={u} onDone={refresh} /> : null}
          </div>
        ))}
        {data && data.length === 0 ? <p className="text-sm text-muted-foreground">No players found.</p> : null}
      </div>
    </>
  );
}

function PlayerActions({ u, onDone }: { u: UserRow; onDone: () => void }) {
  const [coins, setCoins] = useState("0");
  const [gems, setGems] = useState("0");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const act = async (p: Promise<unknown>, ok: string) => { setBusy(true); if (await run(p, ok)) onDone(); setBusy(false); };
  return (
    <div className="mt-3 grid gap-2 border-t border-border pt-3">
      <p className="text-[11px] text-muted-foreground">W {u.wins} · L {u.losses} · D {u.draws} · last seen {new Date(u.last_seen).toLocaleString()}</p>
      <p className="text-xs font-semibold">Add or remove (use minus to remove)</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px]">Coins<input className={input} type="number" value={coins} onChange={(e) => setCoins(e.target.value)} /></label>
        <label className="text-[11px]">Gems<input className={input} type="number" value={gems} onChange={(e) => setGems(e.target.value)} /></label>
      </div>
      <input className={input} placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        <button className={btn} disabled={busy} onClick={() => void act(rpc("admin_adjust_wallet", { p_user: u.user_id, p_coins: Number(coins) || 0, p_gems: Number(gems) || 0, p_reason: reason }), "Wallet updated")}>Apply</button>
        <button className={btn2} disabled={busy} onClick={() => void act(rpc("admin_reset_cooldowns", { p_user: u.user_id }), "Bonuses & spin are claimable again")}>Reset bonuses</button>
        <button className={btn2} disabled={busy} onClick={() => void act(rpc("admin_set_ad_free", { p_user: u.user_id, p_on: !u.ad_free }), u.ad_free ? "Ad-Free removed" : "Ad-Free granted")}>{u.ad_free ? "Remove Ad-Free" : "Give Ad-Free"}</button>
      </div>
    </div>
  );
}

/* ---------------- Economy ---------------- */
interface Economy {
  config: { key: string; value: number; description: string | null }[];
  shop: { id: string; name: string; category: string; preview: string; price: number; gem_price: number | null; active: boolean }[];
  iap: { id: string; name: string; coins: number; gems: number; ad_free: boolean; price_label: string; badge: string | null; active: boolean; play_product_id: string | null }[];
  spin: { slot: number; amount: number; weight: number; label: string }[];
}
const useEconomy = () => useQuery({ queryKey: ["admin", "economy"], queryFn: () => rpc<Economy>("admin_economy") });

const CONFIG_LABELS: Record<string, string> = {
  signup_bonus: "Signup coins", signup_gems: "Signup gems", daily_bonus: "Daily bonus coins",
  weekly_bonus: "Weekly bonus coins", win_reward: "Online win coins", loss_penalty: "Online loss coins (taken)",
  ad_daily_cap: "Ad bonuses per day", interstitial_every: "Forced ad every N games",
  allow_negative_balance: "Allow negative balance (0/1)",
};

function Economy() {
  const { data } = useEconomy();
  const qc = useQueryClient();
  return (
    <>
      <Card title="Bonuses & match rewards">
        <div className="grid gap-2">
          {(data?.config ?? []).map((c) => (
            <NumRow key={c.key} label={CONFIG_LABELS[c.key] ?? c.key} value={c.value}
              onSave={(v) => run(rpc("admin_set_config", { p_key: c.key, p_value: v })).then(() => qc.invalidateQueries({ queryKey: ["admin", "economy"] }))} />
          ))}
        </div>
      </Card>
      <Card title="Lucky Spin prizes">
        <div className="grid gap-2">
          {(data?.spin ?? []).map((s) => <SpinRow key={s.slot} s={s} />)}
        </div>
      </Card>
      <GiftAll />
    </>
  );
}

function NumRow({ label, value, onSave }: { label: string; value: number; onSave: (v: number) => void }) {
  const [v, setV] = useState(String(value));
  useEffect(() => setV(String(value)), [value]);
  return (
    <div className="flex items-center gap-2">
      <span className="flex-1 text-xs">{label}</span>
      <input className={cn(input, "w-24")} type="number" value={v} onChange={(e) => setV(e.target.value)} />
      <button className={btn} disabled={String(value) === v} onClick={() => onSave(Number(v) || 0)}>Save</button>
    </div>
  );
}

function SpinRow({ s }: { s: Economy["spin"][number] }) {
  const [a, setA] = useState(String(s.amount));
  const [w, setW] = useState(String(s.weight));
  const [l, setL] = useState(s.label);
  return (
    <div className="grid grid-cols-[1fr_4rem_4rem_auto] items-end gap-1.5">
      <label className="text-[10px]">Label<input className={input} value={l} onChange={(e) => setL(e.target.value)} /></label>
      <label className="text-[10px]">Coins<input className={input} type="number" value={a} onChange={(e) => setA(e.target.value)} /></label>
      <label className="text-[10px]">Chance<input className={input} type="number" value={w} onChange={(e) => setW(e.target.value)} /></label>
      <button className={btn} onClick={() => void run(rpc("admin_update_spin", { p_slot: s.slot, p_amount: Number(a) || 0, p_weight: Number(w) || 0, p_label: l }))}>Save</button>
    </div>
  );
}

function GiftAll() {
  const [c, setC] = useState("0");
  const [g, setG] = useState("0");
  const [busy, setBusy] = useState(false);
  return (
    <Card title="🎁 Send a gift to every player">
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px]">Coins<input className={input} type="number" min={0} value={c} onChange={(e) => setC(e.target.value)} /></label>
        <label className="text-[11px]">Gems<input className={input} type="number" min={0} value={g} onChange={(e) => setG(e.target.value)} /></label>
      </div>
      <button className={cn(btn, "mt-2")} disabled={busy} onClick={async () => {
        if (!window.confirm(`Send ${c} coins and ${g} gems to every player?`)) return;
        setBusy(true);
        try { const n = await rpc<number>("admin_broadcast_gift", { p_coins: Number(c) || 0, p_gems: Number(g) || 0, p_title: "gift" }); toast.success(`Gift sent to ${n} players`); }
        catch (e) { toast.error((e as Error).message); }
        setBusy(false);
      }}>Send gift</button>
    </Card>
  );
}

/* ---------------- Store ---------------- */
function Store() {
  const { data } = useEconomy();
  return (
    <div className="grid gap-2">
      {(data?.shop ?? []).map((it) => <ShopRow key={it.id} it={it} />)}
    </div>
  );
}
function ShopRow({ it }: { it: Economy["shop"][number] }) {
  const [p, setP] = useState(String(it.price));
  const [g, setG] = useState(it.gem_price == null ? "" : String(it.gem_price));
  const [on, setOn] = useState(it.active);
  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      <p className="text-sm font-semibold">{it.name} <span className="text-[11px] font-normal text-muted-foreground">· {it.category}</span></p>
      <div className="mt-2 grid grid-cols-[1fr_1fr_auto_auto] items-end gap-1.5">
        <label className="text-[10px]">Coin price<input className={input} type="number" value={p} onChange={(e) => setP(e.target.value)} /></label>
        <label className="text-[10px]">Gem price (blank = coins)<input className={input} type="number" value={g} onChange={(e) => setG(e.target.value)} /></label>
        <label className="flex items-center gap-1 pb-2 text-[11px]"><input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} />Live</label>
        <button className={btn} onClick={() => void run(rpc("admin_update_shop_item", { p_id: it.id, p_price: Number(p) || 0, p_gem_price: g === "" ? null : Number(g), p_active: on }))}>Save</button>
      </div>
    </div>
  );
}

/* ---------------- Settings helpers ---------------- */
function useSettingsForm() {
  const { data } = useQuery({ queryKey: ["app-settings"], queryFn: fetchAppSettings });
  const [s, setS] = useState<AppSettings>(DEFAULT_SETTINGS);
  useEffect(() => { if (data) setS(data); }, [data]);
  const qc = useQueryClient();
  const save = (key: keyof AppSettings) =>
    run(rpc("admin_set_setting", { p_key: key, p_value: s[key] })).then(() => qc.invalidateQueries({ queryKey: ["app-settings"] }));
  return { s, setS, save };
}
function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <label className="grid gap-1 text-[11px]">{label}<input className={input} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /></label>;
}

/* ---------------- Ads & IAP ---------------- */
function AdsIap() {
  const { s, setS, save } = useSettingsForm();
  const { data } = useEconomy();
  const ad = s.admob;
  const setAd = (k: keyof typeof ad, v: string | boolean) => setS({ ...s, admob: { ...ad, [k]: v } });
  return (
    <>
      <Card title="Google AdMob">
        <div className="grid gap-2">
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={ad.enabled} onChange={(e) => setAd("enabled", e.target.checked)} />Ads switched on (off = no ads anywhere, bonuses given without video)</label>
          <Field label="AdMob App ID" placeholder="ca-app-pub-xxxx~yyyy" value={ad.app_id} onChange={(v) => setAd("app_id", v)} />
          <Field label="Banner unit ID" placeholder="ca-app-pub-xxxx/yyyy" value={ad.banner_id} onChange={(v) => setAd("banner_id", v)} />
          <Field label="Interstitial unit ID" value={ad.interstitial_id} onChange={(v) => setAd("interstitial_id", v)} />
          <Field label="Rewarded unit ID" value={ad.rewarded_id} onChange={(v) => setAd("rewarded_id", v)} />
          <p className="text-[11px] text-muted-foreground">Note: Google also needs the App ID inside the Android app file, so set it again when building the Android app.</p>
          <button className={btn} onClick={() => void save("admob")}>Save AdMob</button>
        </div>
      </Card>
      <Card title="Google Play billing">
        <div className="grid gap-2">
          <Field label="Android package name" placeholder="com.yourname.tictacarcade" value={s.billing.package_name} onChange={(v) => setS({ ...s, billing: { ...s.billing, package_name: v } })} />
          <button className={btn} onClick={() => void save("billing")}>Save</button>
        </div>
      </Card>
      <p className="mb-2 text-xs font-semibold">Bundles & packs</p>
      <div className="grid gap-2">
        {(data?.iap ?? []).map((p) => <IapRow key={p.id} p={p} />)}
      </div>
    </>
  );
}
function IapRow({ p }: { p: Economy["iap"][number] }) {
  const [f, setF] = useState({ name: p.name, coins: String(p.coins), gems: String(p.gems), price: p.price_label, play: p.play_product_id ?? "", badge: p.badge ?? "", active: p.active });
  const set = (k: keyof typeof f, v: string | boolean) => setF({ ...f, [k]: v });
  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      <div className="grid grid-cols-2 gap-1.5">
        <Field label="Name" value={f.name} onChange={(v) => set("name", v)} />
        <Field label="Shown price" value={f.price} onChange={(v) => set("price", v)} />
        <Field label="Coins" value={f.coins} onChange={(v) => set("coins", v)} />
        <Field label="Gems" value={f.gems} onChange={(v) => set("gems", v)} />
        <Field label="Google Play product ID" placeholder={p.id} value={f.play} onChange={(v) => set("play", v)} />
        <Field label="Badge" value={f.badge} onChange={(v) => set("badge", v)} />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <label className="flex items-center gap-1 text-[11px]"><input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} />Live in shop</label>
        <button className={btn} onClick={() => void run(rpc("admin_update_iap", { p_id: p.id, p_name: f.name, p_coins: Number(f.coins) || 0, p_gems: Number(f.gems) || 0, p_price_label: f.price, p_play_id: f.play, p_badge: f.badge, p_active: f.active }))}>Save</button>
      </div>
    </div>
  );
}

/* ---------------- App ---------------- */
function AppTab() {
  const { s, setS, save } = useSettingsForm();
  const g = s.general;
  const setG = (k: keyof typeof g, v: string | boolean) => setS({ ...s, general: { ...g, [k]: v } });
  return (
    <Card title="App settings">
      <div className="grid gap-2">
        <Field label="Support / contact email (shown on Privacy page)" placeholder="support@yourdomain.com" value={g.support_email} onChange={(v) => setG("support_email", v.trim())} />
        <Field label="Minimum app version (optional)" placeholder="1.0.0" value={g.min_version} onChange={(v) => setG("min_version", v)} />
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={g.maintenance} onChange={(e) => setG("maintenance", e.target.checked)} />Maintenance mode (players see a "be right back" screen; admins don't)</label>
        <Field label="Maintenance message" value={g.maintenance_message} onChange={(v) => setG("maintenance_message", v)} />
        <button className={btn} onClick={() => {
          if (g.support_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(g.support_email)) { toast.error("Enter a valid email"); return; }
          void save("general");
        }}>Save</button>
      </div>
    </Card>
  );
}
