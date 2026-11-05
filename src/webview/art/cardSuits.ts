import type { CardDesignId } from '../../casino/appearance';
import type { Suit } from '../../game/blackjack/types';
import type { Palette } from './pixelRuns';
import { SUIT_GLYPHS, SUIT_PALETTE } from './suits';

/** The four suits of one set, as rows of an ASCII bitmap (see `PixelSprite`). */
export type SuitRows = Readonly<Record<Suit, readonly string[]>>;

/**
 * The suit art of one card design. `mini` is the small suit under the rank in the corner, `centre` the big one in
 * the middle of the card. `#` is always the suit's own ink (`currentColor`, so red and black suits share the art);
 * any other character is a fixed accent that `palette` colors.
 */
export interface CardGlyphs {
  readonly mini: SuitRows;
  readonly centre: SuitRows;
  readonly palette: Palette;
}

const mapSuits = (make: (suit: Suit) => readonly string[]): SuitRows => ({
  spades: make('spades'),
  hearts: make('hearts'),
  diamonds: make('diamonds'),
  clubs: make('clubs'),
});

const filled = (rows: readonly string[], x: number, y: number): boolean => rows[y]?.charAt(x) === '#';

/**
 * Neon: the classic suits with a hot white core, the way a lit glass tube is brightest in the middle. A pixel
 * becomes core when all eight of its neighbours are filled, so the colored rim stays one pixel thick. The club is
 * too thin for that anywhere, so it counts the four neighbours that touch it, which still leaves a rim.
 */
const lit = (rows: readonly string[]): readonly string[] => {
  const core = (reach: readonly (readonly [number, number])[]): readonly string[] =>
    rows.map((row, y) =>
      [...row].map((char, x) => (char === '#' && reach.every(([dx, dy]) => filled(rows, x + dx, y + dy)) ? 'w' : char)).join(''),
    );
  const around = [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => [dx, dy] as const));
  const touching = [[0, -1], [-1, 0], [1, 0], [0, 1]] as const;
  const full = core(around);
  return full.some((row) => row.includes('w')) ? full : core(touching);
};

/**
 * Dark Casino: the classic suit with a gold edge along its lower right, one cell deep, like gold leaf on a
 * pressed card. The suit itself stays whole, so its shape reads as clearly as the classic one.
 */
const gilded = (rows: readonly string[]): readonly string[] => {
  const width = (rows[0]?.length ?? 0) + 1;
  const out: string[] = [];
  for (let y = 0; y <= rows.length; y += 1) {
    let line = '';
    for (let x = 0; x < width; x += 1) {
      if (filled(rows, x, y)) line += '#';
      else if (filled(rows, x - 1, y) || filled(rows, x, y - 1) || filled(rows, x - 1, y - 1)) line += 'o';
      else line += '.';
    }
    out.push(line);
  }
  return out;
};

/** Medieval Fantasy: the classic suit with a gold gem set in its middle, like an illuminated capital. */
const jewelled = (rows: readonly string[]): readonly string[] =>
  rows.map((row, y) => (y === 3 && row.charAt(3) === '#' ? `${row.slice(0, 3)}g${row.slice(4)}` : row));

/** Retro 8-Bit: chunkier, eight cells wide, with one white shine pixel as on a sprite. */
const RETRO: SuitRows = {
  hearts: ['.##..##.', '#hh#####', '########', '########', '.######.', '..####..', '...##...'],
  diamonds: ['...##...', '..####..', '.#h####.', '########', '.######.', '..####..', '...##...'],
  spades: ['...##...', '..####..', '.######.', '#h######', '########', '...##...', '..####..'],
  clubs: ['..####..', '..#h##..', '.#.##.#.', '########', '########', '...##...', '..####..'],
};

/** Minimal Pixel: five cells wide and plain, the suit and nothing else. */
const MINIMAL: SuitRows = {
  hearts: ['.#.#.', '#####', '#####', '#####', '.###.', '..#..'],
  diamonds: ['..#..', '.###.', '#####', '#####', '.###.', '..#..'],
  spades: ['..#..', '.###.', '#####', '#####', '..#..', '.###.'],
  clubs: ['..#..', '.###.', '#.#.#', '#####', '..#..', '.###.'],
};

/** Every character any set draws, with its color. `#` follows the card's ink; the others are accents. */
export const CARD_GLYPH_PALETTE: Palette = {
  ...SUIT_PALETTE,
  w: '#ffffff',
  o: '#c9a24b',
  g: '#e8c35a',
  h: '#ffffff',
};

const classic: CardGlyphs = { mini: SUIT_GLYPHS, centre: SUIT_GLYPHS, palette: SUIT_PALETTE };
const NEON = mapSuits((suit) => lit(SUIT_GLYPHS[suit]));
const MEDIEVAL = mapSuits((suit) => jewelled(SUIT_GLYPHS[suit]));
const GILDED = mapSuits((suit) => gilded(SUIT_GLYPHS[suit]));

/** One glyph set per design. Classic is the original art, untouched. */
export const CARD_GLYPHS: Readonly<Record<CardDesignId, CardGlyphs>> = {
  classic,
  retro: { mini: RETRO, centre: RETRO, palette: CARD_GLYPH_PALETTE },
  neon: { mini: NEON, centre: NEON, palette: CARD_GLYPH_PALETTE },
  medieval: { mini: MEDIEVAL, centre: MEDIEVAL, palette: CARD_GLYPH_PALETTE },
  minimal: { mini: MINIMAL, centre: MINIMAL, palette: CARD_GLYPH_PALETTE },
  dark: { mini: SUIT_GLYPHS, centre: GILDED, palette: CARD_GLYPH_PALETTE },
};

export const glyphsOf = (design: CardDesignId): CardGlyphs => CARD_GLYPHS[design];
