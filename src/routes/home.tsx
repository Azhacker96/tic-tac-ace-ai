import { AvatarGlyph } from "@/components/AvatarGlyph";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Bot,
  Cog,
  Globe2,
  Users,
  UserRound,
  UsersRound,
  ChevronRight,
} from "lucide-react";
import { useEffect, type ReactNode } from "react";

import { LoadingScreen } from "@/components/Screen";

import { useApp } from "@/lib/app-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/home")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Home — Tic Tac Arcade" },
      {
        name: "description",
        content: "Your player dashboard: stats, computer matches, local duels and online play.",
      },
      { property: "og:title", content: "Home — Tic Tac Arcade" },
      { property: "og:description", content: "Your player dashboard and game modes." },
    ],
  }),
  component: Home,
});

function ModeTile({
  to,
  icon,
  title,
  description,
  locked,
}: {
  to: string;
  icon: ReactNode;
  title: string;
  description: string;
  locked?: boolean;
}) {
  return (
    <Link to={to} className="tile-btn active:tile-btn-active">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {locked ? "Needs Google sign-in" : description}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

function Home() {
  const { ready, identity, needsSetup } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (!ready) return;
    if (needsSetup) void navigate({ to: "/setup", replace: true });
    else if (!identity) void navigate({ to: "/", replace: true });
  }, [ready, identity, needsSetup, navigate]);

  if (!ready || !identity) return <LoadingScreen />;

  const { stats } = identity;
  const played = stats.wins + stats.losses + stats.draws;
  const winRate = played ? Math.round((stats.wins / played) * 100) : 0;
  const isGuest = identity.kind === "guest";

  return (
    <div className="screen-shell safe-top safe-bottom px-4">
      <header className="flex items-center gap-3 pb-5">
        <Link
          to="/profile"
          className="flex size-14 overflow-hidden items-center justify-center rounded-2xl border border-border bg-surface text-2xl active:scale-95"
        >
          <AvatarGlyph avatar={identity.avatar} fallback={identity.appAvatar} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg leading-tight">{identity.nickname}</p>
          <p className="truncate text-xs text-muted-foreground">
            ID {identity.playerId} ·{" "}
            <span className={cn(isGuest ? "text-accent" : "text-success")}>
              {isGuest ? "Guest" : "Google"}
            </span>
          </p>
        </div>
        <Link
          to="/settings"
          aria-label="Settings"
          className="flex size-10 items-center justify-center rounded-xl border border-border bg-surface active:scale-95"
        >
          <Cog className="size-5" />
        </Link>
      </header>

      <div className="mb-5 grid grid-cols-4 gap-2 rounded-2xl border border-border bg-surface p-3 text-center">
        {[
          { label: "Played", value: played },
          { label: "Won", value: stats.wins },
          { label: "Lost", value: stats.losses },
          { label: "Win %", value: `${winRate}` },
        ].map((s) => (
          <div key={s.label}>
            <p className="font-display text-lg leading-none">{s.value}</p>
            <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              {s.label}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-2.5">
        <ModeTile
          to="/play/computer"
          icon={<Bot className="size-5" />}
          title="Play with Computer"
          description="Easy · Medium · Hard · Expert"
        />
        <ModeTile
          to="/play/local"
          icon={<Users className="size-5" />}
          title="2 Players"
          description="Pass and play on this phone"
        />
        <ModeTile
          to="/online"
          icon={<Globe2 className="size-5" />}
          title="Online Multiplayer"
          description="Create or join with a match code"
          locked={isGuest}
        />
        <ModeTile
          to="/friends"
          icon={<UsersRound className="size-5" />}
          title="Friends"
          description="Add by Player ID and invite to play"
          locked={isGuest}
        />
        <ModeTile
          to="/profile"
          icon={<UserRound className="size-5" />}
          title="Profile"
          description="Nickname, avatar and full stats"
        />
        <ModeTile
          to="/settings"
          icon={<Cog className="size-5" />}
          title="Settings"
          description="Themes, sound, privacy and account"
        />
      </div>

      {isGuest ? (
        <div className="mt-5 rounded-2xl border border-accent/40 bg-accent/10 p-4">
          <p className="text-sm font-semibold">Playing as a guest</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Link a Google account to unlock online matches and friends. Your nickname, Player ID and
            stats all carry over.
          </p>
          <Link
            to="/settings"
            className="mt-3 inline-flex rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground"
          >
            Link Google
          </Link>
        </div>
      ) : null}
    </div>
  );
}
