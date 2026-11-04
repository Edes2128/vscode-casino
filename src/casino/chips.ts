/** Chip denominations offered by every game. */
export const CHIP_VALUES = [10, 25, 50, 100, 500] as const;

export type ChipValue = (typeof CHIP_VALUES)[number];

/** Smallest bet accepted by any game. */
export const MIN_BET = 10;
