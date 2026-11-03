import { describe, expect, it } from "vitest";

import { bestMove } from "./ai";
import { boardFromString, evaluate } from "./engine";
import { validateMatchCode } from "../validation";

describe("game rules", () => {
  it("detects a diagonal win", () => {
    expect(evaluate(boardFromString("XO-OX---X"))).toEqual({ status: "win", winner: "X", line: [0, 4, 8] });
  });
  it("detects a draw on a full board", () => {
    expect(evaluate(boardFromString("XOXXOOOXX")).status).toBe("draw");
  });
  it("Expert AI takes an immediate win", () => {
    expect(bestMove(boardFromString("OO-XX----"), "O")).toBe(2);
  });
  it("Expert AI blocks the opponent's win", () => {
    expect(bestMove(boardFromString("XX-O-----"), "O")).toBe(2);
  });
});

describe("match codes", () => {
  it("accepts new 6-character codes", () => {
    expect(validateMatchCode("ab3d9k")).toBeNull();
  });
  it("rejects codes that are too short", () => {
    expect(validateMatchCode("AB3")).not.toBeNull();
  });
});
