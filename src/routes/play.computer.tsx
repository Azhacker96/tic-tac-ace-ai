import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { Screen } from "@/components/Screen";
import { GameBoard } from "@/components/game/Board";
import { PlayerChip } from "@/components/game/PlayerChip";
import { ResultSheet, type Outcome } from "@/components/game/ResultSheet";
import { SymbolPicker } from "@/components/game/SymbolPicker";
import { useApp } from "@/lib/app-context";
import { computerMove, DIFFICULTY_BLURBS, DIFFICULTY_LABELS, type Difficulty } from "@/lib/game/ai";
import { EMPTY_BOARD, evaluate, other, type Board, type Player } from "@/lib/game/engine";
import { sfx } from "@/lib/sound";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/play/computer")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Play the computer — Tic Tac Arcade" },
      {
        name: "description",
        content:
          "Four genuinely different AI levels, from a forgiving Easy to an unbeatable Expert minimax engine.",
      },
      { property: "og:title", content: "Play the computer — Tic Tac Arcade" },
      { property: "og:description", content: "Four AI difficulties, from Easy to unbeatable Expert." },
    ],
  }),
  component: ComputerGame,
});

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard", "expert"];

function ComputerGame() {
  const { identity, recordResult } = useApp();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"setup" | "playing">("setup");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [mySymbol, setMySymbol] = useState<Player>("X");
  const [board, setBoard] = useState<Board>(EMPTY_BOARD);
  const [turn, setTurn] = useState<Player>("X");
  const [thinking, setThinking] = useState(false);
  const [finished, setFinished] = useState<{ outcome: Outcome; line: number[] | null } | null>(null);
  const recorded = useRef(false);

  const aiSymbol = other(mySymbol);

  const reset = useCallback(
    (keepSetup = true) => {
      setBoard(EMPTY_BOARD);
      setTurn("X");
      setFinished(null);
      setThinking(false);
      recorded.current = false;
      if (!keepSetup) setPhase("setup");
    },
    [],
  );

  const settle = useCallback(
    (next: Board) => {
      const result = evaluate(next);
      if (result.status === "playing") return false;
      if (result.status === "draw") {
        setFinished({ outcome: "draw", line: null });
        sfx.draw();
      } else {
        const outcome: Outcome = result.winner === mySymbol ? "win" : "loss";
        setFinished({ outcome, line: result.line });
        if (outcome === "win") sfx.win();
        else sfx.lose();
      }
      return true;
    },
    [mySymbol],
  );

  /* AI turn */
  useEffect(() => {
    if (phase !== "playing" || finished || turn !== aiSymbol) return;
    setThinking(true);
    const timer = window.setTimeout(() => {
      setBoard((current) => {
        if (evaluate(current).status !== "playing") return current;
        const cell = computerMove(current, aiSymbol, difficulty);
        if (cell < 0) return current;
        const next = [...current];
        next[cell] = aiSymbol;
        sfx.opponent();
        if (!settle(next)) setTurn(mySymbol);
        setThinking(false);
        return next;
      });
    }, 420);
    return () => window.clearTimeout(timer);
  }, [phase, turn, aiSymbol, difficulty, finished, mySymbol, settle]);

  /* Persist the result once */
  useEffect(() => {
    if (!finished || recorded.current) return;
    recorded.current = true;
    void recordResult(finished.outcome === "win" ? "win" : finished.outcome === "loss" ? "loss" : "draw");
  }, [finished, recordResult]);

  const play = (cell: number) => {
    if (finished || thinking || turn !== mySymbol || board[cell]) return;
    const next = [...board];
    next[cell] = mySymbol;
    sfx.place();
    setBoard(next);
    if (!settle(next)) setTurn(aiSymbol);
  };

  const start = () => {
    reset();
    setPhase("playing");
  };

  if (phase === "setup") {
    return (
      <Screen title="Play with Computer" subtitle="Choose difficulty and mark">
        <div className="grid gap-5">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Difficulty
            </p>
            <div className="grid gap-2">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDifficulty(d)}
                  className={cn(
                    "rounded-2xl border p-3.5 text-left active:scale-[0.99]",
                    difficulty === d ? "border-primary bg-primary/15" : "border-border bg-surface",
                  )}
                >
                  <p className="font-semibold">{DIFFICULTY_LABELS[d]}</p>
                  <p className="text-xs text-muted-foreground">{DIFFICULTY_BLURBS[d]}</p>
                </button>
              ))}
            </div>
          </div>

          <SymbolPicker value={mySymbol} onChange={setMySymbol} />

          <button
            type="button"
            onClick={start}
            className="rounded-2xl bg-primary px-4 py-4 font-semibold text-primary-foreground shadow-tile active:translate-y-0.5"
          >
            Start game
          </button>
        </div>
      </Screen>
    );
  }

  const myTurn = turn === mySymbol && !finished;

  return (
    <Screen
      title={DIFFICULTY_LABELS[difficulty]}
      subtitle="vs Computer"
      action={
        <button
          type="button"
          onClick={() => reset(false)}
          className="rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold active:scale-95"
        >
          Change
        </button>
      }
    >
      <div className="flex gap-2">
        <PlayerChip
          name={identity?.nickname ?? "You"}
          avatar={identity?.avatar}
          symbol={mySymbol}
          active={myTurn}
        />
        <PlayerChip
          name="Computer"
          symbol={aiSymbol}
          active={!myTurn && !finished}
          subtitle={thinking ? "Thinking…" : DIFFICULTY_LABELS[difficulty]}
        />
      </div>

      <p className="py-4 text-center text-sm font-semibold">
        {finished
          ? finished.outcome === "win"
            ? "You won!"
            : finished.outcome === "loss"
              ? "Computer won"
              : "It's a draw"
          : myTurn
            ? "Your turn"
            : "Computer's turn…"}
      </p>

      <GameBoard
        board={board}
        onPlay={play}
        disabled={!myTurn}
        winningLine={finished?.line ?? null}
      />

      <div className="mt-5 grid gap-2">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-2xl border border-border bg-surface px-4 py-3.5 font-semibold active:translate-y-0.5"
        >
          Restart game
        </button>
      </div>

      <ResultSheet
        open={Boolean(finished)}
        outcome={finished?.outcome ?? "draw"}
        headline={
          finished?.outcome === "win"
            ? "Victory!"
            : finished?.outcome === "loss"
              ? "Defeated"
              : "Draw"
        }
        detail={`${DIFFICULTY_LABELS[difficulty]} computer · you played ${mySymbol}`}
        stats={identity?.stats}
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
          onClick={() => reset(false)}
          className="rounded-2xl border border-border px-4 py-3.5 font-semibold"
        >
          New game
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
