import { describe, expect, it } from 'vitest';
import { cryptoRng, randomInt, seededRng, shuffled } from './rng';

describe('cryptoRng', () => {
  it('returns numbers in [0, 1)', () => {
    for (let i = 0; i < 5_000; i += 1) {
      const value = cryptoRng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('is not constant and averages close to one half', () => {
    const values = Array.from({ length: 20_000 }, () => cryptoRng());
    expect(new Set(values).size).toBeGreaterThan(19_900);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    expect(mean).toBeGreaterThan(0.49);
    expect(mean).toBeLessThan(0.51);
  });
});

describe('seededRng', () => {
  it('repeats the same sequence for the same seed and differs between seeds', () => {
    const a = seededRng(42);
    const b = seededRng(42);
    const c = seededRng(43);
    const sequence = (rng: () => number) => Array.from({ length: 8 }, () => rng());
    expect(sequence(a)).toEqual(sequence(b));
    expect(sequence(seededRng(42))).not.toEqual(sequence(c));
  });
});

describe('randomInt', () => {
  it('stays within range and reaches both ends', () => {
    const rng = seededRng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 2_000; i += 1) {
      const value = randomInt(rng, 6);
      expect(Number.isInteger(value)).toBe(true);
      seen.add(value);
    }
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe('shuffled', () => {
  const items = Array.from({ length: 52 }, (_, i) => i);

  it('is a permutation of the input and leaves the input alone', () => {
    const copy = [...items];
    const result = shuffled(items, seededRng(1));
    expect(items).toEqual(copy);
    expect([...result].sort((a, b) => a - b)).toEqual(items);
    expect(result).not.toEqual(items);
  });

  it('is repeatable for a seed and different for another', () => {
    expect(shuffled(items, seededRng(5))).toEqual(shuffled(items, seededRng(5)));
    expect(shuffled(items, seededRng(5))).not.toEqual(shuffled(items, seededRng(6)));
  });

  it('puts every card on top about equally often (no bias toward any card)', () => {
    const rng = seededRng(2_026);
    const topCounts = new Array<number>(52).fill(0);
    const rounds = 52_000;
    for (let i = 0; i < rounds; i += 1) {
      const top = shuffled(items, rng)[0] ?? 0;
      topCounts[top] = (topCounts[top] ?? 0) + 1;
    }
    // Expected 1,000 each with a standard deviation of about 31: five sigmas is 160.
    for (const count of topCounts) {
      expect(count).toBeGreaterThan(840);
      expect(count).toBeLessThan(1_160);
    }
  });

  it('puts every card in every position about equally often', () => {
    const rng = seededRng(99);
    const small = [0, 1, 2, 3, 4];
    const table = Array.from({ length: 5 }, () => new Array<number>(5).fill(0));
    const rounds = 50_000;
    for (let i = 0; i < rounds; i += 1) {
      shuffled(small, rng).forEach((card, position) => {
        const row = table[position];
        if (row !== undefined) row[card] = (row[card] ?? 0) + 1;
      });
    }
    for (const row of table) {
      for (const count of row) {
        expect(count).toBeGreaterThan(9_500);
        expect(count).toBeLessThan(10_500);
      }
    }
  });
});
