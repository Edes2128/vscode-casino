import { CHIP_VALUES, type ChipValue } from '../../casino/chips';
import { addChip, betProblem, betProblemText, parseBetInput } from '../betting';
import { cx } from '../cx';
import { formatChips } from '../format';
import { PixelButton } from './PixelButton';
import { PixelChip } from './PixelChip';

interface BetControlsProps {
  readonly balance: number;
  readonly bet: number;
  readonly onBetChange: (bet: number) => void;
  readonly disabled?: boolean;
}

/** Chips that add to the bet, a box for a custom amount, and quick CLEAR and MAX. Used by every game. */
export function BetControls({ balance, bet, onBetChange, disabled = false }: BetControlsProps) {
  const problem = bet === 0 ? undefined : betProblem(bet, balance);

  return (
    <div className="bet-controls">
      <div className="bet-controls__chips" role="group" aria-label="Add chips to your bet">
        {CHIP_VALUES.map((value: ChipValue) => (
          <PixelChip
            key={value}
            value={value}
            size="md"
            disabled={disabled || balance < value}
            onSelect={() => onBetChange(addChip(bet, value, balance))}
          />
        ))}
      </div>

      <div className="bet-controls__row">
        <label className="bet-controls__field">
          <span className="bet-controls__label">BET</span>
          <input
            className="bet-controls__input"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={bet === 0 ? '' : String(bet)}
            placeholder="0"
            maxLength={9}
            disabled={disabled}
            aria-label="Bet amount in chips"
            aria-invalid={problem !== undefined}
            onChange={(event) => onBetChange(parseBetInput(event.target.value))}
          />
        </label>
        <PixelButton size="sm" variant="ghost" disabled={disabled || bet === 0} onClick={() => onBetChange(0)}>
          CLEAR
        </PixelButton>
        <PixelButton size="sm" variant="ghost" disabled={disabled || balance === 0} onClick={() => onBetChange(balance)}>
          MAX
        </PixelButton>
      </div>

      <p className={cx('bet-controls__hint', problem !== undefined && 'bet-controls__hint--bad')} role="status">
        {problem === undefined ? `YOU HAVE ${formatChips(balance)} CHIPS` : betProblemText(problem)}
      </p>
    </div>
  );
}
