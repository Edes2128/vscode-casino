import {
  EMPTY_GAME_STATS,
  isCount,
  isGameStats,
  isGameType,
  isHistoryEntry,
  isRecord,
  MAX_HISTORY_ENTRIES,
  STARTING_BALANCE,
} from './snapshot';
import type { GameStats, HistoryEntry, OpenRound } from './types';

/** Everything lives under one key, so each save is a single atomic write. */
export const STATE_KEY = 'luckyBreak.state';

/** Where unreadable saved data is copied before it is replaced, so nothing is destroyed silently. */
export const BACKUP_KEY = 'luckyBreak.state.backup';

/** Bump when the saved shape changes, and teach `loadState` to migrate the old version. */
export const STATE_VERSION = 1;

/** The part of VS Code's `Memento` (`globalState`) Lucky Break needs. Tests use an in-memory fake. */
export interface KeyValueStorage {
  get(key: string): unknown;
  update(key: string, value: unknown): PromiseLike<void>;
}

/** What is saved. Overall statistics are derived on load, never stored twice. */
export interface PersistedState {
  readonly version: typeof STATE_VERSION;
  readonly balance: number;
  readonly stats: {
    readonly blackjack: GameStats;
    readonly roulette: GameStats;
  };
  /** Most recent first. */
  readonly history: readonly HistoryEntry[];
  readonly openRounds: readonly OpenRound[];
}

export function createFreshState(): PersistedState {
  return {
    version: STATE_VERSION,
    balance: STARTING_BALANCE,
    stats: { blackjack: EMPTY_GAME_STATS, roulette: EMPTY_GAME_STATS },
    history: [],
    openRounds: [],
  };
}

function isOpenRound(value: unknown): value is OpenRound {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    value['id'].length > 0 &&
    isGameType(value['game']) &&
    isCount(value['staked']) &&
    value['staked'] > 0 &&
    isCount(value['startedAt'])
  );
}

/** Structural check of saved data. Saved data is as untrusted as any other input. */
export function isPersistedState(value: unknown): value is PersistedState {
  if (!isRecord(value) || value['version'] !== STATE_VERSION || !isCount(value['balance'])) return false;

  const { stats, history, openRounds } = value;
  return (
    isRecord(stats) &&
    isGameStats(stats['blackjack']) &&
    isGameStats(stats['roulette']) &&
    Array.isArray(history) &&
    history.length <= MAX_HISTORY_ENTRIES &&
    history.every(isHistoryEntry) &&
    Array.isArray(openRounds) &&
    openRounds.every(isOpenRound) &&
    new Set(openRounds.map((round) => round.id)).size === openRounds.length
  );
}

export interface LoadResult {
  readonly state: PersistedState;
  /** `saved`: loaded as is. `fresh`: nothing saved yet. `corrupt`: unreadable, replaced by a fresh state. */
  readonly source: 'saved' | 'fresh' | 'corrupt';
}

/**
 * Reads the saved state. Anything missing or invalid yields a fresh game instead of a crash;
 * invalid data is first copied to `BACKUP_KEY` so a bug here can never silently eat a balance.
 */
export function loadState(storage: KeyValueStorage): LoadResult {
  const raw = storage.get(STATE_KEY);
  if (raw === undefined) return { state: createFreshState(), source: 'fresh' };
  if (isPersistedState(raw)) return { state: raw, source: 'saved' };

  // Best effort: a failed backup must not stop Lucky Break from starting.
  Promise.resolve(storage.update(BACKUP_KEY, raw)).catch(() => undefined);
  return { state: createFreshState(), source: 'corrupt' };
}

export function saveState(storage: KeyValueStorage, state: PersistedState): PromiseLike<void> {
  return storage.update(STATE_KEY, state);
}
