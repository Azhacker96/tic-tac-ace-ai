import { AvatarGlyph } from "@/components/AvatarGlyph";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Bot, Cog, Globe2, Users } from "lucide-react";
import { CoinBadge } from "@/components/CoinBadge";
import { InviteBanner } from "@/components/InviteBanner";
import { useEquipped } from "@/lib/coins";
import { frameStyle } from "@/lib/cosmetics";
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

function ModeCard({
  to,
  icon,
  title,
  description,
}: {
  to: "/play/computer" | "/play/local";
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-4 active:scale-[0.97] transition-transform"
    >
      <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-semibold">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{description}</span>
      </span>
    </Link>
  );
}

function Home() {
  const { ready, identity, needsSetup } = useApp();
  const navigate = useNavigate();
  const equipped = useEquipped();

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
          style={frameStyle(equipped.frame)}
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
        {!isGuest ? <CoinBadge /> : null}
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

      {!isGuest ? <InviteBanner /> : null}

      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Choose a mode
      </h2>
      <Link
        to="/online"
        className="relative mb-3 block overflow-hidden rounded-3xl bg-primary p-5 text-primary-foreground shadow-glow active:scale-[0.98] transition-transform"
      >
        <Globe2 className="absolute -right-4 -bottom-4 size-28 opacity-15" />
        <span className="inline-flex rounded-full bg-background/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">
          {isGuest ? "Needs Google" : "Live 1v1"}
        </span>
        <p className="mt-3 font-display text-2xl leading-none">Play Online</p>
        <p className="mt-1.5 text-xs opacity-80">Create or join a match with a code</p>
      </Link>
      <div className="grid grid-cols-2 gap-3">
        <ModeCard to="/play/computer" icon={<Bot className="size-6" />} title="vs Computer" description="4 difficulty levels" />
        <ModeCard to="/play/local" icon={<Users className="size-6" />} title="2 Players" description="Same phone" />
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
