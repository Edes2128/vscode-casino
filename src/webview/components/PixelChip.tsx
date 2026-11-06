import type { ChipValue } from '../../state/chips';
import { CHIP_PALETTES, CHIP_ROWS_LARGE, CHIP_ROWS_SMALL, tintChip } from '../art/chip';
import { useAppearance } from '../customization/AppearanceContext';
import { cx } from '../cx';
import { PixelSprite } from './PixelSprite';

export type ChipSize = 'sm' | 'md' | 'lg';

interface PixelChipProps {
  readonly value: ChipValue;
  readonly size?: ChipSize;
  readonly selected?: boolean;
  readonly disabled?: boolean;
  /** When given, the chip is a toggle button; otherwise it is plain decoration. */
  readonly onSelect?: (value: ChipValue) => void;
}

/** A chip in the colour of its denomination. The small size has no printed value. */
export function PixelChip({ value, size = 'md', selected = false, disabled = false, onSelect }: PixelChipProps) {
  const tint = useAppearance().resolved.tokens.chip;
  const className = cx('px-chip', `px-chip--${size}`, `px-chip--v${value}`, selected && 'px-chip--selected');
  const face = (
    <>
      <PixelSprite rows={size === 'sm' ? CHIP_ROWS_SMALL : CHIP_ROWS_LARGE} palette={tintChip(CHIP_PALETTES[value], tint)} />
      {size !== 'sm' && (
        <span className="px-chip__label" aria-hidden="true">
          {value}
        </span>
      )}
    </>
  );

  if (onSelect === undefined) {
    return (
      <span className={className} role="img" aria-label={`${value} chip`}>
        {face}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={className}
      aria-pressed={selected}
      aria-label={`${value} chip`}
      data-sound="chip"
      disabled={disabled}
      onClick={() => onSelect(value)}
    >
      {face}
    </button>
  );
}
