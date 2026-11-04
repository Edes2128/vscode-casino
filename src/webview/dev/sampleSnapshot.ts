/**
 * Sample casino data for design work. Only reachable through the Vite dev server with `?demo`
 * or `?gallery`; the production build contains none of it.
 */
import type { CasinoSnapshot, GameStats, HistoryEntry } from '../../casino/types';

const at = (hour: number, minute: number): number => new Date(2026, 10, 4, hour, minute).getTime();

export const sampleHistory: readonly HistoryEntry[] = [
  { id: 's6', game: 'roulette', bet: 100, outcome: 'win', payout: 100, detail: 'Red 23', timestamp: at(11, 42) },
  { id: 's5', game: 'blackjack', bet: 50, outcome: 'loss', payout: -50, detail: 'Bust with 24', timestamp: at(11, 38) },
  { id: 's4', game: 'blackjack', bet: 100, outcome: 'win', payout: 150, detail: 'Blackjack!', timestamp: at(11, 31) },
  { id: 's3', game: 'roulette', bet: 25, outcome: 'loss', payout: -25, detail: 'Black 8', timestamp: at(11, 27) },
  { id: 's2', game: 'blackjack', bet: 500, outcome: 'push', payout: 0, detail: 'Push on 19', timestamp: at(11, 19) },
  { id: 's1', game: 'roulette', bet: 10, outcome: 'win', payout: 350, detail: 'Green 0', timestamp: at(11, 4) },
];

const stats = (partial: Partial<GameStats>): GameStats => ({
  gamesPlayed: 0,
  wins: 0,
  losses: 0,
  pushes: 0,
  biggestWin: 0,
  biggestLoss: 0,
  totalWagered: 0,
  ...partial,
});

export const sampleSnapshot: CasinoSnapshot = {
  balance: 1_725,
  stats: {
    overall: stats({ gamesPlayed: 12, wins: 6, losses: 5, pushes: 1, biggestWin: 350, biggestLoss: 100, totalWagered: 1_835 }),
    blackjack: stats({ gamesPlayed: 7, wins: 3, losses: 3, pushes: 1, biggestWin: 150, biggestLoss: 100, totalWagered: 1_350 }),
    roulette: stats({ gamesPlayed: 5, wins: 3, losses: 2, biggestWin: 350, biggestLoss: 50, totalWagered: 485 }),
  },
  history: sampleHistory,
};
