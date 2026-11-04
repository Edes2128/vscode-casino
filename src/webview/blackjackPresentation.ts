import { scoreHand } from '../game/blackjack/scoring';
import type { Card } from '../game/blackjack/types';
import type { TablePhase } from '../game/blackjack/view';

/**
 * How the screen plays out the end of a round. The host has already decided the result; this only
 * paces what the player sees: the hole card flips, the dealer's cards arrive one by one, and only
 * then is the result shown. Nothing here affects the outcome.
 */
export interface PresentationStep {
  /** When this step happens, in milliseconds after the round settled. */
  readonly atMs: number;
  /** How many of the dealer's cards are on the table. */
  readonly dealerCards: number;
  /** The hole card is face up. */
  readonly holeUp: boolean;
  /** The result banner, hand outcomes and updated balance may be shown. */
  readonly resultVisible: boolean;
}

/** Pause after a deal that settled at once (a natural), so the dealing animation can finish first. */
export const AFTER_DEAL_DELAY_MS = 1_100;
/** Pause before the hole card flips when the player ended their own turn. */
export const BEFORE_FLIP_DELAY_MS = 450;
export const DEALER_CARD_DELAY_MS = 750;
export const RESULT_DELAY_MS = 700;

/** What is on the table the moment a round settles, before the dealer starts playing. */
export const OPENING_STEP: PresentationStep = { atMs: 0, dealerCards: 2, holeUp: false, resultVisible: false };

export const startDelayFor = (previousPhase: TablePhase): number =>
  previousPhase === 'betting' ? AFTER_DEAL_DELAY_MS : BEFORE_FLIP_DELAY_MS;

/** The timeline for a dealer who ends up holding `dealerCardCount` cards. */
export function revealPlan(dealerCardCount: number, startDelayMs: number): readonly PresentationStep[] {
  const total = Math.max(2, dealerCardCount);
  const steps: PresentationStep[] = [{ atMs: startDelayMs, dealerCards: 2, holeUp: true, resultVisible: false }];

  let at = startDelayMs;
  for (let shown = 3; shown <= total; shown += 1) {
    at += DEALER_CARD_DELAY_MS;
    steps.push({ atMs: at, dealerCards: shown, holeUp: true, resultVisible: false });
  }
  steps.push({ atMs: at + RESULT_DELAY_MS, dealerCards: total, holeUp: true, resultVisible: true });
  return steps;
}

/** The dealer's cards as the table should draw them at this step. `null` is face down. */
export function dealerCardsAt(cards: readonly (Card | null)[], step: PresentationStep): (Card | null)[] {
  return cards.slice(0, step.dealerCards).map((card, index) => (index === 1 && !step.holeUp ? null : card));
}

/** The dealer's total as the table should show it at this step, or `null` while the hole card is down. */
export function dealerTotalAt(cards: readonly (Card | null)[], step: PresentationStep): number | null {
  if (!step.holeUp) return null;
  const shown = cards.slice(0, step.dealerCards).filter((card): card is Card => card !== null);
  return scoreHand(shown).total;
}
