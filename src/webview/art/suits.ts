import type { Suit } from '../../game/blackjack/types';
import type { Palette } from './pixelRuns';

/** 7x7 pixel suits, drawn with `#` and coloured by the surrounding text (`currentColor`). */
export const SUIT_GLYPHS: Readonly<Record<Suit, readonly string[]>> = {
  hearts: ['.##.##.', '#######', '#######', '#######', '.#####.', '..###..', '...#...'],
  diamonds: ['...#...', '..###..', '.#####.', '#######', '.#####.', '..###..', '...#...'],
  spades: ['...#...', '..###..', '.#####.', '#######', '#######', '...#...', '..###..'],
  clubs: ['...#...', '..###..', '...#...', '.#.#.#.', '#######', '.#.#.#.', '..###..'],
};

export const SUIT_PALETTE: Palette = { '#': 'currentColor' };

export const isRedSuit = (suit: Suit): boolean => suit === 'hearts' || suit === 'diamonds';
