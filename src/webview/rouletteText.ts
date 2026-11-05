import { describeSelection, oddsOf } from '../game/roulette/betting';
import type { Pocket, RouletteSelection } from '../game/roulette/types';
import type { SpinView } from '../game/roulette/view';
import { formatChips } from './format';
import type { OutcomeKind } from './components/ResultEffects';

export interface SpinOutcomeText {
  readonly kind: OutcomeKind;
  readonly title: string;
  readonly amount: string;
  readonly detail: string;
}

/** The bet in capitals for the screen: "RED", "NUMBER 17". */
export const selectionLabel = (selection: RouletteSelection): string => describeSelection(selection).toUpperCase();

/** The bet's odds as the screen says them: "1 TO 1", "35 TO 1". */
export const selectionOdds = (selection: RouletteSelection): string => `${oddsOf(selection)} TO 1`;

/** The words for the result banner. A 35 to 1 win, on the green or on a number, is the special one. */
export function spinOutcomeText(last: SpinView): SpinOutcomeText {
  const big = last.won && oddsOf(last.selection) >= 35;
  const kind: OutcomeKind = last.won ? (big ? 'special' : 'win') : 'loss';
  const bigTitle = last.selection.kind === 'number' ? `NUMBER ${last.selection.number}! 35 TO 1` : 'GREEN! 35 TO 1';
  return {
    kind,
    title: big ? bigTitle : last.won ? 'YOU WIN' : 'YOU LOSE',
    amount: last.won ? `+${formatChips(last.net)}` : `-${formatChips(Math.abs(last.net))}`,
    detail: `${last.detail}. You bet ${describeSelection(last.selection)}.`,
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
