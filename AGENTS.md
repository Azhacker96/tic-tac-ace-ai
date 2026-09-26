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
