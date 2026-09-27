import { AvatarGlyph } from "@/components/AvatarGlyph";
import { createFileRoute } from "@tanstack/react-router";
import { Ban, Check, Loader2, Search, UserMinus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { EmptyState, RequiresGoogle, Screen } from "@/components/Screen";

import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { cn } from "@/lib/utils";
import { friendlyError, normalisePlayerId, validatePlayerId } from "@/lib/validation";

export const Route = createFileRoute("/friends")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Friends — Tic Tac Arcade" },
      {
        name: "description",
        content: "Add players by Player ID, accept requests, see who is online and block nuisances.",
      },
      { property: "og:title", content: "Friends — Tic Tac Arcade" },
      { property: "og:description", content: "Add players by ID and see who's online." },
    ],
  }),
  component: Friends,
});

interface FriendRow {
  friendship_id: string;
  user_id: string;
  player_id: string;
  nickname: string;
  avatar: string;
  status: "pending" | "accepted";
  direction: "incoming" | "outgoing";
  online: boolean;
  wins: number;
  losses: number;
  draws: number;
}

interface BlockedRow {
  user_id: string;
  player_id: string;
  nickname: string;
  avatar: string;
}

function Friends() {
  const { identity } = useApp();
  const [tab, setTab] = useState<"friends" | "requests" | "blocked">("friends");
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [blocked, setBlocked] = useState<BlockedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);

  const isGoogle = identity?.kind === "google";

  const load = useCallback(async () => {
    if (!isGoogle) return;
    setLoading(true);
    const [friendRes, blockedRes] = await Promise.all([
      supabase.rpc("list_friends"),
      supabase.rpc("list_blocked"),
    ]);
    if (friendRes.error) setError(friendlyError(friendRes.error, "Couldn't load your friends"));
    else {
      setFriends((friendRes.data as FriendRow[]) ?? []);
      setError(null);
    }
    setBlocked((blockedRes.data as BlockedRow[]) ?? []);
    setLoading(false);
  }, [isGoogle]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 20_000);
    return () => window.clearInterval(id);
  }, [load]);

  if (identity && !isGoogle) {
    return (
      <Screen title="Friends">
        <RequiresGoogle feature="Friends" />
      </Screen>
    );
  }

  const sendRequest = async () => {
    const problem = validatePlayerId(search);
    if (problem) {
      toast.error(problem);
      return;
    }
    setSearching(true);
    const { error: rpcError } = await supabase.rpc("send_friend_request", { p_player_id: search });
    setSearching(false);
    if (rpcError) toast.error(friendlyError(rpcError, "Couldn't send the request"));
    else {
      toast.success("Friend request sent");
      setSearch("");
      await load();
    }
  };

  const respond = async (id: string, accept: boolean) => {
    const query = accept
      ? supabase.from("friendships").update({ status: "accepted" }).eq("id", id)
      : supabase.from("friendships").delete().eq("id", id);
    const { error: e } = await query;
    if (e) toast.error(friendlyError(e));
    else toast.success(accept ? "Friend added" : "Request declined");
    await load();
  };

  const removeFriend = async (id: string) => {
    const { error: e } = await supabase.from("friendships").delete().eq("id", id);
    if (e) toast.error(friendlyError(e));
    else toast.success("Friend removed");
    await load();
  };

  const block = async (userId: string) => {
    const { error: e } = await supabase.rpc("block_player", { p_user_id: userId });
    if (e) toast.error(friendlyError(e));
    else toast.success("Player blocked");
    await load();
  };

  const unblock = async (userId: string) => {
    const { error: e } = await supabase
      .from("blocked_users")
      .delete()
      .eq("blocked_id", userId);
    if (e) toast.error(friendlyError(e));
    else toast.success("Player unblocked");
    await load();
  };

  const accepted = friends.filter((f) => f.status === "accepted");
  const requests = friends.filter((f) => f.status === "pending");

  return (
    <Screen title="Friends" subtitle={`Your ID: ${identity?.playerId ?? "—"}`}>
      <div className="flex gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-2xl border border-input bg-surface px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(normalisePlayerId(e.target.value))}
            placeholder="Add by Player ID"
            autoCapitalize="characters"
            autoCorrect="off"
            enterKeyHint="send"
            maxLength={8}
            className="w-full bg-transparent py-3 tracking-widest outline-none"
          />
        </div>
        <button
          type="button"
          onClick={sendRequest}
          disabled={searching}
          className="rounded-2xl bg-primary px-4 font-semibold text-primary-foreground active:translate-y-0.5 disabled:opacity-60"
        >
          {searching ? <Loader2 className="size-4 animate-spin" /> : "Add"}
        </button>
      </div>

      <div className="my-4 grid grid-cols-3 gap-2 rounded-2xl border border-border bg-surface p-1.5">
        {(
          [
            ["friends", `Friends (${accepted.length})`],
            ["requests", `Requests (${requests.length})`],
            ["blocked", `Blocked (${blocked.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "rounded-xl py-2 text-[11px] font-semibold",
              tab === key ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="mb-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loading && friends.length === 0 ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : null}

      {tab === "friends" ? (
        accepted.length === 0 ? (
          <EmptyState
            icon="👋"
            title="No friends yet"
            description="Share your Player ID above, or add someone with theirs after a match."
          />
        ) : (
          <ul className="grid gap-2">
            {accepted.map((f) => (
              <li key={f.friendship_id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
                <span className="relative flex size-10 items-center justify-center rounded-xl bg-background text-xl">
                  <AvatarGlyph avatar={f.avatar} />
                  <span
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-surface",
                      f.online ? "bg-success" : "bg-muted-foreground",
                    )}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{f.nickname}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    ID {f.player_id} · {f.online ? "Online" : "Offline"} · {f.wins}W {f.losses}L
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeFriend(f.friendship_id)}
                  aria-label={`Remove ${f.nickname}`}
                  className="flex size-9 items-center justify-center rounded-xl border border-border"
                >
                  <UserMinus className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => block(f.user_id)}
                  aria-label={`Block ${f.nickname}`}
                  className="flex size-9 items-center justify-center rounded-xl border border-border text-destructive"
                >
                  <Ban className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}

      {tab === "requests" ? (
        requests.length === 0 ? (
          <EmptyState icon="📭" title="No pending requests" />
        ) : (
          <ul className="grid gap-2">
            {requests.map((f) => (
              <li key={f.friendship_id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-background text-xl">
                  <AvatarGlyph avatar={f.avatar} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{f.nickname}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    ID {f.player_id} · {f.direction === "incoming" ? "Wants to be friends" : "Request sent"}
                  </p>
                </div>
                {f.direction === "incoming" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => respond(f.friendship_id, true)}
                      aria-label="Accept"
                      className="flex size-9 items-center justify-center rounded-xl bg-success text-success-foreground"
                    >
                      <Check className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => respond(f.friendship_id, false)}
                      aria-label="Reject"
                      className="flex size-9 items-center justify-center rounded-xl border border-border"
                    >
                      <X className="size-4" />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => removeFriend(f.friendship_id)}
                    className="rounded-xl border border-border px-3 py-2 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                )}
              </li>
            ))}
          </ul>
        )
      ) : null}

      {tab === "blocked" ? (
        blocked.length === 0 ? (
          <EmptyState icon="🛡️" title="Nobody is blocked" description="Blocked players can't send you friend or game requests." />
        ) : (
          <ul className="grid gap-2">
            {blocked.map((b) => (
              <li key={b.user_id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-background text-xl">
                  <AvatarGlyph avatar={b.avatar} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{b.nickname}</p>
                  <p className="truncate text-[11px] text-muted-foreground">ID {b.player_id}</p>
                </div>
                <button
                  type="button"
                  onClick={() => unblock(b.user_id)}
                  className="rounded-xl border border-border px-3 py-2 text-xs font-semibold"
                >
                  Unblock
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Invite an online friend by sharing your match code from Online Multiplayer.
      </p>
    </Screen>
  );
}
