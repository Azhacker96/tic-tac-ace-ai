import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { LoadingScreen } from "@/components/Screen";
import { AVATARS } from "@/lib/avatars";
import { useApp } from "@/lib/app-context";
import { cn } from "@/lib/utils";
import { friendlyError, validateNickname } from "@/lib/validation";

export const Route = createFileRoute("/setup")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Create your player — Tic Tac Arcade" },
      { name: "description", content: "Pick the nickname and avatar other players will see." },
      { property: "og:title", content: "Create your player — Tic Tac Arcade" },
      { property: "og:description", content: "Pick a nickname and avatar to start playing." },
    ],
  }),
  component: Setup,
});

function Setup() {
  const { ready, session, needsSetup, completeProfile, identity } = useApp();
  const navigate = useNavigate();
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState<string>(AVATARS[0].id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!session) void navigate({ to: "/", replace: true });
    else if (!needsSetup && identity) void navigate({ to: "/home", replace: true });
  }, [ready, session, needsSetup, identity, navigate]);

  if (!ready) return <LoadingScreen />;

  const submit = async () => {
    const problem = validateNickname(nickname);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    try {
      await completeProfile(nickname, avatar);
      void navigate({ to: "/home", replace: true });
    } catch (e) {
      toast.error("Couldn't save your profile", { description: friendlyError(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen-shell safe-top safe-bottom flex flex-col justify-between px-6">
      <div className="pt-10">
        <p className="text-4xl">👋</p>
        <h1 className="mt-3 font-display text-2xl">One last thing</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick the nickname and avatar other players will see. You only do this once — we&apos;ll
          generate your unique Player ID automatically.
        </p>

        <div className="mt-8">
          <label
            htmlFor="nickname"
            className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Nickname
          </label>
          <input
            id="nickname"
            value={nickname}
            onChange={(e) => {
              setNickname(e.target.value);
              setError(null);
            }}
            maxLength={16}
            enterKeyHint="done"
            placeholder="3–16 characters"
            className="mt-2 w-full rounded-2xl border border-input bg-surface px-4 py-3.5 outline-none focus:border-primary"
          />
          {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
        </div>

        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Avatar
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
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="mb-4 rounded-2xl bg-primary px-4 py-4 font-semibold text-primary-foreground shadow-tile active:translate-y-0.5 disabled:opacity-60"
      >
        {busy ? "Saving…" : "Enter the arcade"}
      </button>
    </div>
  );
}
