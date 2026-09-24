import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Copy, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { RequiresGoogle, Screen } from "@/components/Screen";
import { SymbolPicker } from "@/components/game/SymbolPicker";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import type { Player } from "@/lib/game/engine";
import { cn } from "@/lib/utils";
import { friendlyError, normaliseMatchCode, validateMatchCode } from "@/lib/validation";

export const Route = createFileRoute("/online/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Online multiplayer — Tic Tac Arcade" },
      {
        name: "description",
        content:
          "Create a match code to invite a friend, or join a match in seconds. Real-time board sync with a 20 second turn timer.",
      },
      { property: "og:title", content: "Online multiplayer — Tic Tac Arcade" },
      {
        property: "og:description",
        content: "Create or join a match code and play in real time.",
      },
    ],
  }),
  component: OnlineLobby,
});

function OnlineLobby() {
  const { identity, online } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"create" | "join">("create");
  const [symbol, setSymbol] = useState<Player>("X");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  useEffect(() => {
    if (!createdCode) return;
    const id = window.setTimeout(() => {
      void navigate({ to: "/online/$code", params: { code: createdCode } });
    }, 400);
    return () => window.clearTimeout(id);
  }, [createdCode, navigate]);

  if (identity && identity.kind !== "google") {
    return (
      <Screen title="Online Multiplayer">
        <RequiresGoogle feature="Online multiplayer" />
      </Screen>
    );
  }

  const create = async () => {
    if (!online) {
      toast.error("No internet connection");
      return;
    }
    setBusy(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("create_match", { p_symbol: symbol });
    setBusy(false);
    if (rpcError || !data) {
      setError(friendlyError(rpcError, "Couldn't create the match"));
      return;
    }
    const match = data as unknown as { code: string };
    setCreatedCode(match.code);
  };

  const join = async () => {
    const problem = validateMatchCode(code);
    if (problem) {
      setError(problem);
      return;
    }
    if (!online) {
      toast.error("No internet connection");
      return;
    }
    setBusy(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("join_match", { p_code: code });
    setBusy(false);
    if (rpcError || !data) {
      setError(friendlyError(rpcError, "Couldn't join that match"));
      return;
    }
    void navigate({ to: "/online/$code", params: { code: normaliseMatchCode(code) } });
  };

  return (
    <Screen title="Online Multiplayer" subtitle="Play with a match code">
      <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl border border-border bg-surface p-1.5">
        {(["create", "join"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
              setError(null);
            }}
            className={cn(
              "rounded-xl py-2.5 text-sm font-semibold capitalize",
              tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            {t} match
          </button>
        ))}
      </div>

      {tab === "create" ? (
        <div className="grid gap-5">
          <SymbolPicker value={symbol} onChange={setSymbol} label="You play" disabled={busy} />
          {createdCode ? (
            <div className="rounded-2xl border border-primary bg-primary/10 p-5 text-center">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Match code</p>
              <p className="mt-1 font-display text-4xl tracking-[0.3em]">{createdCode}</p>
              <p className="mt-2 text-xs text-muted-foreground">Opening your lobby…</p>
            </div>
          ) : null}
          <button
            type="button"
            onClick={create}
            disabled={busy}
            className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 font-semibold text-primary-foreground shadow-tile active:translate-y-0.5 disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {busy ? "Creating…" : "Create match"}
          </button>
          <p className="text-center text-xs text-muted-foreground">
            You&apos;ll get a 5-character code to share. Lobbies expire after 2 hours.
          </p>
        </div>
      ) : (
        <div className="grid gap-5">
          <div>
            <label
              htmlFor="code"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Match code
            </label>
            <input
              id="code"
              value={code}
              onChange={(e) => {
                setCode(normaliseMatchCode(e.target.value));
                setError(null);
              }}
              inputMode="text"
              autoCapitalize="characters"
              autoCorrect="off"
              enterKeyHint="go"
              maxLength={5}
              placeholder="ABCDE"
              className="mt-2 w-full rounded-2xl border border-input bg-surface px-4 py-4 text-center font-display text-2xl tracking-[0.3em] outline-none focus:border-primary"
            />
          </div>
          <button
            type="button"
            onClick={join}
            disabled={busy}
            className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 font-semibold text-primary-foreground shadow-tile active:translate-y-0.5 disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {busy ? "Joining…" : "Join match"}
          </button>
        </div>
      )}

      {error ? (
        <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => {
          if (createdCode) void navigator.clipboard?.writeText(createdCode);
          toast.success(createdCode ? "Code copied" : "Create a match first");
        }}
        className={cn("mt-6 flex w-full items-center justify-center gap-2 text-xs text-muted-foreground", !createdCode && "hidden")}
      >
        <Copy className="size-3.5" /> Copy code
      </button>
    </Screen>
  );
}
