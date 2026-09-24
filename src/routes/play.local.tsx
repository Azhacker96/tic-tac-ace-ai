import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";

import { Screen } from "@/components/Screen";
import { GameBoard } from "@/components/game/Board";
import { PlayerChip } from "@/components/game/PlayerChip";
import { ResultSheet, type Outcome } from "@/components/game/ResultSheet";
import { SymbolPicker } from "@/components/game/SymbolPicker";
import { EMPTY_BOARD, evaluate, other, type Board, type Player } from "@/lib/game/engine";
import { sfx } from "@/lib/sound";

export const Route = createFileRoute("/play/local")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Two players, one phone — Tic Tac Arcade" },
      {
        name: "description",
        content: "Pass-and-play Tic Tac Toe for two players on the same device, with score keeping.",
      },
      { property: "og:title", content: "Two players, one phone — Tic Tac Arcade" },
      { property: "og:description", content: "Pass-and-play Tic Tac Toe on a single device." },
    ],
  }),
  component: LocalGame,
});

function LocalGame() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"setup" | "playing">("setup");
  const [p1Symbol, setP1Symbol] = useState<Player>("X");
  const [board, setBoard] = useState<Board>(EMPTY_BOARD);
  const [turn, setTurn] = useState<Player>("X");
  const [finished, setFinished] = useState<{
    outcome: Outcome;
    winner: Player | null;
    line: number[] | null;
  } | null>(null);
  const [score, setScore] = useState({ p1: 0, p2: 0, draws: 0 });

  const p2Symbol = other(p1Symbol);

  const reset = useCallback((toSetup = false) => {
    setBoard(EMPTY_BOARD);
    setTurn("X");
    setFinished(null);
    if (toSetup) setPhase("setup");
  }, []);

  const play = (cell: number) => {
    if (finished || board[cell]) return;
    const next = [...board];
    next[cell] = turn;
    sfx.place();
    setBoard(next);

    const result = evaluate(next);
    if (result.status === "win") {
      sfx.win();
      setFinished({ outcome: "win", winner: result.winner, line: result.line });
      setScore((s) =>
        result.winner === p1Symbol ? { ...s, p1: s.p1 + 1 } : { ...s, p2: s.p2 + 1 },
      );
      return;
    }
    if (result.status === "draw") {
      sfx.draw();
      setFinished({ outcome: "draw", winner: null, line: null });
      setScore((s) => ({ ...s, draws: s.draws + 1 }));
      return;
    }
    setTurn(other(turn));
  };

  if (phase === "setup") {
    return (
      <Screen title="2 Players" subtitle="Same device, pass and play">
        <div className="grid gap-5">
          <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted-foreground">
            Player 1 and Player 2 take turns on this phone. X always moves first.
          </div>
          <SymbolPicker value={p1Symbol} onChange={setP1Symbol} label="Player 1 plays" />
          <button
            type="button"
            onClick={() => {
              reset();
              setPhase("playing");
            }}
            className="rounded-2xl bg-primary px-4 py-4 font-semibold text-primary-foreground shadow-tile active:translate-y-0.5"
          >
            Start game
          </button>
        </div>
      </Screen>
    );
  }

  const p1Active = turn === p1Symbol && !finished;
  const winnerName = finished?.winner
    ? finished.winner === p1Symbol
      ? "Player 1"
      : "Player 2"
    : null;

  return (
    <Screen
      title="2 Players"
      subtitle={`P1 ${score.p1} · P2 ${score.p2} · Draws ${score.draws}`}
    >
      <div className="flex gap-2">
        <PlayerChip name="Player 1" symbol={p1Symbol} active={p1Active} />
        <PlayerChip name="Player 2" symbol={p2Symbol} active={!p1Active && !finished} />
      </div>

      <p className="py-4 text-center text-sm font-semibold">
        {finished
          ? winnerName
            ? `${winnerName} wins!`
            : "It's a draw"
          : `${p1Active ? "Player 1" : "Player 2"}'s turn (${turn})`}
      </p>

      <GameBoard board={board} onPlay={play} disabled={Boolean(finished)} winningLine={finished?.line ?? null} />

      <div className="mt-5 grid gap-2">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-2xl border border-border bg-surface px-4 py-3.5 font-semibold active:translate-y-0.5"
        >
          New game
        </button>
      </div>

      <ResultSheet
        open={Boolean(finished)}
        outcome={finished?.outcome === "draw" ? "draw" : "win"}
        headline={winnerName ? `${winnerName} wins!` : "Draw"}
        detail={winnerName ? `Winning mark: ${finished?.winner}` : "Nobody could break through"}
        stats={{ wins: score.p1, losses: score.p2, draws: score.draws }}
      >
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-2xl bg-primary px-4 py-3.5 font-semibold text-primary-foreground"
        >
          Rematch
        </button>
        <button
          type="button"
          onClick={() => {
            setScore({ p1: 0, p2: 0, draws: 0 });
            reset(true);
          }}
          className="rounded-2xl border border-border px-4 py-3.5 font-semibold"
        >
          New match (reset score)
        </button>
        <button
          type="button"
          onClick={() => navigate({ to: "/home" })}
          className="rounded-2xl px-4 py-3 text-sm text-muted-foreground"
        >
          Home
        </button>
      </ResultSheet>
    </Screen>
  );
}
