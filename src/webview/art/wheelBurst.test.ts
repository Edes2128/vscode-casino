import { describe, expect, it } from 'vitest';
import { BURST_MAX_DELAY_MS, BURST_MAX_DISTANCE, BURST_MIN_DISTANCE, BURST_SQUASH, BURST_UP, wheelBurstDots } from './wheelBurst';

describe('the burst of pixels', () => {
  it('has as many dots as it is asked for, and none for nothing', () => {
    expect(wheelBurstDots(28)).toHaveLength(28);
    expect(wheelBurstDots(1)).toHaveLength(1);
    expect(wheelBurstDots(0)).toEqual([]);
    expect(wheelBurstDots(-5)).toEqual([]);
  });

  it('is the same every time: positions come from a formula, not from chance', () => {
    expect(wheelBurstDots(28)).toEqual(wheelBurstDots(28));
    // A bigger burst starts with the dots of a smaller one.
    expect(wheelBurstDots(40).slice(0, 28)).toEqual(wheelBurstDots(28));
  });

  it('lands every dot on a whole wheel pixel, not too near the ball and not too far from it', () => {
    for (const dot of wheelBurstDots(56)) {
      expect(Number.isInteger(dot.dx)).toBe(true);
      expect(Number.isInteger(dot.dy)).toBe(true);
      const across = (dot.dy < 0 ? dot.dy / BURST_UP : dot.dy) / BURST_SQUASH;
      const distance = Math.hypot(dot.dx, across);
      expect(distance).toBeGreaterThanOrEqual(BURST_MIN_DISTANCE - 1);
      expect(distance).toBeLessThanOrEqual(BURST_MAX_DISTANCE + 1);
    }
  });

  it('flies in every direction', () => {
    const dots = wheelBurstDots(28);
    expect(dots.some((dot) => dot.dx > 3 && dot.dy > 3)).toBe(true);
    expect(dots.some((dot) => dot.dx < -3 && dot.dy > 3)).toBe(true);
    expect(dots.some((dot) => dot.dx > 3 && dot.dy < -3)).toBe(true);
    expect(dots.some((dot) => dot.dx < -3 && dot.dy < -3)).toBe(true);
  });

  it('mixes the theme\'s four colours and two sizes of square', () => {
    const dots = wheelBurstDots(28);
    expect(new Set(dots.map((dot) => dot.tint))).toEqual(new Set(['rim', 'light', 'neon', 'white']));
    expect(new Set(dots.map((dot) => dot.size))).toEqual(new Set([2, 3]));
  });

  it('leaves in a quick staggered wave, never later than the stated delay', () => {
    const delays = wheelBurstDots(28).map((dot) => dot.delayMs);
    expect(Math.max(...delays)).toBe(BURST_MAX_DELAY_MS);
    expect(Math.min(...delays)).toBe(0);
  });
});
