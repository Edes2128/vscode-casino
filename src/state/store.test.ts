import { describe, expect, it } from 'vitest';
import { MIN_BET } from './chips';
import { createFreshState, loadState, saveState, STATE_KEY, BACKUP_KEY, type PersistedState } from './persistence';
import { MAX_DETAIL_LENGTH, MAX_HISTORY_ENTRIES, STARTING_BALANCE } from './snapshot';
import { BreakRoomStore, type RoundTicket } from './store';
import { MemoryStorage } from './testing';
import type { BreakRoomSnapshot } from './types';

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A store with a fake clock and predictable ids: r1, r2, ... */
function setup(storage = new MemoryStorage()) {
  let clock = 1_760_000_000_000;
  let counter = 0;
  const errors: string[] = [];
  const store = new BreakRoomStore(storage, {
    now: () => (clock += 1_000),
    newId: () => `r${(counter += 1)}`,
    onError: (message) => errors.push(message),
  });
  return { storage, store, errors };
}

/** A new session on the same storage, as after restarting VS Code. */
const restart = (storage: MemoryStorage) => setup(storage);

function begin(store: BreakRoomStore, game: 'blackjack' | 'roulette', bet: number): RoundTicket {
  const result = store.beginRound(game, bet);
  if (!result.ok) throw new Error(`beginRound failed: ${result.error}`);
  return result.value;
}

describe('a new game', () => {
  it('starts at 1,000 chips with nothing played and writes nothing yet', async () => {
    const { store, storage } = setup();
    await store.flush();
    expect(store.snapshot.balance).toBe(STARTING_BALANCE);
    expect(store.snapshot.history).toEqual([]);
    expect(store.snapshot.stats.overall.gamesPlayed).toBe(0);
    expect(store.startup).toEqual({ source: 'fresh', forfeitedRounds: 0 });
    expect(storage.writes).toEqual([]);
  });
});

describe('beginRound (bet deduction)', () => {
  it('takes the bet from the balance and saves it', async () => {
    const { store, storage } = setup();
    const ticket = begin(store, 'roulette', 100);

    expect(ticket).toEqual({ id: 'r1', game: 'roulette', staked: 100 });
    expect(store.snapshot.balance).toBe(900);

    await store.flush();
    const saved = storage.get(STATE_KEY) as PersistedState;
    expect(saved.balance).toBe(900);
    expect(saved.openRounds).toEqual([{ id: 'r1', game: 'roulette', staked: 100, startedAt: expect.any(Number) }]);
  });

  it('rejects bets below the minimum, invalid amounts and overdrafts without changing anything', async () => {
    const { store, storage } = setup();
    const changes: BreakRoomSnapshot[] = [];
    store.onDidChange((snapshot) => changes.push(snapshot));

    expect(store.beginRound('blackjack', MIN_BET - 1)).toEqual({ ok: false, error: 'below-minimum' });
    expect(store.beginRound('blackjack', 0)).toEqual({ ok: false, error: 'invalid-amount' });
    expect(store.beginRound('blackjack', -10)).toEqual({ ok: false, error: 'invalid-amount' });
    expect(store.beginRound('blackjack', 10.5)).toEqual({ ok: false, error: 'invalid-amount' });
    expect(store.beginRound('blackjack', Number.NaN)).toEqual({ ok: false, error: 'invalid-amount' });
    expect(store.beginRound('blackjack', STARTING_BALANCE + 1)).toEqual({ ok: false, error: 'insufficient-funds' });

    await store.flush();
    expect(store.snapshot.balance).toBe(STARTING_BALANCE);
    expect(store.openRounds).toEqual([]);
    expect(changes).toEqual([]);
    expect(storage.writes).toEqual([]);
  });

  it('allows betting the whole balance, and nothing after that', () => {
    const { store } = setup();
    begin(store, 'blackjack', STARTING_BALANCE);
    expect(store.snapshot.balance).toBe(0);
    expect(store.beginRound('roulette', MIN_BET)).toEqual({ ok: false, error: 'insufficient-funds' });
    expect(store.snapshot.balance).toBe(0);
  });

  it('allows one open round per game, but one of each game together', () => {
    const { store } = setup();
    begin(store, 'blackjack', 100);
    expect(store.beginRound('blackjack', 100)).toEqual({ ok: false, error: 'round-in-progress' });
    expect(store.beginRound('roulette', 100).ok).toBe(true);
    expect(store.snapshot.balance).toBe(800);
  });
});

describe('addStake (double down and split)', () => {
  it('takes an extra stake and raises the round total', () => {
    const { store } = setup();
    const ticket = begin(store, 'blackjack', 100);
    const result = store.addStake(ticket.id, 100);
    expect(result).toEqual({ ok: true, value: { id: 'r1', game: 'blackjack', staked: 200 } });
    expect(store.snapshot.balance).toBe(800);
    expect(store.openRounds[0]?.staked).toBe(200);
  });

  it('rejects an unknown round, invalid amounts and an overdraft, changing nothing', () => {
    const { store } = setup();
    const ticket = begin(store, 'blackjack', 900);
    expect(store.addStake('nope', 10)).toEqual({ ok: false, error: 'unknown-round' });
    expect(store.addStake(ticket.id, 0)).toEqual({ ok: false, error: 'invalid-amount' });
    expect(store.addStake(ticket.id, 1.5)).toEqual({ ok: false, error: 'invalid-amount' });
    expect(store.addStake(ticket.id, 101)).toEqual({ ok: false, error: 'insufficient-funds' });
    expect(store.snapshot.balance).toBe(100);
    expect(store.openRounds[0]?.staked).toBe(900);
  });
});

describe('settleRound (payouts, statistics, history)', () => {
  it('pays an even-money win: stake back plus winnings', () => {
    const { store } = setup();
    const { id } = begin(store, 'roulette', 100);
    const result = store.settleRound(id, 200, 'Red 17');

    expect(store.snapshot.balance).toBe(1_100);
    expect(result).toEqual({
      ok: true,
      value: { id: 'r1', game: 'roulette', bet: 100, outcome: 'win', payout: 100, detail: 'Red 17', timestamp: expect.any(Number) },
    });
    expect(store.openRounds).toEqual([]);
  });

  it('keeps the deducted bet on a loss', () => {
    const { store } = setup();
    const { id } = begin(store, 'roulette', 100);
    const result = store.settleRound(id, 0, 'Black 8');

    expect(store.snapshot.balance).toBe(900);
    expect(result.ok && result.value).toMatchObject({ outcome: 'loss', payout: -100, bet: 100 });
  });

  it('returns the stake on a push', () => {
    const { store } = setup();
    const { id } = begin(store, 'blackjack', 100);
    const result = store.settleRound(id, 100, 'Push on 19');

    expect(store.snapshot.balance).toBe(1_000);
    expect(result.ok && result.value).toMatchObject({ outcome: 'push', payout: 0 });
  });

  it('pays blackjack at 3:2', () => {
    const { store } = setup();
    const { id } = begin(store, 'blackjack', 100);
    store.settleRound(id, 250, 'Blackjack');
    expect(store.snapshot.balance).toBe(1_150);
    expect(store.snapshot.history[0]).toMatchObject({ outcome: 'win', payout: 150 });
  });

  it('pays green at 35:1', () => {
    const { store } = setup();
    const { id } = begin(store, 'roulette', 10);
    store.settleRound(id, 10 * 36, 'Green 0');
    expect(store.snapshot.balance).toBe(1_000 + 350);
    expect(store.snapshot.history[0]).toMatchObject({ outcome: 'win', payout: 350 });
  });

  it('records the whole staked amount after a double down', () => {
    const { store } = setup();
    const { id } = begin(store, 'blackjack', 100);
    store.addStake(id, 100);
    store.settleRound(id, 400, 'Doubled and won'); // 200 staked, 400 back

    expect(store.snapshot.balance).toBe(1_200);
    expect(store.snapshot.history[0]).toMatchObject({ bet: 200, payout: 200, outcome: 'win' });
    expect(store.snapshot.stats.blackjack.totalWagered).toBe(200);
  });

  it('judges a split by its net chips: one hand won, one lost is a push', () => {
    const { store } = setup();
    const { id } = begin(store, 'blackjack', 100);
    store.addStake(id, 100);
    store.settleRound(id, 200, 'Split: one hand each'); // 200 staked, 200 back

    expect(store.snapshot.balance).toBe(1_000);
    expect(store.snapshot.history[0]).toMatchObject({ bet: 200, payout: 0, outcome: 'push' });
    expect(store.snapshot.stats.blackjack.pushes).toBe(1);
  });

  it('rejects an invalid payout and leaves the round open to be settled properly', () => {
    const { store } = setup();
    const { id } = begin(store, 'roulette', 100);

    for (const bad of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(store.settleRound(id, bad, 'x'), `payout ${bad}`).toEqual({ ok: false, error: 'invalid-amount' });
    }
    expect(store.snapshot.balance).toBe(900);
    expect(store.openRounds).toHaveLength(1);
    expect(store.snapshot.history).toEqual([]);

    expect(store.settleRound(id, 200, 'Red 1').ok).toBe(true);
    expect(store.snapshot.balance).toBe(1_100);
  });

  it('rejects settling an unknown round and settling the same round twice', () => {
    const { store } = setup();
    expect(store.settleRound('ghost', 100, 'x')).toEqual({ ok: false, error: 'unknown-round' });

    const { id } = begin(store, 'roulette', 100);
    store.settleRound(id, 200, 'Red 1');
    expect(store.settleRound(id, 200, 'Red 1')).toEqual({ ok: false, error: 'unknown-round' });
    expect(store.snapshot.balance).toBe(1_100); // paid once, not twice
    expect(store.snapshot.history).toHaveLength(1);
  });

  it('trims and shortens the description', () => {
    const { store } = setup();
    const first = begin(store, 'roulette', 10);
    store.settleRound(first.id, 0, '   padded   ');
    const second = begin(store, 'roulette', 10);
    store.settleRound(second.id, 0, 'x'.repeat(1_000));

    expect(store.snapshot.history[1]?.detail).toBe('padded');
    expect(store.snapshot.history[0]?.detail).toHaveLength(MAX_DETAIL_LENGTH);
  });
});

describe('statistics and history', () => {
  it('keeps each game apart and derives the overall numbers from them', () => {
    const { store } = setup();
    const rounds: Array<['blackjack' | 'roulette', number, number]> = [
      ['blackjack', 100, 250], // +150
      ['roulette', 50, 0], // -50
      ['blackjack', 100, 0], // -100
      ['roulette', 10, 360], // +350
      ['blackjack', 20, 20], // push
    ];
    for (const [game, bet, payout] of rounds) {
      store.settleRound(begin(store, game, bet).id, payout, 'x');
    }

    const { blackjack, roulette, overall } = store.snapshot.stats;
    expect(blackjack).toMatchObject({ gamesPlayed: 3, wins: 1, losses: 1, pushes: 1, biggestWin: 150, biggestLoss: 100, totalWagered: 220 });
    expect(roulette).toMatchObject({ gamesPlayed: 2, wins: 1, losses: 1, pushes: 0, biggestWin: 350, biggestLoss: 50, totalWagered: 60 });
    expect(overall).toMatchObject({ gamesPlayed: 5, wins: 2, losses: 2, pushes: 1, biggestWin: 350, biggestLoss: 100, totalWagered: 280 });
  });

  it('lists the newest round first and keeps at most 100', () => {
    const { store } = setup();
    for (let i = 0; i < MAX_HISTORY_ENTRIES + 5; i += 1) {
      store.settleRound(begin(store, 'roulette', MIN_BET).id, MIN_BET, `round ${i}`);
    }
    const { history } = store.snapshot;
    expect(history).toHaveLength(MAX_HISTORY_ENTRIES);
    expect(history[0]?.detail).toBe(`round ${MAX_HISTORY_ENTRIES + 4}`);
    // The statistics are cumulative: they keep counting after old history is dropped.
    expect(store.snapshot.stats.overall.gamesPlayed).toBe(MAX_HISTORY_ENTRIES + 5);
  });

  it('stamps each entry with the time it was settled', () => {
    const { store } = setup();
    const a = store.settleRound(begin(store, 'roulette', 10).id, 0, 'a');
    const b = store.settleRound(begin(store, 'roulette', 10).id, 0, 'b');
    expect(a.ok && b.ok && b.value.timestamp > a.value.timestamp).toBe(true);
  });
});

describe('change events', () => {
  it('fires after every change with the new snapshot, and not for rejected calls', () => {
    const { store } = setup();
    const seen: number[] = [];
    store.onDidChange((snapshot) => seen.push(snapshot.balance));

    const { id } = begin(store, 'roulette', 100); // 900
    store.addStake(id, 100); // 800
    store.beginRound('roulette', 50); // rejected: round in progress
    store.settleRound(id, 400, 'x'); // 1,200
    store.resetBalance(); // 1,000

    expect(seen).toEqual([900, 800, 1_200, 1_000]);
  });

  it('stops calling a listener once it has unsubscribed', () => {
    const { store } = setup();
    let calls = 0;
    const stop = store.onDidChange(() => (calls += 1));
    begin(store, 'roulette', 10);
    stop();
    begin(store, 'blackjack', 10);
    expect(calls).toBe(1);
  });

  it('reports a throwing listener and still calls the others', () => {
    const { store, errors } = setup();
    let healthyCalls = 0;
    store.onDidChange(() => {
      throw new Error('boom');
    });
    store.onDidChange(() => (healthyCalls += 1));

    expect(store.beginRound('roulette', 10).ok).toBe(true);
    expect(healthyCalls).toBe(1);
    expect(errors).toEqual(['A game change listener failed']);
  });

  it('hands out the same snapshot object until something changes', () => {
    const { store } = setup();
    const first = store.snapshot;
    expect(store.snapshot).toBe(first);
    begin(store, 'roulette', 10);
    expect(store.snapshot).not.toBe(first);
  });
});

describe('persistence across restarts', () => {
  it('restores balance, statistics and history exactly', async () => {
    const first = setup();
    first.store.settleRound(begin(first.store, 'blackjack', 100).id, 250, 'Blackjack');
    first.store.settleRound(begin(first.store, 'roulette', 50).id, 0, 'Black 8');
    await first.store.flush();
    const before = first.store.snapshot;

    const second = restart(first.storage);
    expect(second.store.startup).toEqual({ source: 'saved', forfeitedRounds: 0 });
    expect(second.store.snapshot).toEqual(before);
    expect(second.store.snapshot.balance).toBe(1_100);
  });

  it('settles a round left open by the previous session as a recorded loss', async () => {
    const first = setup();
    begin(first.store, 'roulette', 40); // balance 960, never settled: VS Code was closed
    await first.store.flush();

    const second = restart(first.storage);
    expect(second.store.startup).toEqual({ source: 'saved', forfeitedRounds: 1 });
    expect(second.store.openRounds).toEqual([]);
    expect(second.store.snapshot.balance).toBe(960); // the stake stays gone
    expect(second.store.snapshot.history[0]).toMatchObject({
      game: 'roulette',
      bet: 40,
      outcome: 'loss',
      payout: -40,
      detail: 'Round abandoned',
    });
    expect(second.store.snapshot.stats.roulette).toMatchObject({ gamesPlayed: 1, losses: 1, biggestLoss: 40, totalWagered: 40 });
  });

  it('saves the forfeit, so the next restart does not settle it a second time', async () => {
    const first = setup();
    begin(first.store, 'blackjack', 100);
    await first.store.flush();

    const second = restart(first.storage);
    await second.store.flush();
    const third = restart(first.storage);

    expect(third.store.startup.forfeitedRounds).toBe(0);
    expect(third.store.snapshot.stats.blackjack.gamesPlayed).toBe(1);
    expect(third.store.snapshot.history).toHaveLength(1);
  });

  it('starts fresh from corrupt data, keeping a backup and rewriting valid state', async () => {
    const storage = new MemoryStorage();
    const damaged = { version: 1, balance: 'lots' };
    storage.seed(STATE_KEY, damaged);

    const { store } = setup(storage);
    await store.flush();

    expect(store.startup.source).toBe('corrupt');
    expect(store.snapshot.balance).toBe(STARTING_BALANCE);
    expect(storage.get(BACKUP_KEY)).toEqual(damaged);
    expect(loadState(storage).source).toBe('saved');
  });

  it('keeps a balance that was saved by an earlier session', async () => {
    const storage = new MemoryStorage();
    const state: PersistedState = { ...createFreshState(), balance: 4_321 };
    await Promise.resolve(saveState(storage, state));
    expect(setup(storage).store.snapshot.balance).toBe(4_321);
  });
});

describe('resets', () => {
  function playedStore() {
    const ctx = setup();
    ctx.store.settleRound(begin(ctx.store, 'roulette', 100).id, 350, 'Red 3'); // +250
    return ctx;
  }

  it('resetBalance goes back to 1,000 and keeps statistics and history', () => {
    const { store } = playedStore();
    expect(store.snapshot.balance).toBe(1_250);

    expect(store.resetBalance()).toEqual({ ok: true, value: undefined });
    expect(store.snapshot.balance).toBe(1_000);
    expect(store.snapshot.stats.overall.gamesPlayed).toBe(1);
    expect(store.snapshot.history).toHaveLength(1);
  });

  it('resetStatistics clears statistics and history and keeps the balance', () => {
    const { store } = playedStore();
    expect(store.resetStatistics().ok).toBe(true);
    expect(store.snapshot.balance).toBe(1_250);
    expect(store.snapshot.stats.overall.gamesPlayed).toBe(0);
    expect(store.snapshot.history).toEqual([]);
  });

  it('resetAll makes a brand-new game', () => {
    const { store } = playedStore();
    expect(store.resetAll().ok).toBe(true);
    expect(store.snapshot).toEqual({ ...restart(new MemoryStorage()).store.snapshot });
  });

  it('every reset is refused while a round is open, and changes nothing', () => {
    const { store } = playedStore();
    begin(store, 'blackjack', 100);
    const before = store.snapshot;

    expect(store.resetBalance()).toEqual({ ok: false, error: 'round-in-progress' });
    expect(store.resetStatistics()).toEqual({ ok: false, error: 'round-in-progress' });
    expect(store.resetAll()).toEqual({ ok: false, error: 'round-in-progress' });
    expect(store.snapshot).toBe(before);
  });

  it('persists a reset', async () => {
    const { store, storage } = playedStore();
    store.resetAll();
    await store.flush();
    expect(restart(storage).store.snapshot).toEqual(store.snapshot);
  });
});

describe('writing to storage', () => {
  it('folds a burst of changes made together into a single save of the final state', async () => {
    const { store, storage } = setup();

    const { id } = begin(store, 'roulette', 100);
    store.addStake(id, 50);
    store.settleRound(id, 300, 'x');
    begin(store, 'blackjack', 10);
    await store.flush();

    expect(storage.writes).toHaveLength(1);
    expect((storage.get(STATE_KEY) as PersistedState).balance).toBe(store.snapshot.balance);
    expect(store.snapshot.balance).toBe(1_000 - 150 + 300 - 10);
  });

  it('folds changes made during a slow save into exactly one more save with the latest state', async () => {
    const { store, storage } = setup();
    storage.hold();

    begin(store, 'roulette', 100);
    await new Promise((resolve) => setTimeout(resolve, 0)); // the first save is now in flight, held
    begin(store, 'blackjack', 50);
    expect(store.beginRound('roulette', 10).ok).toBe(false); // a roulette round is already open
    expect(store.resetBalance().ok).toBe(false); // refused too: rounds are open

    storage.release();
    await store.flush();

    expect(storage.writes).toHaveLength(2);
    expect((storage.writes[0]?.value as PersistedState).balance).toBe(900);
    expect((storage.get(STATE_KEY) as PersistedState).balance).toBe(850);
    expect(store.snapshot.balance).toBe(850);
  });

  it('flush waits until everything is written', async () => {
    const { store, storage } = setup();
    storage.hold();
    begin(store, 'roulette', 100);

    let flushed = false;
    const done = store.flush().then(() => (flushed = true));
    await Promise.resolve();
    expect(flushed).toBe(false);
    expect(storage.get(STATE_KEY)).toBeUndefined();

    storage.release();
    await done;
    expect((storage.get(STATE_KEY) as PersistedState).balance).toBe(900);
  });

  it('reports a failed save, keeps running, and saves the latest state next time', async () => {
    const { store, storage, errors } = setup();
    storage.failWrites = true;
    begin(store, 'roulette', 100);
    await store.flush();
    expect(errors).toEqual(['Saving Break Room Arcade state failed']);
    expect(store.snapshot.balance).toBe(900); // Break Room Arcade itself carried on

    storage.failWrites = false;
    store.settleRound(store.openRounds[0]?.id ?? '', 200, 'x');
    await store.flush();
    expect((storage.get(STATE_KEY) as PersistedState).balance).toBe(1_100);
  });

  it('survives a storage that throws instead of rejecting: flush still finishes and saving recovers', async () => {
    const { store, storage, errors } = setup();
    storage.throwWrites = true;
    begin(store, 'roulette', 100);

    await store.flush(); // must not hang
    expect(errors).toEqual(['Saving Break Room Arcade state failed']);
    expect(store.snapshot.balance).toBe(900);

    storage.throwWrites = false;
    store.settleRound(store.openRounds[0]?.id ?? '', 200, 'x');
    await store.flush();
    expect((storage.get(STATE_KEY) as PersistedState).balance).toBe(1_100);
  });
});

describe('invariants under random play', () => {
  it('keeps the balance whole and non-negative and counts every round, whatever hostile input arrives', () => {
    const random = mulberry32(31_415_926);
    const { store } = setup();
    let settled = 0;
    let rejected = 0;

    // Stays under the history cap. Bounded by attempts, so a regression fails instead of hanging.
    const target = MAX_HISTORY_ENTRIES - 10;
    for (let attempt = 0; attempt < 5_000 && settled < target; attempt += 1) {
      const game = random() < 0.5 ? 'blackjack' : 'roulette';
      // Mostly sensible bets, with some hostile ones: fractions, zero, negatives, more than the balance.
      const roll = random();
      const bet =
        roll < 0.1 ? 5.5 : roll < 0.15 ? -20 : roll < 0.2 ? 0 : roll < 0.3 ? store.snapshot.balance + 1 : MIN_BET + Math.floor(random() * 300);

      const begun = store.beginRound(game, bet);
      if (!begun.ok) {
        rejected += 1;
      } else {
        if (random() < 0.3) store.addStake(begun.value.id, MIN_BET + Math.floor(random() * 200));
        const staked = store.openRounds.find((round) => round.id === begun.value.id)?.staked ?? 0;
        const payout = random() < 0.5 ? 0 : Math.floor(random() * staked * 4);
        // An occasional invalid payout must not break anything.
        if (random() < 0.1) store.settleRound(begun.value.id, -1, 'bad');
        expect(store.settleRound(begun.value.id, payout, 'round').ok).toBe(true);
        settled += 1;
      }
      // Occasionally the player is broke: top up so play continues.
      if (store.snapshot.balance < MIN_BET) store.resetBalance();

      const snapshot = store.snapshot;
      expect(Number.isSafeInteger(snapshot.balance)).toBe(true);
      expect(snapshot.balance).toBeGreaterThanOrEqual(0);
    }

    expect(settled).toBe(target);
    expect(rejected).toBeGreaterThan(10);
    expect(store.snapshot.stats.overall.gamesPlayed).toBe(settled);
    expect(store.openRounds).toEqual([]);
  });

  it('ties the balance to the history: starting chips plus every recorded net result', () => {
    const random = mulberry32(2_718_281);
    const { store } = setup();

    for (let i = 0; i < 80; i += 1) {
      const begun = store.beginRound(i % 2 === 0 ? 'blackjack' : 'roulette', MIN_BET + Math.floor(random() * 40));
      if (!begun.ok) break;
      const staked = begun.value.staked;
      store.settleRound(begun.value.id, Math.floor(random() * staked * 3), 'round');
    }

    const { balance, history, stats } = store.snapshot;
    const net = history.reduce((sum, entry) => sum + entry.payout, 0);
    expect(history.length).toBeGreaterThan(10);
    expect(balance).toBe(STARTING_BALANCE + net);
    // Every history entry agrees with its own money.
    for (const entry of history) {
      expect(entry.outcome).toBe(entry.payout > 0 ? 'win' : entry.payout < 0 ? 'loss' : 'push');
    }
    expect(stats.overall.wins + stats.overall.losses + stats.overall.pushes).toBe(stats.overall.gamesPlayed);
  });
});
