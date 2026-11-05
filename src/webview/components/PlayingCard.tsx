import { useEffect, useRef, useState } from 'react';
import type { CardDesignId } from '../../casino/appearance';
import type { Card, Rank } from '../../game/blackjack/types';
import { glyphsOf, type CardGlyphs } from '../art/cardSuits';
import { isRedSuit } from '../art/suits';
import { useAppearance } from '../customization/AppearanceContext';
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
  /**
   * How the card is drawn. Left out it is the design the player chose (Customize, Cards); a preview passes one
   * to show a design that is not in use. The look is all CSS, keyed off `data-design`, so it follows this and
   * never the page.
   */
  readonly design?: CardDesignId;
}

/**
 * A pixel-art playing card. It flies in when it first appears, and flips (once) if it was face
 * down and is turned over, as the dealer's hole card is.
 */
export function PlayingCard({ card, dealDelayMs = 0, design }: PlayingCardProps) {
  const chosen = useAppearance().cardDesign;
  const look = design ?? chosen;
  const faceDown = card === null;
  const wasFaceDown = useRef(faceDown);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    if (wasFaceDown.current && !faceDown) setFlipped(true);
    wasFaceDown.current = faceDown;
  }, [faceDown]);

  const style = cssVars({ '--deal-delay': `${dealDelayMs}ms` });

  if (card === null) {
    return <div className="playing-card playing-card--back" style={style} data-design={look} role="img" aria-label="Face-down card" />;
  }

  const glyphs = glyphsOf(look);

  return (
    <div
      className={cx('playing-card', 'playing-card--face', isRedSuit(card.suit) && 'playing-card--red', flipped && 'playing-card--flip')}
      style={style}
      data-design={look}
      role="img"
      aria-label={describe(card)}
    >
      <CornerIndex card={card} glyphs={glyphs} />
      <PixelSprite rows={glyphs.centre[card.suit]} palette={glyphs.palette} className="playing-card__suit" />
      <CornerIndex card={card} glyphs={glyphs} end />
    </div>
  );
}

/** The rank over a small suit, as printed in the corner of a real card. It stays readable when cards overlap. */
function CornerIndex({ card, glyphs, end = false }: { readonly card: Card; readonly glyphs: CardGlyphs; readonly end?: boolean }) {
  return (
    <span className={cx('playing-card__index', end && 'playing-card__index--end')} aria-hidden="true">
      <span className="playing-card__rank">{card.rank}</span>
      <PixelSprite rows={glyphs.mini[card.suit]} palette={glyphs.palette} className="playing-card__mini" />
    </span>
  );
}
