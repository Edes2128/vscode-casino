/** The only things a player can bet on. There are no number, column, dozen or odd/even bets. */
export const ROULETTE_COLORS = ['red', 'black', 'green'] as const;

export type RouletteColor = (typeof ROULETTE_COLORS)[number];

export interface Pocket {
  readonly number: number;
  readonly color: RouletteColor;
}

export const isRouletteColor = (value: unknown): value is RouletteColor =>
  (ROULETTE_COLORS as readonly unknown[]).includes(value);
