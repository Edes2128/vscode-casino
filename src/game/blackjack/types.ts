export const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'] as const;
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;

/** A player may hold at most this many hands after splitting. */
export const MAX_HANDS = 4;

export type Suit = (typeof SUITS)[number];
export type Rank = (typeof RANKS)[number];

export interface Card {
  readonly rank: Rank;
  readonly suit: Suit;
}

export interface Hand {
  readonly cards: readonly Card[];
  /** Chips staked on this hand, including a double down. */
  readonly bet: number;
  /** `split` hands can never be a natural blackjack, even when they total 21 with two cards. */
  readonly origin: 'dealt' | 'split';
  readonly doubled: boolean;
  /** The player is done with this hand (stood, doubled, or split aces). */
  readonly stood: boolean;
}

/** `player`: the player is acting. `settled`: the dealer has played and every hand is decided. */
export type RoundPhase = 'player' | 'settled';

export type HandOutcome = 'blackjack' | 'win' | 'push' | 'loss' | 'bust';

export interface HandResult {
  readonly outcome: HandOutcome;
  /** Chips returned to the player for this hand: the stake back plus winnings, or 0. */
  readonly payout: number;
}

export interface Settlement {
  readonly hands: readonly HandResult[];
  /** Total chips staked on the round (every hand, doubles included). */
  readonly staked: number;
  /** Total chips returned to the player. */
  readonly payout: number;
  /** `payout - staked`: positive when the player came out ahead. */
  readonly net: number;
  readonly dealerTotal: number;
  readonly dealerBust: boolean;
  readonly dealerBlackjack: boolean;
}

export interface Round {
  readonly phase: RoundPhase;
  /** Cards still in the deck. The next card is `deck[0]`. */
  readonly deck: readonly Card[];
  /** The dealer's cards. `dealer[1]` is the hole card until the round is settled. */
  readonly dealer: readonly Card[];
  readonly hands: readonly Hand[];
  /** Index of the hand being played. Only meaningful while `phase` is `player`. */
  readonly active: number;
  readonly settlement?: Settlement;
}

export interface Actions {
  readonly hit: boolean;
  readonly stand: boolean;
  readonly double: boolean;
  readonly split: boolean;
}
