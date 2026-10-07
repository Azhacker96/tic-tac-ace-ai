import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useWallet } from "@/lib/coins";
import { cn } from "@/lib/utils";

/** Live coin balance with a small +/- float animation whenever it changes. */
export function CoinBadge({ className, link = true }: { className?: string; link?: boolean }) {
  const { data, isLoading, isError } = useWallet();
  const prev = useRef<number | null>(null);
  const [delta, setDelta] = useState<{ v: number; k: number } | null>(null);

  useEffect(() => {
    if (data == null) return;
    if (prev.current != null && prev.current !== data.balance) {
      setDelta({ v: data.balance - prev.current, k: Date.now() });
    }
    prev.current = data.balance;
  }, [data]);

  // Count daily/weekly bonuses that are claimable now (server time, re-checked every 30s).
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  void tick;
  let ready = 0;
  if (data) {
    const skew = new Date(data.server_now).getTime() - Date.now();
    const now = Date.now() + skew;
    for (const n of [data.daily_next, data.weekly_next]) {
      if (!n || new Date(n).getTime() <= now) ready++;
    }
  }

  const body = (
    <span
      className={cn(
        "relative inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold",
        className,
      )}
    >
      <span aria-hidden>🪙</span>
      {isLoading ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : isError ? (
        <span className="text-destructive">—</span>
      ) : (
        <span key={data?.balance} className="animate-pop tabular-nums">
          {data?.balance ?? 0}
        </span>
      )}
      {delta ? (
        <span
          key={delta.k}
          className={cn(
            "coin-float pointer-events-none absolute -top-3 right-1 text-xs font-bold",
            delta.v >= 0 ? "text-success" : "text-destructive",
          )}
          onAnimationEnd={() => setDelta(null)}
        >
          {delta.v >= 0 ? `+${delta.v}` : delta.v}
        </span>
      ) : null}
      {link && ready > 0 ? (
        <span
          aria-label={`${ready} reward${ready > 1 ? "s" : ""} available`}
          className="absolute -right-1.5 -top-1.5 flex size-5 animate-pulse items-center justify-center rounded-full bg-destructive text-[11px] font-bold text-destructive-foreground"
        >
          {ready}
        </span>
      ) : null}
    </span>
  );

  return link ? (
    <Link to="/coins" aria-label="Coins and rewards" className="active:scale-95">
      {body}
    </Link>
  ) : (
    body
  );
}
