import type { ReactNode } from 'react';
import { cx } from '../cx';
import { PixelButton } from './PixelButton';

interface GameCardProps {
  readonly title: string;
  readonly tagline: string;
  /** Decorative illustration. */
  readonly art: ReactNode;
  readonly tone: 'felt' | 'red';
  readonly onPlay: () => void;
}

/**
 * A lobby entry for one game. The whole card is clickable for mouse users; the PLAY button
 * is the keyboard and screen-reader control, and its click bubbles up to the card.
 */
export function GameCard({ title, tagline, art, tone, onPlay }: GameCardProps) {
  return (
    <article className={cx('game-card', 'px-frame', `game-card--${tone}`)} onClick={onPlay}>
      <div className="game-card__art" aria-hidden="true">
        {art}
      </div>
      <h3 className="game-card__title">{title}</h3>
      <p className="game-card__tagline">{tagline}</p>
      <PixelButton variant="gold" block aria-label={`Play ${title}`}>
        PLAY
      </PixelButton>
    </article>
  );
}
