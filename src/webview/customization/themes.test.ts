import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COLOR_SLOTS, THEME_IDS, type ColorSlot, type CustomColors } from '../../casino/appearance';
import { contrastOfHex, MIN_TEXT_CONTRAST } from '../color';
import { appearanceAttributes, resolveAppearance } from './appearance';
import { DEFAULT_THEME, themeOf, THEMES } from './themes';

const HEX = /^#[0-9a-f]{6}$/;

describe('the themes', () => {
  it('are the eight of the brief, one per id, in order', () => {
    expect(THEMES.map((theme) => theme.id)).toEqual([...THEME_IDS]);
    expect(THEMES.map((theme) => theme.name)).toEqual([
      'Classic Casino',
      'Neon Arcade',
      'Retro 8-Bit',
      'Midnight Casino',
      'Blood Casino',
      'Cyber Casino',
      'Forest Casino',
      'Royal Casino',
    ]);
  });

  it('are different from each other: no two share a page and a table color', () => {
    const keys = THEMES.map((theme) => `${theme.tokens.bg}/${theme.tokens.felt}`);
    expect(new Set(keys).size).toBe(THEMES.length);
    const accents = THEMES.map((theme) => `${theme.tokens.neon}/${theme.tokens.gold}`);
    expect(new Set(accents).size).toBe(THEMES.length);
  });

  it('write every color as #rrggbb', () => {
    for (const theme of THEMES) {
      for (const [name, value] of Object.entries(theme.tokens)) expect(value, `${theme.id}.${name}`).toMatch(HEX);
    }
  });

  it('describe themselves for the picker', () => {
    for (const theme of THEMES) {
      expect(theme.name.length).toBeGreaterThan(3);
      expect(theme.blurb.length).toBeGreaterThan(10);
    }
  });

  it('fall back to the classic theme for an id it does not know', () => {
    expect(themeOf('classic')).toBe(DEFAULT_THEME);
    expect(themeOf('gone' as never)).toBe(DEFAULT_THEME);
  });

  it('keep the classic theme exactly what the stylesheet has always been', () => {
    const css = readFileSync(join(__dirname, '../styles/global.css'), 'utf8');
    const rootBlock = /:root\s*{([^}]*)}/.exec(css)?.[1] ?? '';
    const fromCss = (name: string): string | undefined => new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(rootBlock)?.[1]?.toLowerCase();
    const classic = themeOf('classic').tokens;
    expect(fromCss('c-bg')).toBe(classic.bg);
    expect(fromCss('c-bg-2')).toBe(classic.bg2);
    expect(fromCss('c-felt')).toBe(classic.felt);
    expect(fromCss('c-neon')).toBe(classic.neon);
    expect(fromCss('c-gold')).toBe(classic.gold);
    expect(fromCss('c-red')).toBe(classic.red);
    expect(fromCss('c-red-text')).toBe(classic.redText);
    expect(fromCss('c-card-red')).toBe(classic.cardRed);
    expect(fromCss('c-white')).toBe(classic.white);
    expect(fromCss('c-muted')).toBe(classic.muted);
  });
});

describe.each(THEMES)('readability of $name', ({ id }) => {
  const { tokens } = resolveAppearance(id);
  const read = (foreground: string, background: string): number => contrastOfHex(foreground, background);

  it('has main text of at least 4.5 to 1 on the page, the panels and the table', () => {
    for (const surface of [tokens.bg, tokens.bg2, tokens.felt]) expect(read(tokens.white, surface), `white on ${surface}`).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it('has secondary text and amounts readable on the table too', () => {
    for (const ink of [tokens.muted, tokens.gold, tokens.redText]) expect(read(ink, tokens.felt), `${ink} on the table`).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it('has secondary text, accents and amounts readable on the page and the panels', () => {
    for (const surface of [tokens.bg, tokens.bg2]) {
      expect(read(tokens.muted, surface), `muted on ${surface}`).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
      expect(read(tokens.neon, surface), `accent on ${surface}`).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
      expect(read(tokens.gold, surface), `gold on ${surface}`).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    }
    expect(read(tokens.redText, tokens.bg)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it('has readable labels on buttons and red suits on a card', () => {
    expect(read(tokens.buttonText, tokens.button)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    expect(read(tokens.cardRed, '#f2f0e8')).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it('keeps the table apart from the page', () => {
    expect(read(tokens.felt, tokens.bg)).toBeGreaterThan(1.15);
  });

  it('is shown as it was designed: the readability pass changes nothing in a theme that is already readable', () => {
    const designed = themeOf(id).tokens;
    expect(tokens.white).toBe(designed.white);
    expect(tokens.muted).toBe(designed.muted);
    expect(tokens.neon).toBe(designed.neon);
    expect(tokens.gold).toBe(designed.gold);
    expect(tokens.felt).toBe(designed.felt);
  });
});

describe('resolving the appearance', () => {
  it('produces a CSS variable for every color and says nothing is adjusted without custom colors', () => {
    const resolved = resolveAppearance('classic');
    expect(resolved.adjusted).toEqual([]);
    for (const [name, value] of Object.entries(resolved.vars)) {
      expect(name).toMatch(/^--c-/);
      expect(value).toMatch(/^#[0-9a-f]{6}$|^transparent$/);
    }
    expect(resolved.vars['--c-bg']).toBe('#101216');
    expect(resolved.vars['--c-chip']).toBe('transparent'); // classic chips keep their own colors
  });

  it('describes the theme for the stylesheets', () => {
    expect(appearanceAttributes(resolveAppearance('neon'))).toEqual({ 'data-theme': 'neon', 'data-pattern': 'grid', 'data-glow': 'on' });
    expect(appearanceAttributes(resolveAppearance('royal'))['data-glow']).toBe('off');
  });

  it('lets every color slot take effect', () => {
    const chosen: Record<ColorSlot, string> = {
      table: '#224466',
      background: '#0a0a1e',
      accent: '#ff8800',
      button: '#2255cc',
      text: '#ffffff',
      chip: '#ff00aa',
    };
    const { tokens } = resolveAppearance('classic', chosen);
    expect(tokens.felt).toBe('#224466');
    expect(tokens.bg).toBe('#0a0a1e');
    expect(tokens.neon).toBe('#ff8800');
    expect(tokens.button).toBe('#2255cc');
    expect(tokens.white).toBe('#ffffff');
    expect(tokens.chip).toBe('#ff00aa');
  });

  it('lets secondary text follow a picked text color, and stay the theme\'s own otherwise', () => {
    const own = resolveAppearance('classic').tokens;
    const yellow = resolveAppearance('classic', { text: '#ffd000' }).tokens;
    expect(yellow.white).toBe('#ffd000');
    expect(yellow.muted).not.toBe(own.muted);
    expect(contrastOfHex(yellow.muted, yellow.bg2)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    // It leans toward the picked color: more red than blue, as yellow is.
    const channels = (hex: string): number[] => [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16));
    const [red, , blue] = channels(yellow.muted) as [number, number, number];
    expect(red).toBeGreaterThan(blue);
    expect(resolveAppearance('classic', { table: '#224466' }).tokens.muted).toBe(own.muted);
  });

  it('lets a color be set on top of any theme without disturbing the others', () => {
    for (const theme of THEMES) {
      const base = resolveAppearance(theme.id).tokens;
      const changed = resolveAppearance(theme.id, { table: '#202040' }).tokens;
      expect(changed.felt).toBe('#202040');
      expect(changed.bg).toBe(base.bg);
      expect(changed.neon).toBe(base.neon);
      expect(changed.button).toBe(base.button);
    }
  });

  it('keeps text readable whatever colors are picked, and says which pick it had to adjust', () => {
    // Dark grey text on a dark page: not readable as picked.
    const resolved = resolveAppearance('classic', { text: '#222222', accent: '#101010', table: '#ffffff' });
    expect([...resolved.adjusted].sort()).toEqual(['accent', 'table', 'text']);
    for (const surface of [resolved.tokens.bg, resolved.tokens.bg2, resolved.tokens.felt]) {
      expect(contrastOfHex(resolved.tokens.white, surface)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    }
    expect(contrastOfHex(resolved.tokens.neon, resolved.tokens.bg)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it('flips the text for a light page rather than leaving it unreadable', () => {
    const resolved = resolveAppearance('classic', { background: '#f4f4f4', table: '#d8e8d8' });
    for (const surface of [resolved.tokens.bg, resolved.tokens.bg2, resolved.tokens.felt]) {
      expect(contrastOfHex(resolved.tokens.white, surface)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
      expect(contrastOfHex(resolved.tokens.muted, resolved.tokens.bg)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    }
  });

  it('keeps every theme readable under a spread of extreme picks (no combination is unreadable)', () => {
    const extremes = ['#000000', '#ffffff', '#808080', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#7f7f7f', '#123456'];
    for (const theme of THEMES) {
      for (const background of extremes) {
        for (const text of extremes) {
          for (const table of ['#000000', '#ffffff', '#336633']) {
            const colors: CustomColors = { background, text, table };
            const { tokens } = resolveAppearance(theme.id, colors);
            for (const surface of [tokens.bg, tokens.bg2, tokens.felt]) {
              expect(contrastOfHex(tokens.white, surface), `${theme.id} ${JSON.stringify(colors)} text on ${surface}`).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST - 0.001);
            }
            for (const ink of [tokens.muted, tokens.gold]) {
              expect(contrastOfHex(ink, tokens.felt), `${theme.id} ${JSON.stringify(colors)} ${ink} on the table`).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST - 0.001);
            }
            for (const surface of [tokens.bg, tokens.bg2]) {
              expect(contrastOfHex(tokens.muted, surface), `${theme.id} ${JSON.stringify(colors)} muted on ${surface}`).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST - 0.001);
              expect(contrastOfHex(tokens.neon, surface)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST - 0.001);
              expect(contrastOfHex(tokens.gold, surface)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST - 0.001);
            }
            expect(contrastOfHex(tokens.buttonText, tokens.button)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST - 0.001);
          }
        }
      }
    }
  });

  it('covers every color slot of the settings', () => {
    expect(COLOR_SLOTS).toHaveLength(6);
  });
});
