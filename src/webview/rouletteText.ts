import type { Pocket } from '../game/roulette/types';
import type { SpinView } from '../game/roulette/view';
import { formatChips } from './format';
import type { OutcomeKind } from './components/ResultEffects';

export interface SpinOutcomeText {
  readonly kind: OutcomeKind;
  readonly title: string;
  readonly amount: string;
  readonly detail: string;
}

/** The words for the result banner. A hit on the green is the special one. */
export function spinOutcomeText(last: SpinView): SpinOutcomeText {
  const kind: OutcomeKind = last.won ? (last.color === 'green' ? 'special' : 'win') : 'loss';
  return {
    kind,
    title: kind === 'special' ? 'GREEN! 35 TO 1' : last.won ? 'YOU WIN' : 'YOU LOSE',
    amount: last.won ? `+${formatChips(last.net)}` : `-${formatChips(Math.abs(last.net))}`,
    detail: `${last.detail}. You bet ${last.color}.`,
  };
}

/**
 * The results to list. While the wheel is still turning the newest one is the very result being
 * revealed, so it is left out until the ball has stopped.
 */
export const visibleRecent = (recent: readonly Pocket[], spinning: boolean): readonly Pocket[] =>
  spinning ? recent.slice(1) : recent;

/** "RED 17", "GREEN 0": a pocket in words. */
export const pocketWords = (pocket: Pocket): string => `${pocket.color.toUpperCase()} ${pocket.number}`;
