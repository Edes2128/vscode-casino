import { isCount, isRecord, MAX_DETAIL_LENGTH } from '../../casino/snapshot';
import type { GameOutcome } from '../../casino/types';
import { MAX_HANDS, RANKS, SUITS, type Actions, type Card, type HandOutcome } from './types';

/** The table as the webview is allowed to see it. The hole card and the deck are never in here. */
export type TablePhase = 'betting' | 'player' | 'settled';

export interface HandView {
  readonly cards: readonly Card[];
  /** Chips on this hand, including a double down. */
  readonly bet: number;
  readonly total: number;
  /** An ace is counting as 11. */
  readonly soft: boolean;
  readonly doubled: boolean;
  /** The hand the player is acting on. */
  readonly active: boolean;
  /** Set once the round is settled. */
  readonly outcome?: HandOutcome;
  readonly payout?: number;
}

export interface DealerView {
  /** `null` is the face-down hole card. */
  readonly cards: readonly (Card | null)[];
  /** `null` while the hole card is hidden. */
  readonly total: number | null;
}

export interface ResultView {
  readonly outcome: GameOutcome;
  /** At least one hand was a natural blackjack. */
  readonly blackjack: boolean;
  /** Net chips for the round. */
  readonly net: number;
  /** Total chips returned to the player. */
  readonly payout: number;
  /** Total chips staked on the round. */
  readonly staked: number;
  readonly detail: string;
  /** The balance just before the result was paid, so the screen can keep showing it until the dealer is done. */
  readonly balanceBefore: number;
}

export interface BlackjackView {
  /** Counts up with every deal. 0 means no round has been dealt yet. */
  readonly round: number;
  readonly phase: TablePhase;
  readonly dealer: DealerView;
  readonly hands: readonly HandView[];
  /** What the player may do right now, including whether they can afford a double or a split. */
  readonly actions: Actions;
  readonly result?: ResultView;
}

export const IDLE_VIEW: BlackjackView = {
  round: 0,
  phase: 'betting',
  dealer: { cards: [], total: null },
  hands: [],
  actions: { hit: false, stand: false, double: false, split: false },
};

// ---------------------------------------------------------------- actions (webview to host)

export type BlackjackAction =
  | { readonly kind: 'deal'; readonly bet: number }
  | { readonly kind: 'hit' }
  | { readonly kind: 'stand' }
  | { readonly kind: 'double' }
  | { readonly kind: 'split' }
  | { readonly kind: 'newRound' };

/** Validates an action from the webview. The bet is only checked for type here; the wallet judges the amount. */
export function parseBlackjackAction(raw: unknown): BlackjackAction | undefined {
  if (!isRecord(raw)) return undefined;
  switch (raw['kind']) {
    case 'deal':
      return typeof raw['bet'] === 'number' ? { kind: 'deal', bet: raw['bet'] } : undefined;
    case 'hit':
    case 'stand':
    case 'double':
    case 'split':
    case 'newRound':
      return { kind: raw['kind'] };
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------- guard (host to webview)

const isCard = (value: unknown): value is Card =>
  isRecord(value) &&
  (RANKS as readonly unknown[]).includes(value['rank']) &&
  (SUITS as readonly unknown[]).includes(value['suit']);

const MAX_CARDS = 12;
const OUTCOMES: readonly unknown[] = ['blackjack', 'win', 'push', 'loss', 'bust'];
const bool = (value: unknown): value is boolean => typeof value === 'boolean';

function isHandView(value: unknown): value is HandView {
  if (!isRecord(value)) return false;
  const { cards } = value;
  return (
    Array.isArray(cards) &&
    cards.length <= MAX_CARDS &&
    cards.every(isCard) &&
    isCount(value['bet']) &&
    isCount(value['total']) &&
    bool(value['soft']) &&
    bool(value['doubled']) &&
    bool(value['active']) &&
    (value['outcome'] === undefined || OUTCOMES.includes(value['outcome'])) &&
    (value['payout'] === undefined || isCount(value['payout']))
  );
}

function isResultView(value: unknown): value is ResultView {
  return (
    isRecord(value) &&
    (value['outcome'] === 'win' || value['outcome'] === 'loss' || value['outcome'] === 'push') &&
    bool(value['blackjack']) &&
    typeof value['net'] === 'number' &&
    Number.isSafeInteger(value['net']) &&
    isCount(value['payout']) &&
    isCount(value['staked']) &&
    typeof value['detail'] === 'string' &&
    value['detail'].length <= MAX_DETAIL_LENGTH &&
    isCount(value['balanceBefore'])
  );
}

/** Structural check of a table view received over the messaging channel. */
export function isBlackjackView(value: unknown): value is BlackjackView {
  if (!isRecord(value)) return false;
  const { dealer, hands, actions, result } = value;

  return (
    isCount(value['round']) &&
    (value['phase'] === 'betting' || value['phase'] === 'player' || value['phase'] === 'settled') &&
    isRecord(dealer) &&
    Array.isArray(dealer['cards']) &&
    dealer['cards'].length <= MAX_CARDS &&
    dealer['cards'].every((card) => card === null || isCard(card)) &&
    (dealer['total'] === null || isCount(dealer['total'])) &&
    Array.isArray(hands) &&
    hands.length <= MAX_HANDS &&
    hands.every(isHandView) &&
    isRecord(actions) &&
    bool(actions['hit']) &&
    bool(actions['stand']) &&
    bool(actions['double']) &&
    bool(actions['split']) &&
    (result === undefined || isResultView(result))
  );
}
