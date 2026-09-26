# Tic Tac Arcade — release notes & packaging

## Working features (verified in a real browser)

- Welcome screen: Continue with Google / Continue as Guest.
- Guest flow: nickname + avatar, auto-generated unique Player ID, saved on device, full offline play.
- Google flow: one-time nickname/avatar setup for new accounts, profile + settings row created server-side.
- Guest → Google linking keeps the same nickname, Player ID and stats (local stats are merged into the account).
- Home dashboard: avatar, nickname, Player ID, account type, win/loss/draw stats, all mode tiles.
- Play with Computer: Easy / Medium / Hard / Expert. Easy is mostly random, Medium blocks and takes wins,
  Hard is near-optimal with occasional slips, Expert is full minimax (unbeatable).
- 2 Players same device: pass-and-play with running score, winning-line highlight, rematch, reset.
- Online multiplayer: 5-character match codes, lobby with copy/share, real-time board sync
  (realtime subscription + polling fallback), turn ownership, rematch with symbol swap.
- 20-second turn timer with autopilot: on expiry the server plays a valid move for the idle player
  (never an instant loss); the returning player can switch autopilot off mid-match.
- Abandonment: a player unseen for 2 minutes can be claimed as a forfeit; leaving an active match forfeits;
  lobbies expire after 2 hours.
- Friends: search by Player ID, request/accept/reject/cancel/remove, block/unblock, online status,
  appear-offline, invite from the friends list.
- Profile: edit nickname/avatar, stats with win percentage, link Google.
- Settings: music, sound effects, four themes (Classic, Neon, Midnight, Minimal), appear offline,
  blocked players, sign out — all persisted (theme verified across reloads).
- Result screen after every game: outcome, winning mark, updated stats, rematch / new game / home;
  online adds opponent nickname, Player ID and add-friend.
- Offline: launch, guest profile, computer mode, same-device mode, settings and local stats all work
  with no network; online screens show a clear connection/sign-in requirement.

## Security model

- All online game rules live in the database as `SECURITY DEFINER` functions
  (`create_match`, `join_match`, `make_move`, `claim_timeout`, `claim_abandon`, `request_rematch`, …).
  The client never decides a winner, a turn or a move's legality.
- Row Level Security on every table: a player can read only their own profile data, their own
  friendships/blocks/settings, and matches they take part in. Matches are never written directly by clients.
- No secrets in the frontend — only the public project URL and publishable key.

## Requires external configuration

1. **Google sign-in credentials** — the app currently uses Lovable's managed Google provider, which works
   out of the box. For Play Store branding you may add your own Google OAuth client (Google Cloud console →
   OAuth client → add the app's domain and callback) in the backend auth settings.
2. **Android packaging** — the app is a web build; it must be wrapped for Play (see below).
3. Nothing else: database, auth and realtime are provisioned.

## Known limitations

- Online multiplayer and friends require a Google account (by design — guests have no server identity).
- Automated end-to-end testing of the online/friends screens was not possible in this environment because
  Google consent cannot be scripted; the underlying server functions were exercised directly.
- Music is a toggle only; no licensed music track is bundled (sound effects are generated).
- Guest data lives on one device; signing out as a guest clears it (confirmed in a dialog).

## Packaging as APK / AAB

1. Publish the app so it has a public HTTPS URL.
2. Add Capacitor to the project: `npm i @capacitor/core @capacitor/cli @capacitor/android`,
   then `npx cap init "Tic Tac Arcade" com.yourcompany.tictacarcade`.
3. In `capacitor.config.ts` point `server.url` at the published HTTPS URL (or build a static export and
   use `webDir`), keep `android.allowMixedContent: false`.
4. `npx cap add android` → `npx cap sync android` → open in Android Studio.
5. Set the app icon/splash, `versionCode`/`versionName`, and `minSdkVersion 23+`.
6. Build a signed release bundle (Build → Generate Signed Bundle → AAB) with an upload keystore you keep safe.

## Before Google Play submission

- Privacy policy URL (the app stores nickname, avatar, Player ID, stats and Google account ID).
- Data safety form: account info + app activity, no ads, no tracking.
- Store listing: title, short/full description, feature graphic, at least 2 phone screenshots.
- Content rating questionnaire, target audience, and a test track rollout before production.
