import { MIN_BET } from './chips';
import { STARTING_BALANCE } from './snapshot';

export type WalletError =
  /** Not a positive whole number of chips (fractions, NaN, negatives, strings, ...). */
  | 'invalid-amount'
  /** A bet smaller than MIN_BET. */
  | 'below-minimum'
  /** More chips than the balance holds. */
  | 'insufficient-funds';

export type WalletResult =
  | { readonly ok: true; readonly balance: number }
  | { readonly ok: false; readonly error: WalletError };

const fail = (error: WalletError): WalletResult => ({ ok: false, error });

const isChips = (amount: unknown): amount is number =>
  typeof amount === 'number' && Number.isSafeInteger(amount) && amount > 0;

/**
 * The player's chips. Whole chips only, and the balance can never go below zero: every
 * operation validates first and only then changes anything, so a rejected call leaves the
 * wallet exactly as it was.
 */
export class Wallet {
  #balance: number;

  constructor(balance: number = STARTING_BALANCE) {
    if (!Number.isSafeInteger(balance) || balance < 0) {
      throw new RangeError(`Invalid wallet balance: ${balance}`);
    }
    this.#balance = balance;
  }

  get balance(): number {
    return this.#balance;
  }

  /** Takes a bet out of the balance. At least MIN_BET and no more than the balance. */
  placeBet(amount: number): WalletResult {
    if (!isChips(amount)) return fail('invalid-amount');
    if (amount < MIN_BET) return fail('below-minimum');
    return this.#debit(amount);
  }

  /** Takes an extra stake mid-round (double down, split). */
  addStake(amount: number): WalletResult {
    if (!isChips(amount)) return fail('invalid-amount');
    return this.#debit(amount);
  }

  /**
   * Pays chips into the balance: the stake returned plus any winnings. Zero is valid and means
   * the round was lost. The balance is capped at the largest exactly representable integer.
   */
  payout(amount: number): WalletResult {
    if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount < 0) {
      return fail('invalid-amount');
    }
    this.#balance = Math.min(this.#balance + amount, Number.MAX_SAFE_INTEGER);
    return { ok: true, balance: this.#balance };
  }

  /** Back to the starting balance. */
  reset(): void {
    this.#balance = STARTING_BALANCE;
  }

  #debit(amount: number): WalletResult {
    if (amount > this.#balance) return fail('insufficient-funds');
    this.#balance -= amount;
    return { ok: true, balance: this.#balance };
  }
}
