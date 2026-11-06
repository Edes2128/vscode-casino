import { useId, type ReactNode } from 'react';
import { cx } from '../cx';

interface ChoiceCardProps {
  readonly selected: boolean;
  readonly label: string;
  /** One line under the name. */
  readonly description?: string | undefined;
  readonly onSelect: () => void;
  /** What the choice looks like. */
  readonly children: ReactNode;
}

/**
 * One option of a set: a preview, a name, and a clear mark when it is the one in use. It is a radio button,
 * so it works by keyboard and is announced by a screen reader as "selected". The mark is words as well as a
 * border color, so it can be seen without telling colors apart.
 */
export function ChoiceCard({ selected, label, description, onSelect, children }: ChoiceCardProps) {
  const descriptionId = useId();
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-describedby={description === undefined ? undefined : descriptionId}
      className={cx('choice', selected && 'choice--selected')}
      onClick={onSelect}
    >
      <span className="choice__preview" aria-hidden="true">
        {children}
      </span>
      <span className="choice__name">
        {label}
        {selected && <span className="choice__mark">IN USE</span>}
      </span>
      {description !== undefined && (
        <span id={descriptionId} className="choice__desc">
          {description}
        </span>
      )}
    </button>
  );
}

interface ChoiceGridProps {
  /** Accessible name of the set, such as "Theme". */
  readonly label: string;
  readonly children: ReactNode;
}

export function ChoiceGrid({ label, children }: ChoiceGridProps) {
  return (
    <div className="choice-grid" role="radiogroup" aria-label={label}>
      {children}
    </div>
  );
}
