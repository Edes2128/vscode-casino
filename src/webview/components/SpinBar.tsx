import { oddsOf } from '../../game/roulette/betting';
import type { RouletteSelection } from '../../game/roulette/types';
import { formatChips } from '../format';
import { selectionLabel } from '../rouletteText';
import { PixelButton } from './PixelButton';

interface SpinBarProps {
  readonly selection: RouletteSelection | undefined;
  readonly bet: number;
  readonly spinning: boolean;
  readonly canSpin: boolean;
  readonly onSpin: () => void;
  /** The host's most recent refusal, shown right above the button where the player is looking. */
  readonly notice?: string | undefined;
}

/**
 * What is about to be bet, and the SPIN button. It stays at the bottom of the view while the page scrolls, so the
 * button is never somewhere below the fold that the player has to hunt for.
 */
export function SpinBar({ selection, bet, spinning, canSpin, onSpin, notice }: SpinBarProps) {
  return (
    <div className="action-dock rl-spin-bar">
      <p className="rl-spin-bar__bet" aria-live="polite">
        {selection === undefined ? (
          'PICK A COLOR OR A NUMBER'
        ) : (
          <>
            <span>
              BET <b>{formatChips(bet)}</b> ON <b>{selectionLabel(selection)}</b>
            </span>
            <span className="rl-spin-bar__pays">
              WIN <b>+{formatChips(bet * oddsOf(selection))}</b>
            </span>
          </>
        )}
      </p>
      {notice !== undefined && (
        <p className="bj-notice" role="alert">
          {notice}
        </p>
      )}
      <PixelButton variant="gold" size="lg" block disabled={!canSpin} onClick={onSpin}>
        {spinning ? 'SPINNING' : selection === undefined ? 'PICK A BET' : 'SPIN'}
      </PixelButton>
    </div>
  );
}
