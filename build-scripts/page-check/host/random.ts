type Random = {
  next: () => number;
  int: (min: number, max: number) => number;
  pick: <T>(items: readonly T[]) => T;
  chance: (probability: number) => boolean;
  id: (prefix: string) => string;
  word: (length: number) => string;
};

const LETTERS = "abcdefghijklmnopqrstuvwxyz";
const HEX = "0123456789abcdef";

function createRandom(seed: number): Random {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number): number => min + Math.floor(next() * (max - min + 1));
  const pick = <T>(items: readonly T[]): T => {
    const item = items[int(0, items.length - 1)];
    if (item === undefined) {
      throw new RangeError("Cannot pick from an empty list");
    }
    return item;
  };
  const text = (alphabet: string, length: number): string => Array.from({ length }, () => alphabet[int(0, alphabet.length - 1)] ?? "").join("");
  const id = (prefix: string): string => `${prefix}_${text(HEX, 8)}-${text(HEX, 4)}-${text(HEX, 4)}-${text(HEX, 4)}-${text(HEX, 12)}`;
  return {
    next,
    int,
    pick,
    chance: (probability) => next() < probability,
    id,
    word: (length) => text(LETTERS, length),
  };
}

export { createRandom };
export type { Random };
