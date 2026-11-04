import { playDealer } from './dealer';
import { BLACKJACK, isBlackjack, isBust, isPair, scoreHand } from './scoring';
import { MAX_HANDS, type Actions, type Card, type Hand, type HandResult, type Round, type Settlement } from './types';

export { MAX_HANDS };

export type EngineResult =
  | { readonly ok: true; readonly round: Round }
  | { readonly ok: false; readonly error: 'not-allowed' };

const NOT_ALLOWED: EngineResult = { ok: false, error: 'not-allowed' };
const NONE: Actions = { hit: false, stand: false, double: false, split: false };

/** A natural is a two-card 21 on the original deal. A split hand that reaches 21 is just a 21. */
export const isNatural = (hand: Hand): boolean => hand.origin === 'dealt' && isBlackjack(hand.cards);

/** A hand the player is finished with: stood, doubled, busted or sitting on 21. */
const isFinished = (hand: Hand): boolean => hand.stood || hand.doubled || scoreHand(hand.cards).total >= BLACKJACK;

function draw(deck: readonly Card[]): { readonly card: Card; readonly deck: readonly Card[] } {
  const card = deck[0];
  if (card === undefined) throw new Error('The deck ran out of cards');
  return { card, deck: deck.slice(1) };
}

const replaceAt = <T>(items: readonly T[], index: number, ...replacement: readonly T[]): T[] => [
  ...items.slice(0, index),
  ...replacement,
  ...items.slice(index + 1),
];

/**
 * Deals a round: player, dealer (face up), player, dealer (hole card). Cards come from the top of
 * `deck`. If either side has a natural blackjack the round is decided on the spot.
 */
export function startRound(deck: readonly Card[], bet: number): Round {
  if (!Number.isSafeInteger(bet) || bet <= 0) throw new RangeError(`Invalid bet: ${bet}`);

  const [first, up, second, hole, ...rest] = deck;
  if (first === undefined || up === undefined || second === undefined || hole === undefined) {
    throw new Error('A round needs at least four cards');
  }

  const round: Round = {
    phase: 'player',
    deck: rest,
    dealer: [up, hole],
    hands: [{ cards: [first, second], bet, origin: 'dealt', doubled: false, stood: false }],
    active: 0,
  };
  const naturals = isBlackjack(round.dealer) || round.hands.some(isNatural);
  return naturals ? settle(round) : round;
}

/** What the player may do with the active hand, by the rules alone (the wallet is checked elsewhere). */
export function availableActions(round: Round): Actions {
  if (round.phase !== 'player') return NONE;
  const hand = round.hands[round.active];
  if (hand === undefined || isFinished(hand)) return NONE;

  const twoCards = hand.cards.length === 2;
  return {
    hit: true,
    stand: true,
    double: twoCards,
    split: twoCards && isPair(hand.cards) && round.hands.length < MAX_HANDS,
  };
}

export function hit(round: Round): EngineResult {
  if (!availableActions(round).hit) return NOT_ALLOWED;
  const hand = activeHand(round);
  const { card, deck } = draw(round.deck);
  return ok(advance({ ...round, deck, hands: replaceAt(round.hands, round.active, { ...hand, cards: [...hand.cards, card] }) }));
}

export function stand(round: Round): EngineResult {
  if (!availableActions(round).stand) return NOT_ALLOWED;
  const hand = activeHand(round);
  return ok(advance({ ...round, hands: replaceAt(round.hands, round.active, { ...hand, stood: true }) }));
}

/** Doubles the bet on a two-card hand, takes exactly one more card and stands. */
export function doubleDown(round: Round): EngineResult {
  if (!availableActions(round).double) return NOT_ALLOWED;
  const hand = activeHand(round);
  const { card, deck } = draw(round.deck);
  const doubled: Hand = { ...hand, cards: [...hand.cards, card], bet: hand.bet * 2, doubled: true, stood: true };
  return ok(advance({ ...round, deck, hands: replaceAt(round.hands, round.active, doubled) }));
}

/**
 * Splits a pair into two hands with the same bet each, dealing a second card to each. Split aces
 * receive exactly one card each and stand.
 */
export function split(round: Round): EngineResult {
  if (!availableActions(round).split) return NOT_ALLOWED;
  const hand = activeHand(round);
  const [left, right] = hand.cards as readonly [Card, Card];

  const first = draw(round.deck);
  const second = draw(first.deck);
  const standsAfterOneCard = left.rank === 'A';
  const make = (kept: Card, dealt: Card): Hand => ({
    cards: [kept, dealt],
    bet: hand.bet,
    origin: 'split',
    doubled: false,
    stood: standsAfterOneCard,
  });

  const hands = replaceAt(round.hands, round.active, make(left, first.card), make(right, second.card));
  return ok(advance({ ...round, deck: second.deck, hands }));
}

const ok = (round: Round): EngineResult => ({ ok: true, round });

function activeHand(round: Round): Hand {
  const hand = round.hands[round.active];
  if (hand === undefined) throw new Error('No active hand');
  return hand;
}

/** Moves on to the next hand that still needs playing, or lets the dealer play when none is left. */
function advance(round: Round): Round {
  const next = round.hands.findIndex((hand, index) => index >= round.active && !isFinished(hand));
  return next >= 0 ? { ...round, active: next } : settle(round);
}

/** The dealer plays (if anyone is still in), then every hand is paid. */
function settle(round: Round): Round {
  // The dealer only needs to draw if some hand could still win against a non-natural result.
  const dealerHasNatural = isBlackjack(round.dealer);
  const dealerNeeded = !dealerHasNatural && round.hands.some((hand) => !isBust(hand.cards) && !isNatural(hand));
  const played = dealerNeeded ? playDealer(round.dealer, round.deck) : { dealer: round.dealer, deck: round.deck };

  const dealerTotal = scoreHand(played.dealer).total;
  const dealerBust = dealerTotal > BLACKJACK;
  const results = round.hands.map((hand) => resolveHand(hand, { total: dealerTotal, bust: dealerBust, blackjack: dealerHasNatural }));

  const staked = round.hands.reduce((sum, hand) => sum + hand.bet, 0);
  const payout = results.reduce((sum, result) => sum + result.payout, 0);
  const settlement: Settlement = {
    hands: results,
    staked,
    payout,
    net: payout - staked,
    dealerTotal,
    dealerBust,
    dealerBlackjack: dealerHasNatural,
  };

  return { ...round, phase: 'settled', dealer: played.dealer, deck: played.deck, settlement };
}

interface DealerFinal {
  readonly total: number;
  readonly bust: boolean;
  readonly blackjack: boolean;
}

/** Blackjack pays 3:2. A half chip is rounded down, in the house's favour. */
export const blackjackPayout = (bet: number): number => bet + Math.floor((bet * 3) / 2);

function resolveHand(hand: Hand, dealer: DealerFinal): HandResult {
  const { total } = scoreHand(hand.cards);

  if (total > BLACKJACK) return { outcome: 'bust', payout: 0 };
  if (isNatural(hand)) {
    return dealer.blackjack
      ? { outcome: 'push', payout: hand.bet }
      : { outcome: 'blackjack', payout: blackjackPayout(hand.bet) };
  }
  if (dealer.blackjack) return { outcome: 'loss', payout: 0 };
  if (dealer.bust || total > dealer.total) return { outcome: 'win', payout: hand.bet * 2 };
  if (total === dealer.total) return { outcome: 'push', payout: hand.bet };
  return { outcome: 'loss', payout: 0 };
}
