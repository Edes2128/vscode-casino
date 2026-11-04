import type { Pocket } from '../../game/roulette/types';
import { cx } from '../cx';

interface PocketBadgeProps {
  readonly pocket: Pocket;
  readonly size?: 'sm' | 'lg';
}

/** A square in a pocket's colour with its number: how the wheel shows a result. */
export function PocketBadge({ pocket, size = 'sm' }: PocketBadgeProps) {
  return (
    <span
      className={cx('pocket-badge', `pocket-badge--${pocket.color}`, `pocket-badge--${size}`)}
      role="img"
      aria-label={`${pocket.color} ${pocket.number}`}
    >
      {pocket.number}
    </span>
  );
}
