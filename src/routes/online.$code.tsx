import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { Copy, Loader2, Plane, Share2, UserPlus, WifiOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AvatarGlyph } from "@/components/AvatarGlyph";
import { EmptyState, LoadingScreen, RequiresGoogle, Screen } from "@/components/Screen";
import { GameBoard } from "@/components/game/Board";
import { useRefreshCoins } from "@/lib/coins";
import { PlayerChip } from "@/components/game/PlayerChip";
import { ResultSheet, type Outcome } from "@/components/game/ResultSheet";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { autopilotMove } from "@/lib/game/ai";
import { boardFromString } from "@/lib/game/engine";
import {
  fetchMatch,
  fetchProfiles,
  iRequestedRematch,
  myAutopilot,
  mySymbol,
  opponentAutopilot,
  opponentId,
  opponentRequestedRematch,
  opponentSeen,
  secondsLeft,
  type MatchRow,
  type PublicProfile,
} from "@/lib/online";
import { sfx } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { friendlyError } from "@/lib/validation";

export const Route = createFileRoute("/online/$code")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Online match — Tic Tac Arcade" },
      {
        name: "description",
        content: "Live Tic Tac Toe match with real-time sync, a turn timer and autopilot cover.",
      },
      { property: "og:title", content: "Online match — Tic Tac Arcade" },
      { property: "og:description", content: "Live match with turn timer and autopilot." },
    ],
  }),
  component: OnlineMatch,
});

const TURN_SECONDS = 20;

function OnlineMatch() {
  const { code } = useParams({ from: "/online/$code" });
  const { identity, session, online, refreshProfile } = useApp();
  const refreshCoins = useRefreshCoins();
  const navigate = useNavigate();

  const [match, setMatch] = useState<MatchRow | null>(null);
  const [profiles, setProfiles] = useState<Record<string, PublicProfile>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(TURN_SECONDS);
  const [leaving, setLeaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [resultSeen, setResultSeen] = useState(false);

  const userId = session?.user?.id ?? null;
  const timeoutGuard = useRef(0);
  const lastBoard = useRef<string>("---------");
  const lastRound = useRef(1);
  const statsSynced = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      const row = await fetchMatch(code);
      if (!row) {
        setLoadError("Match not found. It may have expired, or you're not one of its players.");
      } else {
        setMatch(row);
        setLoadError(null);
      }
    } catch (e) {
      setLoadError(friendlyError(e, "Couldn't load the match"));
    } finally {
      setLoading(false);
    }
  }, [code]);

  /* initial load + realtime + polling fallback + heartbeat */
  useEffect(() => {
    if (!userId) return;
    void load();

    const channel = supabase
      .channel(`match-${code}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches", filter: `code=eq.${code.toUpperCase()}` },
        (payload) => {
          const row = payload.new as MatchRow | null;
          if (row?.id) setMatch(row);
        },
      )
      .subscribe();

    const poll = window.setInterval(() => void load(), 4000);
    const beat = window.setInterval(() => {
      void supabase.rpc("match_heartbeat", { p_code: code });
    }, 12_000);
    void supabase.rpc("match_heartbeat", { p_code: code });

    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(poll);
      window.clearInterval(beat);
    };
  }, [code, userId, load]);

  /* opponent + self profiles */
  useEffect(() => {
    if (!match) return;
    const ids = [match.host_id, match.guest_id].filter(Boolean) as string[];
    const missing = ids.filter((id) => !profiles[id]);
    if (missing.length === 0) return;
    void fetchProfiles(ids).then((map) => setProfiles((prev) => ({ ...prev, ...map })));
  }, [match, profiles]);

  /* countdown */
  useEffect(() => {
    if (!match || match.status !== "active") {
      setRemaining(TURN_SECONDS);
      return;
    }
    const tick = () => setRemaining(secondsLeft(match.turn_deadline));
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [match]);

  /* sound cues on opponent moves */
  useEffect(() => {
    if (!match) return;
    if (match.round !== lastRound.current) {
      lastRound.current = match.round;
      lastBoard.current = match.board;
      setResultSeen(false);
      return;
    }
    if (match.board !== lastBoard.current) {
      lastBoard.current = match.board;
      const mine = userId ? mySymbol(match, userId) : null;
      if (match.status === "active" && match.turn === mine) {
        sfx.opponent();
        setTimeout(() => sfx.turn(), 180);
      }
    }
  }, [match, userId]);

  /* refresh my own stats once a match finishes */
  useEffect(() => {
    if (!match || match.status !== "finished") return;
    const key = `${match.id}-${match.round}`;
    if (statsSynced.current === key) return;
    statsSynced.current = key;
    void refreshProfile();
    void refreshCoins();
    if (match.result === "draw") sfx.draw();
    else if (match.winner_id === userId) sfx.win();
    else sfx.lose();
  }, [match, refreshProfile, refreshCoins, userId]);

  const symbol = match && userId ? mySymbol(match, userId) : "X";
  const myTurn = Boolean(match && match.status === "active" && match.turn === symbol);
  const autopilotOn = Boolean(match && userId && myAutopilot(match, userId));

  /* timer expiry → server plays for whoever is idle */
  useEffect(() => {
    if (!match || match.status !== "active" || !match.turn_deadline) return;
    if (remaining > 0) return;
    const now = Date.now();
    if (now - timeoutGuard.current < 3000) return;
    timeoutGuard.current = now;
    void supabase.rpc("claim_timeout", { p_code: code }).then(() => void load());
  }, [remaining, match, code, load]);

  /* my autopilot plays for me while it is on */
  useEffect(() => {
    if (!match || !myTurn || !autopilotOn) return;
    const id = window.setTimeout(() => {
      const cell = autopilotMove(boardFromString(match.board), symbol);
      if (cell >= 0) void supabase.rpc("make_move", { p_code: code, p_cell: cell }).then(() => void load());
    }, 900);
    return () => window.clearTimeout(id);
  }, [match, myTurn, autopilotOn, symbol, code, load]);

  /* opponent gone for two minutes → allow the forfeit claim */
  useEffect(() => {
    if (!match || match.status !== "active" || !userId) return;
    const seen = opponentSeen(match, userId);
    if (!seen) return;
    if (Date.now() - new Date(seen).getTime() < 125_000) return;
    void supabase.rpc("claim_abandon", { p_code: code }).then(() => void load());
  }, [match, userId, code, load]);

  if (identity && identity.kind !== "google") {
    return (
      <Screen title="Online match" backTo="/online">
        <RequiresGoogle feature="Online multiplayer" />
      </Screen>
    );
  }

  if (loading) return <LoadingScreen label="Loading match…" />;

  if (loadError || !match || !userId) {
    return (
      <Screen title="Online match" backTo="/online">
        <EmptyState
          icon="🔍"
          title="Match unavailable"
          description={loadError ?? "We couldn't open that match."}
          action={
            <button
              type="button"
              onClick={() => navigate({ to: "/online" })}
              className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Back to lobby
            </button>
          }
        />
      </Screen>
    );
  }

  const oppId = opponentId(match, userId);
  const me = profiles[userId];
  const opp = oppId ? profiles[oppId] : undefined;
  const oppSymbol: "X" | "O" = symbol === "X" ? "O" : "X";
  const board = boardFromString(match.board);
  const finished = match.status === "finished";
  const outcome: Outcome =
    match.result === "draw" ? "draw" : match.winner_id === userId ? "win" : "loss";

  const play = async (cell: number) => {
    if (!myTurn || board[cell] || pending !== null) return;
    if (!online) {
      toast.error("No internet connection", { description: "Your move will need a connection." });
      return;
    }
    setPending(cell);
    sfx.place();
    const { error } = await supabase.rpc("make_move", { p_code: code, p_cell: cell });
    setPending(null);
    if (error) {
      sfx.error();
      toast.error(friendlyError(error, "Move rejected"));
    }
    await load();
  };

  const toggleAutopilot = async () => {
    const { error } = await supabase.rpc("set_autopilot", { p_code: code, p_on: !autopilotOn });
    if (error) toast.error(friendlyError(error));
    else toast.success(autopilotOn ? "Autopilot off — you're in control" : "Autopilot on");
    await load();
  };

  const rematch = async () => {
    const { error } = await supabase.rpc("request_rematch", { p_code: code });
    if (error) toast.error(friendlyError(error));
    else setResultSeen(true);
    await load();
  };

  const leave = async () => {
    setLeaving(true);
    await supabase.rpc("leave_match", { p_code: code });
    setLeaving(false);
    void navigate({ to: "/online", replace: true });
  };

  const addFriend = async () => {
    if (!opp) return;
    const { error } = await supabase.rpc("send_friend_request", { p_player_id: opp.player_id });
    if (error) toast.error(friendlyError(error));
    else toast.success(`Friend request sent to ${opp.nickname}`);
  };

  const share = async () => {
    const text = `Join my Tic Tac Arcade match — code ${match.code}`;
    try {
      if (navigator.share) await navigator.share({ title: "Tic Tac Arcade", text });
      else {
        await navigator.clipboard.writeText(match.code);
        toast.success("Match code copied");
      }
    } catch {
      /* user dismissed the share sheet */
    }
  };

  /* ---------- waiting lobby ---------- */
  if (match.status === "waiting") {
    return (
      <Screen title="Waiting for opponent" subtitle={`Match ${match.code}`} backTo="/online">
        <div className="grid gap-5">
          <div className="rounded-3xl border border-primary bg-primary/10 p-6 text-center">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Share this code</p>
            <p className="mt-2 font-display text-5xl tracking-[0.3em]">{match.code}</p>
            <div className="mt-4 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(match.code);
                  toast.success("Copied");
                }}
                className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold"
              >
                <Copy className="size-3.5" /> Copy
              </button>
              <button
                type="button"
                onClick={share}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
              >
                <Share2 className="size-3.5" /> Share
              </button>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Waiting for someone to join…
          </div>

          <button
            type="button"
            onClick={leave}
            disabled={leaving}
            className="rounded-2xl border border-border bg-surface px-4 py-3.5 font-semibold active:translate-y-0.5"
          >
            {leaving ? "Cancelling…" : "Cancel match"}
          </button>
        </div>
      </Screen>
    );
  }

  if (match.status === "abandoned") {
    return (
      <Screen title="Match closed" backTo="/online">
        <EmptyState
          icon="🚪"
          title="This match is no longer active"
          description="The lobby was cancelled or expired."
          action={
            <button
              type="button"
              onClick={() => navigate({ to: "/online" })}
              className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Back to lobby
            </button>
          }
        />
      </Screen>
    );
  }

  const oppStale =
    opponentSeen(match, userId) &&
    Date.now() - new Date(opponentSeen(match, userId) as string).getTime() > 30_000;

  return (
    <Screen
      title={`Match ${match.code}`}
      subtitle={`Round ${match.round} · you play ${symbol}`}
      backTo="/online"
      action={
        <button
          type="button"
          onClick={() => setConfirmLeave(true)}
          className="rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold active:scale-95"
        >
          Leave
        </button>
      }
    >
      <div className="flex gap-2">
        <PlayerChip
          name={me?.nickname ?? identity?.nickname ?? "You"}
          avatar={me?.avatar ?? identity?.avatar}
          symbol={symbol}
          active={myTurn}
          subtitle={autopilotOn ? "Autopilot" : `Plays ${symbol}`}
        />
        <PlayerChip
          name={opp?.nickname ?? "Opponent"}
          avatar={opp?.avatar}
          symbol={oppSymbol}
          active={!myTurn && !finished}
          subtitle={
            opponentAutopilot(match, userId)
              ? "Autopilot"
              : oppStale
                ? "Reconnecting…"
                : `ID ${opp?.player_id ?? "—"}`
          }
        />
      </div>

      {match.status === "active" ? (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold">
              {myTurn ? (autopilotOn ? "Autopilot is playing for you" : "Your turn") : "Opponent's turn"}
            </span>
            <span className={cn("font-display", remaining <= 5 ? "text-destructive" : "text-muted-foreground")}>
              {remaining}s
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                remaining <= 5 ? "bg-destructive" : "bg-primary",
              )}
              style={{ width: `${(remaining / TURN_SECONDS) * 100}%` }}
            />
          </div>
        </div>
      ) : null}

      {!online ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          <WifiOff className="size-4" /> You&apos;re offline — moves will fail until you reconnect.
        </div>
      ) : null}

      {autopilotOn ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-accent/50 bg-accent/10 p-3">
          <Plane className="size-4 shrink-0 text-accent" />
          <p className="flex-1 text-xs">Autopilot took over after your timer ran out.</p>
          <button
            type="button"
            onClick={toggleAutopilot}
            className="rounded-lg bg-accent px-2.5 py-1.5 text-[11px] font-bold text-accent-foreground"
          >
            Turn off
          </button>
        </div>
      ) : null}

      <div className="mt-4">
        <GameBoard
          board={board}
          onPlay={play}
          disabled={!myTurn || finished || autopilotOn}
          winningLine={match.winning_line}
          pendingCell={pending}
        />
      </div>

      {!autopilotOn && match.status === "active" ? (
        <button
          type="button"
          onClick={toggleAutopilot}
          className="mt-4 w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-semibold active:translate-y-0.5"
        >
          Hand my turns to autopilot
        </button>
      ) : null}

      {confirmLeave ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-border bg-surface p-5">
            <h2 className="font-display text-lg">Leave this match?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Leaving an active match counts as a loss and gives your opponent the win.
            </p>
            <div className="mt-5 grid gap-2">
              <button
                type="button"
                onClick={leave}
                className="rounded-xl bg-destructive px-4 py-3 font-semibold text-destructive-foreground"
              >
                Leave match
              </button>
              <button
                type="button"
                onClick={() => setConfirmLeave(false)}
                className="rounded-xl border border-border px-4 py-3 font-semibold"
              >
                Keep playing
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ResultSheet
        open={finished && !resultSeen}
        outcome={outcome}
        headline={
          match.result === "draw"
            ? "Draw"
            : outcome === "win"
              ? match.result === "forfeit"
                ? "Opponent left — you win"
                : "Victory!"
              : match.result === "forfeit"
                ? "Match forfeited"
                : "Defeated"
        }
        detail={
          opp
            ? `${outcome === "win" ? "You beat" : outcome === "loss" ? "You lost to" : "Drew with"} ${opp.nickname} · ID ${opp.player_id}`
            : undefined
        }
        stats={identity?.stats}
      >
        {opp ? (
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-background p-3">
            <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface text-xl">
              <AvatarGlyph avatar={opp.avatar} />
            </span>
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate font-semibold">{opp.nickname}</p>
              <p className="truncate text-[11px] text-muted-foreground">ID {opp.player_id}</p>
            </div>
          </div>
        ) : null}
        <button
          type="button"
          onClick={rematch}
          className="rounded-2xl bg-primary px-4 py-3.5 font-semibold text-primary-foreground"
        >
          {iRequestedRematch(match, userId)
            ? "Waiting for opponent…"
            : opponentRequestedRematch(match, userId)
              ? "Accept rematch"
              : "Rematch"}
        </button>
        <button
          type="button"
          onClick={addFriend}
          className="flex items-center justify-center gap-2 rounded-2xl border border-border px-4 py-3.5 font-semibold"
        >
          <UserPlus className="size-4" /> Add {opp?.nickname ?? "opponent"}
        </button>
        <button
          type="button"
          onClick={() => navigate({ to: "/online" })}
          className="rounded-2xl border border-border px-4 py-3.5 font-semibold"
        >
          New game
        </button>
        <button
          type="button"
          onClick={() => navigate({ to: "/home" })}
          className="rounded-2xl px-4 py-3 text-sm text-muted-foreground"
        >
          Home
        </button>
      </ResultSheet>

      {finished && resultSeen ? (
        <div className="mt-4 rounded-2xl border border-border bg-surface p-4 text-center text-sm text-muted-foreground">
          {iRequestedRematch(match, userId)
            ? "Rematch requested — waiting for your opponent."
            : "Match finished."}
          <button
            type="button"
            onClick={() => setResultSeen(false)}
            className="mt-2 block w-full rounded-xl border border-border px-4 py-2.5 text-xs font-semibold text-foreground"
          >
            Show result
          </button>
        </div>
      ) : null}
    </Screen>
  );
}
