import { AvatarGlyph } from "@/components/AvatarGlyph";
import { createFileRoute } from "@tanstack/react-router";
import { Copy, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { LoadingScreen, Screen } from "@/components/Screen";
import { AVATARS } from "@/lib/avatars";
import { CoinBadge } from "@/components/CoinBadge";
import { useEquipped } from "@/lib/coins";
import { frameStyle } from "@/lib/cosmetics";
import { Link } from "@tanstack/react-router";
import { useApp } from "@/lib/app-context";
import { cn } from "@/lib/utils";
import { friendlyError, validateNickname } from "@/lib/validation";

export const Route = createFileRoute("/profile")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Profile — Tic Tac Arcade" },
      {
        name: "description",
        content: "Your nickname, avatar, unique Player ID and full win/loss/draw record.",
      },
      { property: "og:title", content: "Profile — Tic Tac Arcade" },
      { property: "og:description", content: "Your Player ID, avatar and full record." },
    ],
  }),
  component: Profile,
});

function Profile() {
  const { ready, identity, updateProfile, signInWithGoogle, online } = useApp();
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState("");
  const equipped = useEquipped();
  const [avatar, setAvatar] = useState<string>("fox");
  const [avatarType, setAvatarType] = useState<"app" | "google">("app");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!ready) return <LoadingScreen />;
  if (!identity) return <LoadingScreen label="Loading profile…" />;

  const { stats } = identity;
  const played = stats.wins + stats.losses + stats.draws;
  const winRate = played ? Math.round((stats.wins / played) * 100) : 0;
  const isGuest = identity.kind === "guest";
  const isGoogleWithPicture = identity.kind === "google" && Boolean(identity.googleAvatarUrl);

  const startEdit = () => {
    setNickname(identity.nickname);
    setAvatar(identity.appAvatar);
    setAvatarType(identity.avatarType);
    setError(null);
    setEditing(true);
  };

  const save = async () => {
    const problem = validateNickname(nickname);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    try {
      await updateProfile({
        nickname: nickname.trim(),
        avatar,
        ...(isGoogleWithPicture ? { avatar_type: avatarType } : {}),
      });
      toast.success("Profile updated");
      setEditing(false);
    } catch (e) {
      toast.error("Couldn't save", { description: friendlyError(e) });
    } finally {
      setBusy(false);
    }
  };

  const linkGoogle = async () => {
    if (!online) {
      toast.error("No internet connection");
      return;
    }
    const result = await signInWithGoogle();
    if (result.error) toast.error("Google sign-in failed", { description: result.error });
  };

  return (
    <Screen title="Profile">
      <div className="rounded-3xl border border-border bg-surface p-5 text-center">
        <div style={frameStyle(equipped.frame)} className="mx-auto flex size-20 overflow-hidden items-center justify-center rounded-3xl bg-background text-4xl">
          <AvatarGlyph avatar={identity.avatar} fallback={identity.appAvatar} />
        </div>
        {identity.kind === "google" ? (
          <div className="mt-3 flex justify-center gap-2">
            <CoinBadge />
            <Link to="/shop" className="rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold">Shop</Link>
          </div>
        ) : null}
        <h2 className="mt-3 font-display text-xl">{identity.nickname}</h2>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(identity.playerId);
            toast.success("Player ID copied");
          }}
          className="mx-auto mt-2 flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs tracking-widest"
        >
          {identity.playerId} <Copy className="size-3" />
        </button>
        <p className="mt-3 text-xs">
          <span
            className={cn(
              "rounded-full px-2.5 py-1 font-semibold",
              isGuest ? "bg-accent/20 text-accent" : "bg-success/20 text-success",
            )}
          >
            {isGuest ? "Guest account" : "Google account"}
          </span>
        </p>
        <button
          type="button"
          onClick={startEdit}
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2 text-xs font-semibold active:scale-95"
        >
          <Pencil className="size-3.5" /> Edit profile
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {[
          { label: "Games played", value: played },
          { label: "Win rate", value: `${winRate}%` },
          { label: "Wins", value: stats.wins },
          { label: "Losses", value: stats.losses },
          { label: "Draws", value: stats.draws },
          { label: "Account", value: isGuest ? "Guest" : "Google" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-surface p-4">
            <p className="font-display text-xl">{s.value}</p>
            <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {isGuest ? (
        <div className="mt-4 rounded-2xl border border-accent/40 bg-accent/10 p-4">
          <p className="text-sm font-semibold">Link your Google account</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Keeps this exact profile — same nickname, same Player ID, same stats — and unlocks online
            play and friends.
          </p>
          <button
            type="button"
            onClick={linkGoogle}
            className="mt-3 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground active:translate-y-0.5"
          >
            Link Google account
          </button>
        </div>
      ) : null}

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 backdrop-blur-sm">
          <div className="safe-bottom w-full max-w-[34rem] animate-rise rounded-t-3xl border-t border-border bg-surface px-5 pt-6">
            <h2 className="font-display text-lg">Edit profile</h2>

            <label
              htmlFor="nick"
              className="mt-4 block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Nickname
            </label>
            <input
              id="nick"
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value);
                setError(null);
              }}
              maxLength={16}
              enterKeyHint="done"
              className="mt-2 w-full rounded-2xl border border-input bg-background px-4 py-3.5 outline-none focus:border-primary"
            />
            {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}

            <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Avatar
            </p>
            {isGoogleWithPicture ? (
              <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Avatar source">
                {([
                  { id: "google", label: "Use Google profile picture" },
                  { id: "app", label: "Use app avatar" },
                ] as const).map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    role="radio"
                    aria-checked={avatarType === o.id}
                    onClick={() => setAvatarType(o.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border p-2 text-left text-xs font-semibold active:scale-95",
                      avatarType === o.id ? "border-primary bg-primary/15" : "border-border bg-background",
                    )}
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface text-lg">
                      <AvatarGlyph avatar={o.id === "google" ? identity.googleAvatarUrl : avatar} fallback={avatar} />
                    </span>
                    {o.label}
                  </button>
                ))}
              </div>
            ) : null}
            <div className={cn("mt-2 grid grid-cols-6 gap-2", isGoogleWithPicture && avatarType === "google" && "opacity-50")}>
              {AVATARS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    setAvatar(a.id);
                    setAvatarType("app");
                  }}
                  aria-label={a.id}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-xl border text-xl active:scale-95",
                    avatar === a.id ? "border-primary bg-primary/15" : "border-border bg-background",
                  )}
                >
                  {a.emoji}
                </button>
              ))}
            </div>

            <div className="mb-5 mt-5 grid gap-2">
              <button
                type="button"
                onClick={save}
                disabled={busy}
                className="rounded-2xl bg-primary px-4 py-3.5 font-semibold text-primary-foreground disabled:opacity-60"
              >
                {busy ? "Saving…" : "Save changes"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-2xl border border-border px-4 py-3.5 font-semibold"
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
