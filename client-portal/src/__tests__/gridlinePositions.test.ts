import { describe, it, expect } from "vitest";
import { gridlinePositions, GRID_GUTTER } from "../components/StitchGrid";

describe("gridlinePositions — edge numbering / bold-gridline positions", () => {
  it("always includes the origin (0) and every-10 boundaries up to length", () => {
    expect(gridlinePositions(100)).toEqual([
      0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100,
    ]);
  });

  it("handles a length that is not a multiple of 10", () => {
    expect(gridlinePositions(35)).toEqual([0, 10, 20, 30]);
  });

  it("matches the PDF chart convention (origin 1, then 10, 20, ... N)", () => {
    // PDF labelPositions(0, gridWidth) == same sequence
    expect(gridlinePositions(60)).toEqual([0, 10, 20, 30, 40, 50, 60]);
  });

  it("supports a custom interval", () => {
    expect(gridlinePositions(30, 5)).toEqual([0, 5, 10, 15, 20, 25, 30]);
  });

  it("returns just the origin for grids smaller than the interval", () => {
    expect(gridlinePositions(8)).toEqual([0]);
  });

  it("the gutter constant is positive so numbers have a margin", () => {
    expect(GRID_GUTTER).toBeGreaterThan(0);
  });
});
