import { describe, expect, it } from 'vitest';
import { availableActions, doubleDown, hit, split, stand, startRound } from './engine';
import { seededRng } from '../rng';
import { ReferenceRound, shuffled, text, total, VALUE } from './referenceRules';
import type { Round } from './types';

const ACTIONS = ['hit', 'stand', 'double', 'split'] as const;

describe('the engine against an independent reference of the rules', () => {
  it('agrees on every legal move, every card, every bet and every payout over 100,000 random rounds', () => {
    const random = seededRng(20_261_105);
    const seen = { rounds: 0, splits: 0, resplits: 0, fourHands: 0, splitAces: 0, tenValueSplits: 0, mixedTenSplits: 0, doubles: 0, doubleAfterSplit: 0, naturals: 0, dealerNaturals: 0, busts: 0, dealerBusts: 0, pushes: 0 };

    for (let roundNumber = 0; roundNumber < 100_000; roundNumber += 1) {
      const deck = shuffled(random);
      const bet = 10 * (1 + Math.floor(random() * 10));
      const reference = new ReferenceRound(deck, bet);
      let engine: Round = startRound(deck, bet);
      seen.rounds += 1;

      for (let step = 0; step < 60; step += 1) {
        const context = `round ${roundNumber} step ${step} deck ${text(deck.slice(0, 12))}`;
        expect(engine.phase === 'settled', `${context}: both must end together`).toBe(reference.over);
        if (reference.over) break;

        const legal = reference.legal();
        expect(availableActions(engine), `${context}: legal moves differ`).toEqual(legal);

        const choices = ACTIONS.filter((action) => legal[action]);
        const weights = choices.map((action) => (action === 'hit' ? 4 : action === 'stand' ? 3 : 2));
        let pick = random() * weights.reduce((sum, weight) => sum + weight, 0);
        const action = choices.find((_, index) => (pick -= weights[index] ?? 0) < 0) ?? choices[0];
        if (action === undefined) throw new Error('no action available');

        const before = reference.hands.map((hand) => hand.cards.length);
        const handBefore = reference.hands[reference.current];
        if (action === 'split') {
          seen.splits += 1;
          if (handBefore?.fromSplit) seen.resplits += 1;
          if (handBefore?.cards[0]?.rank === 'A') seen.splitAces += 1;
          else if ((VALUE[handBefore?.cards[0]?.rank ?? ''] ?? 0) === 10) seen.tenValueSplits += 1;
          if (handBefore?.cards[0]?.rank !== handBefore?.cards[1]?.rank) seen.mixedTenSplits += 1;
        }
        if (action === 'double') {
          seen.doubles += 1;
          if (handBefore?.fromSplit) seen.doubleAfterSplit += 1;
        }

        reference.apply(action);
        const result = action === 'hit' ? hit(engine) : action === 'stand' ? stand(engine) : action === 'double' ? doubleDown(engine) : split(engine);
        if (!result.ok) throw new Error(`${context}: the engine refused "${action}" that the rulebook allows`);
        engine = result.round;
        expect(reference.hands.length, `${context}: hands after ${action} (was ${before.join(',')})`).toBe(engine.hands.length);
        if (reference.hands.length === 4) seen.fourHands += 1;

        reference.hands.forEach((hand, index) => {
          const theirs = engine.hands[index];
          expect(text(theirs?.cards ?? []), `${context}: hand ${index} cards`).toBe(text(hand.cards));
          expect(theirs?.bet, `${context}: hand ${index} bet`).toBe(hand.bet);
        });
        if (!reference.over) expect(engine.active, `${context}: active hand`).toBe(reference.current);
      }

      expect(engine.phase, `round ${roundNumber} must finish`).toBe('settled');
      const settlement = engine.settlement;
      expect(settlement, `round ${roundNumber}: settlement`).toBeDefined();
      expect(settlement?.hands.map((hand) => hand.payout), `round ${roundNumber}: payouts (deck ${text(deck.slice(0, 12))})`).toEqual(reference.payouts);
      expect(text(engine.dealer), `round ${roundNumber}: dealer cards`).toBe(text(reference.dealer));

      const staked = reference.hands.reduce((sum, hand) => sum + hand.bet, 0);
      expect(settlement?.staked).toBe(staked);
      expect(settlement?.net).toBe(reference.payouts.reduce((sum, payout) => sum + payout, 0) - staked);

      if (reference.hands.length === 1 && reference.hands[0]?.cards.length === 2 && total(reference.hands[0].cards) === 21 && !reference.hands[0].fromSplit) seen.naturals += 1;
      if (total(reference.dealer) === 21 && reference.dealer.length === 2) seen.dealerNaturals += 1;
      if (total(reference.dealer) > 21) seen.dealerBusts += 1;
      seen.busts += reference.hands.filter((hand) => total(hand.cards) > 21).length;
      seen.pushes += reference.payouts.filter((payout, index) => payout === reference.hands[index]?.bet).length;
    }

    // The fuzz must really have exercised the rules it claims to check.
    expect(seen.splits, JSON.stringify(seen)).toBeGreaterThan(2_000);
    expect(seen.resplits).toBeGreaterThan(150);
    expect(seen.fourHands).toBeGreaterThan(50);
    expect(seen.splitAces).toBeGreaterThan(60);
    expect(seen.tenValueSplits).toBeGreaterThan(1_200);
    expect(seen.mixedTenSplits).toBeGreaterThan(900); // 10+K, J+Q and so on: the rule that was wrong
    expect(seen.doubles).toBeGreaterThan(15_000);
    expect(seen.doubleAfterSplit).toBeGreaterThan(600);
    expect(seen.naturals).toBeGreaterThan(4_000);
    expect(seen.dealerNaturals).toBeGreaterThan(4_000);
    expect(seen.busts).toBeGreaterThan(25_000);
    expect(seen.dealerBusts).toBeGreaterThan(12_000);
    expect(seen.pushes).toBeGreaterThan(3_500);
  }, 120_000);
});
