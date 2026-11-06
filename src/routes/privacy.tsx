import { createFileRoute } from "@tanstack/react-router";

import { Screen } from "@/components/Screen";
import { useAppSettings } from "@/lib/app-settings";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Tic Tac Arcade" },
      { name: "description", content: "How Tic Tac Arcade handles your profile, game and account data." },
      { property: "og:title", content: "Privacy Policy — Tic Tac Arcade" },
      { property: "og:description", content: "What Tic Tac Arcade stores, why, and how to delete it." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Privacy,
});

const sections = (email: string): { title: string; body: string }[] => [
  {
    title: "Guest play",
    body: "Guest profiles (nickname, avatar, Player ID, stats and settings) are stored only on your device. Nothing is sent to our servers until you link a Google account.",
  },
  {
    title: "Google sign-in",
    body: "When you sign in with Google we receive your account ID, email address and profile picture. We use them only to keep your profile, friends, coins and match history across devices. We never post anything to your Google account.",
  },
  {
    title: "Game data",
    body: "For online play we store your nickname, Player ID, avatar, win/loss/draw totals, matches, quick-chat messages and gifts, friend list, blocked players and last-online time. Other players can see your nickname, Player ID, avatar, stats and online status (unless you turn on Appear offline).",
  },
  {
    title: "Virtual coins",
    body: "Coins and gems are virtual items with no cash value and cannot be withdrawn. Optional bundles are sold through Google Play billing; we never see your card details. We keep a history to prevent duplicate rewards.",
  },
  {
    title: "Ads and your data",
    body: "The Android app shows ads from Google AdMob, which may use a device advertising ID as described in Google's policies. Ad-Free removes forced ads. We do not sell your personal data.",
  },
  {
    title: "Children",
    body: "The app is not directed at children under 13 and we do not knowingly collect their personal data.",
  },
  {
    title: "Deleting your data",
    body: `Guests can delete everything by signing out. Google users can ask for account deletion by emailing ${email}; we delete the profile, coins, friends and match data.`,
  },
];

function Privacy() {
  const { data } = useAppSettings();
  const email = data?.general.support_email || "our support team";
  return (
    <Screen title="Privacy Policy">
      <p className="mb-4 text-xs text-muted-foreground">Last updated: November 2026</p>
      <div className="grid gap-3 pb-6">
        {sections(email).map((s) => (
          <section key={s.title} className="rounded-2xl border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold">{s.title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
          </section>
        ))}
      </div>
    </Screen>
  );
}
