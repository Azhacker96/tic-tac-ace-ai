import { useQuery } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { formatCountdown, useRefreshCoins } from "@/lib/coins";
import { sfx, vibrate } from "@/lib/sound";
import { friendlyError } from "@/lib/validation";

interface Prize { slot: number; amount: number; label: string }
const COLORS = ["var(--color-primary)", "var(--color-accent)", "var(--color-success)", "var(--color-destructive)"];
const SESSION_KEY = "ttt.spin.shown";

/** Daily lucky wheel. The prize is chosen by the server; the wheel only animates to it. */
export function LuckySpin() {
  const { identity } = useApp();
  const isGoogle = identity?.kind === "google";
  const refreshCoins = useRefreshCoins();
  const [open, setOpen] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [angle, setAngle] = useState(0);
  const [won, setWon] = useState<number | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const tickRef = useRef<number | null>(null);

  const prizes = useQuery({
    queryKey: ["spin", "prizes"],
    enabled: isGoogle,
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("spin_prizes").select("slot, amount, label").order("slot");
      if (error) throw error;
      return (data ?? []) as Prize[];
    },
  });

  const status = useQuery({
    queryKey: ["spin", "status", identity?.kind === "google" ? identity.userId : null],
    enabled: isGoogle,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("spin_status");
      if (error) throw error;
      return data as unknown as { next: string | null; server_now: string };
    },
  });

  useEffect(() => {
    const s = status.data;
    if (!s || sessionStorage.getItem(SESSION_KEY)) return;
    const ready = !s.next || new Date(s.next).getTime() <= new Date(s.server_now).getTime();
    if (ready) {
      sessionStorage.setItem(SESSION_KEY, "1");
      setOpen(true);
    }
  }, [status.data]);

  useEffect(() => {
    if (!next) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [next]);

  useEffect(() => () => { if (tickRef.current) window.clearInterval(tickRef.current); }, []);

  const list = prizes.data ?? [];
  if (!open || list.length === 0) return null;
  const seg = 360 / list.length;

  const spin = async () => {
    setSpinning(true);
    const { data, error } = await supabase.rpc("spin_wheel");
    if (error) {
      setSpinning(false);
      sfx.error();
      toast.error(friendlyError(error));
      return;
    }
    const res = data as unknown as { slot: number; amount: number; next: string };
    const idx = list.findIndex((p) => p.slot === res.slot);
    const target = 360 * 6 + (360 - (idx * seg + seg / 2));
    setAngle((a) => a - (a % 360) + target);
    tickRef.current = window.setInterval(() => { sfx.tap(); vibrate(8); }, 140);
    window.setTimeout(() => {
      if (tickRef.current) window.clearInterval(tickRef.current);
      setSpinning(false);
      setWon(res.amount);
      setNext(res.next);
      sfx.win();
      sfx.coin();
      vibrate([40, 60, 40]);
      void refreshCoins();
      void status.refetch();
    }, 4200);
  };

  const gradient = `conic-gradient(${list.map((_, i) => `${COLORS[i % COLORS.length]} ${i * seg}deg ${(i + 1) * seg}deg`).join(",")})`;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/85 p-6 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-3xl border border-border bg-surface p-5 text-center animate-in zoom-in-95">
        {!spinning ? (
          <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="absolute right-3 top-3 flex size-10 items-center justify-center rounded-full active:scale-95">
            <X className="size-5" />
          </button>
        ) : null}
        <h2 className="font-display text-xl">Lucky Spin</h2>
        <p className="mt-1 text-xs text-muted-foreground">One free spin every 24 hours</p>

        <div className="relative mx-auto mt-5 size-64">
          <div className="absolute left-1/2 top-[-6px] z-10 -translate-x-1/2 text-2xl drop-shadow">🔻</div>
          <div
            className="size-full rounded-full border-4 border-border shadow-xl"
            style={{ background: gradient, transform: `rotate(${angle}deg)`, transition: "transform 4.2s cubic-bezier(0.17,0.67,0.12,1)" }}
          >
            {list.map((p, i) => (
              <span
                key={p.slot}
                className="absolute left-1/2 top-1/2 origin-[0_0] font-display text-sm text-primary-foreground drop-shadow"
                style={{ transform: `rotate(${i * seg + seg / 2 - 90}deg) translate(70px, -8px)` }}
              >
                🪙{p.label}
              </span>
            ))}
          </div>
          <div className="absolute left-1/2 top-1/2 flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-border bg-surface text-xl">🎁</div>
        </div>

        {won !== null ? (
          <div className="mt-5">
            <p className="font-display text-2xl text-accent animate-in zoom-in">+{won} coins! 🎉</p>
            {next ? <p className="mt-1 text-xs text-muted-foreground">Next spin in {formatCountdown(new Date(next).getTime(), now)}</p> : null}
            <button type="button" onClick={() => setOpen(false)} className="mt-4 h-12 w-full rounded-2xl bg-primary font-semibold text-primary-foreground active:scale-95">Collect</button>
          </div>
        ) : (
          <button
            type="button"
            disabled={spinning}
            onClick={spin}
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary font-display text-primary-foreground active:scale-95 disabled:opacity-70"
          >
            {spinning ? <Loader2 className="size-5 animate-spin" /> : null}
            {spinning ? "Spinning…" : "SPIN"}
          </button>
        )}
      </div>
    </div>
  );
}
