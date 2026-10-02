import { useEquipped } from "@/lib/coins";
import { BOARD_SKINS, pieceGlyphs } from "@/lib/cosmetics";
import { cn } from "@/lib/utils";
import type { Board as BoardType, Player } from "@/lib/game/engine";

interface BoardProps {
  board: BoardType;
  onPlay: (cell: number) => void;
  disabled?: boolean;
  winningLine?: number[] | null;
  pendingCell?: number | null;
}

function Mark({ value, glyphs }: { value: Player; glyphs: [string, string] }) {
  const isX = value === "X";
  return (
    <span
      className={cn(
        "animate-pop select-none font-display leading-none",
        "text-[13vw] sm:text-6xl",
        isX ? "text-mark-x" : "text-mark-o",
      )}
      style={{ textShadow: "var(--shadow-glow)" }}
      aria-hidden
    >
      {isX ? glyphs[0] : glyphs[1]}
    </span>
  );
}

export function GameBoard({ board, onPlay, disabled, winningLine, pendingCell }: BoardProps) {
  const equipped = useEquipped();
  const glyphs = pieceGlyphs(equipped.pieces);
  const skin = equipped.board ? BOARD_SKINS[equipped.board] : undefined;
  return (
    <div
      style={skin}
      className="w-full rounded-3xl border border-border bg-board p-2.5 shadow-tile"
      role="grid"
      aria-label="Tic Tac Toe board"
    >
      <div className="grid grid-cols-3 gap-2.5">
        {board.map((cell, index) => {
          const isWinning = winningLine?.includes(index) ?? false;
          const isEmpty = cell === null;
          return (
            <button
              key={index}
              type="button"
              role="gridcell"
              aria-label={`Square ${index + 1}${cell ? `, ${cell}` : ", empty"}`}
              disabled={disabled || !isEmpty}
              onClick={() => onPlay(index)}
              className={cn(
                "relative flex aspect-square items-center justify-center rounded-2xl",
                "bg-cell transition-all duration-150 active:scale-95",
                "border border-board-line/70",
                isWinning && "bg-primary/25 ring-2 ring-primary",
                pendingCell === index && "opacity-60",
                !isEmpty && "cursor-default",
                isEmpty && !disabled && "hover:bg-board-line/40",
              )}
            >
              {cell ? <Mark value={cell} glyphs={glyphs} /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
