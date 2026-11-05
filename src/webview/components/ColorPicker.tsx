import { ROULETTE_COLORS, sameSelection, type RouletteSelection } from '../../game/roulette/types';
import { PAYOUT_ODDS } from '../../game/roulette/betting';
import { cx } from '../cx';

interface ColorPickerProps {
  readonly value: RouletteSelection | undefined;
  readonly onChange: (selection: RouletteSelection) => void;
  readonly disabled?: boolean;
}

/** The three colour bets: red, black or green. A colour is chosen by name; a number is chosen on the number grid. */
export function ColorPicker({ value, onChange, disabled = false }: ColorPickerProps) {
  return (
    <div className="color-picker" role="radiogroup" aria-label="Pick a color to bet on">
      {ROULETTE_COLORS.map((color) => {
        const selection: RouletteSelection = { kind: 'color', color };
        const selected = sameSelection(value, selection);
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            className={cx('color-pick', `color-pick--${color}`, selected && 'color-pick--selected')}
            onClick={() => onChange(selection)}
          >
            <span className="color-pick__name">{color.toUpperCase()}</span>
            <span className="color-pick__odds">{PAYOUT_ODDS[color]} TO 1</span>
          </button>
        );
      })}
    </div>
  );
}
