import { shuffled, type Rng } from '../rng';
import { RANKS, SUITS, type Card } from './types';

/** A standard 52-card deck in a fixed order. */
export function createDeck(): Card[] {
  return SUITS.flatMap((suit) => RANKS.map((rank) => ({ rank, suit })));
}

/** A freshly shuffled standard deck. */
export function createShuffledDeck(rng: Rng): Card[] {
  return shuffled(createDeck(), rng);
}
