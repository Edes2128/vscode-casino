/**
 * What a player can bet on: one colour, or one number. There are no column, dozen or odd/even bets.
 * The wheel is European, so the numbers are 0 to 36.
 */
export const ROULETTE_COLORS = ['red', 'black', 'green'] as const;

export type RouletteColor = (typeof ROULETTE_COLORS)[number];

export interface Pocket {
  readonly number: number;
  readonly color: RouletteColor;
}

export const isRouletteColor = (value: unknown): value is RouletteColor =>
  (ROULETTE_COLORS as readonly unknown[]).includes(value);

/** The highest number on a European wheel. */
export const HIGHEST_NUMBER = 36;

/** A whole number from 0 to 36. */
export const isRouletteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= HIGHEST_NUMBER;

/** A bet on a colour (the ball lands on any pocket of that colour) or on one number (straight up). */
export type RouletteSelection =
  | { readonly kind: 'color'; readonly color: RouletteColor }
  | { readonly kind: 'number'; readonly number: number };

/**
 * Reads a selection from untrusted data. Anything that is not exactly a colour bet on one of the three colours or
 * a number bet on 0 to 36 is refused, and extra fields are dropped, so the result can be trusted.
 */
export function parseSelection(raw: unknown): RouletteSelection | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined;
  const record = raw as Record<string, unknown>;
  if (record['kind'] === 'color' && isRouletteColor(record['color'])) return { kind: 'color', color: record['color'] };
  if (record['kind'] === 'number' && isRouletteNumber(record['number'])) return { kind: 'number', number: record['number'] };
  return undefined;
}

export const isRouletteSelection = (value: unknown): value is RouletteSelection => parseSelection(value) !== undefined;

export const sameSelection = (a: RouletteSelection | undefined, b: RouletteSelection | undefined): boolean =>
  a !== undefined && b !== undefined && (a.kind === 'color' ? b.kind === 'color' && a.color === b.color : b.kind === 'number' && a.number === b.number);
