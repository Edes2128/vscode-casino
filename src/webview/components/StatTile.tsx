import { cx } from '../cx';
import { formatChips } from '../format';

export type StatTone = 'plain' | 'win' | 'loss';

interface StatTileProps {
  readonly label: string;
  readonly value: number;
  readonly tone?: StatTone;
}

/** One label/value pair. Render inside a `<dl className="stat-strip">`. */
export function StatTile({ label, value, tone = 'plain' }: StatTileProps) {
  return (
    <div className={cx('stat-tile', `stat-tile--${tone}`)}>
      <dt className="stat-tile__label">{label}</dt>
      <dd className="stat-tile__value">{formatChips(value)}</dd>
    </div>
  );
}
