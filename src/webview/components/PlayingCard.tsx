import { useEffect, useRef, useState } from 'react';
import type { Card, Rank } from '../../game/blackjack/types';
import { isRedSuit, SUIT_GLYPHS, SUIT_PALETTE } from '../art/suits';
import { cssVars } from '../cssVars';
import { cx } from '../cx';
import { PixelSprite } from './PixelSprite';

const RANK_NAMES: Partial<Record<Rank, string>> = { A: 'ace', J: 'jack', Q: 'queen', K: 'king' };

const describe = (card: Card): string => `${RANK_NAMES[card.rank] ?? card.rank} of ${card.suit}`;

interface PlayingCardProps {
  /** `null` is a face-down card. */
  readonly card: Card | null;
  /** Delay before the card flies in, so the opening cards arrive one after another. */
  readonly dealDelayMs?: number;
}

/**
 * A pixel-art playing card. It flies in when it first appears, and flips (once) if it was face
 * down and is turned over, as the dealer's hole card is.
 */
export function PlayingCard({ card, dealDelayMs = 0 }: PlayingCardProps) {
  const faceDown = card === null;
  const wasFaceDown = useRef(faceDown);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    if (wasFaceDown.current && !faceDown) setFlipped(true);
    wasFaceDown.current = faceDown;
  }, [faceDown]);

  const style = cssVars({ '--deal-delay': `${dealDelayMs}ms` });

  if (card === null) {
    return <div className="playing-card playing-card--back" style={style} role="img" aria-label="Face-down card" />;
  }

  return (
    <div
      className={cx('playing-card', 'playing-card--face', isRedSuit(card.suit) && 'playing-card--red', flipped && 'playing-card--flip')}
      style={style}
      role="img"
      aria-label={describe(card)}
    >
      <span className="playing-card__rank" aria-hidden="true">
        {card.rank}
      </span>
      <PixelSprite rows={SUIT_GLYPHS[card.suit]} palette={SUIT_PALETTE} className="playing-card__suit" />
      <span className="playing-card__rank playing-card__rank--end" aria-hidden="true">
        {card.rank}
      </span>
    </div>
  );
}
