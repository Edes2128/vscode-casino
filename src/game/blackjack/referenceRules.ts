import { createDeck } from './deck';
import type { Card } from './types';

/**
 * A SECOND implementation of the blackjack rules, written separately from the engine and straight from the
 * rulebook, then played against it. It shares no code with the engine and does its sums differently on purpose
 * (aces counted as 1 and promoted, not counted as 11 and demoted). The rules it states:
 *
 *  - One player, one dealer. Deal: player, dealer (up), player, dealer (hole).
 *  - A two-card 21 on the deal is a blackjack. If the dealer has one the round ends at once: a player
 *    blackjack pushes, anything else loses. If only the player has one it pays 3 to 2, a half chip down.
 *  - A hand that reaches 21 stops. Otherwise: hit, stand, double (two cards only: one card, then stop) and
 *    split (two cards of the same VALUE, so any two ten-value cards; up to four hands in all).
 *  - A split gives each new hand one more card. Split aces get that one card and no more. A 21 after a split
 *    is an ordinary 21, not a blackjack. Doubling after a split is allowed.
 *  - The dealer plays only if some hand is still alive (not bust), draws to 16 and stands on every 17.
 *  - Win pays 1 to 1, push returns the bet, a bust or a lower total loses it.
 */
export const VALUE: Readonly<Record<string, number>> = { A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 10, Q: 10, K: 10 };

export function total(cards: readonly Card[]): number {
  const hard = cards.reduce((sum, card) => sum + (VALUE[card.rank] ?? 0), 0);
  const hasAce = cards.some((card) => card.rank === 'A');
  return hasAce && hard + 10 <= 21 ? hard + 10 : hard;
}

/** The value of a card for the purpose of splitting: aces are worth the same as aces, tens as tens. */
const splitValue = (card: Card): number => (card.rank === 'A' ? 11 : (VALUE[card.rank] ?? 0));

export interface RefHand {
  cards: Card[];
  bet: number;
  fromSplit: boolean;
  done: boolean;
}

export interface Legal {
  hit: boolean;
  stand: boolean;
  double: boolean;
  split: boolean;
}

export class ReferenceRound {
  readonly hands: RefHand[];
  readonly dealer: Card[];
  readonly deck: Card[];
  current = 0;
  over = false;
  payouts: number[] = [];

  constructor(deck: readonly Card[], bet: number) {
    this.deck = [...deck];
    const p1 = this.take();
    const d1 = this.take();
    const p2 = this.take();
    const d2 = this.take();
    this.dealer = [d1, d2];
    this.hands = [{ cards: [p1, p2], bet, fromSplit: false, done: false }];

    const playerNatural = total(this.hands[0]?.cards ?? []) === 21;
    const dealerNatural = total(this.dealer) === 21;
    if (playerNatural || dealerNatural) {
      this.over = true;
      if (dealerNatural) this.payouts = [playerNatural ? bet : 0];
      else this.payouts = [bet + Math.floor((bet * 3) / 2)];
    }
  }

  take(): Card {
    const card = this.deck.shift();
    if (card === undefined) throw new Error('reference: deck ran out');
    return card;
  }

  legal(): Legal {
    const none = { hit: false, stand: false, double: false, split: false };
    if (this.over) return none;
    const hand = this.hands[this.current];
    if (hand === undefined || hand.done) return none;
    const two = hand.cards.length === 2;
    const [a, b] = hand.cards;
    return {
      hit: true,
      stand: true,
      double: two,
      split: two && a !== undefined && b !== undefined && splitValue(a) === splitValue(b) && this.hands.length < 4,
    };
  }

  apply(action: 'hit' | 'stand' | 'double' | 'split'): void {
    const hand = this.hands[this.current];
    if (hand === undefined) throw new Error('reference: no hand');
    if (action === 'hit') {
      hand.cards.push(this.take());
      if (total(hand.cards) >= 21) hand.done = true;
    } else if (action === 'stand') {
      hand.done = true;
    } else if (action === 'double') {
      hand.bet *= 2;
      hand.cards.push(this.take());
      hand.done = true;
    } else {
      const [a, b] = hand.cards as [Card, Card];
      const aces = a.rank === 'A';
      const left: RefHand = { cards: [a, this.take()], bet: hand.bet, fromSplit: true, done: aces };
      const right: RefHand = { cards: [b, this.take()], bet: hand.bet, fromSplit: true, done: aces };
      for (const part of [left, right]) if (total(part.cards) >= 21) part.done = true;
      this.hands.splice(this.current, 1, left, right);
    }
    this.moveOn();
  }

  private moveOn(): void {
    const next = this.hands.findIndex((hand, index) => index >= this.current && !hand.done);
    if (next >= 0) {
      this.current = next;
      return;
    }
    this.finish();
  }

  private finish(): void {
    this.over = true;
    if (this.hands.some((hand) => total(hand.cards) <= 21)) {
      while (total(this.dealer) < 17) this.dealer.push(this.take());
    }
    const dealerTotal = total(this.dealer);
    this.payouts = this.hands.map((hand) => {
      const mine = total(hand.cards);
      if (mine > 21) return 0;
      if (dealerTotal > 21 || mine > dealerTotal) return hand.bet * 2;
      return mine === dealerTotal ? hand.bet : 0;
    });
  }
}

export const text = (cards: readonly Card[]): string => cards.map((card) => `${card.rank}${card.suit[0]}`).join(' ');

export function shuffled(random: () => number): Card[] {
  const deck = createDeck();
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [deck[index], deck[other]] = [deck[other] as Card, deck[index] as Card];
  }
  return deck;
}

