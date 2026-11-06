import { outcomeOf } from '../../state/statistics';
import type { LuckyBreakStore, RoundTicket } from '../../state/store';
import { cryptoRng, type Rng } from '../rng';
import { fail, OK, type TableResult } from '../tableResult';
import { createShuffledDeck } from './deck';
import { availableActions, doubleDown, hit, split, stand, startRound, type EngineResult } from './engine';
import { scoreHand } from './scoring';
import type { Card, Hand, HandOutcome, HandResult, Round, Settlement } from './types';
import { IDLE_VIEW, type BlackjackAction, type BlackjackView, type HandView, type ResultView } from './view';

export type { TableError, TableResult } from '../tableResult';

export interface TableOptions {
  /** Where shuffles get their randomness. Defaults to the Web Crypto API. */
  readonly rng?: Rng;
  /** Supplies the deck for each round. Defaults to a fresh shuffled deck; tests stack their own. */
  readonly deck?: () => readonly Card[];
  readonly onError?: (message: string, error: unknown) => void;
}

/**
 * The one blackjack table, shared by every view. It lives in the extension host and is the only
 * thing that can change the round: it owns the deck and the dealer's hole card, takes every stake
 * from the wallet and settles the round exactly once. Webviews send actions and receive a `view`
 * that leaves out everything they must not know.
 */
export class BlackjackTable {
  readonly #store: LuckyBreakStore;
  readonly #deck: () => readonly Card[];
  readonly #onError: (message: string, error: unknown) => void;
  readonly #listeners = new Set<(view: BlackjackView) => void>();

  #round: Round | undefined;
  #ticket: RoundTicket | undefined;
  #roundNumber = 0;
  #result: { readonly balanceBefore: number; readonly detail: string } | undefined;
  #view: BlackjackView = IDLE_VIEW;

  constructor(store: LuckyBreakStore, options: TableOptions = {}) {
    const rng = options.rng ?? cryptoRng;
    this.#store = store;
    this.#deck = options.deck ?? (() => createShuffledDeck(rng));
    this.#onError = options.onError ?? (() => undefined);
  }

  /** What the webviews should show right now. */
  get view(): BlackjackView {
    return this.#view;
  }

  /** Calls `listener` whenever the table changes. Returns a function that stops listening. */
  onDidChange(listener: (view: BlackjackView) => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  perform(action: BlackjackAction): TableResult {
    switch (action.kind) {
      case 'deal':
        return this.#deal(action.bet);
      case 'newRound':
        return this.#newRound();
      case 'hit':
        return this.#play(hit);
      case 'stand':
        return this.#play(stand);
      case 'double':
        return this.#withExtraStake(doubleDown);
      case 'split':
        return this.#withExtraStake(split);
    }
  }

  #deal(bet: number): TableResult {
    if (this.#round?.phase === 'player') return fail('round-active');

    const begun = this.#store.beginRound('blackjack', bet);
    if (!begun.ok) return fail(begun.error);

    this.#ticket = begun.value;
    this.#roundNumber += 1;
    this.#result = undefined;
    this.#round = startRound(this.#deck(), bet);
    return this.#afterChange();
  }

  /** Hit and stand: rules only, no chips involved. */
  #play(action: (round: Round) => EngineResult): TableResult {
    const round = this.#round;
    if (round === undefined) return fail('not-allowed');

    const result = action(round);
    if (!result.ok) return fail('not-allowed');
    this.#round = result.round;
    return this.#afterChange();
  }

  /**
   * Double down and split each need a second stake. The move is worked out first (it has no side
   * effects), then the stake is taken, then the move is applied, so a refused stake changes nothing.
   */
  #withExtraStake(action: (round: Round) => EngineResult): TableResult {
    const round = this.#round;
    const ticket = this.#ticket;
    if (round === undefined || ticket === undefined) return fail('not-allowed');

    const result = action(round);
    const hand = round.hands[round.active];
    if (!result.ok || hand === undefined) return fail('not-allowed');

    const stake = this.#store.addStake(ticket.id, hand.bet);
    if (!stake.ok) return fail(stake.error);

    this.#ticket = stake.value;
    this.#round = result.round;
    return this.#afterChange();
  }

  /**
   * Sends the table back to betting and forgets the last hand, once the history it was recorded in
   * has been cleared. A hand that is still being played is left alone: it cannot be cleared.
   */
  clear(): void {
    if (this.#round?.phase === 'player') return;
    this.#round = undefined;
    this.#ticket = undefined;
    this.#result = undefined;
    this.#publish();
  }

  #newRound(): TableResult {
    if (this.#round?.phase === 'player') return fail('round-active');
    this.#round = undefined;
    this.#result = undefined;
    this.#publish();
    return OK;
  }

  #afterChange(): TableResult {
    if (this.#round?.phase === 'settled') this.#settle();
    else this.#publish();
    return OK;
  }

  /**
   * Pays the round out. The views are told the result first and the wallet is paid right after,
   * so a view can hold the old balance on screen until it has finished showing the dealer's play.
   */
  #settle(): void {
    const round = this.#round;
    const ticket = this.#ticket;
    const settlement = round?.settlement;
    if (round === undefined || ticket === undefined || settlement === undefined) return;

    if (ticket.staked !== settlement.staked) {
      this.#onError(`Blackjack stake mismatch: wallet ${ticket.staked}, table ${settlement.staked}`, undefined);
    }

    const detail = describeSettlement(round.hands, settlement);
    this.#result = { balanceBefore: this.#store.snapshot.balance, detail };
    this.#publish();

    const settled = this.#store.settleRound(ticket.id, settlement.payout, detail);
    if (!settled.ok) this.#onError(`Settling a blackjack round failed: ${settled.error}`, undefined);
    this.#ticket = undefined;
  }

  #publish(): void {
    this.#view = buildView(this.#round, this.#roundNumber, this.#store.snapshot.balance, this.#result);
    for (const listener of [...this.#listeners]) {
      try {
        listener(this.#view);
      } catch (error) {
        this.#onError('A blackjack listener failed', error);
      }
    }
  }
}

// ---------------------------------------------------------------- view

function buildView(
  round: Round | undefined,
  roundNumber: number,
  balance: number,
  result: { readonly balanceBefore: number; readonly detail: string } | undefined,
): BlackjackView {
  if (round === undefined) return { ...IDLE_VIEW, round: roundNumber };

  const settled = round.phase === 'settled';
  const { settlement } = round;

  const hands: HandView[] = round.hands.map((hand, index) => {
    const { total, soft } = scoreHand(hand.cards);
    const handResult = settlement?.hands[index];
    return {
      cards: hand.cards,
      bet: hand.bet,
      total,
      soft,
      doubled: hand.doubled,
      active: !settled && index === round.active,
      ...(handResult === undefined ? {} : { outcome: handResult.outcome, payout: handResult.payout }),
    };
  });

  const rules = availableActions(round);
  const activeBet = round.hands[round.active]?.bet ?? Number.POSITIVE_INFINITY;
  const canAfford = balance >= activeBet;

  const resultView: ResultView | undefined =
    settled && settlement !== undefined && result !== undefined
      ? {
          outcome: outcomeOf(settlement.net),
          blackjack: settlement.hands.some((hand) => hand.outcome === 'blackjack'),
          net: settlement.net,
          payout: settlement.payout,
          staked: settlement.staked,
          detail: result.detail,
          balanceBefore: result.balanceBefore,
        }
      : undefined;

  return {
    round: roundNumber,
    phase: settled ? 'settled' : 'player',
    dealer: {
      // While the player is acting the hole card stays face down: the webview never receives it.
      cards: settled ? round.dealer : [round.dealer[0] ?? null, null],
      total: settled ? scoreHand(round.dealer).total : null,
    },
    hands,
    actions: {
      hit: rules.hit,
      stand: rules.stand,
      double: rules.double && canAfford,
      split: rules.split && canAfford,
    },
    ...(resultView === undefined ? {} : { result: resultView }),
  };
}

// ---------------------------------------------------------------- history text

const WON: readonly HandOutcome[] = ['win', 'blackjack'];
const LOST: readonly HandOutcome[] = ['loss', 'bust'];

/** A short description of the round for the history, such as "Blackjack!" or "Lose 18 vs 20". */
export function describeSettlement(hands: readonly Hand[], settlement: Settlement): string {
  const [hand] = hands;
  const [result] = settlement.hands;
  if (hands.length === 1 && hand !== undefined && result !== undefined) {
    return describeHand(hand, result, settlement);
  }

  const count = (outcomes: readonly HandOutcome[]): number =>
    settlement.hands.filter((handResult) => outcomes.includes(handResult.outcome)).length;
  const parts = [
    count(WON) > 0 ? `${count(WON)} won` : undefined,
    count(LOST) > 0 ? `${count(LOST)} lost` : undefined,
    count(['push']) > 0 ? `${count(['push'])} push` : undefined,
  ].filter((part): part is string => part !== undefined);
  return `Split: ${parts.join(', ')}`;
}

function describeHand(hand: Hand, result: HandResult, settlement: Settlement): string {
  const total = scoreHand(hand.cards).total;
  const prefix = hand.doubled ? 'Doubled: ' : '';
  switch (result.outcome) {
    case 'blackjack':
      return 'Blackjack!';
    case 'bust':
      return `${prefix}Bust with ${total}`;
    case 'win':
      return settlement.dealerBust
        ? `${prefix}Dealer bust (${settlement.dealerTotal})`
        : `${prefix}Win ${total} vs ${settlement.dealerTotal}`;
    case 'loss':
      return settlement.dealerBlackjack ? 'Dealer blackjack' : `${prefix}Lose ${total} vs ${settlement.dealerTotal}`;
    case 'push':
      return settlement.dealerBlackjack ? 'Push: both blackjack' : `${prefix}Push on ${total}`;
  }
}
