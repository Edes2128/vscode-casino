import type { Card, Rank } from './types';

export const BLACKJACK = 21;

export interface Score {
  /** The best total that does not bust, or the lowest possible total when every option busts. */
  readonly total: number;
  /** An ace is currently counting as 11, so the hand cannot bust on the next card. */
  readonly soft: boolean;
}

/** Face cards count 10 and an ace starts as 11 (see `scoreHand` for when it drops to 1). */
function baseValue(rank: Rank): number {
  if (rank === 'A') return 11;
  if (rank === 'J' || rank === 'Q' || rank === 'K') return 10;
  return Number(rank);
}

/**
 * Totals a hand. Aces count as 11 unless that would bust, in which case they count as 1, one
 * ace at a time, so only as many aces as needed are demoted.
 */
export function scoreHand(cards: readonly Card[]): Score {
  let total = 0;
  let softAces = 0;
  for (const card of cards) {
    total += baseValue(card.rank);
    if (card.rank === 'A') softAces += 1;
  }
  while (total > BLACKJACK && softAces > 0) {
    total -= 10;
    softAces -= 1;
  }
  return { total, soft: softAces > 0 };
}

/** Two cards totalling 21. (Whether it is a natural also depends on the hand not coming from a split.) */
export const isBlackjack = (cards: readonly Card[]): boolean =>
  cards.length === 2 && scoreHand(cards).total === BLACKJACK;

export const isBust = (cards: readonly Card[]): boolean => scoreHand(cards).total > BLACKJACK;

/**
 * A splittable pair: two cards of the same VALUE, as at a real table. Any two ten-value cards qualify
 * (10, J, Q and K are all worth 10), as do two aces, and so do two 8s. An ace and a king do not.
 */
export const isPair = (cards: readonly Card[]): boolean => {
  const [first, second] = cards;
  return cards.length === 2 && first !== undefined && second !== undefined && baseValue(first.rank) === baseValue(second.rank);
};
