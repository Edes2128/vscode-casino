import { MIN_BET, type ChipValue } from '../casino/chips';

/** Most digits a typed bet may have. Keeps the number comfortably inside the safe integer range. */
const MAX_BET_DIGITS = 9;

/** Adds a chip to the bet, never beyond what the player has. */
export const addChip = (bet: number, chip: ChipValue, balance: number): number => Math.min(bet + chip, balance);

/** Reads what was typed into the bet box: digits only, and an empty box is 0. */
export function parseBetInput(text: string): number {
  const digits = text.replace(/\D/g, '').slice(0, MAX_BET_DIGITS);
  return digits === '' ? 0 : Number.parseInt(digits, 10);
}

export type BetProblem = 'too-low' | 'too-high';

/** What is wrong with a bet, if anything. The host re-checks every bet; this is for the player's benefit. */
export function betProblem(bet: number, balance: number): BetProblem | undefined {
  if (bet > balance) return 'too-high';
  if (bet < MIN_BET) return 'too-low';
  return undefined;
}

export function betProblemText(problem: BetProblem): string {
  return problem === 'too-high' ? 'NOT ENOUGH CHIPS' : `MIN BET IS ${MIN_BET}`;
}

/** The player-facing reason for a refusal from the host. */
export function rejectionText(error: string): string {
  switch (error) {
    case 'below-minimum':
      return `MIN BET IS ${MIN_BET}`;
    case 'insufficient-funds':
      return 'NOT ENOUGH CHIPS';
    case 'invalid-amount':
      return 'BET WHOLE CHIPS ONLY';
    case 'round-active':
      return 'FINISH THIS HAND FIRST';
    case 'not-allowed':
      return 'THAT MOVE IS NOT ALLOWED';
    default:
      return 'THE TABLE IS BUSY. TRY AGAIN';
  }
}
