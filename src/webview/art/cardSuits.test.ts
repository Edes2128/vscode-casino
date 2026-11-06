import { describe, expect, it } from 'vitest';
import { CARD_DESIGN_IDS } from '../../state/appearance';
import { SUITS } from '../../game/blackjack/types';
import { CARD_GLYPH_PALETTE, CARD_GLYPHS, glyphsOf, type SuitRows } from './cardSuits';
import { spriteRects } from './pixelRuns';
import { SUIT_GLYPHS } from './suits';

const parts = ['mini', 'centre'] as const;

/** Every character a sprite draws must have a colour, or the pixel silently vanishes. */
const characters = (rows: readonly string[]): string[] => [...new Set(rows.join('').replaceAll('.', ''))];

describe.each(CARD_DESIGN_IDS)('the %s suit art', (design) => {
  const glyphs = glyphsOf(design);

  it('has all four suits for the corner and for the centre', () => {
    for (const part of parts) {
      for (const suit of SUITS) expect(glyphs[part][suit].length, `${part} ${suit}`).toBeGreaterThan(3);
    }
  });

  it('is made of rectangular bitmaps that fit the corner index and the card: no larger than 8 by 8 cells', () => {
    for (const part of parts) {
      for (const suit of SUITS) {
        const rows = glyphs[part][suit];
        const width = rows[0]?.length ?? 0;
        expect(rows.every((row) => row.length === width), `${part} ${suit}: row widths`).toBe(true);
        expect(width, `${part} ${suit}: width`).toBeLessThanOrEqual(8);
        expect(rows.length, `${part} ${suit}: height`).toBeLessThanOrEqual(8);
      }
    }
  });

  it('colors every character it draws, and `#` is always the suit ink', () => {
    expect(glyphs.palette['#']).toBe('currentColor');
    for (const part of parts) {
      for (const suit of SUITS) {
        const missing = characters(glyphs[part][suit]).filter((char) => glyphs.palette[char] === undefined);
        expect(missing, `${part} ${suit}`).toEqual([]);
        expect(spriteRects(glyphs[part][suit], glyphs.palette).length, `${part} ${suit}: something is drawn`).toBeGreaterThan(0);
      }
    }
  });

  it('has four different shapes, so the suits are not told apart by color alone', () => {
    for (const part of parts) {
      const shapes = SUITS.map((suit) => glyphs[part][suit].join('/'));
      expect(new Set(shapes).size, part).toBe(SUITS.length);
      // Each suit differs from every other by more than an accent pixel: compare the ink alone.
      const ink = SUITS.map((suit) => glyphs[part][suit].map((row) => row.replace(/[^.]/g, '#')).join('/'));
      expect(new Set(ink).size, `${part}: silhouettes`).toBe(SUITS.length);
    }
  });

  it('keeps the black suits looking different from the red ones in silhouette', () => {
    const silhouette = (rows: readonly string[]): string => rows.map((row) => row.replace(/[^.]/g, '#')).join('/');
    const red = ['hearts', 'diamonds'] as const;
    const black = ['spades', 'clubs'] as const;
    for (const a of red) for (const b of black) expect(silhouette(glyphs.centre[a]), `${a} vs ${b}`).not.toBe(silhouette(glyphs.centre[b]));
  });
});

describe('the classic art', () => {
  it('is the original suits, the very same objects', () => {
    expect(CARD_GLYPHS.classic.mini).toBe(SUIT_GLYPHS);
    expect(CARD_GLYPHS.classic.centre).toBe(SUIT_GLYPHS);
  });
});

describe('the other designs', () => {
  const others = CARD_DESIGN_IDS.filter((id) => id !== 'classic');
  const centre = (id: (typeof CARD_DESIGN_IDS)[number]): string => SUITS.map((suit) => CARD_GLYPHS[id].centre[suit].join('/')).join('|');

  it('each draw their centre suits their own way, different from the classic ones and from each other', () => {
    const drawn = [centre('classic'), ...others.map(centre)];
    expect(new Set(drawn).size).toBe(CARD_DESIGN_IDS.length);
  });

  it('neon puts a hot core in every suit, inside a rim that is one pixel thick', () => {
    for (const suit of SUITS) {
      const rows = CARD_GLYPHS.neon.centre[suit];
      expect(rows.join(''), suit).toContain('w');
      rows.forEach((row, y) =>
        [...row].forEach((char, x) => {
          if (char !== 'w') return;
          // A core pixel is never on the edge: it has ink or core on all four sides.
          for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]] as const) expect('#w', `${suit} ${x},${y}`).toContain(rows[y + dy]?.charAt(x + dx) || '.');
        }),
      );
    }
  });

  it('medieval sets one gem in the middle of every suit', () => {
    for (const suit of SUITS) {
      for (const part of parts) expect(CARD_GLYPHS.medieval[part][suit].join('').split('g').length - 1, `${part} ${suit}`).toBe(1);
    }
  });

  it('dark edges only the centre suit in gold, and leaves the corner suits plain', () => {
    expect(CARD_GLYPHS.dark.mini).toBe(SUIT_GLYPHS);
    for (const suit of SUITS) {
      const rows = CARD_GLYPHS.dark.centre[suit];
      expect(rows.join(''), suit).toContain('o');
      // The suit itself is whole: every ink pixel of the classic suit is still there, where it was.
      SUIT_GLYPHS[suit].forEach((row, y) => [...row].forEach((char, x) => expect(rows[y]?.charAt(x) === '#', `${suit} ${x},${y}`).toBe(char === '#')));
    }
  });

  it('retro is chunkier: eight cells wide, with a shine pixel', () => {
    for (const suit of SUITS) {
      expect(CARD_GLYPHS.retro.centre[suit][0]?.length, suit).toBe(8);
      expect(CARD_GLYPHS.retro.centre[suit].join(''), suit).toContain('h');
    }
  });

  it('minimal is smaller and plain: five cells wide, ink only', () => {
    for (const suit of SUITS) {
      const rows = CARD_GLYPHS.minimal.centre[suit];
      expect(rows[0]?.length, suit).toBe(5);
      expect(characters(rows), suit).toEqual(['#']);
    }
  });

  it('use the shared palette, whose accents are fixed colors and whose ink follows the card', () => {
    for (const id of others) expect(CARD_GLYPHS[id].palette).toBe(CARD_GLYPH_PALETTE);
    for (const [char, color] of Object.entries(CARD_GLYPH_PALETTE)) {
      if (char !== '#') expect(color, char).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('share one set of rows between the corner and the centre where they draw the same thing', () => {
    const same = (rows: SuitRows, other: SuitRows): boolean => rows === other;
    for (const id of ['retro', 'neon', 'medieval', 'minimal'] as const) expect(same(CARD_GLYPHS[id].mini, CARD_GLYPHS[id].centre), id).toBe(true);
  });
});
