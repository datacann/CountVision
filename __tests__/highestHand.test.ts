import { solveHighestHand, type SolverTile } from "../services/highestHand";

const tiles = (...values: Array<[number | "okey", string, Partial<SolverTile>?]>): SolverTile[] =>
  values.map(([number, color, extra], index) => ({ id: `tile-${index}`, number, color, ...extra }));

describe("solveHighestHand", () => {
  it("builds runs and leaves unrelated tiles out", () => {
    const result = solveHighestHand(
      tiles([1, "red"], [2, "red"], [3, "red"], [13, "black"]),
      7,
      "yellow",
    );
    expect(result.score).toBe(6);
    expect(result.groups).toHaveLength(1);
    expect(result.leftovers).toHaveLength(1);
  });

  it("chooses the higher-scoring meld when groups overlap", () => {
    const result = solveHighestHand(
      tiles([10, "red"], [11, "red"], [12, "red"], [12, "black"], [12, "yellow"]),
      7,
      "yellow",
    );
    expect(result.score).toBe(36);
    expect(result.usedTileCount).toBe(3);
  });

  it("uses a real okey as a wildcard in a run", () => {
    const result = solveHighestHand(
      tiles([5, "black"], ["okey", "other", { is_okey: true }], [7, "black"]),
      12,
      "red",
    );
    expect(result.score).toBe(18);
    expect(result.usedTileCount).toBe(3);
  });

  it("treats fake okey as the selected okey value, not a wildcard", () => {
    const result = solveHighestHand(
      tiles([5, "black"], [0 as any, "other", { is_fake_okey: true }], [7, "black"]),
      6,
      "black",
    );
    expect(result.score).toBe(18);
  });

  it("solves a full 21-tile rack without reusing physical tiles", () => {
    const rack = tiles(
      [1, "red"], [2, "red"], [3, "red"], [4, "red"], [5, "red"], [6, "red"], [7, "red"],
      [7, "black"], [8, "black"], [9, "black"], [10, "black"], [11, "black"],
      [13, "red"], [13, "black"], [13, "yellow"], [13, "other"],
      [4, "yellow"], [5, "yellow"], [6, "yellow"],
      ["okey", "other", { is_okey: true }], [2, "black"],
    );
    const result = solveHighestHand(rack, 12, "other");
    expect(result.score).toBeGreaterThan(0);
    expect(result.groups.flat()).toHaveLength(result.usedTileCount);
    expect(new Set(result.groups.flat().map((tile) => tile.id)).size).toBe(result.usedTileCount);
  });
});
