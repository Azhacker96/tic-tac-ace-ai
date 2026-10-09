import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Loader2, Pencil, Swords, UserPlus, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { AvatarGlyph } from "@/components/AvatarGlyph";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { frameStyle } from "@/lib/cosmetics";
import { cn } from "@/lib/utils";
import { friendlyError } from "@/lib/validation";

/* Tiny global store so any avatar anywhere can open the card. */
let current: string | null = null;
const subs = new Set<() => void>();
export function openPlayer(userId: string | null | undefined) {
  if (!userId) return;
  current = userId;
  subs.forEach((s) => s());
}
function closePlayer() {
  current = null;
  subs.forEach((s) => s());
}
function useCurrent() {
  return useSyncExternalStore(
    (cb) => (subs.add(cb), () => subs.delete(cb)),
    () => current,
    () => null,
  );
}

interface Card {
  user_id: string; player_id: string; nickname: string; avatar: string; frame: string | null;
  wins: number; losses: number; draws: number; rank: number; online: boolean;
  is_me: boolean; blocked: boolean; friend_status: "none" | "friends" | "outgoing" | "incoming";
  h2h: { my_wins: number; their_wins: number; draws: number };
}

export function PlayerSheet() {
  const userId = useCurrent();
  const { identity } = useApp();
  const isGoogle = identity?.kind === "google";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closePlayer();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [userId]);

  const q = useQuery({
    queryKey: ["player-card", userId],
    enabled: Boolean(userId && isGoogle),
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_player_card", { p_user: userId! });
      if (error) throw error;
      return data as unknown as Card;
    },
  });

  if (!userId) return null;
  const c = q.data;
  const total = c ? c.wins + c.losses + c.draws : 0;

  const run = async (fn: () => Promise<{ error: unknown }>, ok: string) => {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) return toast.error(friendlyError(error));
    toast.success(ok);
    void qc.invalidateQueries({ queryKey: ["player-card", userId] });
  };

  const play = async () => {
    if (!c) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("invite_friend", { p_user_id: c.user_id });
    setBusy(false);
    if (error) return toast.error(friendlyError(error));
    closePlayer();
    void navigate({ to: "/online/$code", params: { code: (data as { code: string }).code } });
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-background/80 backdrop-blur-sm sm:items-center"
      onClick={closePlayer}
    >
      <div
        role="dialog"
        aria-label="Player profile"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-t-3xl border border-border bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] animate-in slide-in-from-bottom-8 sm:rounded-3xl"
      >
        <button type="button" aria-label="Close" onClick={closePlayer} className="absolute right-3 top-3 flex size-10 items-center justify-center rounded-full active:scale-95">
          <X className="size-5" />
        </button>
        {!isGoogle ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Sign in with Google to view player profiles.</p>
        ) : q.isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
        ) : !c ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Couldn&apos;t load this player.</p>
        ) : (
          <>
            <div className="flex flex-col items-center text-center">
              <span
                className="relative flex size-20 items-center justify-center overflow-hidden rounded-full bg-background text-4xl"
                style={frameStyle(c.frame ?? undefined)}
              >
                <AvatarGlyph avatar={c.avatar} />
              </span>
              <p className="mt-3 font-display text-xl">{c.nickname}</p>
              <p className="text-xs text-muted-foreground">ID {c.player_id}</p>
              <span className={cn("mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold", c.online ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>
                <span className={cn("size-2 rounded-full", c.online ? "bg-success" : "bg-muted-foreground")} />
                {c.online ? "Online" : "Offline"}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-4 gap-2 text-center">
              <Stat label="Played" value={total} />
              <Stat label="Wins" value={c.wins} />
              <Stat label="Win %" value={total ? `${Math.round((c.wins / total) * 100)}%` : "0%"} />
              <Stat label="Rank" value={`#${c.rank}`} />
            </div>

            {!c.is_me && c.h2h.my_wins + c.h2h.their_wins + c.h2h.draws > 0 ? (
              <p className="mt-3 rounded-xl bg-background p-2.5 text-center text-xs">
                You vs {c.nickname}: <b className="text-success">{c.h2h.my_wins}W</b> · <b className="text-destructive">{c.h2h.their_wins}L</b> · <b>{c.h2h.draws}D</b>
              </p>
            ) : null}

            <div className="mt-4 grid gap-2">
              {c.is_me ? (
                <Action icon={<Pencil className="size-4" />} onClick={() => { closePlayer(); void navigate({ to: "/profile" }); }}>Edit profile</Action>
              ) : c.blocked ? (
                <p className="text-center text-xs text-muted-foreground">You blocked this player. Unblock from Settings.</p>
              ) : (
                <>
                  {c.friend_status === "friends" ? (
                    <Action primary disabled={busy} icon={<Swords className="size-4" />} onClick={play}>Play match</Action>
                  ) : c.friend_status === "none" ? (
                    <Action primary disabled={busy} icon={<UserPlus className="size-4" />} onClick={() => run(() => supabase.rpc("send_friend_request", { p_player_id: c.player_id }), "Friend request sent")}>Add friend</Action>
                  ) : (
                    <p className="text-center text-xs text-muted-foreground">
                      {c.friend_status === "outgoing" ? "Friend request sent" : "Sent you a friend request — accept it in Friends"}
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(() => supabase.rpc("block_player", { p_user_id: c.user_id }), `${c.nickname} blocked`)}
                    className="flex h-11 items-center justify-center gap-1.5 text-xs font-semibold text-destructive active:scale-95"
                  >
                    <Ban className="size-3.5" /> Block player
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-background p-2">
      <p className="font-display text-base tabular-nums">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function Action({ children, icon, onClick, primary, disabled }: { children: string; icon: React.ReactNode; onClick: () => void; primary?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn("flex h-12 items-center justify-center gap-2 rounded-2xl font-semibold active:scale-95 disabled:opacity-60", primary ? "bg-primary text-primary-foreground" : "border border-border bg-background")}
    >
      {icon}{children}
    </button>
  );
}
