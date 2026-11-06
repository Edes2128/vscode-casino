import type { ColorSlot, CustomColors, ThemeId } from '../../state/appearance';
import {
  darken,
  ensureContrast,
  lighten,
  luminance,
  MIN_TEXT_CONTRAST,
  mixColors,
  parseHex,
  readableOn,
  toHex,
  type Rgb,
} from '../color';
import { themeOf, type BackdropPattern, type ThemeDefinition, type ThemeTokens } from './themes';

/**
 * The colors a screen is drawn with: the chosen theme, then the player's own colors on top of it, then a
 * readability pass. Every color the player picks is kept as picked unless the text on it would become hard to
 * read, in which case it is nudged just far enough, and `adjusted` says which slots were.
 */
export interface ResolvedAppearance {
  readonly theme: ThemeDefinition;
  /** The final colors, `#rrggbb`. */
  readonly tokens: ResolvedTokens;
  /** CSS custom properties for the root of the page (or of a preview). */
  readonly vars: Readonly<Record<string, string>>;
  /** Colors the player picked that had to be adjusted so text stays readable. */
  readonly adjusted: readonly ColorSlot[];
}

export interface ResolvedTokens extends Omit<ThemeTokens, 'chip'> {
  readonly chip: string | undefined;
  /** Readable text on the primary button. */
  readonly buttonText: string;
  /** The shaded lower edge of the primary button. */
  readonly buttonShade: string;
  /** Hairlines and dividers: a step from the panel color toward the text. */
  readonly line: string;
}

const rgbOf = (hex: string): Rgb => parseHex(hex) ?? [0, 0, 0];

/** The page color's neighbour for panels: a little lighter on a dark page, a little darker on a light one. */
const panelOf = (bg: Rgb): Rgb => {
  const panel = luminance(bg) < 0.4 ? lighten(bg, 0.07) : darken(bg, 0.07);
  // Whole channels, because that is the color that is drawn, and the one text is checked against.
  return panel.map(Math.round) as unknown as Rgb;
};

export function resolveAppearance(themeId: ThemeId, colors: CustomColors = {}): ResolvedAppearance {
  const theme = themeOf(themeId);
  const base = theme.tokens;
  const adjusted = new Set<ColorSlot>();

  const picked = (slot: ColorSlot): Rgb | undefined => {
    const value = colors[slot];
    return value === undefined ? undefined : parseHex(value);
  };

  const bg = picked('background') ?? rgbOf(base.bg);
  const bg2 = picked('background') === undefined ? rgbOf(base.bg2) : panelOf(bg);
  const buttonColor = picked('button') ?? rgbOf(base.button);

  // Text. A picked text color is kept when it reads on the page, the panels and the table.
  const wantedText = picked('text') ?? rgbOf(base.white);
  let text = wantedText;
  for (const surface of [bg, bg2]) text = ensureContrast(text, surface);
  if (picked('text') !== undefined && toHex(text) !== toHex(wantedText)) adjusted.add('text');

  // Secondary text follows the main text when that was changed, and keeps to the theme's own otherwise.
  let muted = picked('text') === undefined ? rgbOf(base.muted) : mixColors(text, bg2, 0.22);
  for (const surface of [bg, bg2]) muted = ensureContrast(muted, surface);

  // The accent: titles, the active tab. Gold, the second accent, stays the theme's.
  const wantedAccent = picked('accent') ?? rgbOf(base.neon);
  let accent = wantedAccent;
  for (const surface of [bg, bg2]) accent = ensureContrast(accent, surface);
  if (picked('accent') !== undefined && toHex(accent) !== toHex(wantedAccent)) adjusted.add('accent');

  let gold = rgbOf(base.gold);
  for (const surface of [bg, bg2]) gold = ensureContrast(gold, surface);
  const redText = ensureContrast(rgbOf(base.redText), bg);
  const cardRed = ensureContrast(rgbOf(base.cardRed), [0xf2, 0xf0, 0xe8]);

  // The table is where the game's text sits, so it gives way to the text, not the other way round: a table
  // picked too close to the text is moved just far enough that the text, the secondary text, the amounts and the
  // red of a lost hand read.
  const wantedFelt = picked('table') ?? rgbOf(base.felt);
  let felt = wantedFelt;
  for (const ink of [text, muted, gold, redText]) felt = ensureContrast(felt, ink);
  if (picked('table') !== undefined && toHex(felt) !== toHex(wantedFelt)) adjusted.add('table');

  // The page, the panels and the table are shown exactly as picked; only what is drawn on them is adjusted.
  const buttonText = readableOn(buttonColor);
  const chip = colors.chip ?? base.chip;

  const tokens: ResolvedTokens = {
    bg: toHex(bg),
    bg2: toHex(bg2),
    felt: toHex(felt),
    neon: toHex(accent),
    gold: toHex(gold),
    red: base.red,
    redText: toHex(redText),
    cardRed: toHex(cardRed),
    white: toHex(text),
    muted: toHex(muted),
    button: toHex(buttonColor),
    buttonText: toHex(buttonText),
    buttonShade: toHex(darken(buttonColor, 0.3)),
    line: toHex(mixColors(bg2, text, 0.16)),
    frame: picked('table') === undefined ? base.frame : toHex(mixColors(felt, accent, 0.3)),
    rim: base.rim,
    rimLight: base.rimLight,
    bowl: base.bowl,
    chip,
  };

  const onColor = (color: string): string => toHex(readableOn(rgbOf(color)));
  const vars: Record<string, string> = {
    '--c-bg': tokens.bg,
    '--c-bg-2': tokens.bg2,
    '--c-felt': tokens.felt,
    '--c-frame': tokens.frame,
    '--c-line': tokens.line,
    '--c-neon': tokens.neon,
    '--c-gold': tokens.gold,
    '--c-red': tokens.red,
    '--c-red-text': tokens.redText,
    '--c-card-red': tokens.cardRed,
    '--c-white': tokens.white,
    '--c-muted': tokens.muted,
    '--c-button': tokens.button,
    '--c-button-fg': tokens.buttonText,
    '--c-button-shade': tokens.buttonShade,
    '--c-on-neon': onColor(tokens.neon),
    '--c-on-gold': onColor(tokens.gold),
    '--c-on-red': onColor(tokens.red),
    '--c-gold-shade': toHex(darken(rgbOf(tokens.gold), 0.28)),
    '--c-red-shade': toHex(darken(rgbOf(tokens.red), 0.3)),
    '--c-neon-shade': toHex(darken(rgbOf(tokens.neon), 0.3)),
    '--c-rim': tokens.rim,
    '--c-rim-light': tokens.rimLight,
    '--c-bowl': tokens.bowl,
    '--c-chip': tokens.chip ?? 'transparent',
  };

  return { theme, tokens, vars, adjusted: [...adjusted] };
}

/** Attributes the stylesheets key on: the theme's name, its backdrop and whether it glows. */
export function appearanceAttributes(resolved: ResolvedAppearance): Readonly<Record<'data-theme' | 'data-pattern' | 'data-glow', string>> {
  return {
    'data-theme': resolved.theme.id,
    'data-pattern': resolved.theme.pattern satisfies BackdropPattern,
    'data-glow': resolved.theme.glow ? 'on' : 'off',
  };
}

/** The smallest contrast the readability pass guarantees for text. */
export const GUARANTEED_CONTRAST = MIN_TEXT_CONTRAST;
