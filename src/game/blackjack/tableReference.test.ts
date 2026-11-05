import { describe, expect, it } from 'vitest';
import { createFreshState, STATE_KEY } from '../../casino/persistence';
import { CasinoStore } from '../../casino/store';
import { MemoryStorage } from '../../casino/testing';
import { seededRng } from '../rng';
import { ReferenceRound, shuffled, text } from './referenceRules';
import { BlackjackTable } from './table';
import type { Card } from './types';

/**
 * The same independent rulebook, played through the REAL table and wallet: every stake that leaves the balance
 * (the bet, a double, the second bet of a split), what the player may do given what they can afford, a move they
 * cannot afford being refused without changing anything, and the exact chips that come back at the end.
 */
const ACTIONS = ['hit', 'stand', 'double', 'split'] as const;

describe('the table and wallet against the independent reference', () => {
  it('moves the right chips for every bet, double, split and payout over 100,000 random rounds', () => {
    const random = seededRng(7_721_105);
    let deck: readonly Card[] = [];
    let counter = 0;
    const seen = { rounds: 0, refusedForMoney: 0, splits: 0, doubles: 0, unaffordableSplit: 0, unaffordableDouble: 0, allIn: 0 };

    for (let roundNumber = 0; roundNumber < 100_000; roundNumber += 1) {
      // A new wallet each round, of a random size (in steps of 5), so that the chips left can fall exactly on, or
      // just short of, the stake that a double or a split needs.
      const bet = 10 * (1 + Math.floor(random() ** 2 * 100)); // 10 .. 1000, small bets likelier
      const balance = bet + 5 * Math.floor(random() * ((bet * 3) / 5 + 1)); // the bet, up to four times the bet
      const storage = new MemoryStorage();
      storage.seed(STATE_KEY, { ...createFreshState(), balance });
      const store = new CasinoStore(storage, { newId: () => `r${(counter += 1)}` });
      const table = new BlackjackTable(store, { deck: () => deck });
      if (balance === bet) seen.allIn += 1;
      deck = shuffled(random);
      const context = `round ${roundNumber} bet ${bet} wallet ${balance} deck ${text(deck.slice(0, 10))}`;

      const reference = new ReferenceRound(deck, bet);
      expect(table.perform({ kind: 'deal', bet }), context).toEqual({ ok: true });
      seen.rounds += 1;
      let staked = bet;

      for (let step = 0; step < 60 && !reference.over; step += 1) {
        const where = `${context} step ${step}`;
        const hand = reference.hands[reference.current];
        if (hand === undefined) throw new Error('no hand');
        const left = store.snapshot.balance;
        expect(left, `${where}: the wallet holds what is left after every stake`).toBe(balance - staked);

        const legal = reference.legal();
        const affordable = left >= hand.bet;
        const expected = { hit: legal.hit, stand: legal.stand, double: legal.double && affordable, split: legal.split && affordable };
        expect(table.view.actions, `${where}: what the table offers`).toEqual(expected);

        // A move the rules allow but the wallet cannot pay for is refused, and nothing changes.
        for (const move of ['double', 'split'] as const) {
          if (legal[move] && !affordable) {
            const viewBefore = table.view;
            const snapshotBefore = store.snapshot;
            expect(table.perform({ kind: move }), `${where}: ${move} without the chips`).toEqual({ ok: false, error: 'insufficient-funds' });
            expect(table.view, `${where}: the table must not change`).toBe(viewBefore);
            expect(store.snapshot, `${where}: the wallet must not change`).toBe(snapshotBefore);
            seen.refusedForMoney += 1;
            if (move === 'split') seen.unaffordableSplit += 1;
            else seen.unaffordableDouble += 1;
          }
        }

        const choices = ACTIONS.filter((action) => expected[action]);
        const weights = choices.map((action) => (action === 'hit' ? 4 : action === 'stand' ? 3 : 2));
        let pick = random() * weights.reduce((sum, weight) => sum + weight, 0);
        const action = choices.find((_, index) => (pick -= weights[index] ?? 0) < 0) ?? choices[0];
        if (action === undefined) throw new Error('no move to make');

        if (action === 'double' || action === 'split') {
          staked += hand.bet; // the extra stake is exactly the hand's bet
          if (action === 'split') seen.splits += 1;
          else seen.doubles += 1;
        }
        reference.apply(action);
        expect(table.perform({ kind: action }), `${where}: ${action}`).toEqual({ ok: true });

        reference.hands.forEach((ref, index) => {
          const shown = table.view.hands[index];
          expect(text(shown?.cards ?? []), `${where}: hand ${index} cards`).toBe(text(ref.cards));
          expect(shown?.bet, `${where}: hand ${index} bet`).toBe(ref.bet);
        });
      }

      expect(table.view.phase, `${context}: finished`).toBe('settled');
      const returned = reference.payouts.reduce((sum, payout) => sum + payout, 0);
      expect(store.snapshot.balance, `${context}: balance after the round`).toBe(balance - staked + returned);
      expect(store.openRounds, `${context}: nothing left open`).toEqual([]);

      const entry = store.snapshot.history[0];
      expect(entry?.bet, `${context}: history bet`).toBe(staked);
      expect(entry?.payout, `${context}: history net`).toBe(returned - staked);
      expect(entry?.outcome, `${context}: history outcome`).toBe(returned > staked ? 'win' : returned < staked ? 'loss' : 'push');
      expect(table.view.result?.net, `${context}: result net`).toBe(returned - staked);
    }

    expect(seen.splits, JSON.stringify(seen)).toBeGreaterThan(1_500);
    expect(seen.doubles).toBeGreaterThan(10_000);
    expect(seen.unaffordableSplit).toBeGreaterThan(300);
    expect(seen.unaffordableDouble).toBeGreaterThan(2_000);
    expect(seen.allIn).toBeGreaterThan(1_000); // bet the whole wallet
  }, 120_000);
});
