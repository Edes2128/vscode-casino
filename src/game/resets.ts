import type { CasinoStore } from '../casino/store';
import type { ResetOutcome, ResetScope } from './resetScope';

export { isResetOutcome, isResetScope, RESET_OUTCOMES, RESET_SCOPES } from './resetScope';
export type { ResetOutcome, ResetScope } from './resetScope';

/** A game table that shows results taken from the history, so it must forget them when they are wiped. */
export interface Clearable {
  clear(): void;
}

export interface ResetDependencies {
  readonly store: CasinoStore;
  readonly tables: readonly Clearable[];
  /** Asks the player. Must resolve `true` only for an explicit yes. The extension shows a modal dialog. */
  readonly confirm: (scope: ResetScope) => PromiseLike<boolean>;
  readonly onError?: (message: string, error: unknown) => void;
}

/**
 * The only way a reset happens. A webview can only ask: the host asks the player, and only an
 * explicit yes changes anything. The store still refuses mid-round, so a reset can never be played
 * against an open bet, even if a round started while the question was on screen.
 */
export class ResetCoordinator {
  readonly #deps: ResetDependencies;
  #asking = false;

  constructor(deps: ResetDependencies) {
    this.#deps = deps;
  }

  async reset(scope: ResetScope): Promise<ResetOutcome> {
    const { store, tables, confirm, onError } = this.#deps;
    if (this.#asking) return 'busy';
    // Do not ask the player something that cannot be done.
    if (store.openRounds.length > 0) return 'round-in-progress';

    this.#asking = true;
    let confirmed = false;
    try {
      confirmed = (await confirm(scope)) === true;
    } catch (error) {
      onError?.('Asking for confirmation of a reset failed; nothing was reset', error);
    } finally {
      this.#asking = false;
    }
    if (!confirmed) return 'cancelled';

    const result = scope === 'balance' ? store.resetBalance() : scope === 'statistics' ? store.resetStatistics() : store.resetAll();
    if (!result.ok) return 'round-in-progress';

    // The statistics and the history are the source of the tables' last results.
    if (scope !== 'balance') for (const table of tables) table.clear();
    return 'done';
  }
}
