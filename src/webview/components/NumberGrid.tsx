import { HIGHEST_NUMBER, sameSelection, type RouletteSelection } from '../../game/roulette/types';
import { NUMBER_ODDS } from '../../game/roulette/betting';
import { colorOfNumber } from '../../game/roulette/wheel';
import { cx } from '../cx';

interface NumberGridProps {
  readonly value: RouletteSelection | undefined;
  readonly onChange: (selection: RouletteSelection) => void;
  readonly disabled?: boolean;
  /** The number the ball last landed on, marked so the player can see it among the others. */
  readonly lastNumber?: number | undefined;
}

/** 0 on its own, then 1 to 36 in rows of three, as on the cloth of a roulette table. */
const ROWS: ReadonlyArray<readonly number[]> = Array.from({ length: HIGHEST_NUMBER / 3 }, (_, row) => [row * 3 + 1, row * 3 + 2, row * 3 + 3]);

/** All 37 numbers of a European wheel, to bet on one of them straight up (35 to 1). */
export function NumberGrid({ value, onChange, disabled = false, lastNumber }: NumberGridProps) {
  const pick = (number: number) => {
    const selection: RouletteSelection = { kind: 'number', number };
    const color = colorOfNumber(number);
    const selected = sameSelection(value, selection);
    return (
      <button
        key={number}
        type="button"
        role="radio"
        aria-checked={selected}
        aria-label={`Number ${number}, ${color}, pays ${NUMBER_ODDS} to 1${number === lastNumber ? ', the last number' : ''}`}
        disabled={disabled}
        className={cx(
          'number-pick',
          `number-pick--${color}`,
          number === 0 && 'number-pick--zero',
          selected && 'number-pick--selected',
          number === lastNumber && 'number-pick--last',
        )}
        onClick={() => onChange(selection)}
      >
        {number}
      </button>
    );
  };

  return (
    <div className="number-grid" role="radiogroup" aria-label="Pick a number to bet on">
      {pick(0)}
      {ROWS.flat().map(pick)}
    </div>
  );
}
