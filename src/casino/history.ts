import { MAX_HISTORY_ENTRIES } from './snapshot';
import type { HistoryEntry } from './types';

/** Puts the newest entry first and drops the oldest ones beyond the cap. Returns a new array. */
export function addEntry(
  history: readonly HistoryEntry[],
  entry: HistoryEntry,
  limit: number = MAX_HISTORY_ENTRIES,
): HistoryEntry[] {
  return [entry, ...history].slice(0, limit);
}
