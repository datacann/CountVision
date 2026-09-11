export type SolverTile = {
  id: string;
  number?: string | number | null;
  color?: string | null;
  color_variant?: string | null;
  is_okey?: boolean;
  is_joker?: boolean;
  is_fake_okey?: boolean;
  [key: string]: unknown;
};

export type HighestHandResult = {
  groups: SolverTile[][];
  leftovers: SolverTile[];
  score: number;
  usedTileCount: number;
};

type NormalTile = { index: number; number: number; color: string };
type Candidate = { mask: bigint; score: number; tiles: number[] };

const VALID_COLORS = new Set(["yellow", "red", "black", "other"]);

function normalizeColor(color?: string | null): string | null {
  const normalized = color?.toLowerCase();
  if (normalized === "green" || normalized === "blue") return "other";
  return normalized && VALID_COLORS.has(normalized) ? normalized : null;
}

function isLiteralOkey(tile: SolverTile): boolean {
  return Boolean(tile.is_okey || tile.is_joker || tile.number === "okey");
}

function tileValue(
  tile: SolverTile,
  okeyNumber: number,
  okeyColor: string,
): { wildcard: boolean; number?: number; color?: string } {
  if (!tile.is_fake_okey) {
    if (isLiteralOkey(tile)) return { wildcard: true };
    if (
      Number(tile.number) === okeyNumber &&
      normalizeColor(tile.color) === okeyColor
    ) {
      return { wildcard: true };
    }
  }

  const number = tile.is_fake_okey ? okeyNumber : Number(tile.number);
  const color = tile.is_fake_okey ? okeyColor : normalizeColor(tile.color);
  if (!Number.isInteger(number) || number < 1 || number > 13 || !color) return { wildcard: false };
  return { wildcard: false, number, color };
}

function combinations<T>(items: T[], count: number): T[][] {
  if (count === 0) return [[]];
  if (items.length < count) return [];
  const result: T[][] = [];
  const visit = (start: number, picked: T[]) => {
    if (picked.length === count) {
      result.push([...picked]);
      return;
    }
    for (let index = start; index <= items.length - (count - picked.length); index++) {
      picked.push(items[index]);
      visit(index + 1, picked);
      picked.pop();
    }
  };
  visit(0, []);
  return result;
}

function cartesianChoices(choices: number[][]): number[][] {
  let result: number[][] = [[]];
  for (const options of choices) {
    result = result.flatMap((prefix) => options.map((option) => [...prefix, option]));
  }
  return result;
}

function toMask(indices: number[]): bigint {
  return indices.reduce((mask, index) => mask | (1n << BigInt(index)), 0n);
}

function bitCount(mask: bigint): number {
  let count = 0;
  while (mask) {
    count += Number(mask & 1n);
    mask >>= 1n;
  }
  return count;
}

export function solveHighestHand(
  tiles: SolverTile[],
  selectedOkeyNumber: string | number,
  selectedOkeyColor: string,
): HighestHandResult {
  const okeyNumber = Number(selectedOkeyNumber);
  const okeyColor = normalizeColor(selectedOkeyColor);
  if (!Number.isInteger(okeyNumber) || okeyNumber < 1 || okeyNumber > 13 || !okeyColor) {
    throw new Error("Geçerli okey taşı seçilmelidir.");
  }
  if (tiles.length > 30) throw new Error("En fazla 30 taş çözülebilir.");

  const wildcards: number[] = [];
  const normals: NormalTile[] = [];
  tiles.forEach((tile, index) => {
    const value = tileValue(tile, okeyNumber, okeyColor);
    if (value.wildcard) wildcards.push(index);
    else if (value.number && value.color) {
      normals.push({ index, number: value.number, color: value.color });
    }
  });

  const candidatesByMask = new Map<string, Candidate>();
  const addCandidate = (indices: number[], score: number) => {
    const mask = toMask(indices);
    const key = mask.toString();
    const current = candidatesByMask.get(key);
    if (!current || score > current.score) candidatesByMask.set(key, { mask, score, tiles: indices });
  };

  // Per: aynı sayı, farklı renk, toplam 3 veya 4 taş.
  for (let number = 1; number <= 13; number++) {
    const byColor = new Map<string, number[]>();
    normals.filter((tile) => tile.number === number).forEach((tile) => {
      byColor.set(tile.color, [...(byColor.get(tile.color) ?? []), tile.index]);
    });
    const colors = [...byColor.keys()];
    for (const length of [3, 4]) {
      for (let jokerCount = 0; jokerCount <= Math.min(2, wildcards.length, length - 1); jokerCount++) {
        const normalCount = length - jokerCount;
        for (const selectedColors of combinations(colors, normalCount)) {
          for (const normalIndices of cartesianChoices(selectedColors.map((color) => byColor.get(color)!))) {
            for (const jokerIndices of combinations(wildcards, jokerCount)) {
              addCandidate([...normalIndices, ...jokerIndices], number * length);
            }
          }
        }
      }
    }
  }

  // Seri: aynı renk, ardışık sayılar; joker eksik pozisyonu tamamlar.
  for (const color of VALID_COLORS) {
    const byNumber = new Map<number, number[]>();
    normals.filter((tile) => tile.color === color).forEach((tile) => {
      byNumber.set(tile.number, [...(byNumber.get(tile.number) ?? []), tile.index]);
    });
    for (let start = 1; start <= 11; start++) {
      for (let end = start + 2; end <= 13; end++) {
        const numbers = Array.from({ length: end - start + 1 }, (_, index) => start + index);
        for (let jokerCount = 0; jokerCount <= Math.min(2, wildcards.length, numbers.length - 1); jokerCount++) {
          for (const jokerNumbers of combinations(numbers, jokerCount)) {
            const jokerSet = new Set(jokerNumbers);
            const normalNumbers = numbers.filter((number) => !jokerSet.has(number));
            if (normalNumbers.some((number) => !byNumber.has(number))) continue;
            for (const normalIndices of cartesianChoices(normalNumbers.map((number) => byNumber.get(number)!))) {
              for (const jokerIndices of combinations(wildcards, jokerCount)) {
                const ordered = numbers.map((number) =>
                  jokerSet.has(number)
                    ? jokerIndices[jokerNumbers.indexOf(number)]
                    : normalIndices[normalNumbers.indexOf(number)],
                );
                addCandidate(ordered, numbers.reduce((sum, number) => sum + number, 0));
              }
            }
          }
        }
      }
    }
  }

  const candidates = [...candidatesByMask.values()];
  const byTile = Array.from({ length: tiles.length }, () => [] as Candidate[]);
  candidates.forEach((candidate) => {
    candidate.tiles.forEach((index) => byTile[index].push(candidate));
  });

  type Solution = { score: number; used: number; picks: Candidate[] };
  const memo = new Map<string, Solution>();
  const solve = (available: bigint): Solution => {
    if (available === 0n) return { score: 0, used: 0, picks: [] };
    const key = available.toString();
    const cached = memo.get(key);
    if (cached) return cached;

    let pivot = 0;
    while ((available & (1n << BigInt(pivot))) === 0n) pivot++;
    let best = solve(available & ~(1n << BigInt(pivot)));
    for (const candidate of byTile[pivot]) {
      if ((candidate.mask & available) !== candidate.mask) continue;
      const tail = solve(available & ~candidate.mask);
      const proposal = {
        score: candidate.score + tail.score,
        used: bitCount(candidate.mask) + tail.used,
        picks: [candidate, ...tail.picks],
      };
      if (proposal.score > best.score || (proposal.score === best.score && proposal.used > best.used)) {
        best = proposal;
      }
    }
    memo.set(key, best);
    return best;
  };

  const fullMask = tiles.length ? (1n << BigInt(tiles.length)) - 1n : 0n;
  const solution = solve(fullMask);
  const usedMask = solution.picks.reduce((mask, candidate) => mask | candidate.mask, 0n);
  return {
    groups: solution.picks.map((candidate) => candidate.tiles.map((index) => tiles[index])),
    leftovers: tiles.filter((_, index) => (usedMask & (1n << BigInt(index))) === 0n),
    score: solution.score,
    usedTileCount: solution.used,
  };
}
