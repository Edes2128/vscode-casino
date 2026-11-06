import { STARTING_BALANCE } from '../state/snapshot';
import type { ResetScope } from './resetScope';

export interface ResetPrompt {
  /** The question, as the title of the dialog. */
  readonly message: string;
  /** What exactly will and will not be touched. */
  readonly detail: string;
  /** The label of the one button that confirms. The dialog adds its own Cancel. */
  readonly confirmLabel: string;
}

const chips = STARTING_BALANCE.toLocaleString('en-US');

/** The words of the confirmation dialog for each kind of reset. */
export function resetPrompt(scope: ResetScope): ResetPrompt {
  switch (scope) {
    case 'balance':
      return {
        message: `Reset your balance to ${chips} chips?`,
        detail: 'Your statistics and game history are kept. The chips you have now are lost.',
        confirmLabel: 'Reset Balance',
      };
    case 'statistics':
      return {
        message: 'Clear your statistics and game history?',
        detail: 'Your balance is kept. This cannot be undone.',
        confirmLabel: 'Clear Statistics',
      };
    case 'all':
      return {
        message: 'Reset everything in Break Room Arcade?',
        detail: `Your balance goes back to ${chips} chips, and your statistics and game history are cleared. Your sound and animation settings are kept. This cannot be undone.`,
        confirmLabel: 'Reset Everything',
      };
  }
}
