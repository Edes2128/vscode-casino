import { isCount, isRecord, MAX_DETAIL_LENGTH } from '../../casino/snapshot';
import { parseSelection, type Pocket, type RouletteSelection } from './types';
import { colorOfNumber, POCKET_COUNT } from './wheel';

/** How many recent results the table remembers. */
export const MAX_RECENT = 12;

/** What happened on the latest spin. */
export interface SpinView {
  /** Where the ball landed. */
  readonly pocket: Pocket;
  /** What the player bet on. */
  readonly selection: RouletteSelection;
  readonly bet: number;
  readonly won: boolean;
  /** Net chips for the spin: positive when won, negative when lost. */
  readonly net: number;
  /** Chips returned to the player: the stake back plus winnings, or 0. */
  readonly payout: number;
  readonly detail: string;
  /** The balance just before the spin was paid, so the screen can keep showing it until the wheel stops. */
  readonly balanceBefore: number;
}

/** The roulette table as the webview is allowed to see it. */
export interface RouletteView {
  /** Counts up with every spin. 0 means no spin yet in this session. */
  readonly spin: number;
  readonly last?: SpinView;
  /** The most recent winning pockets, newest first. */
  readonly recent: readonly Pocket[];
}

export const IDLE_ROULETTE_VIEW: RouletteView = { spin: 0, recent: [] };

// ---------------------------------------------------------------- actions (webview to host)

/** The only thing a player can do: bet on a colour or a number, and spin. */
export interface RouletteAction {
  readonly kind: 'spin';
  readonly selection: RouletteSelection;
  readonly bet: number;
}

/**
 * Validates an action from the webview. The selection must be a colour bet on one of the three colours or a number bet
 * on 0 to 36, and nothing else; the wallet judges the amount.
 */
export function parseRouletteAction(raw: unknown): RouletteAction | undefined {
  if (!isRecord(raw) || raw['kind'] !== 'spin') return undefined;
  const selection = parseSelection(raw['selection']);
  const { bet } = raw;
  return selection !== undefined && typeof bet === 'number' ? { kind: 'spin', selection, bet } : undefined;
}

// ---------------------------------------------------------------- guard (host to webview)

/** A pocket that exists on the wheel and has the colour the wheel gives it. */
export function isPocket(value: unknown): value is Pocket {
  return (
    isRecord(value) &&
    isCount(value['number']) &&
    value['number'] < POCKET_COUNT &&
    value['color'] === colorOfNumber(value['number'])
  );
}

function isSpinView(value: unknown): value is SpinView {
  return (
    isRecord(value) &&
    isPocket(value['pocket']) &&
    parseSelection(value['selection']) !== undefined &&
    isCount(value['bet']) &&
    typeof value['won'] === 'boolean' &&
    typeof value['net'] === 'number' &&
    Number.isSafeInteger(value['net']) &&
    isCount(value['payout']) &&
    typeof value['detail'] === 'string' &&
    value['detail'].length <= MAX_DETAIL_LENGTH &&
    isCount(value['balanceBefore'])
  );
}

/** Structural check of a roulette view received over the messaging channel. */
export function isRouletteView(value: unknown): value is RouletteView {
  if (!isRecord(value)) return false;
  const { recent, last } = value;
  return (
    isCount(value['spin']) &&
    Array.isArray(recent) &&
    recent.length <= MAX_RECENT &&
    recent.every(isPocket) &&
    (last === undefined || isSpinView(last))
  );
}
