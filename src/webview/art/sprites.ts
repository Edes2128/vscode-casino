import { createGrid, fillRect, gridRows, outlineRect, setCell, stamp } from './grid';
import type { Palette } from './pixelRuns';

export interface Sprite {
  readonly rows: readonly string[];
  readonly palette: Palette;
}

const INK = '#14171d';
const WHITE = '#f2f0e8';
const RED = '#e94b4b';

// ---------------------------------------------------------------- logo die

export const DIE: Sprite = {
  rows: [
    '.LLLLLLLLLL.',
    'LRRRRRRRRRRD',
    'LRWWRRRRWWRD',
    'LRWWRRRRWWRD',
    'LRRRRRRRRRRD',
    'LRRRRWWRRRRD',
    'LRRRRWWRRRRD',
    'LRRRRRRRRRRD',
    'LRWWRRRRWWRD',
    'LRWWRRRRWWRD',
    'LRRRRRRRRRRD',
    '.DDDDDDDDDD.',
  ],
  palette: { L: '#ff7a7a', R: RED, D: '#a82f2f', W: WHITE },
};

/** The second die of the logo pair: a six. Shares the palette of `DIE`. */
export const DIE_SIX: Sprite = {
  rows: [
    '.LLLLLLLLLL.',
    'LRRRRRRRRRRD',
    'LRWWRRRRWWRD',
    'LRWWRRRRWWRD',
    'LRRRRRRRRRRD',
    'LRWWRRRRWWRD',
    'LRWWRRRRWWRD',
    'LRRRRRRRRRRD',
    'LRWWRRRRWWRD',
    'LRWWRRRRWWRD',
    'LRRRRRRRRRRD',
    '.DDDDDDDDDD.',
  ],
  palette: DIE.palette,
};

/** Four-point twinkle used over chips and the logo. */
export const SPARKLE: Sprite = {
  rows: ['..#..', '..#..', '#####', '..#..', '..#..'],
  palette: { '#': WHITE },
};

// ---------------------------------------------------------------- coffee cup

/** The yellow cup on the "Buy me chips" button. */
export const COFFEE: Sprite = {
  rows: [
    '..s..s....',
    '...s..s...',
    '.ooooooo..',
    '.oYYYYYooo',
    '.oYYYYYo.o',
    '.oYYYYYooo',
    '..oYYYYo..',
    '...oooo...',
  ],
  palette: { o: '#000000', Y: '#ffdd00', s: '#ffffff' },
};

// ---------------------------------------------------------------- coin

export const COIN: Sprite = {
  rows: [
    '..oooo..',
    '.oYhhYo.',
    'oYhYYYso',
    'oYhYYYso',
    'oYYYYYso',
    'oYYYYsso',
    '.osssso.',
    '..oooo..',
  ],
  palette: { o: '#8a5a12', Y: '#f5c451', h: '#ffe08a', s: '#c8962b' },
};

// ---------------------------------------------------------------- navigation icons (single colour)

/** Icons are drawn with `#` and take their colour from the surrounding text (`currentColor`). */
export const ICON_PALETTE: Palette = { '#': 'currentColor' };

export const HOME_ICON: readonly string[] = [
  '....##....',
  '...####...',
  '..######..',
  '.########.',
  '##########',
  '.########.',
  '.###..###.',
  '.###..###.',
  '.###..###.',
  '.###..###.',
];

/** Points at the hand being played. */
export const ARROW_DOWN: readonly string[] = ['#######', '.#####.', '..###..', '...#...'];

/** Three bars of rising height. */
export const STATS_ICON: readonly string[] = [
  '........##',
  '........##',
  '........##',
  '....##..##',
  '....##..##',
  '....##..##',
  '##..##..##',
  '##..##..##',
  '##..##..##',
  '##..##..##',
];

export const SETTINGS_ICON: readonly string[] = [
  '....##....',
  '.#.####.#.',
  '..######..',
  '.########.',
  '####..####',
  '####..####',
  '.########.',
  '..######..',
  '.#.####.#.',
  '....##....',
];

function buildCardsIcon(): string[] {
  const grid = createGrid(10, 10);
  outlineRect(grid, 0, 2, 7, 8, '#'); // the card behind
  fillRect(grid, 2, 0, 8, 9, '.'); // a gap so the front card reads as separate
  outlineRect(grid, 3, 0, 7, 8, '#');
  stamp(grid, 5, 2, ['#.#', '###', '.#.']); // heart
  return gridRows(grid);
}

function buildWheelIcon(): string[] {
  const size = 10;
  const rows: string[] = [];
  for (let y = 0; y < size; y += 1) {
    let row = '';
    for (let x = 0; x < size; x += 1) {
      const dx = x + 0.5 - size / 2;
      const dy = y + 0.5 - size / 2;
      const r = Math.hypot(dx, dy);
      const ring = r <= 5 && r > 3.6;
      const hub = r < 1.7;
      const spoke = r <= 5 && (Math.abs(dx) < 0.51 || Math.abs(dy) < 0.51);
      row += ring || hub || spoke ? '#' : '.';
    }
    rows.push(row);
  }
  return rows;
}

export const CARDS_ICON: readonly string[] = buildCardsIcon();
export const WHEEL_ICON: readonly string[] = buildWheelIcon();

// ---------------------------------------------------------------- playing cards

export type Suit = 'heart' | 'spade' | 'diamond';

const GLYPHS: Readonly<Record<Suit, readonly string[]>> = {
  heart: ['.#.#.', '#####', '#####', '.###.', '..#..'],
  spade: ['..#..', '.###.', '#####', '#####', '..#..'],
  diamond: ['..#..', '.###.', '#####', '.###.', '..#..'],
};

export const CARD_COLS = 11;
export const CARD_ROWS = 14;

export const CARD_PALETTE: Palette = {
  o: INK,
  w: WHITE,
  r: RED,
  k: '#20242c',
  p: RED,
  q: '#a82f2f',
};

function newCardGrid() {
  const grid = createGrid(CARD_COLS, CARD_ROWS);
  fillRect(grid, 0, 0, CARD_COLS, CARD_ROWS, 'o');
  fillRect(grid, 1, 1, CARD_COLS - 2, CARD_ROWS - 2, 'w');
  for (const [x, y] of [
    [0, 0],
    [CARD_COLS - 1, 0],
    [0, CARD_ROWS - 1],
    [CARD_COLS - 1, CARD_ROWS - 1],
  ] as const) {
    setCell(grid, x, y, '.');
  }
  return grid;
}

export function faceCardRows(suit: Suit): string[] {
  const grid = newCardGrid();
  const ink = suit === 'spade' ? 'k' : 'r';
  stamp(
    grid,
    3,
    5,
    GLYPHS[suit].map((row) => row.replaceAll('#', ink)),
  );
  setCell(grid, 2, 2, ink);
  setCell(grid, CARD_COLS - 3, CARD_ROWS - 3, ink);
  return gridRows(grid);
}

export function backCardRows(): string[] {
  const grid = newCardGrid();
  for (let y = 2; y < CARD_ROWS - 2; y += 1) {
    for (let x = 2; x < CARD_COLS - 2; x += 1) setCell(grid, x, y, (x + y) % 2 === 0 ? 'p' : 'q');
  }
  return gridRows(grid);
}

// ---------------------------------------------------------------- blackjack table

export const TABLE_COLS = 44;
export const TABLE_ROWS = 30;

export const TABLE_PALETTE: Palette = {
  w: '#6b4423',
  y: '#f5c451',
  f: '#174d36',
  g: '#1d6044',
};

/** Felt table seen from above, with a gold line and a wooden rail. */
export function tableRows(): string[] {
  const centreX = TABLE_COLS / 2;
  const centreY = 17;
  const radiusX = 21.5;
  const radiusY = 12.5;

  const rows: string[] = [];
  for (let y = 0; y < TABLE_ROWS; y += 1) {
    let row = '';
    for (let x = 0; x < TABLE_COLS; x += 1) {
      const d = Math.hypot((x + 0.5 - centreX) / radiusX, (y + 0.5 - centreY) / radiusY);
      if (d > 1) row += '.';
      else if (d > 0.9) row += 'w';
      else if (d > 0.82) row += 'y';
      else row += (x * 7 + y * 13) % 11 === 0 ? 'g' : 'f';
    }
    rows.push(row);
  }
  return rows;
}
