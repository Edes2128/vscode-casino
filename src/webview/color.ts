/**
 * Colour maths for readability: WCAG relative luminance and contrast ratio, and helpers that pick or adjust a
 * colour so text stays legible. Used by the contrast test over every theme, and by the custom colours screen.
 * Colours are `#rrggbb` (a leading `#` and three digits are accepted too).
 */

export type Rgb = readonly [red: number, green: number, blue: number];

/** The smallest contrast WCAG accepts for normal-size text (level AA). */
export const MIN_TEXT_CONTRAST = 4.5;

/** Parses `#rgb` or `#rrggbb`. Returns `undefined` for anything else, so callers never see a half-valid colour. */
export function parseHex(value: string): Rgb | undefined {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (match === null) return undefined;
  let digits = match[1] ?? '';
  if (digits.length === 3) digits = [...digits].map((digit) => digit + digit).join('');
  return [0, 2, 4].map((at) => Number.parseInt(digits.slice(at, at + 2), 16)) as unknown as Rgb;
}

export const toHex = ([red, green, blue]: Rgb): string =>
  `#${[red, green, blue].map((channel) => Math.round(Math.min(255, Math.max(0, channel))).toString(16).padStart(2, '0')).join('')}`;

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function luminance([red, green, blue]: Rgb): number {
  const linear = (channel: number): number => {
    const value = channel / 255;
    return value <= 0.039_28 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}

/** WCAG contrast ratio between two colours, 1 (identical) to 21 (black on white). */
export function contrastRatio(first: Rgb, second: Rgb): number {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Contrast between two `#rrggbb` strings; 1 when either cannot be read. */
export function contrastOfHex(foreground: string, background: string): number {
  const fg = parseHex(foreground);
  const bg = parseHex(background);
  return fg === undefined || bg === undefined ? 1 : contrastRatio(fg, bg);
}

const NEAR_BLACK: Rgb = [0x10, 0x12, 0x16];
const NEAR_WHITE: Rgb = [0xf8, 0xf6, 0xee];

const BLACK: Rgb = [0, 0, 0];
const WHITE: Rgb = [255, 255, 255];

/**
 * Whichever of near-black and near-white reads better on `background`. Used for the label on a coloured button.
 * On the few mid-brightness colours where neither reaches AA (a strong blue, say), pure black or white is used,
 * because those always can: the worst case, at a luminance of about 0.18, is 4.58 to 1.
 */
export function readableOn(background: Rgb): Rgb {
  const soft = contrastRatio(NEAR_BLACK, background) >= contrastRatio(NEAR_WHITE, background) ? NEAR_BLACK : NEAR_WHITE;
  if (contrastRatio(soft, background) >= MIN_TEXT_CONTRAST) return soft;
  return contrastRatio(BLACK, background) >= contrastRatio(WHITE, background) ? BLACK : WHITE;
}

/**
 * Moves `foreground` toward white or black until it is readable against `background` (`minimum`), in small steps,
 * and stops at the first colour that is. Returns the colour unchanged when it already is. It keeps to the side it
 * is already on, lighter text getting lighter and darker text darker, so the hue and the look of a chosen color are
 * kept as far as they can be; it crosses to the other side only when its own side cannot reach the minimum.
 */
export function ensureContrast(foreground: Rgb, background: Rgb, minimum = MIN_TEXT_CONTRAST): Rgb {
  if (contrastRatio(foreground, background) >= minimum) return foreground;

  const toward = (target: Rgb): Rgb | undefined => {
    for (let step = 1; step <= 40; step += 1) {
      const mix = step / 40;
      // Whole channels, as they will be written: a ratio checked on fractions could fall short once rounded.
      const candidate = foreground.map((channel, index) => Math.round(channel + ((target[index] ?? 0) - channel) * mix)) as unknown as Rgb;
      if (contrastRatio(candidate, background) >= minimum) return candidate;
    }
    return undefined;
  };

  const ownSide = luminance(foreground) >= luminance(background) ? WHITE : BLACK;
  const otherSide = ownSide === WHITE ? BLACK : WHITE;
  const found = toward(ownSide) ?? toward(otherSide);
  if (found !== undefined) return found;
  // Neither reaches it (a mid-tone background): the one that comes closest.
  return contrastRatio(WHITE, background) >= contrastRatio(BLACK, background) ? WHITE : BLACK;
}

/** `from` moved `amount` (0 to 1) of the way toward `to`. */
export const mixColors = (from: Rgb, to: Rgb, amount: number): Rgb =>
  from.map((channel, index) => channel + ((to[index] ?? 0) - channel) * amount) as unknown as Rgb;

/** `color` with `amount` (0 to 1) of black mixed in: the shaded edge of a button or a chip. */
export const darken = (color: Rgb, amount: number): Rgb => mixColors(color, BLACK, amount);

/** `color` with `amount` (0 to 1) of white mixed in. */
export const lighten = (color: Rgb, amount: number): Rgb => mixColors(color, WHITE, amount);
