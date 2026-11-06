import { describe, expect, it } from 'vitest';
import { addEntry } from './history';
import type { HistoryEntry } from './types';

const entry = (id: string): HistoryEntry => ({
  id,
  game: 'roulette',
  bet: 10,
  outcome: 'win',
  payout: 10,
  detail: 'Red 1',
  timestamp: 1_760_000_000_000,
});

describe('addEntry', () => {
  it('puts the newest entry first', () => {
    const history = addEntry(addEntry([], entry('a')), entry('b'));
    expect(history.map((item) => item.id)).toEqual(['b', 'a']);
  });

  it('drops the oldest entries beyond the limit', () => {
    let history: HistoryEntry[] = [];
    for (const id of ['a', 'b', 'c', 'd']) history = addEntry(history, entry(id), 3);
    expect(history.map((item) => item.id)).toEqual(['d', 'c', 'b']);
  });

  it('keeps 100 entries by default', () => {
    let history: HistoryEntry[] = [];
    for (let i = 0; i < 150; i += 1) history = addEntry(history, entry(`r${i}`));
    expect(history).toHaveLength(100);
    expect(history[0]?.id).toBe('r149');
    expect(history[99]?.id).toBe('r50');
  });

  it('does not modify the history it is given', () => {
    const original = [entry('a')];
    addEntry(original, entry('b'));
    expect(original.map((item) => item.id)).toEqual(['a']);
  });
});
