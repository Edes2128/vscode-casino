import { STARTING_BALANCE } from '../state/snapshot';
import type { ResetOutcome, ResetScope } from '../game/resetScope';
import { formatChips } from './format';

const DONE: Readonly<Record<ResetScope, string>> = {
  balance: `BALANCE RESET TO ${formatChips(STARTING_BALANCE)} CHIPS.`,
  statistics: 'STATISTICS AND HISTORY CLEARED.',
  all: 'LUCKY BREAK WAS RESET.',
};

/** What the settings screen says after a reset request ended. */
export function resetResultText(scope: ResetScope, outcome: ResetOutcome): string {
  switch (outcome) {
    case 'done':
      return DONE[scope];
    case 'cancelled':
      return 'CANCELLED. NOTHING WAS CHANGED.';
    case 'round-in-progress':
      return 'FINISH YOUR BLACKJACK HAND FIRST.';
    case 'busy':
      return 'ANOTHER RESET IS WAITING FOR YOUR ANSWER.';
  }
}

/** How the volume slider reads out its value. */
export const volumeText = (volume: number): string => `${volume}%`;
