import { describe, expect, it } from 'vitest';
import { createInitialSnapshot, isLuckyBreakSnapshot, MAX_HISTORY_ENTRIES, STARTING_BALANCE } from './snapshot';
import type { LuckyBreakSnapshot, HistoryEntry } from './types';

const entry: HistoryEntry = {
  id: 'r-1',
  game: 'roulette',
  bet: 50,
  outcome: 'win',
  payout: 50,
  detail: 'Red 17',
  timestamp: 1_760_000_000_000,
};

describe('createInitialSnapshot', () => {
  it('starts with 1,000 chips and nothing played', () => {
    const snapshot = createInitialSnapshot();
    expect(snapshot.balance).toBe(1_000);
    expect(snapshot.balance).toBe(STARTING_BALANCE);
    expect(snapshot.history).toEqual([]);
    for (const stats of Object.values(snapshot.stats)) {
      expect(stats).toEqual({
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        pushes: 0,
        biggestWin: 0,
        biggestLoss: 0,
        totalWagered: 0,
      });
    }
  });
});

describe('isLuckyBreakSnapshot', () => {
  const initial = createInitialSnapshot();
  const withHistory: LuckyBreakSnapshot = { ...initial, history: [entry] };

  it('accepts a fresh snapshot and one with history', () => {
    expect(isLuckyBreakSnapshot(initial)).toBe(true);
    expect(isLuckyBreakSnapshot(withHistory)).toBe(true);
  });

  it('accepts negative payouts (losses)', () => {
    const loss = { ...entry, outcome: 'loss', payout: -50 };
    expect(isLuckyBreakSnapshot({ ...initial, history: [loss] })).toBe(true);
  });

  it('rejects a negative, fractional or non-numeric balance', () => {
    expect(isLuckyBreakSnapshot({ ...initial, balance: -1 })).toBe(false);
    expect(isLuckyBreakSnapshot({ ...initial, balance: 10.5 })).toBe(false);
    expect(isLuckyBreakSnapshot({ ...initial, balance: Number.NaN })).toBe(false);
    expect(isLuckyBreakSnapshot({ ...initial, balance: '1000' })).toBe(false);
  });

  it('rejects malformed shapes', () => {
    expect(isLuckyBreakSnapshot(undefined)).toBe(false);
    expect(isLuckyBreakSnapshot(null)).toBe(false);
    expect(isLuckyBreakSnapshot([])).toBe(false);
    expect(isLuckyBreakSnapshot({ balance: 1_000 })).toBe(false);
    expect(isLuckyBreakSnapshot({ ...initial, stats: { overall: initial.stats.overall } })).toBe(false);
    expect(isLuckyBreakSnapshot({ ...initial, history: 'none' })).toBe(false);
  });

  it('rejects invalid history entries', () => {
    const bad = (patch: Record<string, unknown>) => isLuckyBreakSnapshot({ ...initial, history: [{ ...entry, ...patch }] });
    expect(bad({ game: 'poker' })).toBe(false);
    expect(bad({ outcome: 'draw' })).toBe(false);
    expect(bad({ bet: -10 })).toBe(false);
    expect(bad({ payout: 1.5 })).toBe(false);
    expect(bad({ id: '' })).toBe(false);
    expect(bad({ detail: 'x'.repeat(500) })).toBe(false);
  });

  it('rejects more history than the cap allows', () => {
    const history = Array.from({ length: MAX_HISTORY_ENTRIES + 1 }, (_, i) => ({ ...entry, id: `r-${i}` }));
    expect(isLuckyBreakSnapshot({ ...initial, history })).toBe(false);
  });
});
