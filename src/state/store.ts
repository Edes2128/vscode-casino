import { addEntry } from './history';
import {
  loadState,
  saveState,
  STATE_VERSION,
  type KeyValueStorage,
  type LoadResult,
  type PersistedState,
} from './persistence';
import { EMPTY_GAME_STATS, MAX_DETAIL_LENGTH } from './snapshot';
import { combineStats, outcomeOf, recordRound } from './statistics';
import type { BreakRoomSnapshot, GameStats, GameType, HistoryEntry, OpenRound } from './types';
import { Wallet, type WalletError } from './wallet';
import { WriteQueue } from './writeQueue';

export type RoundError =
  | WalletError
  /** That game already has a round that has not been settled. */
  | 'round-in-progress'
  /** No open round has that id: never opened, or already settled. */
  | 'unknown-round';

export type RoundResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: RoundError };

const ok = <T>(value: T): RoundResult<T> => ({ ok: true, value });
const fail = (error: RoundError): RoundResult<never> => ({ ok: false, error });

/** What a game engine holds on to while a round is being played. */
export interface RoundTicket {
  readonly id: string;
  readonly game: GameType;
  /** Chips taken from the balance for this round so far. */
  readonly staked: number;
}

export interface StartupReport {
  readonly source: LoadResult['source'];
  /** Rounds left open by the previous session, settled as forfeited losses. */
  readonly forfeitedRounds: number;
}

export interface StoreOptions {
  readonly now?: () => number;
  readonly newId?: () => string;
  /** Called when saving fails or a change listener throws. Break Room Arcade keeps running either way. */
  readonly onError?: (message: string, error: unknown) => void;
}

type PerGameStats = { readonly blackjack: GameStats; readonly roulette: GameStats };

/**
 * The one source of truth for the wallet, statistics and history. Lives in the extension host.
 *
 * Games never touch the balance directly. A round is opened with `beginRound` (the bet is taken
 * from the balance), may take extra stakes with `addStake` (double down, split) and ends with
 * `settleRound`, which pays out, updates the statistics and writes the history. The result of a
 * round (win, loss or push) is derived from the net chips, so the money and the record always agree.
 */
export class BreakRoomStore {
  readonly startup: StartupReport;

  readonly #storage: KeyValueStorage;
  readonly #now: () => number;
  readonly #newId: () => string;
  readonly #onError: (message: string, error: unknown) => void;
  readonly #wallet: Wallet;
  readonly #openRounds = new Map<string, OpenRound>();
  readonly #listeners = new Set<(snapshot: BreakRoomSnapshot) => void>();
  readonly #queue = new WriteQueue(
    () => saveState(this.#storage, this.#serialise()),
    (error) => this.#onError('Saving Break Room Arcade state failed', error),
  );

  #stats: PerGameStats;
  #history: readonly HistoryEntry[];
  #snapshot: BreakRoomSnapshot | undefined;

  constructor(storage: KeyValueStorage, options: StoreOptions = {}) {
    this.#storage = storage;
    this.#now = options.now ?? Date.now;
    this.#newId = options.newId ?? (() => crypto.randomUUID());
    this.#onError = options.onError ?? (() => undefined);

    const { state, source } = loadState(storage);
    this.#wallet = new Wallet(state.balance);
    this.#stats = state.stats;
    this.#history = state.history;

    // A round still open from the last session can never be finished: its game state died with
    // that session. The stake is already out of the balance, so settle it as a recorded loss.
    // (Refunding would let a losing hand be escaped by closing VS Code.)
    for (const round of state.openRounds) this.#record(round, 0, 'Round abandoned');
    this.startup = { source, forfeitedRounds: state.openRounds.length };

    if (state.openRounds.length > 0 || source === 'corrupt') this.#queue.schedule();
  }

  /** The current game state. The same object until the next change. */
  get snapshot(): BreakRoomSnapshot {
    this.#snapshot ??= {
      balance: this.#wallet.balance,
      stats: {
        overall: combineStats(this.#stats.blackjack, this.#stats.roulette),
        blackjack: this.#stats.blackjack,
        roulette: this.#stats.roulette,
      },
      history: this.#history,
    };
    return this.#snapshot;
  }

  /** Rounds that have taken a bet but are not settled yet. */
  get openRounds(): readonly OpenRound[] {
    return [...this.#openRounds.values()];
  }

  /** Calls `listener` after every change. Returns a function that stops listening. */
  onDidChange(listener: (snapshot: BreakRoomSnapshot) => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  // ------------------------------------------------------------------ rounds

  /** Opens a round and takes `bet` from the balance. One open round per game at a time. */
  beginRound(game: GameType, bet: number): RoundResult<RoundTicket> {
    if (this.openRounds.some((round) => round.game === game)) return fail('round-in-progress');

    const debit = this.#wallet.placeBet(bet);
    if (!debit.ok) return fail(debit.error);

    const round: OpenRound = { id: this.#newId(), game, staked: bet, startedAt: this.#now() };
    this.#openRounds.set(round.id, round);
    this.#changed();
    return ok(toTicket(round));
  }

  /** Takes an extra stake for an open round: a double down, or the second bet of a split. */
  addStake(roundId: string, amount: number): RoundResult<RoundTicket> {
    const round = this.#openRounds.get(roundId);
    if (round === undefined) return fail('unknown-round');

    const debit = this.#wallet.addStake(amount);
    if (!debit.ok) return fail(debit.error);

    const updated: OpenRound = { ...round, staked: round.staked + amount };
    this.#openRounds.set(roundId, updated);
    this.#changed();
    return ok(toTicket(updated));
  }

  /**
   * Ends a round. `payout` is the total chips returned to the player: the stake back plus any
   * winnings (0 when everything was lost). Pays the balance, updates the statistics and adds the
   * history entry in one step. An invalid `payout` changes nothing and leaves the round open.
   */
  settleRound(roundId: string, payout: number, detail: string): RoundResult<HistoryEntry> {
    const round = this.#openRounds.get(roundId);
    if (round === undefined) return fail('unknown-round');

    const credit = this.#wallet.payout(payout);
    if (!credit.ok) return fail(credit.error);

    const entry = this.#record(round, payout, detail);
    this.#changed();
    return ok(entry);
  }

  // ------------------------------------------------------------------ resets
  // These refuse to run mid-round, so a reset can never be played against an open bet.

  /** Back to the starting balance. Statistics and history are kept. */
  resetBalance(): RoundResult<void> {
    if (this.#openRounds.size > 0) return fail('round-in-progress');
    this.#wallet.reset();
    this.#changed();
    return ok(undefined);
  }

  /** Clears the statistics and the history. The balance is kept. */
  resetStatistics(): RoundResult<void> {
    if (this.#openRounds.size > 0) return fail('round-in-progress');
    this.#stats = { blackjack: EMPTY_GAME_STATS, roulette: EMPTY_GAME_STATS };
    this.#history = [];
    this.#changed();
    return ok(undefined);
  }

  /** A brand-new game: starting balance, no statistics, no history. */
  resetAll(): RoundResult<void> {
    if (this.#openRounds.size > 0) return fail('round-in-progress');
    this.#wallet.reset();
    this.#stats = { blackjack: EMPTY_GAME_STATS, roulette: EMPTY_GAME_STATS };
    this.#history = [];
    this.#changed();
    return ok(undefined);
  }

  // ------------------------------------------------------------------ persistence

  /** Resolves once everything changed so far has been written. Call before shutting down. */
  flush(): Promise<void> {
    return this.#queue.flush();
  }

  #record(round: OpenRound, payout: number, detail: string): HistoryEntry {
    this.#openRounds.delete(round.id);

    const net = payout - round.staked;
    const entry: HistoryEntry = {
      id: round.id,
      game: round.game,
      bet: round.staked,
      outcome: outcomeOf(net),
      payout: net,
      detail: detail.trim().slice(0, MAX_DETAIL_LENGTH),
      timestamp: this.#now(),
    };

    this.#stats = { ...this.#stats, [round.game]: recordRound(this.#stats[round.game], round.staked, net) };
    this.#history = addEntry(this.#history, entry);
    return entry;
  }

  #changed(): void {
    this.#snapshot = undefined;
    this.#queue.schedule();

    const snapshot = this.snapshot;
    for (const listener of [...this.#listeners]) {
      try {
        listener(snapshot);
      } catch (error) {
        this.#onError('A game change listener failed', error);
      }
    }
  }

  #serialise(): PersistedState {
    return {
      version: STATE_VERSION,
      balance: this.#wallet.balance,
      stats: this.#stats,
      history: this.#history,
      openRounds: this.openRounds,
    };
  }
}

const toTicket = (round: OpenRound): RoundTicket => ({ id: round.id, game: round.game, staked: round.staked });
