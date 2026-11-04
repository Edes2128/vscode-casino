import type { Pocket, RouletteColor } from './types';

/**
 * The European wheel, clockwise from the zero: 37 pockets, numbers 0 to 36, each exactly once.
 * (Red and black alternate all the way round, with the single green zero between 26 and 32.)
 */
export const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29,
  7, 28, 12, 35, 3, 26,
] as const;

export const POCKET_COUNT = WHEEL_ORDER.length;

const RED_NUMBERS: ReadonlySet<number> = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

export function colorOfNumber(number: number): RouletteColor {
  if (number === 0) return 'green';
  return RED_NUMBERS.has(number) ? 'red' : 'black';
}

/** Every pocket, in wheel order. */
export const POCKETS: readonly Pocket[] = WHEEL_ORDER.map((number) => ({ number, color: colorOfNumber(number) }));

/** Where a number sits on the wheel (0 to 36), or -1 if it is not a roulette number. */
export const pocketIndexOfNumber = (number: number): number => WHEEL_ORDER.indexOf(number as never);

/** "Red 17", "Black 8", "Green 0": how a result is written in the history. */
export function describePocket(pocket: Pocket): string {
  return `${pocket.color[0]?.toUpperCase()}${pocket.color.slice(1)} ${pocket.number}`;
}

/** The inverse of `describePocket`. `undefined` for anything that is not a result written by it. */
export function parsePocket(text: string): Pocket | undefined {
  const match = /^(Red|Black|Green) (\d{1,2})$/.exec(text);
  if (match === null) return undefined;
  const number = Number(match[2]);
  const pocket = POCKETS.find((candidate) => candidate.number === number);
  return pocket !== undefined && describePocket(pocket) === text ? pocket : undefined;
}
