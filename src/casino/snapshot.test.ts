import { describe, expect, it } from 'vitest';
import { createInitialSnapshot, isCasinoSnapshot, MAX_HISTORY_ENTRIES, STARTING_BALANCE } from './snapshot';
import type { CasinoSnapshot, HistoryEntry } from './types';

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

describe('isCasinoSnapshot', () => {
  const initial = createInitialSnapshot();
  const withHistory: CasinoSnapshot = { ...initial, history: [entry] };

  it('accepts a fresh snapshot and one with history', () => {
    expect(isCasinoSnapshot(initial)).toBe(true);
    expect(isCasinoSnapshot(withHistory)).toBe(true);
  });

  it('accepts negative payouts (losses)', () => {
    const loss = { ...entry, outcome: 'loss', payout: -50 };
    expect(isCasinoSnapshot({ ...initial, history: [loss] })).toBe(true);
  });

  it('rejects a negative, fractional or non-numeric balance', () => {
    expect(isCasinoSnapshot({ ...initial, balance: -1 })).toBe(false);
    expect(isCasinoSnapshot({ ...initial, balance: 10.5 })).toBe(false);
    expect(isCasinoSnapshot({ ...initial, balance: Number.NaN })).toBe(false);
    expect(isCasinoSnapshot({ ...initial, balance: '1000' })).toBe(false);
  });

  it('rejects malformed shapes', () => {
    expect(isCasinoSnapshot(undefined)).toBe(false);
    expect(isCasinoSnapshot(null)).toBe(false);
    expect(isCasinoSnapshot([])).toBe(false);
    expect(isCasinoSnapshot({ balance: 1_000 })).toBe(false);
    expect(isCasinoSnapshot({ ...initial, stats: { overall: initial.stats.overall } })).toBe(false);
    expect(isCasinoSnapshot({ ...initial, history: 'none' })).toBe(false);
  });

  it('rejects invalid history entries', () => {
    const bad = (patch: Record<string, unknown>) => isCasinoSnapshot({ ...initial, history: [{ ...entry, ...patch }] });
    expect(bad({ game: 'poker' })).toBe(false);
    expect(bad({ outcome: 'draw' })).toBe(false);
    expect(bad({ bet: -10 })).toBe(false);
    expect(bad({ payout: 1.5 })).toBe(false);
    expect(bad({ id: '' })).toBe(false);
    expect(bad({ detail: 'x'.repeat(500) })).toBe(false);
  });

  it('rejects more history than the cap allows', () => {
    const history = Array.from({ length: MAX_HISTORY_ENTRIES + 1 }, (_, i) => ({ ...entry, id: `r-${i}` }));
    expect(isCasinoSnapshot({ ...initial, history })).toBe(false);
  });
});
