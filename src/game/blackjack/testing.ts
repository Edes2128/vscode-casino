import { RANKS, SUITS, type Card, type Rank, type Suit } from './types';

const SUIT_LETTERS: Readonly<Record<string, Suit>> = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' };

/**
 * Builds a deck in an exact order from text, for stacking tests: `cards('AS KH 10D 5C')`.
 * Each card is a rank followed by a suit letter (S, H, D, C). Drawing takes cards left to right.
 */
export function cards(spec: string): Card[] {
  return spec
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .map((token) => {
      const rank = token.slice(0, -1) as Rank;
      const suit = SUIT_LETTERS[token.slice(-1)];
      if (!RANKS.includes(rank) || suit === undefined || !SUITS.includes(suit)) {
        throw new Error(`Bad card "${token}"`);
      }
      return { rank, suit };
    });
}
