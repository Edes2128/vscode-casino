import { randomInt, type Rng } from '../rng';
import { payoutFor } from './betting';
import type { Pocket, RouletteColor } from './types';
import { POCKET_COUNT, POCKETS } from './wheel';

/** Spins the wheel: every one of the 37 pockets is equally likely. */
export function spinWheel(rng: Rng): Pocket {
  const pocket = POCKETS[randomInt(rng, POCKET_COUNT)];
  if (pocket === undefined) throw new RangeError('The random generator returned a value outside [0, 1)');
  return pocket;
}

export interface SpinResult {
  readonly pocket: Pocket;
  /** The colour the player bet on. */
  readonly color: RouletteColor;
  readonly bet: number;
  readonly won: boolean;
  /** Chips returned to the player: the stake back plus winnings, or 0. */
  readonly payout: number;
  /** `payout - bet`. */
  readonly net: number;
}

/** Decides a bet against where the ball landed. */
export function resolveSpin(pocket: Pocket, color: RouletteColor, bet: number): SpinResult {
  const payout = payoutFor(color, bet, pocket);
  return { pocket, color, bet, won: payout > 0, payout, net: payout - bet };
}
