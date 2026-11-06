import { describe, expect, it } from 'vitest';
import { STARTING_BALANCE } from '../state/snapshot';
import { BreakRoomStore } from '../state/store';
import { MemoryStorage } from '../state/testing';
import { BlackjackTable } from './blackjack/table';
import { cards } from './blackjack/testing';
import { ResetCoordinator, type ResetScope } from './resets';
import { RouletteTable } from './roulette/table';
import { POCKET_COUNT, pocketIndexOfNumber } from './roulette/wheel';

/** A game with a few results in it, and a confirmation the test controls. */
function setup(answer: boolean | 'throw' | 'wait' = true) {
  const storage = new MemoryStorage();
  let counter = 0;
  const errors: string[] = [];
  const store = new BreakRoomStore(storage, { newId: () => `r${(counter += 1)}`, onError: (m) => errors.push(m) });
  const landing = [32, 0, 17];
  let next = 0;
  const roulette = new RouletteTable(store, {
    rng: () => {
      const number = landing[next % landing.length] ?? 0;
      next += 1;
      return (pocketIndexOfNumber(number) + 0.5) / POCKET_COUNT;
    },
  });
  // 10+9 against 10+7: the player stands and wins.
  const blackjack = new BlackjackTable(store, { deck: () => cards('KS KH 9S 7H') });

  const asked: ResetScope[] = [];
  let release: ((yes: boolean) => void) | undefined;
  const coordinator = new ResetCoordinator({
    store,
    tables: [blackjack, roulette],
    confirm: (scope) => {
      asked.push(scope);
      if (answer === 'throw') return Promise.reject(new Error('dialog failed'));
      if (answer === 'wait') return new Promise<boolean>((resolve) => (release = resolve));
      return Promise.resolve(answer);
    },
    onError: (m) => errors.push(m),
  });

  const play = () => {
    roulette.perform({ kind: 'spin', selection: { kind: 'color', color: 'red' }, bet: 100 });
    roulette.perform({ kind: 'spin', selection: { kind: 'color', color: 'black' }, bet: 50 });
    blackjack.perform({ kind: 'deal', bet: 100 });
    blackjack.perform({ kind: 'stand' });
  };

  return { store, roulette, blackjack, coordinator, asked, errors, play, answer: (yes: boolean) => release?.(yes) };
}

describe('asking before a reset', () => {
  it.each(['balance', 'statistics', 'all'] as const)('asks the player about "%s" and changes nothing on a no', async (scope) => {
    const t = setup(false);
    t.play();
    const before = t.store.snapshot;
    const recent = t.roulette.view.recent;

    expect(await t.coordinator.reset(scope)).toBe('cancelled');

    expect(t.asked).toEqual([scope]);
    expect(t.store.snapshot).toBe(before);
    expect(t.roulette.view.recent).toBe(recent);
  });

  it('treats a failed dialog as a no, and says so', async () => {
    const t = setup('throw');
    t.play();
    const before = t.store.snapshot;

    expect(await t.coordinator.reset('all')).toBe('cancelled');
    expect(t.store.snapshot).toBe(before);
    expect(t.errors).toEqual(['Asking for confirmation of a reset failed; nothing was reset']);
  });

  it('only an explicit yes counts', async () => {
    const t = setup();
    t.play();
    const sloppy = new ResetCoordinator({
      store: t.store,
      tables: [],
      confirm: () => Promise.resolve('yes' as unknown as boolean),
    });
    expect(await sloppy.reset('balance')).toBe('cancelled');
    expect(t.store.snapshot.balance).not.toBe(STARTING_BALANCE);
  });
});

describe('resetting the balance', () => {
  it('goes back to the starting balance and keeps the statistics, the history and the tables', async () => {
    const t = setup();
    t.play();
    const { stats, history } = t.store.snapshot;
    const view = t.roulette.view;

    expect(await t.coordinator.reset('balance')).toBe('done');

    expect(t.store.snapshot.balance).toBe(STARTING_BALANCE);
    expect(t.store.snapshot.stats).toEqual(stats);
    expect(t.store.snapshot.history).toEqual(history);
    expect(t.roulette.view).toBe(view);
    expect(t.blackjack.view.phase).toBe('settled');
  });
});

describe('resetting the statistics', () => {
  it('clears the statistics, the history and what the tables remember, and keeps the balance', async () => {
    const t = setup();
    t.play();
    const balance = t.store.snapshot.balance;
    const spins = t.roulette.view.spin;
    expect(t.roulette.view.recent).toHaveLength(2);

    expect(await t.coordinator.reset('statistics')).toBe('done');

    expect(t.store.snapshot.balance).toBe(balance);
    expect(t.store.snapshot.stats.overall.gamesPlayed).toBe(0);
    expect(t.store.snapshot.history).toEqual([]);
    expect(t.roulette.view.recent).toEqual([]);
    expect(t.roulette.view.last).toBeUndefined();
    expect(t.roulette.view.spin).toBe(spins);
    expect(t.blackjack.view.phase).toBe('betting');
    expect(t.blackjack.view.hands).toEqual([]);
  });
});

describe('resetting everything', () => {
  it('makes a brand-new game of the chips, the statistics, the history and the tables', async () => {
    const t = setup();
    t.play();

    expect(await t.coordinator.reset('all')).toBe('done');

    expect(t.store.snapshot.balance).toBe(STARTING_BALANCE);
    expect(t.store.snapshot.stats.overall.gamesPlayed).toBe(0);
    expect(t.store.snapshot.history).toEqual([]);
    expect(t.roulette.view.recent).toEqual([]);
    expect(t.blackjack.view.phase).toBe('betting');
  });

  it('leaves the tables playable, with the spin counter still counting up', async () => {
    const t = setup();
    t.play();
    const spins = t.roulette.view.spin;
    await t.coordinator.reset('all');

    expect(t.roulette.perform({ kind: 'spin', selection: { kind: 'color', color: 'red' }, bet: 10 })).toEqual({ ok: true });
    expect(t.roulette.view.spin).toBe(spins + 1);
    expect(t.blackjack.perform({ kind: 'deal', bet: 10 })).toEqual({ ok: true });
  });

  it('tells every listener of a table that it was cleared', async () => {
    const t = setup();
    t.play();
    const seen: number[] = [];
    t.roulette.onDidChange((view) => seen.push(view.recent.length));
    await t.coordinator.reset('all');
    expect(seen).toEqual([0]);
  });
});

describe('while a hand is being played', () => {
  it.each(['balance', 'statistics', 'all'] as const)('refuses a "%s" reset without asking', async (scope) => {
    const t = setup();
    t.blackjack.perform({ kind: 'deal', bet: 100 });
    expect(t.blackjack.view.phase).toBe('player');
    const before = t.store.snapshot;

    expect(await t.coordinator.reset(scope)).toBe('round-in-progress');

    expect(t.asked).toEqual([]);
    expect(t.store.snapshot).toBe(before);
    expect(t.blackjack.view.phase).toBe('player');
  });

  it('refuses when a hand was dealt while the question was on screen, and changes nothing', async () => {
    const t = setup('wait');
    t.play();
    const asking = t.coordinator.reset('all');
    await Promise.resolve();
    expect(t.asked).toEqual(['all']);

    // The player (or another view) deals a hand before answering.
    t.blackjack.perform({ kind: 'newRound' });
    t.blackjack.perform({ kind: 'deal', bet: 100 });
    const before = t.store.snapshot;
    t.answer(true);

    expect(await asking).toBe('round-in-progress');
    expect(t.store.snapshot).toBe(before);
    expect(t.blackjack.view.phase).toBe('player');
    expect(t.roulette.view.recent).toHaveLength(2);
  });

  it('never clears a table that has a hand in play', () => {
    const t = setup();
    t.blackjack.perform({ kind: 'deal', bet: 100 });
    const view = t.blackjack.view;
    t.blackjack.clear();
    expect(t.blackjack.view).toBe(view);
  });
});

describe('two requests at once', () => {
  it('answers the second with busy, asks only once, and allows a new one afterwards', async () => {
    const t = setup('wait');
    t.play();
    const first = t.coordinator.reset('balance');
    await Promise.resolve();

    expect(await t.coordinator.reset('all')).toBe('busy');
    expect(t.asked).toEqual(['balance']);

    t.answer(true);
    expect(await first).toBe('done');
    expect(t.store.snapshot.history).toHaveLength(3);

    const again = t.coordinator.reset('statistics');
    await Promise.resolve();
    t.answer(false);
    expect(await again).toBe('cancelled');
  });

  it('is not left stuck after a failed dialog', async () => {
    const t = setup('throw');
    await t.coordinator.reset('all');
    expect(await t.coordinator.reset('all')).toBe('cancelled');
    expect(t.asked).toEqual(['all', 'all']);
  });
});
