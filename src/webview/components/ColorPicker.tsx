import { ROULETTE_COLORS, type RouletteColor } from '../../game/roulette/types';
import { PAYOUT_ODDS } from '../../game/roulette/betting';
import { cx } from '../cx';

interface ColorPickerProps {
  readonly value: RouletteColor | undefined;
  readonly onChange: (color: RouletteColor) => void;
  readonly disabled?: boolean;
}

/** The three bets: red, black or green. Nothing else can be bet on. */
export function ColorPicker({ value, onChange, disabled = false }: ColorPickerProps) {
  return (
    <div className="color-picker" role="radiogroup" aria-label="Pick a color to bet on">
      {ROULETTE_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          disabled={disabled}
          className={cx('color-pick', `color-pick--${color}`, value === color && 'color-pick--selected')}
          onClick={() => onChange(color)}
        >
          <span className="color-pick__name">{color.toUpperCase()}</span>
          <span className="color-pick__odds">{PAYOUT_ODDS[color]} TO 1</span>
        </button>
      ))}
    </div>
  );
}
