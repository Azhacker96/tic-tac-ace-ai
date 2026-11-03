import { createFileRoute } from "@tanstack/react-router";

import { Screen } from "@/components/Screen";

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

const SECTIONS: { title: string; body: string }[] = [
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
    body: "Coins are virtual only. They cannot be bought with real money, withdrawn or exchanged, and have no cash value. We keep a coin history to prevent duplicate rewards.",
  },
  {
    title: "No ads, no selling data",
    body: "The app shows no advertising and we do not sell or share your personal data with third parties. Data is processed by our hosting provider only to run the app.",
  },
  {
    title: "Children",
    body: "The app is not directed at children under 13 and we do not knowingly collect their personal data.",
  },
  {
    title: "Deleting your data",
    body: "Guests can delete everything by signing out. Google users can ask for account deletion by emailing support@tictacarcade.app; we delete the profile, coins, friends and match data.",
  },
];

function Privacy() {
  return (
    <Screen title="Privacy Policy">
      <p className="mb-4 text-xs text-muted-foreground">Last updated: November 2026</p>
      <div className="grid gap-3 pb-6">
        {SECTIONS.map((s) => (
          <section key={s.title} className="rounded-2xl border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold">{s.title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
          </section>
        ))}
      </div>
    </Screen>
  );
}
