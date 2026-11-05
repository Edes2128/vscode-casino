import { describe, expect, it } from 'vitest';
import { MIN_BET } from '../../casino/chips';
import { STARTING_BALANCE } from '../../casino/snapshot';
import { CasinoStore } from '../../casino/store';
import { MemoryStorage } from '../../casino/testing';
import type { HistoryEntry } from '../../casino/types';
import { cryptoRng, seededRng, type Rng } from '../rng';
import { payoutFor, selectionWins } from './betting';
import { RouletteTable, recentFromHistory } from './table';
import { ROULETTE_COLORS, type RouletteColor, type RouletteSelection } from './types';
import { MAX_RECENT, type RouletteView } from './view';
import { POCKETS, POCKET_COUNT, WHEEL_ORDER, describePocket, pocketIndexOfNumber } from './wheel';

/** A generator that makes the ball land on each of `numbers` in turn. */
function ballLandingOn(...numbers: number[]): Rng {
  let next = 0;
  return () => {
    const number = numbers[next];
    next += 1;
    if (number === undefined) throw new Error('The test ran out of planned spins');
    return (pocketIndexOfNumber(number) + 0.5) / POCKET_COUNT;
  };
}

function setup(rng: Rng, storage = new MemoryStorage()) {
  let counter = 0;
  const errors: string[] = [];
  const store = new CasinoStore(storage, { newId: () => `r${(counter += 1)}`, onError: (m) => errors.push(m) });
  const table = new RouletteTable(store, { rng, onError: (m) => errors.push(m) });
  return { store, table, storage, errors };
}

/** A spin on a colour (by name) or on any selection, such as `number(17)`. */
const spin = (on: RouletteColor | RouletteSelection, bet: number) =>
  ({ kind: 'spin', selection: typeof on === 'string' ? ({ kind: 'color', color: on } as const) : on, bet }) as const;
const number = (n: number): RouletteSelection => ({ kind: 'number', number: n });
const colorBet = (color: RouletteColor): RouletteSelection => ({ kind: 'color', color });

describe('a fresh table', () => {
  it('has not spun yet', () => {
    const { table } = setup(ballLandingOn());
    expect(table.view).toEqual({ spin: 0, recent: [] });
    expect(table.view.last).toBeUndefined();
  });
});

describe('spinning', () => {
  it('pays a red win 1:1 through the wallet and records it', () => {
    const { table, store } = setup(ballLandingOn(32)); // red
    expect(table.perform(spin('red', 100))).toEqual({ ok: true });

    expect(store.snapshot.balance).toBe(1_100);
    expect(store.openRounds).toEqual([]);
    expect(store.snapshot.history[0]).toMatchObject({
      game: 'roulette',
      bet: 100,
      outcome: 'win',
      payout: 100,
      detail: 'Red 32',
    });
    expect(store.snapshot.stats.roulette).toMatchObject({ gamesPlayed: 1, wins: 1, totalWagered: 100, biggestWin: 100 });
  });

  it('pays a black win 1:1', () => {
    const { table, store } = setup(ballLandingOn(15)); // black
    table.perform(spin('black', 50));
    expect(store.snapshot.balance).toBe(1_050);
    expect(store.snapshot.history[0]).toMatchObject({ outcome: 'win', payout: 50, detail: 'Black 15' });
  });

  it('pays a green win 35:1', () => {
    const { table, store } = setup(ballLandingOn(0));
    table.perform(spin('green', 10));
    expect(store.snapshot.balance).toBe(1_000 - 10 + 360);
    expect(store.snapshot.history[0]).toMatchObject({ outcome: 'win', payout: 350, detail: 'Green 0' });
    expect(store.snapshot.stats.roulette.biggestWin).toBe(350);
  });

  it('takes the bet on a loss, and says where the ball landed, not what was bet', () => {
    const { table, store } = setup(ballLandingOn(32)); // red
    table.perform(spin('black', 100));
    expect(store.snapshot.balance).toBe(900);
    expect(store.snapshot.history[0]).toMatchObject({ outcome: 'loss', payout: -100, detail: 'Red 32' });
    expect(store.snapshot.stats.roulette).toMatchObject({ losses: 1, biggestLoss: 100 });
  });

  it('loses a red or black bet when the ball lands on the zero', () => {
    for (const color of ['red', 'black'] as const) {
      const { table, store } = setup(ballLandingOn(0));
      table.perform(spin(color, 100));
      expect(store.snapshot.balance).toBe(900);
      expect(store.snapshot.history[0]).toMatchObject({ outcome: 'loss', detail: 'Green 0' });
    }
  });

  it('settles every pocket against every colour, with the exact balance, through the real wallet', () => {
    for (const pocket of POCKETS) {
      for (const color of ROULETTE_COLORS) {
        const { table, store } = setup(ballLandingOn(pocket.number));
        table.perform(spin(color, 10));
        const expected = STARTING_BALANCE - 10 + payoutFor(colorBet(color), 10, pocket);
        expect(store.snapshot.balance, `${color} bet on ${describePocket(pocket)}`).toBe(expected);
        expect(store.snapshot.history[0]?.detail).toBe(describePocket(pocket));
        expect(store.openRounds).toEqual([]);
      }
    }
  });

  it('counts exactly one game per spin', () => {
    const { table, store } = setup(ballLandingOn(1, 2, 3, 4));
    for (let spins = 1; spins <= 4; spins += 1) {
      table.perform(spin('red', 10));
      expect(store.snapshot.stats.roulette.gamesPlayed).toBe(spins);
      expect(store.snapshot.history).toHaveLength(spins);
    }
  });
});

describe('number bets', () => {
  it('pay 35 to 1 through the wallet when the ball lands on the chosen number, and record it', () => {
    const { table, store } = setup(ballLandingOn(17));
    expect(table.perform(spin(number(17), 100))).toEqual({ ok: true });

    expect(store.snapshot.balance).toBe(STARTING_BALANCE - 100 + 3_600);
    expect(store.snapshot.history[0]).toMatchObject({ game: 'roulette', bet: 100, outcome: 'win', payout: 3_500, detail: 'Black 17' });
    expect(table.view.last).toMatchObject({ selection: { kind: 'number', number: 17 }, won: true, net: 3_500, payout: 3_600 });
    expect(store.openRounds).toEqual([]);
  });

  it('lose the bet on any other number, even a neighbour and even the right colour', () => {
    const { table, store } = setup(ballLandingOn(15)); // black 15, a black number like 17
    table.perform(spin(number(17), 100));
    expect(store.snapshot.balance).toBe(STARTING_BALANCE - 100);
    expect(table.view.last).toMatchObject({ won: false, net: -100, payout: 0 });
  });

  it('can be placed on the zero, and pay 35 to 1 there too', () => {
    const { table, store } = setup(ballLandingOn(0));
    table.perform(spin(number(0), 10));
    expect(store.snapshot.balance).toBe(STARTING_BALANCE - 10 + 360);
  });

  it('settle every number against every pocket, with the exact balance, through the real wallet (1,369 spins)', () => {
    for (let chosen = 0; chosen <= 36; chosen += 1) {
      for (const pocket of POCKETS) {
        const { table, store } = setup(ballLandingOn(pocket.number));
        expect(table.perform(spin(number(chosen), 10)), `bet ${chosen}`).toEqual({ ok: true });
        const expected = STARTING_BALANCE - 10 + (pocket.number === chosen ? 360 : 0);
        expect(store.snapshot.balance, `bet ${chosen}, landed ${pocket.number}`).toBe(expected);
        expect(store.openRounds).toEqual([]);
      }
    }
  });

  it('are refused when the number is not on the wheel, before any chips move', () => {
    const { table, store } = setup(ballLandingOn(1));
    const snapshot = store.snapshot;
    for (const bad of [-1, 37, 100, 1.5, Number.NaN]) {
      expect(table.perform({ kind: 'spin', selection: { kind: 'number', number: bad }, bet: 10 }), String(bad)).toEqual({ ok: false, error: 'not-allowed' });
    }
    expect(table.perform({ kind: 'spin', selection: { kind: 'dozen' } as never, bet: 10 })).toEqual({ ok: false, error: 'not-allowed' });
    expect(store.snapshot).toBe(snapshot);
    expect(table.view.spin).toBe(0);
  });

  it('are subject to the same limits as any bet: the minimum, whole chips and the balance', () => {
    const { table, store } = setup(ballLandingOn(1));
    expect(table.perform(spin(number(5), 5))).toEqual({ ok: false, error: 'below-minimum' });
    expect(table.perform(spin(number(5), 12.5))).toEqual({ ok: false, error: 'invalid-amount' });
    expect(table.perform(spin(number(5), STARTING_BALANCE + 1))).toEqual({ ok: false, error: 'insufficient-funds' });
    expect(store.snapshot.balance).toBe(STARTING_BALANCE);
  });
});

describe('invalid bets and an empty wallet', () => {
  it('refuses a bet below the minimum, a non-whole bet and an overdraft, and changes nothing', () => {
    const { table, store } = setup(ballLandingOn());
    const before = table.view;
    const changes: RouletteView[] = [];
    table.onDidChange((view) => changes.push(view));

    expect(table.perform(spin('red', MIN_BET - 1))).toEqual({ ok: false, error: 'below-minimum' });
    expect(table.perform(spin('red', 0))).toEqual({ ok: false, error: 'invalid-amount' });
    expect(table.perform(spin('red', -100))).toEqual({ ok: false, error: 'invalid-amount' });
    expect(table.perform(spin('red', 12.5))).toEqual({ ok: false, error: 'invalid-amount' });
    expect(table.perform(spin('red', Number.NaN))).toEqual({ ok: false, error: 'invalid-amount' });
    expect(table.perform(spin('red', STARTING_BALANCE + 1))).toEqual({ ok: false, error: 'insufficient-funds' });

    expect(table.view).toBe(before);
    expect(changes).toEqual([]);
    expect(store.snapshot.balance).toBe(STARTING_BALANCE);
    expect(store.snapshot.history).toEqual([]);
    expect(store.openRounds).toEqual([]);
  });

  it('allows the minimum bet and betting everything', () => {
    for (const bet of [MIN_BET, STARTING_BALANCE]) {
      const { table, store } = setup(ballLandingOn(2)); // black
      expect(table.perform(spin('red', bet))).toEqual({ ok: true });
      expect(store.snapshot.balance).toBe(STARTING_BALANCE - bet);
    }
  });

  it('refuses further spins once the wallet cannot cover the minimum', () => {
    const { table, store } = setup(ballLandingOn(2));
    table.perform(spin('red', STARTING_BALANCE)); // black comes up: balance 0
    expect(store.snapshot.balance).toBe(0);
    expect(table.perform(spin('red', MIN_BET))).toEqual({ ok: false, error: 'insufficient-funds' });
    expect(store.snapshot.balance).toBe(0);
    expect(table.view.spin).toBe(1); // the refused spin did not count
  });
});

describe('what the views are shown', () => {
  it('describes the spin: where the ball landed, the bet and the net result', () => {
    const { table } = setup(ballLandingOn(0));
    table.perform(spin('green', 10));

    expect(table.view.spin).toBe(1);
    expect(table.view.last).toEqual({
      pocket: { number: 0, color: 'green' },
      selection: { kind: 'color', color: 'green' },
      bet: 10,
      won: true,
      net: 350,
      payout: 360,
      detail: 'Green 0',
      balanceBefore: 990,
    });
  });

  it('counts spins and lists the latest result first', () => {
    const { table } = setup(ballLandingOn(17, 0, 23));
    for (let i = 0; i < 3; i += 1) table.perform(spin('red', 10));
    expect(table.view.spin).toBe(3);
    expect(table.view.recent.map((pocket) => pocket.number)).toEqual([23, 0, 17]);
    expect(table.view.last?.pocket.number).toBe(23);
  });

  it(`remembers at most ${MAX_RECENT} results`, () => {
    const numbers = Array.from({ length: MAX_RECENT + 5 }, (_, i) => WHEEL_ORDER[i % 37] as number);
    const { table } = setup(ballLandingOn(...numbers));
    for (let i = 0; i < numbers.length; i += 1) table.perform(spin('red', 10));
    expect(table.view.recent).toHaveLength(MAX_RECENT);
    expect(table.view.recent[0]?.number).toBe(numbers.at(-1));
  });

  it('reports the balance as it stood before the result was paid, for the view to hold on screen', () => {
    const { table } = setup(ballLandingOn(32));
    table.perform(spin('red', 250));
    expect(table.view.last?.balanceBefore).toBe(STARTING_BALANCE - 250);
  });

  it('announces the result BEFORE the wallet is paid', () => {
    const { table, store } = setup(ballLandingOn(32));
    const events: string[] = [];
    table.onDidChange((view) => events.push(`view:${view.spin}`));
    store.onDidChange(() => events.push('wallet'));

    table.perform(spin('red', 100));

    expect(events).toEqual([
      'wallet', // the bet leaves the balance
      'view:1', // the result is announced,
      'wallet', // and only then paid, so a wheel can keep spinning on the old balance
    ]);
  });

  it('stops calling a listener once it has unsubscribed, and survives one that throws', () => {
    const { table, errors } = setup(ballLandingOn(1, 2, 3));
    let calls = 0;
    const stop = table.onDidChange(() => (calls += 1));
    table.perform(spin('red', 10));
    stop();
    table.perform(spin('red', 10));
    expect(calls).toBe(1);

    table.onDidChange(() => {
      throw new Error('boom');
    });
    expect(table.perform(spin('red', 10))).toEqual({ ok: true });
    expect(errors).toEqual(['A roulette listener failed']);
  });
});

describe('recent results across sessions', () => {
  const entry = (patch: Partial<HistoryEntry>): HistoryEntry => ({
    id: 'x',
    game: 'roulette',
    bet: 10,
    outcome: 'loss',
    payout: -10,
    detail: 'Red 32',
    timestamp: 1,
    ...patch,
  });

  it('reads them back from the history, newest first', () => {
    const history = [entry({ detail: 'Black 15' }), entry({ detail: 'Green 0' }), entry({ detail: 'Red 32' })];
    expect(recentFromHistory(history).map((pocket) => pocket.number)).toEqual([15, 0, 32]);
  });

  it('ignores blackjack rounds, abandoned rounds and anything it did not write', () => {
    const history = [
      entry({ game: 'blackjack', detail: 'Win 20 vs 18' }),
      entry({ detail: 'Round abandoned' }),
      entry({ game: 'blackjack', detail: 'Red 32' }),
      entry({ detail: 'Black 8' }),
    ];
    expect(recentFromHistory(history).map((pocket) => pocket.number)).toEqual([8]);
  });

  it(`keeps at most ${MAX_RECENT}`, () => {
    const history = Array.from({ length: 40 }, () => entry({}));
    expect(recentFromHistory(history)).toHaveLength(MAX_RECENT);
  });

  it('shows the last results again after a restart', async () => {
    const first = setup(ballLandingOn(17, 0, 23));
    for (let i = 0; i < 3; i += 1) first.table.perform(spin('red', 10));
    await first.store.flush();

    const second = setup(ballLandingOn(), first.storage); // a new session on the same saved data
    expect(second.table.view.recent.map((pocket) => pocket.number)).toEqual([23, 0, 17]);
    expect(second.table.view.spin).toBe(0); // spins are counted per session
    expect(second.table.view.last).toBeUndefined();
  });
});

describe('random play through the whole stack', () => {
  const play = (rng: Rng, spins: number) => {
    const { table, store, errors } = setup(rng);
    const picker = seededRng(7);
    const tally = { red: 0, black: 0, green: 0 };
    let played = 0;

    for (let i = 0; i < spins; i += 1) {
      if (store.snapshot.balance < MIN_BET) store.resetBalance();
      const before = store.snapshot.balance;
      const bet = Math.min(before, 10 * (1 + Math.floor(picker() * 30)));
      const color = ROULETTE_COLORS[Math.floor(picker() * 3)] ?? 'red';
      const selection: RouletteSelection = picker() < 0.5 ? colorBet(color) : number(Math.floor(picker() * 37));

      expect(table.perform(spin(selection, bet))).toEqual({ ok: true });
      const last = table.view.last;
      expect(last).toBeDefined();
      if (last === undefined) continue;

      expect(last.pocket.color).toBe(POCKETS.find((p) => p.number === last.pocket.number)?.color);
      expect(last.payout).toBe(payoutFor(selection, bet, last.pocket));
      expect(last.won).toBe(selectionWins(selection, last.pocket));
      expect(last.selection).toEqual(selection);
      expect(store.snapshot.balance).toBe(before + last.net);
      expect(store.openRounds).toEqual([]);
      expect(Number.isSafeInteger(store.snapshot.balance)).toBe(true);
      expect(store.snapshot.balance).toBeGreaterThanOrEqual(0);
      tally[last.pocket.color] += 1;
      played += 1;
    }
    expect(errors).toEqual([]);
    expect(store.snapshot.stats.roulette.gamesPlayed).toBe(played);
    return tally;
  };

  it('keeps the wallet, the statistics and the views consistent over 400 seeded spins', () => {
    const tally = play(seededRng(808), 400);
    expect(tally.red).toBeGreaterThan(100);
    expect(tally.black).toBeGreaterThan(100);
    expect(tally.green).toBeGreaterThan(0);
  });

  it('does the same with the real Web Crypto generator', () => {
    const tally = play(cryptoRng, 200);
    expect(tally.red + tally.black + tally.green).toBe(200);
  });
});
