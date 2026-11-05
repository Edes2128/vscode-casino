import type { Pocket, RouletteColor, RouletteSelection } from './types';

/** Winnings per chip bet on a colour. Red and black pay 1:1, green (the zero) pays 35:1. */
export const PAYOUT_ODDS: Readonly<Record<RouletteColor, number>> = { red: 1, black: 1, green: 35 };

/** Winnings per chip bet on a single number: 35 to 1, the European straight-up payout. */
export const NUMBER_ODDS = 35;

/** How many chips are won per chip bet when the selection wins. */
export const oddsOf = (selection: RouletteSelection): number =>
  selection.kind === 'color' ? PAYOUT_ODDS[selection.color] : NUMBER_ODDS;

/** Whether the ball landing in `pocket` wins this bet. */
export const selectionWins = (selection: RouletteSelection, pocket: Pocket): boolean =>
  selection.kind === 'color' ? pocket.color === selection.color : pocket.number === selection.number;

/**
 * The chips returned to the player: the stake back plus the winnings when the bet wins, and nothing otherwise.
 */
export function payoutFor(selection: RouletteSelection, bet: number, pocket: Pocket): number {
  return selectionWins(selection, pocket) ? bet * (oddsOf(selection) + 1) : 0;
}

/** "red", "number 17": how a bet is named in words. */
export const describeSelection = (selection: RouletteSelection): string =>
  selection.kind === 'color' ? selection.color : `number ${selection.number}`;
