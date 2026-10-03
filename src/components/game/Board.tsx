import { memo, useCallback } from "react";

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

interface CellProps {
  index: number;
  value: Player | null;
  glyphX: string;
  glyphO: string;
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
      className={cn(
        "relative flex aspect-square items-center justify-center rounded-2xl",
        "bg-cell transition-transform duration-100 active:scale-95",
        "border border-board-line/70 [transform:translateZ(0)]",
        winning && "bg-primary/25 ring-2 ring-primary",
        pending && "opacity-60",
        !isEmpty && "cursor-default",
        isEmpty && !disabled && "hover:bg-board-line/40",
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
  const skin = equipped.board ? BOARD_SKINS[equipped.board] : undefined;
  // Stable handler so memoized cells don't redraw when the parent re-renders (e.g. timer ticks).
  const play = useCallback((cell: number) => onPlay(cell), [onPlay]);
  return (
    <div
      style={skin}
      className="w-full rounded-3xl border border-border bg-board p-2.5 shadow-tile"
      role="grid"
      aria-label="Tic Tac Toe board"
    >
      <div className="grid grid-cols-3 gap-2.5">
        {board.map((cell, index) => (
          <Cell
            key={index}
            index={index}
            value={cell}
            glyphX={glyphs[0]}
            glyphO={glyphs[1]}
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
