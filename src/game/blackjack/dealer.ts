import { scoreHand } from './scoring';
import type { Card } from './types';

/** The dealer must draw to 16 and stand on every 17, soft 17 included. */
export const DEALER_STANDS_ON = 17;

export const dealerMustDraw = (cards: readonly Card[]): boolean => scoreHand(cards).total < DEALER_STANDS_ON;

/** Plays out the dealer's hand from the top of `deck`. Returns the finished hand and the deck left over. */
export function playDealer(
  dealer: readonly Card[],
  deck: readonly Card[],
): { readonly dealer: readonly Card[]; readonly deck: readonly Card[] } {
  let hand = dealer;
  let rest = deck;
  while (dealerMustDraw(hand)) {
    const card = rest[0];
    if (card === undefined) throw new Error('The deck ran out while the dealer was drawing');
    hand = [...hand, card];
    rest = rest.slice(1);
  }
  return { dealer: hand, deck: rest };
}
