import { describe, expect, it } from 'vitest';
import {
  BACKUP_KEY,
  createFreshState,
  isPersistedState,
  loadState,
  saveState,
  STATE_KEY,
  STATE_VERSION,
  type PersistedState,
} from './persistence';
import { MAX_HISTORY_ENTRIES } from './snapshot';
import { MemoryStorage } from './testing';
import type { HistoryEntry, OpenRound } from './types';

const entry: HistoryEntry = {
  id: 'r1',
  game: 'blackjack',
  bet: 100,
  outcome: 'win',
  payout: 150,
  detail: 'Blackjack',
  timestamp: 1_760_000_000_000,
};

const open: OpenRound = { id: 'r2', game: 'roulette', staked: 40, startedAt: 1_760_000_100_000 };

const sample: PersistedState = {
  ...createFreshState(),
  balance: 1_150,
  stats: {
    blackjack: { gamesPlayed: 1, wins: 1, losses: 0, pushes: 0, biggestWin: 150, biggestLoss: 0, totalWagered: 100 },
    roulette: createFreshState().stats.roulette,
  },
  history: [entry],
  openRounds: [open],
};

const settle = async (promise: PromiseLike<void> | Promise<void>): Promise<void> => {
  await promise;
};

describe('loadState', () => {
  it('starts a fresh game when nothing is saved', () => {
    const { state, source } = loadState(new MemoryStorage());
    expect(source).toBe('fresh');
    expect(state).toEqual(createFreshState());
    expect(state.balance).toBe(1_000);
  });

  it('loads what was saved, exactly', async () => {
    const storage = new MemoryStorage();
    await settle(saveState(storage, sample));
    const loaded = loadState(storage);
    expect(loaded.source).toBe('saved');
    expect(loaded.state).toEqual(sample);
  });

  it('survives a JSON round trip, like the real globalState', async () => {
    const storage = new MemoryStorage();
    await settle(saveState(storage, sample));
    expect(JSON.parse(JSON.stringify(storage.get(STATE_KEY)))).toEqual(sample);
  });

  it('keeps unreadable data in a backup and starts fresh instead of crashing', async () => {
    const storage = new MemoryStorage();
    const damaged = { version: STATE_VERSION, balance: -5, stats: 'nope' };
    storage.seed(STATE_KEY, damaged);

    const { state, source } = loadState(storage);
    expect(source).toBe('corrupt');
    expect(state).toEqual(createFreshState());

    await Promise.resolve(); // let the best-effort backup write finish
    expect(storage.get(BACKUP_KEY)).toEqual(damaged);
  });

  it('treats data from a different version as unreadable, never as current', () => {
    const storage = new MemoryStorage();
    storage.seed(STATE_KEY, { ...sample, version: STATE_VERSION + 1 });
    expect(loadState(storage).source).toBe('corrupt');
  });

  it('still starts when the backup cannot be written', () => {
    const storage = new MemoryStorage();
    storage.seed(STATE_KEY, 'garbage');
    storage.failWrites = true;
    expect(loadState(storage).source).toBe('corrupt');
  });
});

describe('isPersistedState', () => {
  it('accepts valid states', () => {
    expect(isPersistedState(createFreshState())).toBe(true);
    expect(isPersistedState(sample)).toBe(true);
  });

  it('rejects anything malformed', () => {
    const bad = (patch: Record<string, unknown>) => isPersistedState({ ...sample, ...patch });
    expect(isPersistedState(undefined)).toBe(false);
    expect(isPersistedState(null)).toBe(false);
    expect(isPersistedState([])).toBe(false);
    expect(isPersistedState('state')).toBe(false);
    expect(bad({ version: 0 })).toBe(false);
    expect(bad({ balance: -1 })).toBe(false);
    expect(bad({ balance: 1.5 })).toBe(false);
    expect(bad({ balance: '1000' })).toBe(false);
    expect(bad({ stats: { blackjack: sample.stats.blackjack } })).toBe(false);
    expect(bad({ history: [{ ...entry, bet: -1 }] })).toBe(false);
    expect(bad({ history: 'none' })).toBe(false);
    expect(bad({ openRounds: [{ ...open, staked: 0 }] })).toBe(false);
    expect(bad({ openRounds: [{ ...open, game: 'poker' }] })).toBe(false);
    expect(bad({ openRounds: [{ ...open, id: '' }] })).toBe(false);
    expect(bad({ openRounds: 'none' })).toBe(false);
  });

  it('rejects two open rounds with the same id', () => {
    expect(isPersistedState({ ...sample, openRounds: [open, { ...open }] })).toBe(false);
  });

  it('rejects more history than the cap allows', () => {
    const history = Array.from({ length: MAX_HISTORY_ENTRIES + 1 }, (_, i) => ({ ...entry, id: `h${i}` }));
    expect(isPersistedState({ ...sample, history })).toBe(false);
  });
});
