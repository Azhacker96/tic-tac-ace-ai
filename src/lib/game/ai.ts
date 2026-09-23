import {
  availableMoves,
  evaluate,
  LINES,
  other,
  type Board,
  type Player,
} from "./engine";

export type Difficulty = "easy" | "medium" | "hard" | "expert";

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  expert: "Expert",
};

export const DIFFICULTY_BLURBS: Record<Difficulty, string> = {
  easy: "Mostly random moves. Great for warming up.",
  medium: "Blocks and attacks, but misses traps.",
  hard: "Strong play with the occasional slip.",
  expert: "Perfect play. Unbeatable — a draw is a win.",
};

function randomOf(cells: number[]): number {
  return cells[Math.floor(Math.random() * cells.length)]!;
}

/** Returns a cell that immediately completes a line for `p`, or null. */
function winningCell(board: Board, p: Player): number | null {
  for (const line of LINES) {
    const values = line.map((i) => board[i]);
    const owned = values.filter((v) => v === p).length;
    const empty = values.filter((v) => v === null).length;
    if (owned === 2 && empty === 1) {
      return line[values.findIndex((v) => v === null)]!;
    }
  }
  return null;
}

/** Full minimax with depth preference — plays perfectly. */
export function bestMove(board: Board, me: Player): number {
  const moves = availableMoves(board);
  if (moves.length === 0) return -1;
  let bestScore = -Infinity;
  let best = moves[0]!;
  for (const move of moves) {
    const next = [...board];
    next[move] = me;
    const score = minimax(next, me, other(me), 1);
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }
  return best;
}

function minimax(board: Board, me: Player, turn: Player, depth: number): number {
  const result = evaluate(board);
  if (result.status === "win") {
    return result.winner === me ? 10 - depth : depth - 10;
  }
  if (result.status === "draw") return 0;

  const moves = availableMoves(board);
  if (turn === me) {
    let best = -Infinity;
    for (const move of moves) {
      const next = [...board];
      next[move] = turn;
      best = Math.max(best, minimax(next, me, other(turn), depth + 1));
    }
    return best;
  }
  let best = Infinity;
  for (const move of moves) {
    const next = [...board];
    next[move] = turn;
    best = Math.min(best, minimax(next, me, other(turn), depth + 1));
  }
  return best;
}

/** Heuristic move: win, block, centre, corner, side. */
export function heuristicMove(board: Board, me: Player): number {
  const moves = availableMoves(board);
  const win = winningCell(board, me);
  if (win !== null) return win;
  const block = winningCell(board, other(me));
  if (block !== null) return block;
  if (moves.includes(4)) return 4;
  const corners = [0, 2, 6, 8].filter((c) => moves.includes(c));
  if (corners.length) return randomOf(corners);
  return randomOf(moves);
}

/**
 * Difficulty is expressed as the chance the AI plays its best move; otherwise
 * it falls back to a weaker policy. Each level behaves measurably differently.
 */
export function computerMove(board: Board, me: Player, difficulty: Difficulty): number {
  const moves = availableMoves(board);
  if (moves.length === 0) return -1;

  switch (difficulty) {
    case "easy": {
      // Random, but will take a free win 30% of the time.
      const win = winningCell(board, me);
      if (win !== null && Math.random() < 0.3) return win;
      return randomOf(moves);
    }
    case "medium": {
      // Win/block reliably, otherwise semi-random.
      if (Math.random() < 0.75) return heuristicMove(board, me);
      return randomOf(moves);
    }
    case "hard": {
      // Near-perfect with a 15% slip into heuristic play.
      if (Math.random() < 0.85) return bestMove(board, me);
      return heuristicMove(board, me);
    }
    case "expert":
    default:
      return bestMove(board, me);
  }
}

/** Used by online autopilot on the client for local previews. */
export const autopilotMove = (board: Board, me: Player) => heuristicMove(board, me);
