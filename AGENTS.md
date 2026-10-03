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
- Guest profiles are localStorage-only (`src/lib/local-store.ts`); linking Google merges them into the account.
- Profile avatar: `avatar` (app id) + `avatar_type` app|google + server-synced `avatar_url`; UI receives one effective `avatar` string (https URL = picture). A trigger blocks clients editing player_id/stats/avatar_url.
- Coins: all values live in `coin_config`, prices in `shop_items`; balances change only via SECURITY DEFINER RPCs (`coin_apply` is not client-callable) and the `coin_transactions` ledger dedupes by (user,type,reference) — prevents client-side coin minting/duplicate rewards.
- Coin game rewards apply only to server-decided online matches (ttt_finish/claim_abandon/leave_match); offline games give no coins — client results can't be trusted.
