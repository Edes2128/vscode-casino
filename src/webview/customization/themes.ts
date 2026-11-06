import type { ThemeId } from '../../state/appearance';

/**
 * Every color a theme sets. A theme is nothing but this table, so a new one is a new row, and the screens that
 * show themes (the picker, the previews, the contrast test) all read the same data.
 */
export interface ThemeTokens {
  /** The page. */
  readonly bg: string;
  /** Panels and cards that sit on the page. */
  readonly bg2: string;
  /** The table: the felt of the Blackjack table, the Roulette stage. */
  readonly felt: string;
  /** The frame around the table. */
  readonly frame: string;
  /** The main accent: titles, the active tab, the neon of the UI. */
  readonly neon: string;
  /** The second accent: amounts, frames, highlights. */
  readonly gold: string;
  /** Red as a fill: danger, red pockets. */
  readonly red: string;
  /** Red as text on the page. */
  readonly redText: string;
  /** Red suits on the white of a card. */
  readonly cardRed: string;
  /** Main text. */
  readonly white: string;
  /** Secondary text. */
  readonly muted: string;
  /** The primary button. */
  readonly button: string;
  /** Rim and spokes of the roulette wheel. */
  readonly rim: string;
  /** Highlight on the wheel's hub. */
  readonly rimLight: string;
  /** The wheel's bowl. */
  readonly bowl: string;
  /** Tint of the chips' stripes and rings. Left out, chips keep their classic colors. */
  readonly chip?: string;
}

/** How the page behind everything is drawn. */
export type BackdropPattern = 'grid' | 'dots' | 'diagonal' | 'stars' | 'bars';

export interface ThemeDefinition {
  readonly id: ThemeId;
  readonly name: string;
  /** One line under the name in the picker. */
  readonly blurb: string;
  readonly pattern: BackdropPattern;
  /** Titles and the active tab glow, as in neon lights. */
  readonly glow: boolean;
  readonly tokens: ThemeTokens;
}

/**
 * The eight themes. Each is checked against the contrast rules in `themes.test.ts`: text is at least 4.5 to 1 on
 * the page, the panels and the table, whatever the palette.
 */
export const THEMES: readonly ThemeDefinition[] = [
  {
    id: 'classic',
    name: 'Classic Felt',
    blurb: 'Green felt, gold, a dark room.',
    pattern: 'grid',
    glow: false,
    tokens: {
      bg: '#101216',
      bg2: '#191d25',
      felt: '#174d36',
      frame: '#2f8f5b',
      neon: '#65e572',
      gold: '#f5c451',
      red: '#e94b4b',
      redText: '#ff9a9a',
      cardRed: '#c4242b',
      white: '#f2f0e8',
      muted: '#bcc3cf',
      button: '#65e572',
      rim: '#f5c451',
      rimLight: '#ffe08a',
      bowl: '#6b4423',
    },
  },
  {
    id: 'neon',
    name: 'Neon Arcade',
    blurb: 'Hot pink and cyan on a violet night.',
    pattern: 'grid',
    glow: true,
    tokens: {
      bg: '#0a0420',
      bg2: '#160b3a',
      felt: '#26105e',
      frame: '#7c4dff',
      neon: '#2ef2ff',
      gold: '#ff5cd6',
      red: '#ff3d77',
      redText: '#ff8fb0',
      cardRed: '#d4144f',
      white: '#f6f1ff',
      muted: '#c9bdf0',
      button: '#2ef2ff',
      rim: '#ff5cd6',
      rimLight: '#ffb3ec',
      bowl: '#2c1470',
      chip: '#2ef2ff',
    },
  },
  {
    id: 'retro',
    name: 'Retro 8-Bit',
    blurb: 'Four shades of handheld green.',
    pattern: 'dots',
    glow: false,
    tokens: {
      bg: '#0b2a0f',
      bg2: '#123a17',
      felt: '#275a25',
      frame: '#6f9a2f',
      neon: '#b5e04f',
      gold: '#d7f27a',
      red: '#d9663a',
      redText: '#ffb48f',
      cardRed: '#b8431d',
      white: '#e6f5b8',
      muted: '#b3cf84',
      button: '#b5e04f',
      rim: '#9bbc0f',
      rimLight: '#e6f5b8',
      bowl: '#1f4f1c',
      chip: '#e6f5b8',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight Felt',
    blurb: 'Navy felt, silver trim, quiet light.',
    pattern: 'stars',
    glow: false,
    tokens: {
      bg: '#080e1f',
      bg2: '#101a35',
      felt: '#17346a',
      frame: '#3f6fc0',
      neon: '#8cc0ff',
      gold: '#ecdcaa',
      red: '#e65f72',
      redText: '#ff95a3',
      cardRed: '#b3263c',
      white: '#edf2ff',
      muted: '#b8c5e2',
      button: '#8cc0ff',
      rim: '#cdd9f5',
      rimLight: '#ffffff',
      bowl: '#1f3260',
      chip: '#cdd9f5',
    },
  },
  {
    id: 'blood',
    name: 'Crimson Felt',
    blurb: 'Burgundy felt and old brass.',
    pattern: 'diagonal',
    glow: false,
    tokens: {
      bg: '#150607',
      bg2: '#260b0e',
      felt: '#541016',
      frame: '#9b2a31',
      neon: '#ff5a4f',
      gold: '#e9b758',
      red: '#e23a3a',
      redText: '#ff8f85',
      cardRed: '#b3111c',
      white: '#f7ebe7',
      muted: '#dbbdb8',
      button: '#ff5a4f',
      rim: '#d9a74d',
      rimLight: '#ffe0a0',
      bowl: '#3f1611',
      chip: '#d9a74d',
    },
  },
  {
    id: 'cyber',
    name: 'Cyber Felt',
    blurb: 'Yellow signs, teal glass, black streets.',
    pattern: 'bars',
    glow: true,
    tokens: {
      bg: '#05090e',
      bg2: '#0d1823',
      felt: '#0d4247',
      frame: '#12a48e',
      neon: '#f9ef2d',
      gold: '#19f2d0',
      red: '#ff2e5c',
      redText: '#ff8099',
      cardRed: '#c4123f',
      white: '#e8fbff',
      muted: '#a9c8d0',
      button: '#f9ef2d',
      rim: '#19f2d0',
      rimLight: '#c2fff3',
      bowl: '#10393d',
      chip: '#f9ef2d',
    },
  },
  {
    id: 'forest',
    name: 'Forest Felt',
    blurb: 'Deep moss, amber lamps, dark wood.',
    pattern: 'dots',
    glow: false,
    tokens: {
      bg: '#0b1810',
      bg2: '#13281a',
      felt: '#1b5030',
      frame: '#3d9b5e',
      neon: '#92e67f',
      gold: '#e4bd78',
      red: '#d9573b',
      redText: '#ff9a7e',
      cardRed: '#b3321f',
      white: '#eff4e3',
      muted: '#bfceb4',
      button: '#92e67f',
      rim: '#c29a58',
      rimLight: '#f3dba0',
      bowl: '#4d3420',
      chip: '#dcb46e',
    },
  },
  {
    id: 'royal',
    name: 'Royal Felt',
    blurb: 'Purple velvet and a lot of gold.',
    pattern: 'diagonal',
    glow: false,
    tokens: {
      bg: '#130a25',
      bg2: '#201239',
      felt: '#3d1a70',
      frame: '#8a4dd1',
      neon: '#d7b0ff',
      gold: '#ffd24a',
      red: '#e2506a',
      redText: '#ff96aa',
      cardRed: '#b01e45',
      white: '#f7f1ff',
      muted: '#cfc1e8',
      button: '#ffd24a',
      rim: '#ffd24a',
      rimLight: '#fff0a6',
      bowl: '#3a1c5e',
      chip: '#ffd24a',
    },
  },
];

export const DEFAULT_THEME: ThemeDefinition = THEMES[0] as ThemeDefinition;

/** The theme with this id. An id that is not a theme gets the classic one rather than nothing. */
export const themeOf = (id: ThemeId): ThemeDefinition => THEMES.find((theme) => theme.id === id) ?? DEFAULT_THEME;
