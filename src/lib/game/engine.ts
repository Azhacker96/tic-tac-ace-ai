export type Cell = "X" | "O" | null;
export type Board = Cell[];
export type Player = "X" | "O";

export const EMPTY_BOARD: Board = Array(9).fill(null);

export const LINES: number[][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export type GameResult =
  | { status: "playing" }
  | { status: "draw" }
  | { status: "win"; winner: Player; line: number[] };

export function evaluate(board: Board): GameResult {
  for (const line of LINES) {
    const [a, b, c] = line as [number, number, number];
    const v = board[a];
    if (v && v === board[b] && v === board[c]) {
      return { status: "win", winner: v, line };
    }
  }
  if (board.every((c) => c !== null)) return { status: "draw" };
  return { status: "playing" };
}

export function availableMoves(board: Board): number[] {
  const out: number[] = [];
  board.forEach((c, i) => {
    if (c === null) out.push(i);
  });
  return out;
}

export function other(p: Player): Player {
  return p === "X" ? "O" : "X";
}

/** "X-O--X---" style string used by the database. */
export function boardToString(board: Board): string {
  return board.map((c) => c ?? "-").join("");
}

export function boardFromString(value: string): Board {
  const chars = value.padEnd(9, "-").slice(0, 9).split("");
  return chars.map((c) => (c === "X" || c === "O" ? (c as Player) : null));
}
