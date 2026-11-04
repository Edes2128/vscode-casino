import { EMPTY_GAME_STATS } from './snapshot';
import type { GameOutcome, GameStats } from './types';

/** A round's result is decided by its net chips alone, so outcome and money can never disagree. */
export const outcomeOf = (net: number): GameOutcome => (net > 0 ? 'win' : net < 0 ? 'loss' : 'push');

/** Adds one finished round to a game's statistics. Returns a new object. */
export function recordRound(stats: GameStats, stake: number, net: number): GameStats {
  const outcome = outcomeOf(net);
  return {
    gamesPlayed: stats.gamesPlayed + 1,
    wins: stats.wins + (outcome === 'win' ? 1 : 0),
    losses: stats.losses + (outcome === 'loss' ? 1 : 0),
    pushes: stats.pushes + (outcome === 'push' ? 1 : 0),
    biggestWin: Math.max(stats.biggestWin, net > 0 ? net : 0),
    biggestLoss: Math.max(stats.biggestLoss, net < 0 ? -net : 0),
    totalWagered: stats.totalWagered + stake,
  };
}

/** The overall casino numbers are always derived from the per-game ones, never stored twice. */
export function combineStats(...parts: readonly GameStats[]): GameStats {
  return parts.reduce<GameStats>(
    (total, part) => ({
      gamesPlayed: total.gamesPlayed + part.gamesPlayed,
      wins: total.wins + part.wins,
      losses: total.losses + part.losses,
      pushes: total.pushes + part.pushes,
      biggestWin: Math.max(total.biggestWin, part.biggestWin),
      biggestLoss: Math.max(total.biggestLoss, part.biggestLoss),
      totalWagered: total.totalWagered + part.totalWagered,
    }),
    EMPTY_GAME_STATS,
  );
}

/** Wins as a percentage (0 to 100) of all games played. Pushes count as games, not wins. */
export function winPercentage(stats: GameStats): number {
  return stats.gamesPlayed === 0 ? 0 : (stats.wins / stats.gamesPlayed) * 100;
}

export interface BlockCounts {
  readonly win: number;
  readonly loss: number;
  readonly push: number;
}

/**
 * Splits `blocks` pixels between wins, losses and pushes in proportion to the results, for the
 * statistics bar. The largest-remainder method guarantees the counts add up to exactly `blocks`
 * (or to 0 when nothing has been played).
 */
export function proportionBlocks(stats: GameStats, blocks: number): BlockCounts {
  const total = stats.wins + stats.losses + stats.pushes;
  if (total === 0) return { win: 0, loss: 0, push: 0 };

  const exact = [stats.wins, stats.losses, stats.pushes].map((count) => (count / total) * blocks);
  const counts = exact.map(Math.floor);
  let remaining = blocks - counts.reduce((sum, count) => sum + count, 0);

  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const { index } of byRemainder) {
    if (remaining === 0) break;
    counts[index] = (counts[index] ?? 0) + 1;
    remaining -= 1;
  }

  return { win: counts[0] ?? 0, loss: counts[1] ?? 0, push: counts[2] ?? 0 };
}
