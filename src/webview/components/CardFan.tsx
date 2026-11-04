import type { Card } from '../../game/blackjack/types';
import { cssVars } from '../cssVars';
import { PlayingCard } from './PlayingCard';

interface CardFanProps {
  /** `null` is a face-down card. */
  readonly cards: readonly (Card | null)[];
  readonly owner: 'dealer' | 'player';
}

/** Cards of the opening deal arrive in this order: player, dealer, player, dealer. */
const OPENING_DELAYS_MS = { player: [0, 360], dealer: [180, 540] } as const;

/** A row of overlapping cards. */
export function CardFan({ cards, owner }: CardFanProps) {
  return (
    <div className="card-fan" style={cssVars({ '--n': cards.length })}>
      {cards.map((card, index) => (
        <PlayingCard
          // The dealer's cards only ever append or flip, so an index keeps the hole card's identity
          // (and its flip). A player's card is keyed by what it is, so a split hand that gets a new
          // card in the same place deals it in again.
          key={owner === 'dealer' ? index : `${index}-${card?.rank}-${card?.suit}`}
          card={card}
          dealDelayMs={OPENING_DELAYS_MS[owner][index] ?? 0}
        />
      ))}
    </div>
  );
}
