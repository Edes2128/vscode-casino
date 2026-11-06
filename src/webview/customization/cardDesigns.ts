import type { CardDesignId } from '../../state/appearance';

/**
 * What a card design is made of, as data: the colors that matter for reading a card. A card is a physical object,
 * so a design brings its own paper and its own inks and does not follow the theme (the Classic Pixel face is the
 * one exception: it has always followed the theme's white and card red, and the values here are the classic
 * theme's). `cards.css` draws the same colors as `--card-*` custom properties on `.playing-card[data-design]`,
 * and `cardDesigns.test.ts` checks the two agree and that every ink reads on its paper.
 */
export interface CardDesign {
  readonly id: CardDesignId;
  readonly name: string;
  /** One line under the name in the picker. */
  readonly blurb: string;
  /** The paper of the front. */
  readonly face: string;
  /** Rank and suit of the black suits, and the corner indexes. */
  readonly ink: string;
  /** Rank and suit of hearts and diamonds. */
  readonly redInk: string;
  /** The ground of the back. */
  readonly back: string;
  /** The pattern drawn on the back. */
  readonly backAccent: string;
  /** The border of the back. */
  readonly backEdge: string;
}

/** The six designs, in the order the picker shows them. All are free. */
export const CARD_DESIGNS: readonly CardDesign[] = [
  {
    id: 'classic',
    name: 'Classic Pixel',
    blurb: 'Cream cards, red checkered back.',
    face: '#f2f0e8',
    ink: '#20242c',
    redInk: '#c4242b',
    back: '#e94b4b',
    backAccent: '#a82f2f',
    backEdge: '#f2f0e8',
  },
  {
    id: 'retro',
    name: 'Retro 8-Bit',
    blurb: 'Chunky suits, notched corners, blue dither.',
    face: '#fcfcfc',
    ink: '#101010',
    redInk: '#c40000',
    back: '#0058f8',
    backAccent: '#3cbcfc',
    backEdge: '#fcfcfc',
  },
  {
    id: 'neon',
    name: 'Neon',
    blurb: 'Glowing tubes on a dark grid.',
    face: '#0c0a24',
    ink: '#5ff4ff',
    redInk: '#ff6ec7',
    back: '#220a4a',
    backAccent: '#ff6ec7',
    backEdge: '#5ff4ff',
  },
  {
    id: 'medieval',
    name: 'Medieval Fantasy',
    blurb: 'Parchment, bronze trim, jeweled suits.',
    face: '#ead9ae',
    ink: '#2a1a0c',
    redInk: '#8e1b1b',
    back: '#5a1428',
    backAccent: '#d9a93f',
    backEdge: '#d9a93f',
  },
  {
    id: 'minimal',
    name: 'Minimal Pixel',
    blurb: 'Flat white, thin lines, small suits.',
    face: '#ffffff',
    ink: '#1c1c1c',
    redInk: '#c0262d',
    back: '#2b3340',
    backAccent: '#8fa3b8',
    backEdge: '#ffffff',
  },
  {
    id: 'dark',
    name: 'Dark Deck',
    blurb: 'Black cards, gold leaf, a red diamond.',
    face: '#17171c',
    ink: '#e9e2d0',
    redInk: '#ff6b6b',
    back: '#0e0e12',
    backAccent: '#c9a24b',
    backEdge: '#c9a24b',
  },
];

export const DEFAULT_CARD_DESIGN: CardDesign = CARD_DESIGNS[0] as CardDesign;

/** The design with this id. An id that is not a design gets the classic one rather than nothing. */
export const cardDesignOf = (id: CardDesignId): CardDesign => CARD_DESIGNS.find((design) => design.id === id) ?? DEFAULT_CARD_DESIGN;
