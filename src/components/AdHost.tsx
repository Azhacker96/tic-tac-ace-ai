import { X } from "lucide-react";
import { useEffect, useState } from "react";

import { finishAd, useCurrentAd } from "@/lib/ads";

/** Test-ad overlay used in the web preview (real AdMob ads replace it in the Android app). */
export function AdHost() {
  const ad = useCurrentAd();
  const total = ad?.kind === "rewarded" ? 15 : 5;
  const [left, setLeft] = useState(total);

  useEffect(() => {
    if (!ad) return;
    setLeft(total);
    const id = window.setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => window.clearInterval(id);
  }, [ad, total]);

  if (!ad) return null;
  const done = left === 0;
  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-background px-6 text-center">
      <span className="absolute left-4 top-[calc(1rem+env(safe-area-inset-top))] rounded-md bg-muted px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        Test ad
      </span>
      <button
        type="button"
        aria-label={done ? "Close ad" : `Ad ends in ${left}s`}
        disabled={!done && ad.kind === "rewarded"}
        onClick={() => finishAd(done)}
        className="absolute right-4 top-[calc(0.75rem+env(safe-area-inset-top))] flex size-11 items-center justify-center rounded-full border border-border bg-surface text-sm font-bold disabled:opacity-60"
      >
        {done || ad.kind === "interstitial" ? <X className="size-5" /> : left}
      </button>
      <p className="text-6xl">📺</p>
      <h2 className="mt-4 font-display text-xl">{ad.kind === "rewarded" ? "Watch to earn your bonus" : "Advertisement"}</h2>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">
        Real Google ads will play here in the Android app.
      </p>
      <p className="mt-6 font-display text-3xl tabular-nums">{done ? "✓" : `${left}s`}</p>
      {done ? (
        <button type="button" onClick={() => finishAd(true)} className="mt-6 rounded-2xl bg-primary px-6 py-3 font-semibold text-primary-foreground">
          {ad.kind === "rewarded" ? "Collect reward" : "Continue"}
        </button>
      ) : null}
    </div>
  );
}
