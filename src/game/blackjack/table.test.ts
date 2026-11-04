import { describe, expect, it } from 'vitest';
import { MIN_BET } from '../../casino/chips';
import { STARTING_BALANCE } from '../../casino/snapshot';
import { CasinoStore } from '../../casino/store';
import { MemoryStorage } from '../../casino/testing';
import { seededRng } from '../rng';
import { BlackjackTable, type TableResult } from './table';
import { cards } from './testing';
import type { BlackjackAction, BlackjackView } from './view';

function setup(deckSpec: string) {
  const storage = new MemoryStorage();
  let counter = 0;
  const errors: string[] = [];
  const store = new CasinoStore(storage, { newId: () => `r${(counter += 1)}`, onError: (m) => errors.push(m) });
  const table = new BlackjackTable(store, { deck: () => cards(deckSpec), onError: (m) => errors.push(m) });
  return { store, table, storage, errors };
}

const deal = (bet: number): BlackjackAction => ({ kind: 'deal', bet });
const HIT: BlackjackAction = { kind: 'hit' };
const STAND: BlackjackAction = { kind: 'stand' };
const DOUBLE: BlackjackAction = { kind: 'double' };
const SPLIT: BlackjackAction = { kind: 'split' };
const NEW_ROUND: BlackjackAction = { kind: 'newRound' };

function ok(result: TableResult): void {
  expect(result).toEqual({ ok: true });
}

const NO_ACTIONS = { hit: false, stand: false, double: false, split: false };

describe('an idle table', () => {
  it('waits for a bet and offers no moves', () => {
    const { table } = setup('9S 6H 7D 10C');
    expect(table.view).toMatchObject({ round: 0, phase: 'betting', hands: [], actions: NO_ACTIONS });
    expect(table.view.dealer).toEqual({ cards: [], total: null });
    expect(table.view.result).toBeUndefined();
  });
});

describe('dealing', () => {
  it('takes the bet from the wallet and deals the opening hands', () => {
    const { table, store } = setup('9S 6H 7D 10C 2S 3S');
    ok(table.perform(deal(100)));

    expect(store.snapshot.balance).toBe(STARTING_BALANCE - 100);
    expect(store.openRounds).toHaveLength(1);
    expect(table.view).toMatchObject({
      round: 1,
      phase: 'player',
      actions: { hit: true, stand: true, double: true, split: false },
    });
    expect(table.view.hands).toEqual([
      {
        cards: cards('9S 7D'),
        bet: 100,
        total: 16,
        soft: false,
        doubled: false,
        active: true,
      },
    ]);
  });

  it('keeps the dealer hole card and the deck out of the view', () => {
    const { table } = setup('9S 6H 7D 10C 2S 3S');
    table.perform(deal(100));

    expect(table.view.dealer).toEqual({ cards: [{ rank: '6', suit: 'hearts' }, null], total: null });
    const everything = JSON.stringify(table.view);
    expect(everything).not.toContain('"rank":"10","suit":"clubs"'); // the hole card
    expect(everything).not.toContain('"rank":"2","suit":"spades"'); // the next card in the deck
    expect(everything).not.toContain('"rank":"3","suit":"spades"');
    expect(everything).not.toContain('deck');
  });

  it('refuses bad bets and leaves the table and the wallet untouched', () => {
    const { table, store } = setup('9S 6H 7D 10C');
    const before = table.view;

    expect(table.perform(deal(MIN_BET - 1))).toEqual({ ok: false, error: 'below-minimum' });
    expect(table.perform(deal(0))).toEqual({ ok: false, error: 'invalid-amount' });
    expect(table.perform(deal(-50))).toEqual({ ok: false, error: 'invalid-amount' });
    expect(table.perform(deal(12.5))).toEqual({ ok: false, error: 'invalid-amount' });
    expect(table.perform(deal(STARTING_BALANCE + 1))).toEqual({ ok: false, error: 'insufficient-funds' });

    expect(table.view).toBe(before);
    expect(store.snapshot.balance).toBe(STARTING_BALANCE);
    expect(store.openRounds).toEqual([]);
  });

  it('accepts the minimum bet, a custom bet and the whole balance', () => {
    for (const bet of [MIN_BET, 37, STARTING_BALANCE]) {
      const { table, store } = setup('9S 6H 7D 10C');
      ok(table.perform(deal(bet)));
      expect(store.snapshot.balance).toBe(STARTING_BALANCE - bet);
    }
  });

  it('will not deal over a round that is still being played', () => {
    const { table, store } = setup('9S 6H 7D 10C 2S 3S');
    table.perform(deal(100));
    expect(table.perform(deal(100))).toEqual({ ok: false, error: 'round-active' });
    expect(store.snapshot.balance).toBe(STARTING_BALANCE - 100);
  });
});

describe('playing a round', () => {
  it('stand: pays a win through the wallet and records it', () => {
    const { table, store } = setup('10S 7H 10D 10C'); // 20 vs 17
    table.perform(deal(100));
    ok(table.perform(STAND));

    expect(store.snapshot.balance).toBe(1_100);
    expect(store.openRounds).toEqual([]);
    expect(store.snapshot.history[0]).toMatchObject({
      game: 'blackjack',
      bet: 100,
      outcome: 'win',
      payout: 100,
      detail: 'Win 20 vs 17',
    });
    expect(store.snapshot.stats.blackjack).toMatchObject({ gamesPlayed: 1, wins: 1, totalWagered: 100, biggestWin: 100 });
  });

  it('shows the dealer hand and the result once the round is settled', () => {
    const { table } = setup('10S 7H 10D 10C');
    table.perform(deal(100));
    table.perform(STAND);

    expect(table.view.phase).toBe('settled');
    expect(table.view.dealer).toEqual({ cards: cards('7H 10C'), total: 17 });
    expect(table.view.actions).toEqual(NO_ACTIONS);
    expect(table.view.hands[0]).toMatchObject({ outcome: 'win', payout: 200, active: false });
    expect(table.view.result).toEqual({
      outcome: 'win',
      blackjack: false,
      net: 100,
      payout: 200,
      staked: 100,
      detail: 'Win 20 vs 17',
      balanceBefore: 900,
    });
  });

  it('hit to a bust loses the bet', () => {
    const { table, store } = setup('10S 6H 6D 10C KS 5S'); // 16, hits a king
    table.perform(deal(100));
    ok(table.perform(HIT));

    expect(store.snapshot.balance).toBe(900);
    expect(table.view.result).toMatchObject({ outcome: 'loss', net: -100, payout: 0, detail: 'Bust with 26' });
    expect(store.snapshot.history[0]).toMatchObject({ outcome: 'loss', payout: -100 });
  });

  it('a hit that does not end the round keeps it open and shows the new card', () => {
    const { table } = setup('2S 6H 3D 10C 4S 5S');
    table.perform(deal(100));
    ok(table.perform(HIT));
    expect(table.view.phase).toBe('player');
    expect(table.view.hands[0]?.cards).toEqual(cards('2S 3D 4S'));
    expect(table.view.hands[0]?.total).toBe(9);
    expect(table.view.actions).toEqual({ hit: true, stand: true, double: false, split: false });
  });

  it('a natural blackjack pays 3:2 straight away', () => {
    const { table, store } = setup('AS 9H KD 7C');
    ok(table.perform(deal(100)));

    expect(table.view.phase).toBe('settled');
    expect(store.snapshot.balance).toBe(1_150);
    expect(table.view.result).toMatchObject({ outcome: 'win', blackjack: true, net: 150, payout: 250, detail: 'Blackjack!' });
    expect(store.snapshot.history[0]).toMatchObject({ outcome: 'win', payout: 150, detail: 'Blackjack!' });
  });

  it('a dealer blackjack loses straight away', () => {
    const { table, store } = setup('9S AH 8D KC');
    table.perform(deal(100));
    expect(table.view.phase).toBe('settled');
    expect(store.snapshot.balance).toBe(900);
    expect(table.view.result).toMatchObject({ outcome: 'loss', blackjack: false, detail: 'Dealer blackjack' });
  });

  it('two blackjacks push and return the bet', () => {
    const { table, store } = setup('AS AH KD KC');
    table.perform(deal(100));
    expect(store.snapshot.balance).toBe(1_000);
    expect(table.view.result).toMatchObject({ outcome: 'push', net: 0, detail: 'Push: both blackjack' });
  });

  it('pushes on equal totals', () => {
    const { table, store } = setup('10S 8H 8D 10C');
    table.perform(deal(100));
    table.perform(STAND);
    expect(store.snapshot.balance).toBe(1_000);
    expect(table.view.result).toMatchObject({ outcome: 'push', detail: 'Push on 18' });
    expect(store.snapshot.stats.blackjack.pushes).toBe(1);
  });

  it('describes a loss against the dealer', () => {
    const { table } = setup('10S 6H 7D 10C 2S'); // 17 vs 18
    table.perform(deal(100));
    table.perform(STAND);
    expect(table.view.result?.detail).toBe('Lose 17 vs 18');
  });
});

describe('double down', () => {
  it('takes a second stake, plays one card and pays on the doubled bet', () => {
    const { table, store } = setup('5S 6H 6D 10C 9S 8S'); // 11, doubles to 20, dealer 16 busts
    table.perform(deal(100));
    ok(table.perform(DOUBLE));

    expect(store.snapshot.balance).toBe(1_200); // 1,000 - 200 + 400
    expect(table.view.hands[0]).toMatchObject({ bet: 200, doubled: true, total: 20, outcome: 'win', payout: 400 });
    expect(store.snapshot.history[0]).toMatchObject({ bet: 200, payout: 200, detail: 'Doubled: Dealer bust (24)' });
    expect(store.snapshot.stats.blackjack.totalWagered).toBe(200);
  });

  it('loses the whole doubled stake', () => {
    const { table, store } = setup('5S 6H 6D 10C 2S 2D');
    table.perform(deal(100));
    table.perform(DOUBLE);
    expect(store.snapshot.balance).toBe(800);
    expect(store.snapshot.history[0]).toMatchObject({ bet: 200, payout: -200, outcome: 'loss' });
  });

  it('is refused when the player cannot afford it, and nothing changes', () => {
    const { table, store } = setup('5S 6H 6D 10C 9S 8S');
    table.perform(deal(STARTING_BALANCE)); // all in: balance 0
    expect(table.view.actions.double).toBe(false); // the view already says so

    const before = table.view;
    expect(table.perform(DOUBLE)).toEqual({ ok: false, error: 'insufficient-funds' });
    expect(table.view).toBe(before);
    expect(table.view.hands[0]?.cards).toHaveLength(2);
    expect(store.snapshot.balance).toBe(0);
    expect(store.openRounds[0]?.staked).toBe(STARTING_BALANCE);

    ok(table.perform(STAND)); // the round carries on normally
  });

  it('is refused on a hand with three cards', () => {
    const { table, store } = setup('2S 6H 3D 10C 4S 9S');
    table.perform(deal(100));
    table.perform(HIT);
    expect(table.perform(DOUBLE)).toEqual({ ok: false, error: 'not-allowed' });
    expect(store.snapshot.balance).toBe(900); // no extra stake was taken
  });
});

describe('split', () => {
  const deck = '8S 6H 8D 10C 3S 2H 9C'; // two hands: 11 and 10; the dealer's 16 draws a 9 and busts

  it('takes a second stake and plays two hands', () => {
    const { table, store } = setup(deck);
    table.perform(deal(100));
    expect(table.view.actions.split).toBe(true);

    ok(table.perform(SPLIT));
    expect(store.snapshot.balance).toBe(800);
    expect(table.view.hands.map((hand) => [hand.cards.length, hand.bet, hand.active])).toEqual([
      [2, 100, true],
      [2, 100, false],
    ]);

    ok(table.perform(STAND));
    expect(table.view.hands.map((hand) => hand.active)).toEqual([false, true]);
    ok(table.perform(STAND));

    expect(store.snapshot.balance).toBe(1_200);
    expect(store.snapshot.history[0]).toMatchObject({ bet: 200, payout: 200, outcome: 'win', detail: 'Split: 2 won' });
    expect(table.view.result).toMatchObject({ staked: 200, payout: 400, net: 200 });
  });

  it('describes a mixed result', () => {
    const { table, store } = setup('8S 6H 8D 10C 10S 5H 2C'); // hands 18 and 13; dealer 16 + 2 = 18
    table.perform(deal(100));
    table.perform(SPLIT);
    table.perform(STAND);
    table.perform(STAND);

    expect(store.snapshot.history[0]).toMatchObject({ bet: 200, payout: -100, outcome: 'loss', detail: 'Split: 1 lost, 1 push' });
  });

  it('is refused when the player cannot afford the second stake, and nothing changes', () => {
    const { table, store } = setup(deck);
    table.perform(deal(600)); // balance 400 < 600
    expect(table.view.actions.split).toBe(false);

    const before = table.view;
    expect(table.perform(SPLIT)).toEqual({ ok: false, error: 'insufficient-funds' });
    expect(table.view).toBe(before);
    expect(store.snapshot.balance).toBe(400);
    expect(table.view.hands).toHaveLength(1);
  });

  it('is refused on a hand that is not a pair', () => {
    const { table, store } = setup('10S 6H 7D 10C');
    table.perform(deal(100));
    expect(table.perform(SPLIT)).toEqual({ ok: false, error: 'not-allowed' });
    expect(store.snapshot.balance).toBe(900);
  });
});

describe('preventing invalid actions', () => {
  it('refuses every move before a round has been dealt', () => {
    const { table } = setup('9S 6H 7D 10C');
    for (const action of [HIT, STAND, DOUBLE, SPLIT]) {
      expect(table.perform(action)).toEqual({ ok: false, error: 'not-allowed' });
    }
    expect(table.view.round).toBe(0);
  });

  it('refuses every move once the round is settled', () => {
    const { table, store } = setup('10S 7H 10D 10C');
    table.perform(deal(100));
    table.perform(STAND);
    const balance = store.snapshot.balance;

    for (const action of [HIT, STAND, DOUBLE, SPLIT]) {
      expect(table.perform(action)).toEqual({ ok: false, error: 'not-allowed' });
    }
    expect(store.snapshot.balance).toBe(balance); // never paid twice
    expect(store.snapshot.stats.blackjack.gamesPlayed).toBe(1);
  });

  it('will not start a new round while one is being played', () => {
    const { table } = setup('9S 6H 7D 10C 2S 3S');
    table.perform(deal(100));
    expect(table.perform(NEW_ROUND)).toEqual({ ok: false, error: 'round-active' });
    expect(table.view.phase).toBe('player');
  });
});

describe('new rounds', () => {
  it('clears a settled round back to betting, and keeps counting rounds', () => {
    const { table } = setup('10S 7H 10D 10C');
    table.perform(deal(100));
    table.perform(STAND);
    ok(table.perform(NEW_ROUND));

    expect(table.view).toMatchObject({ round: 1, phase: 'betting', hands: [], actions: NO_ACTIONS });
    expect(table.view.result).toBeUndefined();

    ok(table.perform(deal(100)));
    expect(table.view.round).toBe(2);
  });

  it('can deal straight from a settled round', () => {
    const { table } = setup('10S 7H 10D 10C');
    table.perform(deal(100));
    table.perform(STAND);
    ok(table.perform(deal(50)));
    expect(table.view).toMatchObject({ round: 2, phase: 'player' });
  });

  it('plays several rounds in a row with the wallet always in step', () => {
    const { table, store } = setup('10S 7H 10D 10C'); // the same winning hand every round
    for (let round = 1; round <= 5; round += 1) {
      table.perform(deal(100));
      table.perform(STAND);
      expect(store.snapshot.balance).toBe(1_000 + round * 100);
    }
    expect(store.snapshot.stats.blackjack).toMatchObject({ gamesPlayed: 5, wins: 5, totalWagered: 500 });
  });
});

describe('telling the views', () => {
  it('announces every change, and tells the views the result BEFORE the wallet is paid', () => {
    const { table, store } = setup('10S 7H 10D 10C');
    const events: string[] = [];
    table.onDidChange((view) => events.push(`view:${view.phase}`));
    store.onDidChange(() => events.push('wallet'));

    table.perform(deal(100));
    table.perform(STAND);
    table.perform(NEW_ROUND);

    expect(events).toEqual([
      'wallet', // the bet leaves the balance...
      'view:player', // ...then the opening hands
      'view:settled', // the result is announced first,
      'wallet', // and only then paid, so a view can keep the old balance on screen
      'view:betting',
    ]);
  });

  it('stops calling a listener once it has unsubscribed', () => {
    const { table } = setup('9S 6H 7D 10C 2S');
    let calls = 0;
    const stop = table.onDidChange(() => (calls += 1));
    table.perform(deal(100));
    stop();
    table.perform(STAND);
    expect(calls).toBe(1);
  });

  it('reports a throwing listener and carries on', () => {
    const { table, errors } = setup('9S 6H 7D 10C');
    table.onDidChange(() => {
      throw new Error('boom');
    });
    ok(table.perform(deal(100)));
    expect(errors).toEqual(['A blackjack listener failed']);
  });

  it('reports the balance as it was before the result, for the views to hold on screen', () => {
    const { table } = setup('10S 7H 10D 10C');
    table.perform(deal(250));
    table.perform(STAND);
    expect(table.view.result?.balanceBefore).toBe(STARTING_BALANCE - 250);
  });
});

describe('random play through the whole stack', () => {
  it('keeps the wallet, the statistics and the views consistent, round after round', () => {
    const rng = seededRng(424_242);
    const storage = new MemoryStorage();
    const errors: string[] = [];
    const store = new CasinoStore(storage, { onError: (message) => errors.push(message) });
    const table = new BlackjackTable(store, { rng, onError: (message) => errors.push(message) });

    let rounds = 0;
    let doubles = 0;
    let splits = 0;

    for (let attempt = 0; attempt < 1_000 && rounds < 90; attempt += 1) {
      if (store.snapshot.balance < MIN_BET) store.resetBalance(); // keep playing after going broke

      const before = store.snapshot.balance;
      const bet = Math.min(before, 10 * (1 + Math.floor(rng() * 12)));
      const dealt = table.perform(deal(bet));
      expect(dealt).toEqual({ ok: true });

      for (let guard = 0; table.view.phase === 'player' && guard < 60; guard += 1) {
        // While a round is open, exactly one round holds exactly the chips on the table.
        const open = store.openRounds;
        expect(open).toHaveLength(1);
        expect(open[0]?.staked).toBe(table.view.hands.reduce((sum, hand) => sum + hand.bet, 0));

        const { actions } = table.view;
        const candidates: ReadonlyArray<readonly [BlackjackAction, boolean]> = [
          [HIT, actions.hit],
          [STAND, actions.stand],
          [DOUBLE, actions.double],
          [SPLIT, actions.split],
        ];
        const moves = candidates.filter(([, allowed]) => allowed).map(([action]) => action);
        const move: BlackjackAction = moves[Math.floor(rng() * moves.length)] ?? STAND;
        if (move === DOUBLE) doubles += 1;
        if (move === SPLIT) splits += 1;
        expect(table.perform(move)).toEqual({ ok: true });
      }

      const view: BlackjackView = table.view;
      expect(view.phase).toBe('settled');
      const { result } = view;
      expect(result).toBeDefined();
      if (result === undefined) continue;

      // The wallet moved by exactly the net result, and nothing is left open.
      expect(store.snapshot.balance).toBe(before + result.net);
      expect(store.openRounds).toEqual([]);
      expect(result.balanceBefore).toBe(before - result.staked);
      expect(result.payout - result.staked).toBe(result.net);
      expect(view.hands.reduce((sum, hand) => sum + (hand.payout ?? 0), 0)).toBe(result.payout);
      expect(store.snapshot.history[0]).toMatchObject({ game: 'blackjack', bet: result.staked, payout: result.net });
      expect(Number.isSafeInteger(store.snapshot.balance)).toBe(true);
      expect(store.snapshot.balance).toBeGreaterThanOrEqual(0);

      rounds += 1;
      table.perform(NEW_ROUND);
    }

    expect(errors).toEqual([]);
    expect(rounds).toBe(90);
    expect(store.snapshot.stats.blackjack.gamesPlayed).toBe(90);
    expect(doubles).toBeGreaterThan(5);
    expect(splits).toBeGreaterThan(0);
  });
});
