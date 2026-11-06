import type { Card } from '../../game/blackjack/types';
import { cssVars } from '../cssVars';
import { PixelChip } from '../components/PixelChip';
import { PlayingCard } from '../components/PlayingCard';
import { AppearanceProvider, useAppearance } from './AppearanceContext';
import type { ResolvedAppearance } from './appearance';

const SAMPLE_HAND: readonly Card[] = [
  { rank: 'A', suit: 'spades' },
  { rank: 'K', suit: 'hearts' },
];

interface ScenePreviewProps {
  readonly resolved: ResolvedAppearance;
  /** A name for screen readers; the picture is decoration. */
  readonly title?: string;
}

/**
 * A small table drawn in the given colors with Lucky Break's own parts: the header, the felt, two cards, a chip
 * and a button. It is what a theme, or a set of colors, looks like, shown at once, with nothing to explain.
 */
export function ScenePreview({ resolved, title }: ScenePreviewProps) {
  const current = useAppearance();
  return (
    <AppearanceProvider value={{ ...current, resolved }}>
      <span className="scene" style={cssVars(resolved.vars)} aria-hidden={title === undefined ? true : undefined} {...(title === undefined ? {} : { role: 'img', 'aria-label': title })}>
        <span className="scene__bar">
          <span className="scene__title">LUCKY BREAK</span>
          <span className="scene__chips">1,000</span>
        </span>
        <span className="scene__table px-frame">
          <span className="scene__hand">
            {SAMPLE_HAND.map((card) => (
              <PlayingCard key={card.rank} card={card} />
            ))}
          </span>
          <PixelChip value={25} size="md" />
        </span>
        <span className="scene__actions">
          {/* Not a real button: the whole preview sits inside a choice that is one. */}
          <span className="px-button px-button--primary px-button--sm">DEAL</span>
          <span className="scene__muted">VIRTUAL CHIPS</span>
        </span>
      </span>
    </AppearanceProvider>
  );
}
