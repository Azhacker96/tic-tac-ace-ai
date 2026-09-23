import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AVATARS } from "@/lib/avatars";
import { useApp } from "@/lib/app-context";
import { LoadingScreen } from "@/components/Screen";
import { validateNickname } from "@/lib/validation";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Tic Tac Arcade — Play Tic Tac Toe online or offline" },
      {
        name: "description",
        content:
          "Sign in with Google or play as a guest. Four AI difficulties, same-device duels and real-time online matches.",
      },
      { property: "og:title", content: "Tic Tac Arcade" },
      {
        property: "og:description",
        content: "Four AI difficulties, same-device duels and real-time online matches.",
      },
    ],
  }),
  component: Welcome,
});

function Welcome() {
  const { ready, identity, needsSetup, signInWithGoogle, createGuest, online } = useApp();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"landing" | "guest">("landing");
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState<string>(AVATARS[0].id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (needsSetup) void navigate({ to: "/setup", replace: true });
    else if (identity) void navigate({ to: "/home", replace: true });
  }, [ready, identity, needsSetup, navigate]);

  if (!ready) return <LoadingScreen label="Starting up…" />;

  const handleGoogle = async () => {
    if (!online) {
      toast.error("No internet connection", {
        description: "Google sign-in needs a connection. You can play as a guest offline.",
      });
      return;
    }
    setBusy(true);
    const result = await signInWithGoogle();
    setBusy(false);
    if (result.error) toast.error("Google sign-in failed", { description: result.error });
  };

  const handleGuest = () => {
    const problem = validateNickname(nickname);
    if (problem) {
      setError(problem);
      return;
    }
    createGuest(nickname, avatar);
    void navigate({ to: "/home", replace: true });
  };

  return (
    <div className="screen-shell safe-top safe-bottom flex flex-col justify-between px-6">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="animate-float rounded-[2rem] border border-border bg-surface p-5 shadow-tile">
          <div className="grid grid-cols-3 gap-1.5">
            {["✕", "◯", "✕", "◯", "✕", "◯", "◯", "✕", "✕"].map((m, i) => (
              <span
                key={i}
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg bg-cell font-display text-lg",
                  m === "✕" ? "text-mark-x" : "text-mark-o",
                )}
              >
                {m}
              </span>
            ))}
          </div>
        </div>
        <h1 className="arcade-title mt-7 text-3xl leading-tight">TIC TAC ARCADE</h1>
        <p className="mt-3 max-w-[16rem] text-sm text-muted-foreground">
          Beat the computer, duel a friend on one phone, or take on the world with a match code.
        </p>
      </div>

      {mode === "landing" ? (
        <div className="grid gap-3 pb-4">
          <button
            type="button"
            onClick={handleGoogle}
            disabled={busy}
            className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 font-semibold text-primary-foreground shadow-tile active:translate-y-0.5 disabled:opacity-60"
          >
            {busy ? "Opening Google…" : "Continue with Google"}
          </button>
          <button
            type="button"
            onClick={() => setMode("guest")}
            className="rounded-2xl border border-border bg-surface px-4 py-4 font-semibold active:translate-y-0.5"
          >
            Continue as Guest
          </button>
          <p className="px-2 text-center text-[11px] leading-relaxed text-muted-foreground">
            Guest profiles stay on this device. Online multiplayer and friends need Google — you can
            link it later without losing anything.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 pb-4">
          <div>
            <label htmlFor="nickname" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Choose a nickname
            </label>
            <input
              id="nickname"
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value);
                setError(null);
              }}
              autoComplete="nickname"
              enterKeyHint="done"
              maxLength={16}
              placeholder="e.g. NoughtyNina"
              className="mt-2 w-full rounded-2xl border border-input bg-surface px-4 py-3.5 outline-none focus:border-primary"
            />
            {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Pick an avatar
            </p>
            <div className="mt-2 grid grid-cols-6 gap-2">
              {AVATARS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAvatar(a.id)}
                  aria-label={a.id}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-xl border text-xl active:scale-95",
                    avatar === a.id ? "border-primary bg-primary/15" : "border-border bg-surface",
                  )}
                >
                  {a.emoji}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleGuest}
            className="rounded-2xl bg-primary px-4 py-4 font-semibold text-primary-foreground shadow-tile active:translate-y-0.5"
          >
            Start playing
          </button>
          <button
            type="button"
            onClick={() => setMode("landing")}
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Back
          </button>
        </div>
      )}
    </div>
  );
}
