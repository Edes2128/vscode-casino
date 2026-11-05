import type { CasinoStore } from '../../casino/store';
import type { HistoryEntry } from '../../casino/types';
import { cryptoRng, type Rng } from '../rng';
import { fail, OK, type TableResult } from '../tableResult';
import { resolveSpin, spinWheel } from './engine';
import { isRouletteSelection, type Pocket } from './types';
import { IDLE_ROULETTE_VIEW, MAX_RECENT, type RouletteAction, type RouletteView, type SpinView } from './view';
import { describePocket, parsePocket } from './wheel';

export interface RouletteTableOptions {
  /** Where the ball gets its randomness. Defaults to the Web Crypto API. */
  readonly rng?: Rng;
  readonly onError?: (message: string, error: unknown) => void;
}

/**
 * The one roulette table, shared by every view. It lives in the extension host: it spins the wheel,
 * takes the bet from the wallet and pays the result, exactly once per spin. A webview only says
 * which colour and how much; where the ball lands is decided here, before any animation starts.
 */
export class RouletteTable {
  readonly #store: CasinoStore;
  readonly #rng: Rng;
  readonly #onError: (message: string, error: unknown) => void;
  readonly #listeners = new Set<(view: RouletteView) => void>();

  #spin = 0;
  #last: SpinView | undefined;
  #recent: readonly Pocket[];
  #view: RouletteView = IDLE_ROULETTE_VIEW;

  constructor(store: CasinoStore, options: RouletteTableOptions = {}) {
    this.#store = store;
    this.#rng = options.rng ?? cryptoRng;
    this.#onError = options.onError ?? (() => undefined);
    // The results of earlier sessions are in the history, written in a form that reads back.
    this.#recent = recentFromHistory(store.snapshot.history);
    this.#view = this.#buildView();
  }

  /** What the webviews should show right now. */
  get view(): RouletteView {
    return this.#view;
  }

  /** Calls `listener` whenever the table changes. Returns a function that stops listening. */
  onDidChange(listener: (view: RouletteView) => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  perform(action: RouletteAction): TableResult {
    // The message boundary has already validated this. Checked again, because chips are about to move.
    if (!isRouletteSelection(action.selection)) return fail('not-allowed');

    const begun = this.#store.beginRound('roulette', action.bet);
    if (!begun.ok) return fail(begun.error);

    // The ball has landed before the screen shows anything. The animation only reveals it.
    const result = resolveSpin(spinWheel(this.#rng), action.selection, action.bet);
    const detail = describePocket(result.pocket);

    this.#spin += 1;
    this.#recent = [result.pocket, ...this.#recent].slice(0, MAX_RECENT);
    this.#last = {
      pocket: result.pocket,
      selection: result.selection,
      bet: result.bet,
      won: result.won,
      net: result.net,
      payout: result.payout,
      detail,
      balanceBefore: this.#store.snapshot.balance,
    };

    // The views are told first and the wallet is paid right after, so a view can keep the old
    // balance on screen until its wheel has stopped.
    this.#publish();
    const settled = this.#store.settleRound(begun.value.id, result.payout, detail);
    if (!settled.ok) this.#onError(`Settling a roulette spin failed: ${settled.error}`, undefined);
    return OK;
  }

  /**
   * Forgets the latest result and the recent results, once the history they came from has been
   * cleared. The spin counter keeps its value: it only ever counts spins.
   */
  clear(): void {
    this.#last = undefined;
    this.#recent = [];
    this.#publish();
  }

  #buildView(): RouletteView {
    return {
      spin: this.#spin,
      recent: this.#recent,
      ...(this.#last === undefined ? {} : { last: this.#last }),
    };
  }

  #publish(): void {
    this.#view = this.#buildView();
    for (const listener of [...this.#listeners]) {
      try {
        listener(this.#view);
      } catch (error) {
        this.#onError('A roulette listener failed', error);
      }
    }
  }
}

/** Recent winning pockets from the history (newest first), skipping anything that is not a spin result. */
export function recentFromHistory(history: readonly HistoryEntry[]): Pocket[] {
  const pockets: Pocket[] = [];
  for (const entry of history) {
    if (entry.game !== 'roulette') continue;
    const pocket = parsePocket(entry.detail);
    if (pocket !== undefined) pockets.push(pocket);
    if (pockets.length === MAX_RECENT) break;
  }
  return pockets;
}
