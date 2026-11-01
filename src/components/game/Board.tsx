import { memo, useCallback, type CSSProperties } from "react";

import { BoardCorners } from "@/components/game/BoardDecor";
import { useEquipped } from "@/lib/coins";
import { boardTheme, pieceGlyphs } from "@/lib/cosmetics";
import { cn } from "@/lib/utils";
import type { Board as BoardType, Player } from "@/lib/game/engine";

interface BoardProps {
  board: BoardType;
  onPlay: (cell: number) => void;
  disabled?: boolean;
  winningLine?: number[] | null;
  pendingCell?: number | null;
}

interface CellProps {
  index: number;
  value: Player | null;
  glyphX: string;
  glyphO: string;
  cellStyle: CSSProperties;
  disabled: boolean;
  winning: boolean;
  pending: boolean;
  onPlay: (cell: number) => void;
}

const Cell = memo(function Cell({
  index,
  value,
  glyphX,
  glyphO,
  cellStyle,
  disabled,
  winning,
  pending,
  onPlay,
}: CellProps) {
  const isEmpty = value === null;
  return (
    <button
      type="button"
      role="gridcell"
      aria-label={`Square ${index + 1}${value ? `, ${value}` : ", empty"}`}
      disabled={disabled || !isEmpty}
      onClick={() => onPlay(index)}
      style={cellStyle}
      className={cn(
        "relative flex aspect-square items-center justify-center rounded-2xl",
        "transition-[transform,filter] duration-100 active:scale-95 [transform:translateZ(0)]",
        winning && "ring-2 ring-primary brightness-125",
        pending && "opacity-60",
        !isEmpty && "cursor-default",
        isEmpty && !disabled && "hover:brightness-125",
      )}
    >
      {value ? (
        <span
          className={cn(
            "animate-pop select-none font-display leading-none",
            "text-[13vw] sm:text-6xl",
            value === "X" ? "text-mark-x" : "text-mark-o",
          )}
          style={{ textShadow: "var(--shadow-glow)" }}
          aria-hidden
        >
          {value === "X" ? glyphX : glyphO}
        </span>
      ) : null}
    </button>
  );
});

function GameBoardInner({ board, onPlay, disabled, winningLine, pendingCell }: BoardProps) {
  const equipped = useEquipped();
  const glyphs = pieceGlyphs(equipped.pieces);
  const theme = boardTheme(equipped.board);
  // Stable handler so memoized cells don't redraw when the parent re-renders (e.g. timer ticks).
  const play = useCallback((cell: number) => onPlay(cell), [onPlay]);
  return (
    <div
      style={theme.frame}
      className="relative w-full overflow-hidden rounded-3xl p-3"
      role="grid"
      aria-label="Tic Tac Toe board"
    >
      <BoardCorners decor={theme.decor} accent={theme.accent} />
      <div className="relative grid grid-cols-3 gap-2.5">
        {board.map((cell, index) => (
          <Cell
            key={index}
            index={index}
            value={cell}
            glyphX={glyphs[0]}
            glyphO={glyphs[1]}
            cellStyle={theme.cell}
            disabled={Boolean(disabled)}
            winning={winningLine?.includes(index) ?? false}
            pending={pendingCell === index}
            onPlay={play}
          />
        ))}
      </div>
    </div>
  );
}

export const GameBoard = memo(GameBoardInner);
