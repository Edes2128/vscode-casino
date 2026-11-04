import { describe, expect, it } from 'vitest';
import { EMPTY_GAME_STATS } from './snapshot';
import { combineStats, outcomeOf, proportionBlocks, recordRound, winPercentage } from './statistics';
import type { GameStats } from './types';

describe('outcomeOf', () => {
  it('is decided by net chips alone', () => {
    expect(outcomeOf(1)).toBe('win');
    expect(outcomeOf(350)).toBe('win');
    expect(outcomeOf(-1)).toBe('loss');
    expect(outcomeOf(-500)).toBe('loss');
    expect(outcomeOf(0)).toBe('push');
  });
});

describe('recordRound', () => {
  it('counts a win', () => {
    expect(recordRound(EMPTY_GAME_STATS, 100, 150)).toEqual({
      gamesPlayed: 1,
      wins: 1,
      losses: 0,
      pushes: 0,
      biggestWin: 150,
      biggestLoss: 0,
      totalWagered: 100,
    });
  });

  it('counts a loss as a positive biggestLoss', () => {
    expect(recordRound(EMPTY_GAME_STATS, 50, -50)).toEqual({
      gamesPlayed: 1,
      wins: 0,
      losses: 1,
      pushes: 0,
      biggestWin: 0,
      biggestLoss: 50,
      totalWagered: 50,
    });
  });

  it('counts a push without touching the biggest win or loss', () => {
    const stats = recordRound(EMPTY_GAME_STATS, 200, 0);
    expect(stats.pushes).toBe(1);
    expect(stats.gamesPlayed).toBe(1);
    expect(stats.biggestWin).toBe(0);
    expect(stats.biggestLoss).toBe(0);
    expect(stats.totalWagered).toBe(200);
  });

  it('keeps the biggest win and loss across many rounds', () => {
    let stats = EMPTY_GAME_STATS;
    for (const [stake, net] of [
      [100, 100],
      [50, -50],
      [10, 350],
      [500, -500],
      [25, 25],
      [25, -25],
    ] as const) {
      stats = recordRound(stats, stake, net);
    }
    expect(stats.biggestWin).toBe(350);
    expect(stats.biggestLoss).toBe(500);
    expect(stats.gamesPlayed).toBe(6);
    expect(stats.wins + stats.losses + stats.pushes).toBe(6);
    expect(stats.totalWagered).toBe(710);
  });

  it('counts the whole stake, including doubles and splits', () => {
    // 100 bet, doubled to 200, then lost.
    expect(recordRound(EMPTY_GAME_STATS, 200, -200).totalWagered).toBe(200);
  });

  it('does not modify the stats it is given', () => {
    const before: GameStats = { ...EMPTY_GAME_STATS, gamesPlayed: 2, wins: 2 };
    const copy = { ...before };
    recordRound(before, 10, 10);
    expect(before).toEqual(copy);
  });
});

describe('combineStats', () => {
  it('adds the counts and keeps the larger extremes', () => {
    const blackjack: GameStats = {
      gamesPlayed: 3,
      wins: 2,
      losses: 1,
      pushes: 0,
      biggestWin: 150,
      biggestLoss: 100,
      totalWagered: 400,
    };
    const roulette: GameStats = {
      gamesPlayed: 2,
      wins: 0,
      losses: 1,
      pushes: 1,
      biggestWin: 0,
      biggestLoss: 500,
      totalWagered: 600,
    };
    expect(combineStats(blackjack, roulette)).toEqual({
      gamesPlayed: 5,
      wins: 2,
      losses: 2,
      pushes: 1,
      biggestWin: 150,
      biggestLoss: 500,
      totalWagered: 1_000,
    });
  });

  it('is the empty stats for no input', () => {
    expect(combineStats()).toEqual(EMPTY_GAME_STATS);
  });
});

describe('winPercentage', () => {
  it('is 0 before any game', () => {
    expect(winPercentage(EMPTY_GAME_STATS)).toBe(0);
  });

  it('is wins over all games, and pushes count as games', () => {
    expect(winPercentage({ ...EMPTY_GAME_STATS, gamesPlayed: 4, wins: 1, losses: 2, pushes: 1 })).toBe(25);
    expect(winPercentage({ ...EMPTY_GAME_STATS, gamesPlayed: 3, wins: 3 })).toBe(100);
    expect(winPercentage({ ...EMPTY_GAME_STATS, gamesPlayed: 3, losses: 3 })).toBe(0);
  });
});

describe('proportionBlocks', () => {
  const stats = (wins: number, losses: number, pushes: number): GameStats => ({
    ...EMPTY_GAME_STATS,
    gamesPlayed: wins + losses + pushes,
    wins,
    losses,
    pushes,
  });
  const sum = (counts: { win: number; loss: number; push: number }) => counts.win + counts.loss + counts.push;

  it('is empty before any game', () => {
    expect(proportionBlocks(stats(0, 0, 0), 20)).toEqual({ win: 0, loss: 0, push: 0 });
  });

  it('splits evenly when the results divide evenly', () => {
    expect(proportionBlocks(stats(5, 5, 0), 20)).toEqual({ win: 10, loss: 10, push: 0 });
    expect(proportionBlocks(stats(1, 1, 2), 20)).toEqual({ win: 5, loss: 5, push: 10 });
  });

  it('fills the whole bar with a single result', () => {
    expect(proportionBlocks(stats(7, 0, 0), 20)).toEqual({ win: 20, loss: 0, push: 0 });
    expect(proportionBlocks(stats(0, 3, 0), 20)).toEqual({ win: 0, loss: 20, push: 0 });
  });

  it('always adds up to exactly the number of blocks, however the results divide', () => {
    for (let wins = 0; wins <= 9; wins += 1) {
      for (let losses = 0; losses <= 9; losses += 1) {
        for (let pushes = 0; pushes <= 9; pushes += 1) {
          if (wins + losses + pushes === 0) continue;
          const counts = proportionBlocks(stats(wins, losses, pushes), 20);
          expect(sum(counts), `${wins}/${losses}/${pushes}`).toBe(20);
          // A result that happened always gets at least a fair share, and one that did not gets none.
          if (wins === 0) expect(counts.win).toBe(0);
          if (losses === 0) expect(counts.loss).toBe(0);
          if (pushes === 0) expect(counts.push).toBe(0);
        }
      }
    }
  });

  it('rounds a one-in-three split without losing or inventing a block', () => {
    const counts = proportionBlocks(stats(1, 1, 1), 20);
    expect(sum(counts)).toBe(20);
    expect(Math.max(counts.win, counts.loss, counts.push)).toBe(7);
  });
});
