import { describe, expect, it } from 'vitest';
import { CHIP_VALUES } from '../state/chips';
import { addChip, betProblem, betProblemText, parseBetInput, rejectionText } from './betting';

describe('addChip', () => {
  it('adds the chip to the bet', () => {
    expect(addChip(0, 25, 1_000)).toBe(25);
    expect(addChip(25, 100, 1_000)).toBe(125);
  });

  it('never goes beyond the balance', () => {
    expect(addChip(950, 100, 1_000)).toBe(1_000);
    expect(addChip(0, 500, 300)).toBe(300);
    expect(addChip(1_000, 10, 1_000)).toBe(1_000);
  });

  it('builds any bet out of the real chip values', () => {
    let bet = 0;
    for (const chip of CHIP_VALUES) bet = addChip(bet, chip, 10_000);
    expect(bet).toBe(10 + 25 + 50 + 100 + 500);
  });
});

describe('parseBetInput', () => {
  it('reads digits', () => {
    expect(parseBetInput('250')).toBe(250);
    expect(parseBetInput('0042')).toBe(42);
  });

  it('treats an empty box as 0', () => {
    expect(parseBetInput('')).toBe(0);
    expect(parseBetInput('abc')).toBe(0);
  });

  it('drops everything that is not a digit, so no fractions, signs or exponents get through', () => {
    expect(parseBetInput('12.5')).toBe(125);
    expect(parseBetInput('-50')).toBe(50);
    expect(parseBetInput('1e9')).toBe(19);
    expect(parseBetInput(' 1 000 ')).toBe(1_000);
  });

  it('keeps the number safe however much is pasted in', () => {
    const huge = parseBetInput('9'.repeat(50));
    expect(Number.isSafeInteger(huge)).toBe(true);
    expect(huge).toBe(999_999_999);
  });
});

describe('betProblem', () => {
  it('is fine for a bet from the minimum up to the balance', () => {
    expect(betProblem(10, 1_000)).toBeUndefined();
    expect(betProblem(1_000, 1_000)).toBeUndefined();
    expect(betProblem(37, 1_000)).toBeUndefined();
  });

  it('flags a bet below the minimum', () => {
    expect(betProblem(9, 1_000)).toBe('too-low');
    expect(betProblem(0, 1_000)).toBe('too-low');
  });

  it('flags a bet over the balance, which takes priority', () => {
    expect(betProblem(1_001, 1_000)).toBe('too-high');
    expect(betProblem(5, 3)).toBe('too-high');
  });

  it('says so in words', () => {
    expect(betProblemText('too-high')).toBe('NOT ENOUGH CHIPS');
    expect(betProblemText('too-low')).toBe('MIN BET IS 10');
  });
});

describe('rejectionText', () => {
  it('explains every refusal the host can send', () => {
    expect(rejectionText('below-minimum')).toBe('MIN BET IS 10');
    expect(rejectionText('insufficient-funds')).toBe('NOT ENOUGH CHIPS');
    expect(rejectionText('invalid-amount')).toBe('BET WHOLE CHIPS ONLY');
    expect(rejectionText('round-active')).toBe('FINISH THIS HAND FIRST');
    expect(rejectionText('not-allowed')).toBe('THAT MOVE IS NOT ALLOWED');
  });

  it('has a sensible fallback', () => {
    expect(rejectionText('round-in-progress')).toContain('TABLE IS BUSY');
    expect(rejectionText('something new')).toContain('TABLE IS BUSY');
  });
});
