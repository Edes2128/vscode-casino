import type {
  BreakRoomSnapshot,
  BreakRoomStats,
  GameOutcome,
  GameStats,
  GameType,
  HistoryEntry,
} from './types';

export const STARTING_BALANCE = 1_000;

/** Upper bound for the history kept in a snapshot. */
export const MAX_HISTORY_ENTRIES = 100;

/** Longest description kept for a round in the history. */
export const MAX_DETAIL_LENGTH = 120;

export const EMPTY_GAME_STATS: GameStats = {
  gamesPlayed: 0,
  wins: 0,
  losses: 0,
  pushes: 0,
  biggestWin: 0,
  biggestLoss: 0,
  totalWagered: 0,
};

export const EMPTY_BREAK_ROOM_STATS: BreakRoomStats = {
  overall: EMPTY_GAME_STATS,
  blackjack: EMPTY_GAME_STATS,
  roulette: EMPTY_GAME_STATS,
};

/** A brand-new game: the starting balance, no games played. */
export function createInitialSnapshot(): BreakRoomSnapshot {
  return { balance: STARTING_BALANCE, stats: EMPTY_BREAK_ROOM_STATS, history: [] };
}

// ---------------------------------------------------------------- runtime guard

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A non-negative whole number of chips or games. */
export const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

const isWholeNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value);

export const isGameType = (value: unknown): value is GameType => value === 'blackjack' || value === 'roulette';

const isOutcome = (value: unknown): value is GameOutcome =>
  value === 'win' || value === 'loss' || value === 'push';

export function isGameStats(value: unknown): value is GameStats {
  return (
    isRecord(value) &&
    isCount(value['gamesPlayed']) &&
    isCount(value['wins']) &&
    isCount(value['losses']) &&
    isCount(value['pushes']) &&
    isCount(value['biggestWin']) &&
    isCount(value['biggestLoss']) &&
    isCount(value['totalWagered'])
  );
}

export function isHistoryEntry(value: unknown): value is HistoryEntry {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    value['id'].length > 0 &&
    isGameType(value['game']) &&
    isCount(value['bet']) &&
    isOutcome(value['outcome']) &&
    isWholeNumber(value['payout']) &&
    typeof value['detail'] === 'string' &&
    value['detail'].length <= MAX_DETAIL_LENGTH &&
    isCount(value['timestamp'])
  );
}

/** Structural check for a snapshot received over the messaging channel. */
export function isBreakRoomSnapshot(value: unknown): value is BreakRoomSnapshot {
  if (!isRecord(value) || !isCount(value['balance'])) return false;

  const { stats, history } = value;
  return (
    isRecord(stats) &&
    isGameStats(stats['overall']) &&
    isGameStats(stats['blackjack']) &&
    isGameStats(stats['roulette']) &&
    Array.isArray(history) &&
    history.length <= MAX_HISTORY_ENTRIES &&
    history.every(isHistoryEntry)
  );
}
