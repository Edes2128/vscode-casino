import type { Pocket, RouletteColor } from './types';

/** Winnings per chip bet. Red and black pay 1:1, green (the zero) pays 35:1. */
export const PAYOUT_ODDS: Readonly<Record<RouletteColor, number>> = { red: 1, black: 1, green: 35 };

/**
 * The chips returned to the player for a bet on `color`: the stake back plus the winnings when the
 * ball lands on that colour, and nothing otherwise.
 */
export function payoutFor(color: RouletteColor, bet: number, pocket: Pocket): number {
  return pocket.color === color ? bet * (PAYOUT_ODDS[color] + 1) : 0;
}
