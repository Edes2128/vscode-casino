import { describe, expect, it } from 'vitest';
import { MIN_BET } from './chips';
import { Wallet } from './wallet';

/** Small deterministic PRNG so the random-walk test is reproducible. */
function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('Wallet', () => {
  it('starts with 1,000 chips', () => {
    expect(new Wallet().balance).toBe(1_000);
  });

  it('rejects an invalid starting balance', () => {
    expect(() => new Wallet(-1)).toThrow(RangeError);
    expect(() => new Wallet(1.5)).toThrow(RangeError);
    expect(() => new Wallet(Number.NaN)).toThrow(RangeError);
  });

  describe('bet deduction', () => {
    it('takes the bet out of the balance', () => {
      const wallet = new Wallet(1_000);
      expect(wallet.placeBet(100)).toEqual({ ok: true, balance: 900 });
      expect(wallet.balance).toBe(900);
    });

    it('accepts the minimum bet and an all-in bet', () => {
      expect(new Wallet(1_000).placeBet(MIN_BET).ok).toBe(true);
      const wallet = new Wallet(250);
      expect(wallet.placeBet(250)).toEqual({ ok: true, balance: 0 });
    });

    it('rejects a bet below the minimum and leaves the balance alone', () => {
      const wallet = new Wallet(1_000);
      expect(wallet.placeBet(MIN_BET - 1)).toEqual({ ok: false, error: 'below-minimum' });
      expect(wallet.placeBet(1)).toEqual({ ok: false, error: 'below-minimum' });
      expect(wallet.balance).toBe(1_000);
    });

    it('rejects anything that is not a positive whole number of chips', () => {
      const wallet = new Wallet(1_000);
      for (const bad of [0, -50, 12.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 2]) {
        expect(wallet.placeBet(bad), `bet ${bad}`).toEqual({ ok: false, error: 'invalid-amount' });
      }
      expect(wallet.placeBet('100' as unknown as number)).toEqual({ ok: false, error: 'invalid-amount' });
      expect(wallet.balance).toBe(1_000);
    });
  });

  describe('insufficient balance', () => {
    it('refuses to bet more than the balance and never goes negative', () => {
      const wallet = new Wallet(100);
      expect(wallet.placeBet(101)).toEqual({ ok: false, error: 'insufficient-funds' });
      expect(wallet.balance).toBe(100);
    });

    it('refuses any bet once the balance is below the minimum', () => {
      const wallet = new Wallet(5);
      expect(wallet.placeBet(MIN_BET)).toEqual({ ok: false, error: 'insufficient-funds' });
      expect(wallet.balance).toBe(5);
    });

    it('refuses an extra stake the balance cannot cover', () => {
      const wallet = new Wallet(100);
      wallet.placeBet(60);
      expect(wallet.addStake(60)).toEqual({ ok: false, error: 'insufficient-funds' });
      expect(wallet.balance).toBe(40);
    });
  });

  describe('extra stakes (double down and split)', () => {
    it('deducts an additional stake', () => {
      const wallet = new Wallet(1_000);
      wallet.placeBet(100);
      expect(wallet.addStake(100)).toEqual({ ok: true, balance: 800 });
    });

    it('rejects invalid extra stakes', () => {
      const wallet = new Wallet(1_000);
      expect(wallet.addStake(0)).toEqual({ ok: false, error: 'invalid-amount' });
      expect(wallet.addStake(-10)).toEqual({ ok: false, error: 'invalid-amount' });
      expect(wallet.addStake(2.5)).toEqual({ ok: false, error: 'invalid-amount' });
      expect(wallet.balance).toBe(1_000);
    });
  });

  describe('payouts', () => {
    it('pays a winning round: the stake back plus the winnings', () => {
      const wallet = new Wallet(1_000);
      wallet.placeBet(100); // 900
      // Even-money win: 100 stake + 100 winnings.
      expect(wallet.payout(200)).toEqual({ ok: true, balance: 1_100 });
    });

    it('pays a green roulette win at 35:1', () => {
      const wallet = new Wallet(1_000);
      wallet.placeBet(10);
      expect(wallet.payout(10 + 10 * 35).ok).toBe(true);
      expect(wallet.balance).toBe(1_000 - 10 + 360);
    });

    it('pays a blackjack at 3:2', () => {
      const wallet = new Wallet(1_000);
      wallet.placeBet(100);
      expect(wallet.payout(100 + 150).ok).toBe(true);
      expect(wallet.balance).toBe(1_150);
    });

    it('returns the stake on a push', () => {
      const wallet = new Wallet(1_000);
      wallet.placeBet(100);
      wallet.payout(100);
      expect(wallet.balance).toBe(1_000);
    });

    it('keeps the deduction when a bet is lost (payout of zero)', () => {
      const wallet = new Wallet(1_000);
      wallet.placeBet(100);
      expect(wallet.payout(0)).toEqual({ ok: true, balance: 900 });
    });

    it('rejects negative, fractional and non-numeric payouts without changing the balance', () => {
      const wallet = new Wallet(1_000);
      for (const bad of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(wallet.payout(bad), `payout ${bad}`).toEqual({ ok: false, error: 'invalid-amount' });
      }
      expect(wallet.payout('50' as unknown as number)).toEqual({ ok: false, error: 'invalid-amount' });
      expect(wallet.balance).toBe(1_000);
    });

    it('never exceeds the largest exactly representable integer', () => {
      const wallet = new Wallet(Number.MAX_SAFE_INTEGER - 5);
      wallet.payout(1_000);
      expect(wallet.balance).toBe(Number.MAX_SAFE_INTEGER);
      expect(Number.isSafeInteger(wallet.balance)).toBe(true);
    });
  });

  describe('reset', () => {
    it('goes back to 1,000 chips', () => {
      const wallet = new Wallet(3);
      wallet.reset();
      expect(wallet.balance).toBe(1_000);
    });
  });

  it('keeps a whole, non-negative balance through thousands of random operations', () => {
    const random = mulberry32(20_261_104);
    const wallet = new Wallet();
    let accepted = 0;
    let rejected = 0;

    for (let step = 0; step < 20_000; step += 1) {
      const before = wallet.balance;
      const roll = random();
      // Mostly whole amounts (some negative or zero), with one in five pushed off a whole number.
      const whole = Math.floor(random() * 650) - 50;
      const amount = random() < 0.2 ? whole + 0.5 : whole;

      const result =
        roll < 0.35 ? wallet.placeBet(amount) : roll < 0.55 ? wallet.addStake(amount) : wallet.payout(amount);

      if (result.ok) accepted += 1;
      else {
        rejected += 1;
        expect(wallet.balance, 'a rejected call must not change the balance').toBe(before);
      }
      expect(Number.isSafeInteger(wallet.balance)).toBe(true);
      expect(wallet.balance).toBeGreaterThanOrEqual(0);
    }

    // The walk really exercised both paths.
    expect(accepted).toBeGreaterThan(1_000);
    expect(rejected).toBeGreaterThan(1_000);
  });
});
