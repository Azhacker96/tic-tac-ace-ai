import { useSyncExternalStore } from "react";

/**
 * Ad engine. On Android (Capacitor + AdMob plugin) this calls the real SDK.
 * In the web preview there is no ad network, so a clearly labelled test ad
 * with a countdown is shown instead — no fake earnings beyond the server-capped bonus.
 */
export type AdKind = "rewarded" | "interstitial";

interface AdState { kind: AdKind; resolve: (watched: boolean) => void }
let current: AdState | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

interface AdMobLike {
  showRewarded?: () => Promise<boolean>;
  showInterstitial?: () => Promise<void>;
}
function nativeAds(): AdMobLike | null {
  if (typeof window === "undefined") return null;
  return ((window as unknown as { TTTAds?: AdMobLike }).TTTAds) ?? null;
}

export function showAd(kind: AdKind): Promise<boolean> {
  const native = nativeAds();
  if (native) {
    if (kind === "rewarded" && native.showRewarded) return native.showRewarded();
    if (kind === "interstitial" && native.showInterstitial) return native.showInterstitial().then(() => true);
  }
  if (current) return Promise.resolve(false);
  return new Promise((resolve) => {
    current = { kind, resolve };
    emit();
  });
}

export function finishAd(watched: boolean) {
  const c = current;
  current = null;
  emit();
  c?.resolve(watched);
}

export function useCurrentAd() {
  return useSyncExternalStore(
    (f) => { subs.add(f); return () => subs.delete(f); },
    () => current,
    () => null,
  );
}

const COUNT_KEY = "ttt.ads.games";

/** Call once per finished game; shows an interstitial every N games unless Ad-Free. */
export function noteGameFinished(adFree: boolean, every = 3) {
  if (adFree || typeof window === "undefined") return;
  const n = (Number(localStorage.getItem(COUNT_KEY)) || 0) + 1;
  localStorage.setItem(COUNT_KEY, String(n % every));
  if (n >= every) window.setTimeout(() => void showAd("interstitial"), 1400);
}
