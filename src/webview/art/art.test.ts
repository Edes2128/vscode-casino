import { describe, expect, it } from 'vitest';
import { CHIP_VALUES } from '../../casino/chips';
import { CHIP_PALETTES, CHIP_ROWS_LARGE, CHIP_ROWS_SMALL, chipRows, GOLD_CHIP_PALETTE } from './chip';
import { spriteRects, type Palette } from './pixelRuns';
import {
  backCardRows,
  CARD_COLS,
  CARD_PALETTE,
  CARD_ROWS,
  CARDS_ICON,
  COIN,
  DIE,
  DIE_SIX,
  faceCardRows,
  HOME_ICON,
  ICON_PALETTE,
  SPARKLE,
  TABLE_COLS,
  TABLE_PALETTE,
  TABLE_ROWS,
  tableRows,
  WHEEL_ICON,
} from './sprites';
import { isRedSuit, SUIT_GLYPHS, SUIT_PALETTE } from './suits';
import { WHEEL_FRAMES, WHEEL_PALETTE, WHEEL_SIZE, wheelFrameRows } from './wheel';

/** Every character a sprite draws must have a colour; a typo would silently vanish. */
function expectPaletteCovers(rows: readonly string[], palette: Palette, name: string): void {
  const missing = new Set<string>();
  for (const row of rows) {
    for (const char of row) {
      if (char !== '.' && palette[char] === undefined) missing.add(char);
    }
  }
  expect([...missing], `${name}: characters without a colour`).toEqual([]);
}

function expectRectangular(rows: readonly string[], width: number, height: number, name: string): void {
  expect(rows, `${name}: height`).toHaveLength(height);
  for (const row of rows) expect(row, `${name}: row width`).toHaveLength(width);
}

describe('spriteRects', () => {
  it('merges horizontal runs of one colour and skips transparent cells', () => {
    const rects = spriteRects(['..AABA', 'AAAA..'], { A: '#111111', B: '#222222' });
    expect(rects).toEqual([
      { x: 2, y: 0, width: 2, fill: '#111111' },
      { x: 4, y: 0, width: 1, fill: '#222222' },
      { x: 5, y: 0, width: 1, fill: '#111111' },
      { x: 0, y: 1, width: 4, fill: '#111111' },
    ]);
  });

  it('treats characters missing from the palette as transparent', () => {
    expect(spriteRects(['AxA'], { A: '#111111' })).toEqual([
      { x: 0, y: 0, width: 1, fill: '#111111' },
      { x: 2, y: 0, width: 1, fill: '#111111' },
    ]);
  });
});

describe('chips', () => {
  it('draws round, symmetric discs', () => {
    for (const rows of [CHIP_ROWS_LARGE, CHIP_ROWS_SMALL]) {
      const size = rows.length;
      expectRectangular(rows, size, size, 'chip');
      rows.forEach((row, y) => {
        expect(row, 'left/right symmetry').toBe([...row].reverse().join(''));
        expect(row, 'top/bottom symmetry').toBe(rows[size - 1 - y]);
      });
      expect(rows[0]?.charAt(0)).toBe('.'); // corners are transparent
    }
  });

  it('has an outline, edge stripes and a face', () => {
    const all = CHIP_ROWS_LARGE.join('');
    for (const part of ['o', 'a', 'b', 'd', 'c']) expect(all).toContain(part);
  });

  it('colours every character for every denomination', () => {
    for (const value of CHIP_VALUES) {
      expectPaletteCovers(CHIP_ROWS_LARGE, CHIP_PALETTES[value], `chip ${value} large`);
      expectPaletteCovers(CHIP_ROWS_SMALL, CHIP_PALETTES[value], `chip ${value} small`);
    }
    expectPaletteCovers(CHIP_ROWS_LARGE, GOLD_CHIP_PALETTE, 'gold chip');
  });

  it('scales to other diameters', () => {
    expectRectangular(chipRows(21, true), 21, 21, 'chip 21');
  });
});

describe('sprites', () => {
  it('are rectangular and fully coloured', () => {
    const cases: ReadonlyArray<readonly [string, readonly string[], Palette, number, number]> = [
      ['die', DIE.rows, DIE.palette, 12, 12],
      ['die six', DIE_SIX.rows, DIE_SIX.palette, 12, 12],
      ['coin', COIN.rows, COIN.palette, 8, 8],
      ['sparkle', SPARKLE.rows, SPARKLE.palette, 5, 5],
      ['home icon', HOME_ICON, ICON_PALETTE, 10, 10],
      ['cards icon', CARDS_ICON, ICON_PALETTE, 10, 10],
      ['wheel icon', WHEEL_ICON, ICON_PALETTE, 10, 10],
      ['table', tableRows(), TABLE_PALETTE, TABLE_COLS, TABLE_ROWS],
      ['card back', backCardRows(), CARD_PALETTE, CARD_COLS, CARD_ROWS],
      ['spade card', faceCardRows('spade'), CARD_PALETTE, CARD_COLS, CARD_ROWS],
      ['heart card', faceCardRows('heart'), CARD_PALETTE, CARD_COLS, CARD_ROWS],
      ['diamond card', faceCardRows('diamond'), CARD_PALETTE, CARD_COLS, CARD_ROWS],
    ];

    for (const [name, rows, palette, width, height] of cases) {
      expectRectangular(rows, width, height, name);
      expectPaletteCovers(rows, palette, name);
    }
  });

  it('shows red suits in red and spades in black', () => {
    expect(faceCardRows('heart').join('')).toContain('r');
    expect(faceCardRows('diamond').join('')).toContain('r');
    expect(faceCardRows('spade').join('')).not.toContain('r');
    expect(faceCardRows('spade').join('')).toContain('k');
  });

  it('gives the two dice different pips', () => {
    expect(DIE.rows).not.toEqual(DIE_SIX.rows);
  });
});

describe('roulette wheel frames', () => {
  const frame0 = wheelFrameRows(0);

  it('is a transparent-cornered square, fully coloured', () => {
    expectRectangular(frame0, WHEEL_SIZE, WHEEL_SIZE, 'wheel');
    expectPaletteCovers(frame0, WHEEL_PALETTE, 'wheel');
    expect(frame0[0]?.charAt(0)).toBe('.');
    expect(frame0[WHEEL_SIZE - 1]?.charAt(WHEEL_SIZE - 1)).toBe('.');
  });

  it('has a gold hub, red, black and green pockets and one ball', () => {
    const all = frame0.join('');
    for (const part of ['y', 'h', 'w', 'c', 'r', 'k', 'g']) expect(all).toContain(part);
    const ball = [...all].filter((char) => char === 'b').length;
    expect(ball).toBeGreaterThanOrEqual(3);
    expect(ball).toBeLessThanOrEqual(8);
  });

  it('is deterministic and different from frame to frame', () => {
    expect(wheelFrameRows(0)).toEqual(frame0);
    expect(wheelFrameRows(1)).not.toEqual(frame0);
    expect(wheelFrameRows(WHEEL_FRAMES / 2)).not.toEqual(frame0);
  });

  it('keeps the green pocket in a single place per frame', () => {
    const green = frame0.flatMap((row, y) => [...row].flatMap((char, x) => (char === 'g' ? [[x, y] as const] : [])));
    expect(green.length).toBeGreaterThan(8);
    const xs = green.map(([x]) => x);
    const ys = green.map(([, y]) => y);
    // One pocket is a compact blob, not scattered pixels.
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(10);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(10);
  });
});

describe('suits', () => {
  it('has a 7x7 glyph for each of the four suits, drawn in one colour', () => {
    expect(Object.keys(SUIT_GLYPHS).sort()).toEqual(['clubs', 'diamonds', 'hearts', 'spades']);
    for (const [suit, rows] of Object.entries(SUIT_GLYPHS)) {
      expectRectangular(rows, 7, 7, suit);
      expectPaletteCovers(rows, SUIT_PALETTE, suit);
    }
  });

  it('keeps every glyph mirror-symmetric, so a suit never leans to one side', () => {
    for (const [suit, rows] of Object.entries(SUIT_GLYPHS)) {
      for (const row of rows) expect(row, `${suit} row ${row}`).toBe([...row].reverse().join(''));
    }
  });

  it('gives the four suits four different shapes', () => {
    const shapes = new Set(Object.values(SUIT_GLYPHS).map((rows) => rows.join('/')));
    expect(shapes.size).toBe(4);
  });

  it('knows which suits are red', () => {
    expect(isRedSuit('hearts')).toBe(true);
    expect(isRedSuit('diamonds')).toBe(true);
    expect(isRedSuit('spades')).toBe(false);
    expect(isRedSuit('clubs')).toBe(false);
  });
});
