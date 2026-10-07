import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";

import { AvatarGlyph } from "@/components/AvatarGlyph";
import { EmptyState, RequiresGoogle, Screen } from "@/components/Screen";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/leaderboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Leaderboard — Tic Tac Arcade" },
      { name: "description", content: "Global and friends rankings plus head-to-head scorecards." },
      { property: "og:title", content: "Leaderboard — Tic Tac Arcade" },
      { property: "og:description", content: "See who rules Tic Tac Arcade — globally and among friends." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Leaderboard,
});

type Tab = "global" | "friends" | "h2h";
const TABS: { id: Tab; label: string }[] = [
  { id: "global", label: "Global" },
  { id: "friends", label: "Friends" },
  { id: "h2h", label: "Head-to-Head" },
];

interface RankRow {
  user_id: string; player_id: string; nickname: string; avatar: string;
  wins: number; losses: number; draws: number; rank: number; is_me: boolean;
}
interface H2HRow {
  user_id: string; player_id: string; nickname: string; avatar: string;
  my_wins: number; their_wins: number; draws: number; played: number;
}

function useRanks(tab: "global" | "friends") {
  return useQuery({
    queryKey: ["leaderboard", tab],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } =
        tab === "global"
          ? await supabase.rpc("get_global_leaderboard", { p_limit: 20 })
          : await supabase.rpc("get_friends_leaderboard");
      if (error) throw error;
      return (data ?? []) as unknown as RankRow[];
    },
  });
}

function useH2H() {
  return useQuery({
    queryKey: ["leaderboard", "h2h"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_head_to_head");
      if (error) throw error;
      return (data ?? []) as unknown as H2HRow[];
    },
  });
}

const medal = (r: number) => (r === 1 ? "🥇" : r === 2 ? "🥈" : r === 3 ? "🥉" : `#${r}`);
const rate = (w: number, l: number, d: number) => {
  const t = w + l + d;
  return t ? Math.round((w / t) * 100) : 0;
};

function RankItem({ r, sticky }: { r: RankRow; sticky?: boolean }) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-2xl border px-3 py-2.5",
        r.is_me ? "border-primary bg-primary/10" : "border-border bg-surface",
        sticky && "shadow-lg",
      )}
    >
      <span className="w-9 text-center text-sm font-bold tabular-nums">{medal(r.rank)}</span>
      <span className="flex size-10 items-center justify-center overflow-hidden rounded-full bg-background text-xl">
        <AvatarGlyph avatar={r.avatar} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{r.nickname}{r.is_me ? " (You)" : ""}</span>
        <span className="block text-xs text-muted-foreground">{r.player_id}</span>
      </span>
      <span className="text-right">
        <span className="block font-bold tabular-nums">{r.wins} W</span>
        <span className="block text-xs text-muted-foreground">{rate(r.wins, r.losses, r.draws)}%</span>
      </span>
    </li>
  );
}

function RankList({ tab }: { tab: "global" | "friends" }) {
  const q = useRanks(tab);
  if (q.isLoading) return <Spinner />;
  if (q.isError) return <EmptyState icon="⚠️" title="Couldn't load rankings" description="Check your connection and try again." />;
  const rows = q.data ?? [];
  const me = rows.find((r) => r.is_me);
  const list = tab === "global" ? rows.filter((r) => !r.is_me || r.rank <= 20).slice(0, 20) : rows;
  const meOutside = tab === "global" && me && !list.includes(me);
  if (tab === "friends" && rows.length <= 1)
    return <EmptyState icon="🤝" title="No friends yet" description="Add friends to compete on this board." />;
  return (
    <>
      <ul className="space-y-2">{list.map((r) => <RankItem key={r.user_id} r={r} />)}</ul>
      {me ? (
        <div className="sticky bottom-20 mt-3">
          {meOutside ? <p className="mb-1 text-center text-xs text-muted-foreground">Your position</p> : null}
          <ul><RankItem r={me} sticky /></ul>
        </div>
      ) : null}
    </>
  );
}

function H2HList() {
  const q = useH2H();
  const { identity } = useApp();
  if (q.isLoading) return <Spinner />;
  if (q.isError) return <EmptyState icon="⚠️" title="Couldn't load scorecard" description="Check your connection and try again." />;
  const rows = q.data ?? [];
  if (!rows.length) return <EmptyState icon="⚔️" title="No rivals yet" description="Add friends and play them online to build your scorecard." />;
  const tot = rows.reduce((a, r) => ({ w: a.w + r.my_wins, l: a.l + r.their_wins, d: a.d + r.draws }), { w: 0, l: 0, d: 0 });
  return (
    <>
      <div className="mb-3 flex items-center gap-3 rounded-2xl border border-primary bg-primary/10 px-3 py-2.5">
        <span className="flex size-10 items-center justify-center overflow-hidden rounded-full bg-background text-xl">
          <AvatarGlyph avatar={identity?.avatar} />
        </span>
        <span className="flex-1 font-semibold">You vs all friends</span>
        <Score w={tot.w} l={tot.l} d={tot.d} />
      </div>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.user_id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-3 py-2.5">
            <span className="flex size-10 items-center justify-center overflow-hidden rounded-full bg-background text-xl">
              <AvatarGlyph avatar={r.avatar} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{r.nickname}</span>
              <span className="block text-xs text-muted-foreground">
                {r.played ? (r.my_wins > r.their_wins ? "You lead 🔥" : r.my_wins < r.their_wins ? "They lead ⚔️" : "Tied") : "Not played yet"}
              </span>
            </span>
            <Score w={r.my_wins} l={r.their_wins} d={r.draws} />
          </li>
        ))}
      </ul>
    </>
  );
}

function Score({ w, l, d }: { w: number; l: number; d: number }) {
  return (
    <span className="flex gap-2 text-xs font-bold tabular-nums">
      <span className="text-success">{w}W</span>
      <span className="text-destructive">{l}L</span>
      <span className="text-muted-foreground">{d}D</span>
    </span>
  );
}

function Spinner() {
  return <div className="flex justify-center py-10"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
}

function Leaderboard() {
  const { identity } = useApp();
  const [tab, setTab] = useState<Tab>("global");
  if (identity && identity.kind !== "google") {
    return <Screen title="Leaderboard"><RequiresGoogle feature="The Leaderboard" /></Screen>;
  }
  return (
    <Screen title="Leaderboard" subtitle="Online wins">
      <div role="tablist" className="mb-4 grid grid-cols-3 gap-1 rounded-2xl border border-border bg-surface p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "h-10 rounded-xl text-sm font-semibold transition-colors active:scale-95",
              tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "h2h" ? <H2HList /> : <RankList key={tab} tab={tab} />}
    </Screen>
  );
}
