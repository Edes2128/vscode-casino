/** A source of uniform random numbers in [0, 1). Engines take one so tests can control the outcome. */
export type Rng = () => number;

/**
 * Cryptographically secure randomness from the Web Crypto API. 53 random bits are combined into a
 * double, so the result is uniform over every value a double can take in [0, 1).
 */
export const cryptoRng: Rng = () => {
  const words = new Uint32Array(2);
  crypto.getRandomValues(words);
  return (((words[0] ?? 0) >>> 5) * 67_108_864 + ((words[1] ?? 0) >>> 6)) / 9_007_199_254_740_992;
};

/** A small deterministic generator (mulberry32), for tests that need a repeatable sequence. */
export function seededRng(seed: number): Rng {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A uniformly random whole number from 0 up to, but not including, `maxExclusive`. */
export function randomInt(rng: Rng, maxExclusive: number): number {
  return Math.floor(rng() * maxExclusive);
}

/** Fisher-Yates shuffle. Returns a new array; the input is left alone. */
export function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = randomInt(rng, i + 1);
    const a = result[i] as T;
    result[i] = result[j] as T;
    result[j] = a;
  }
  return result;
}
