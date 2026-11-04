import type { Actions } from '../../game/blackjack/types';
import { PixelButton } from './PixelButton';

export type PlayerMove = 'hit' | 'stand' | 'double' | 'split';

interface ActionBarProps {
  /** What the host says the player may do right now. */
  readonly actions: Actions;
  /** Waiting for the host to answer the last move. */
  readonly disabled: boolean;
  readonly onMove: (move: PlayerMove) => void;
}

/** HIT, STAND, DOUBLE and SPLIT. A move the rules or the wallet forbid is disabled. */
export function ActionBar({ actions, disabled, onMove }: ActionBarProps) {
  return (
    <div className="action-bar" role="group" aria-label="Your move">
      <PixelButton variant="primary" disabled={disabled || !actions.hit} onClick={() => onMove('hit')}>
        HIT
      </PixelButton>
      <PixelButton variant="gold" disabled={disabled || !actions.stand} onClick={() => onMove('stand')}>
        STAND
      </PixelButton>
      <PixelButton variant="ghost" disabled={disabled || !actions.double} onClick={() => onMove('double')}>
        DOUBLE
      </PixelButton>
      <PixelButton variant="ghost" disabled={disabled || !actions.split} onClick={() => onMove('split')}>
        SPLIT
      </PixelButton>
    </div>
  );
}
