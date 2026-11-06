import { MIN_BET } from '../../state/chips';
import type { RouletteSelection } from '../../game/roulette/types';
import { BetControls } from './BetControls';
import { ColorPicker } from './ColorPicker';
import { NumberGrid } from './NumberGrid';
import { OutOfChips } from './OutOfChips';
import { SegmentedControl } from './SegmentedControl';
import { SpinBar } from './SpinBar';

export type BetKind = 'color' | 'number';

const BET_KINDS = [
  { value: 'color', label: 'COLOR' },
  { value: 'number', label: 'NUMBER' },
] as const satisfies ReadonlyArray<{ value: BetKind; label: string }>;

interface RouletteControlsProps {
  readonly chips: number;
  readonly bet: number;
  readonly onBetChange: (bet: number) => void;
  readonly selection: RouletteSelection | undefined;
  readonly onSelectionChange: (selection: RouletteSelection) => void;
  readonly betKind: BetKind;
  readonly onBetKindChange: (kind: BetKind) => void;
  /** The wheel is turning. Nothing can be changed and no other spin can be started until it has stopped. */
  readonly spinning: boolean;
  /** A spin has been sent and the host has not answered yet. */
  readonly pending: boolean;
  readonly canSpin: boolean;
  readonly onSpin: () => void;
  /** The host's most recent refusal. */
  readonly notice: string | undefined;
  /** The number the ball landed on last, marked on the number grid. */
  readonly lastNumber: number | undefined;
  readonly onOpenSettings: () => void;
}

/**
 * Everything the player uses to place a bet and spin: what to bet on, how much, and the SPIN button. While the wheel
 * turns (or the host has not answered yet) every one of them is switched off, so a second spin cannot be started.
 */
export function RouletteControls({
  chips,
  bet,
  onBetChange,
  selection,
  onSelectionChange,
  betKind,
  onBetKindChange,
  spinning,
  pending,
  canSpin,
  onSpin,
  notice,
  lastNumber,
  onOpenSettings,
}: RouletteControlsProps) {
  if (chips < MIN_BET && !spinning) return <OutOfChips onOpenSettings={onOpenSettings} />;
  const locked = spinning || pending;
  return (
    <>
      <SegmentedControl label="Bet on" options={BET_KINDS} value={betKind} onChange={onBetKindChange} />
      {betKind === 'color' ? (
        <ColorPicker value={selection} onChange={onSelectionChange} disabled={locked} />
      ) : (
        <NumberGrid value={selection} onChange={onSelectionChange} disabled={locked} lastNumber={lastNumber} />
      )}
      <BetControls balance={chips} bet={bet} onBetChange={onBetChange} disabled={locked} />
      <SpinBar selection={selection} bet={bet} spinning={spinning} canSpin={canSpin} onSpin={onSpin} notice={notice} />
    </>
  );
}
