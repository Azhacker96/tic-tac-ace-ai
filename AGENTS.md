<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules

- All online game rules (create/join match, moves, timeout autopilot, forfeits, rematch, friends) live in
  Postgres SECURITY DEFINER functions; the client only calls RPCs and never decides game outcomes.
- Board state is a 9-character `X/O/-` string; game modules under `src/lib/game/` stay UI-free.
- Guest profiles are localStorage-only (`src/lib/local-store.ts`); linking Google preserves nickname and Player ID (guest offline stats stay local and never transfer — client-asserted stats can't be trusted for leaderboards).
- Profile avatar: `avatar` (app id) + `avatar_type` app|google + server-synced `avatar_url`; UI receives one effective `avatar` string (https URL = picture). A trigger blocks clients editing player_id/stats/avatar_url.
- Coins: all values live in `coin_config`, prices in `shop_items`; balances change only via SECURITY DEFINER RPCs (`coin_apply` is not client-callable) and the `coin_transactions` ledger dedupes by (user,type,reference) — prevents client-side coin minting/duplicate rewards.
- Coin game rewards apply only to server-decided online matches (ttt_finish/claim_abandon/leave_match); offline games give no coins — client results can't be trusted.
- Leaderboards come from SECURITY DEFINER RPCs (get_global_leaderboard/get_friends_leaderboard/get_head_to_head) over server-owned profile stats and finished matches — rankings can't be faked client-side.
- Account win/loss stats change only through server-decided online matches; offline results stay local and never merge into the account — prevents leaderboard faking.
- Match codes are 6 characters generated with `gen_random_bytes` (32-symbol alphabet); `join_match` also accepts legacy 5-character codes.
- Gems live in `coin_wallets.gems` and share the `coin_transactions` ledger (`currency`='gem'); gem-only shop items use `shop_items.gem_price`. No gem→coin exchange.
- Rewarded-ad bonuses go through `claim_ad_reward` (one per win/daily, capped per 24h by `coin_config.ad_daily_cap`); Ad-Free users skip the video but get the same server-checked bonus. Real-money packs live in `iap_products` and must only be granted by a verified Google Play purchase handler (not built yet).
- `src/lib/ads.ts` uses `window.TTTAds` (native AdMob bridge) when present, else a labelled web test ad.
