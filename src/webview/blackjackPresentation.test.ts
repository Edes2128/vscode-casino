import { describe, expect, it } from 'vitest';
import { cards } from '../game/blackjack/testing';
import {
  AFTER_DEAL_DELAY_MS,
  BEFORE_FLIP_DELAY_MS,
  DEALER_CARD_DELAY_MS,
  OPENING_STEP,
  RESULT_DELAY_MS,
  dealerCardsAt,
  dealerTotalAt,
  revealPlan,
  startDelayFor,
} from './blackjackPresentation';

describe('revealPlan', () => {
  it('flips the hole card, then shows the result, when the dealer draws nothing', () => {
    expect(revealPlan(2, 450)).toEqual([
      { atMs: 450, dealerCards: 2, holeUp: true, resultVisible: false },
      { atMs: 450 + RESULT_DELAY_MS, dealerCards: 2, holeUp: true, resultVisible: true },
    ]);
  });

  it('deals the dealer extra cards one at a time before the result', () => {
    const plan = revealPlan(4, 450);
    expect(plan.map((step) => step.dealerCards)).toEqual([2, 3, 4, 4]);
    expect(plan.map((step) => step.resultVisible)).toEqual([false, false, false, true]);
    expect(plan[1]?.atMs).toBe(450 + DEALER_CARD_DELAY_MS);
    expect(plan[2]?.atMs).toBe(450 + 2 * DEALER_CARD_DELAY_MS);
    expect(plan[3]?.atMs).toBe(450 + 2 * DEALER_CARD_DELAY_MS + RESULT_DELAY_MS);
  });

  it('only ever moves forward in time and shows the result exactly once, last', () => {
    for (let count = 2; count <= 8; count += 1) {
      const plan = revealPlan(count, 450);
      expect(plan.map((step) => step.atMs)).toEqual([...plan.map((step) => step.atMs)].sort((a, b) => a - b));
      expect(plan.filter((step) => step.resultVisible)).toHaveLength(1);
      expect(plan.at(-1)?.resultVisible).toBe(true);
      expect(plan.at(-1)?.dealerCards).toBe(count);
      expect(plan.every((step) => step.holeUp)).toBe(true);
    }
  });

  it('never shows fewer than the dealer two opening cards', () => {
    expect(revealPlan(0, 0).at(-1)?.dealerCards).toBe(2);
    expect(revealPlan(1, 0).at(-1)?.dealerCards).toBe(2);
  });

  it('waits longer after a deal that ended at once, so the dealing animation can finish', () => {
    expect(startDelayFor('betting')).toBe(AFTER_DEAL_DELAY_MS);
    expect(startDelayFor('player')).toBe(BEFORE_FLIP_DELAY_MS);
    expect(AFTER_DEAL_DELAY_MS).toBeGreaterThan(BEFORE_FLIP_DELAY_MS);
  });
});

describe('what the table shows at each step', () => {
  const dealer = cards('6H 10C 9S');

  it('keeps the hole card face down and the total hidden at the start', () => {
    expect(dealerCardsAt(dealer, OPENING_STEP)).toEqual([dealer[0], null]);
    expect(dealerTotalAt(dealer, OPENING_STEP)).toBeNull();
  });

  it('turns the hole card over and totals only the cards shown so far', () => {
    const flipped = { atMs: 0, dealerCards: 2, holeUp: true, resultVisible: false };
    expect(dealerCardsAt(dealer, flipped)).toEqual([dealer[0], dealer[1]]);
    expect(dealerTotalAt(dealer, flipped)).toBe(16);

    const drawn = { ...flipped, dealerCards: 3 };
    expect(dealerCardsAt(dealer, drawn)).toEqual(dealer);
    expect(dealerTotalAt(dealer, drawn)).toBe(25);
  });

  it('does not reveal a card the dealer has not been dealt yet', () => {
    expect(dealerCardsAt(dealer, { atMs: 0, dealerCards: 2, holeUp: true, resultVisible: false })).toHaveLength(2);
  });
});
