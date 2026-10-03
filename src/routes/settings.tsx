import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { LoadingScreen, Screen } from "@/components/Screen";
import { useApp } from "@/lib/app-context";
import { getHapticsEnabled, setHapticsEnabled, sfx, vibrate } from "@/lib/sound";
import { THEMES } from "@/lib/themes";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Settings — Tic Tac Arcade" },
      {
        name: "description",
        content: "Board themes, sound, privacy, blocked players and account options.",
      },
      { property: "og:title", content: "Settings — Tic Tac Arcade" },
      { property: "og:description", content: "Themes, sound, privacy and account options." },
    ],
  }),
  component: Settings,
});

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-5">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">{children}</div>
    </section>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-3.5 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{label}</p>
        {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn(
        "relative h-7 w-12 shrink-0 rounded-full transition-colors",
        on ? "bg-primary" : "bg-muted",
      )}
    >
      <span
        className={cn(
          "absolute top-1 size-5 rounded-full bg-background transition-all",
          on ? "left-6" : "left-1",
        )}
      />
    </button>
  );
}

function Settings() {
  const {
    ready,
    identity,
    settings,
    updateSettings,
    setTheme,
    setAppearOffline,
    signInWithGoogle,
    signOut,
    online,
  } = useApp();
  const navigate = useNavigate();
  const [confirmOut, setConfirmOut] = useState(false);

  if (!ready || !identity) return <LoadingScreen />;
  const isGuest = identity.kind === "guest";

  const linkGoogle = async () => {
    if (!online) {
      toast.error("No internet connection");
      return;
    }
    const result = await signInWithGoogle();
    if (result.error) toast.error("Google sign-in failed", { description: result.error });
  };

  return (
    <Screen title="Settings">
      <Section title="Audio">
        <Row label="Music" hint="Background music during matches">
          <Toggle on={settings.music} onChange={(music) => updateSettings({ music })} />
        </Row>
        <Row label="Sound effects" hint="Taps, wins and timer warnings">
          <Toggle
            on={settings.sfx}
            onChange={(value) => {
              updateSettings({ sfx: value });
              if (value) setTimeout(() => sfx.place(), 60);
            }}
          />
        </Row>
        <Row label="Vibration" hint="Buzz on moves, wins and your turn">
          <Toggle
            on={haptic}
            onChange={(value) => {
              setHaptic(value);
              setHapticsEnabled(value);
              if (value) vibrate(30);
            }}
          />
        </Row>
      </Section>

      <Section title="Appearance">
        <div className="grid grid-cols-2 gap-2 p-3">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id)}
              className={cn(
                "rounded-xl border p-3 text-left active:scale-[0.98]",
                settings.theme === t.id ? "border-primary bg-primary/10" : "border-border",
              )}
            >
              <div className="flex gap-1">
                {t.swatch.map((c) => (
                  <span
                    key={c}
                    className="size-4 rounded-full border border-border"
                    style={{ background: c }}
                  />
                ))}
              </div>
              <p className="mt-2 text-sm font-semibold">{t.name}</p>
              <p className="text-[11px] leading-tight text-muted-foreground">{t.description}</p>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Account">
        <Row label="Profile" hint="Nickname, avatar and stats">
          <Link to="/profile" className="rounded-xl border border-border px-3 py-2 text-xs font-semibold">
            Open
          </Link>
        </Row>
        <Row
          label={isGuest ? "Link Google account" : "Signed in with Google"}
          hint={
            isGuest
              ? "Keeps your nickname, Player ID and stats"
              : "Online play and friends are unlocked"
          }
        >
          {isGuest ? (
            <button
              type="button"
              onClick={linkGoogle}
              className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
            >
              Link
            </button>
          ) : (
            <span className="text-xs text-success">Active</span>
          )}
        </Row>
        <Row label="Sign out" hint="Returns to the welcome screen">
          <button
            type="button"
            onClick={() => setConfirmOut(true)}
            className="rounded-xl border border-destructive/50 px-3 py-2 text-xs font-semibold text-destructive"
          >
            Sign out
          </button>
        </Row>
      </Section>

      <Section title="Privacy & social">
        <Row
          label="Appear offline"
          hint={
            isGuest
              ? "Available once you link a Google account"
              : "Friends see you as offline while this is on"
          }
        >
          <Toggle
            on={settings.appearOffline}
            onChange={(value) => {
              if (isGuest) {
                toast.error("Link a Google account to use this");
                return;
              }
              void setAppearOffline(value);
            }}
          />
        </Row>
        <Row label="Blocked players" hint="Manage who can't contact you">
          <Link to="/friends" className="rounded-xl border border-border px-3 py-2 text-xs font-semibold">
            Manage
          </Link>
        </Row>
      </Section>

      <p className="pb-4 text-center text-[11px] text-muted-foreground">
        Tic Tac Arcade · settings are saved on this device
      </p>

      {confirmOut ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-border bg-surface p-5">
            <h2 className="font-display text-lg">Sign out?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {isGuest
                ? "Guest profiles live on this device only — signing out deletes this guest profile and its local stats."
                : "You can sign back in with Google at any time. Your profile and stats are kept."}
            </p>
            <div className="mt-5 grid gap-2">
              <button
                type="button"
                onClick={async () => {
                  await signOut();
                  void navigate({ to: "/", replace: true });
                }}
                className="rounded-xl bg-destructive px-4 py-3 font-semibold text-destructive-foreground"
              >
                Sign out
              </button>
              <button
                type="button"
                onClick={() => setConfirmOut(false)}
                className="rounded-xl border border-border px-4 py-3 font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </Screen>
  );
}
