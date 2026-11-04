import { describe, expect, it } from 'vitest';
import { formatChips, formatPayout, formatPercent, formatTimestamp, pluralise } from './format';

describe('pluralise', () => {
  it('uses the singular only for exactly one', () => {
    expect(pluralise(0, 'win')).toBe('0 wins');
    expect(pluralise(1, 'win')).toBe('1 win');
    expect(pluralise(2, 'win')).toBe('2 wins');
    expect(pluralise(1, 'loss', 'losses')).toBe('1 loss');
    expect(pluralise(5, 'loss', 'losses')).toBe('5 losses');
  });
});

describe('formatPercent', () => {
  it('prints one decimal', () => {
    expect(formatPercent(0)).toBe('0.0%');
    expect(formatPercent(50)).toBe('50.0%');
    expect(formatPercent(100)).toBe('100.0%');
    expect(formatPercent(100 / 3)).toBe('33.3%');
    expect(formatPercent(2 / 3 * 100)).toBe('66.7%');
  });
});

describe('formatChips', () => {
  it('groups thousands', () => {
    expect(formatChips(0)).toBe('0');
    expect(formatChips(950)).toBe('950');
    expect(formatChips(1_000)).toBe('1,000');
    expect(formatChips(1_234_567)).toBe('1,234,567');
  });
});

describe('formatPayout', () => {
  it('signs wins and losses and leaves pushes plain', () => {
    expect(formatPayout(150)).toBe('+150');
    expect(formatPayout(-50)).toBe('-50');
    expect(formatPayout(0)).toBe('0');
    expect(formatPayout(12_500)).toBe('+12,500');
  });
});

describe('formatTimestamp', () => {
  it('prints local month/day and 24-hour time with zero padding', () => {
    expect(formatTimestamp(new Date(2026, 10, 4, 9, 5).getTime())).toBe('11/04 09:05');
    expect(formatTimestamp(new Date(2026, 0, 31, 23, 59).getTime())).toBe('01/31 23:59');
  });
});
