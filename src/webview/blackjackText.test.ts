import { describe, expect, it } from 'vitest';
import type { HandView, ResultView } from '../game/blackjack/view';
import { burstParticles, handTag, handTotalText, resultAmount, resultKind, resultTitle } from './blackjackText';

const hand = (patch: Partial<HandView> = {}): HandView => ({
  cards: [],
  bet: 100,
  total: 18,
  soft: false,
  doubled: false,
  active: false,
  ...patch,
});

const result = (patch: Partial<ResultView> = {}): ResultView => ({
  outcome: 'win',
  blackjack: false,
  net: 100,
  payout: 200,
  staked: 100,
  detail: 'Win 20 vs 18',
  balanceBefore: 900,
  ...patch,
});

describe('handTotalText', () => {
  it('shows the total, and SOFT when an ace counts as 11', () => {
    expect(handTotalText(hand({ total: 18 }), false)).toBe('18');
    expect(handTotalText(hand({ total: 17, soft: true }), false)).toBe('SOFT 17');
  });

  it('shows BUST over 21 at once, without waiting for the result', () => {
    expect(handTotalText(hand({ total: 24 }), false)).toBe('BUST');
  });

  it('shows BLACKJACK only once the result may be shown', () => {
    const natural = hand({ total: 21, soft: true, outcome: 'blackjack' });
    expect(handTotalText(natural, false)).toBe('SOFT 21');
    expect(handTotalText(natural, true)).toBe('BLACKJACK');
  });
});

describe('handTag', () => {
  it('shows nothing until the result may be shown, or when there is no outcome', () => {
    expect(handTag(hand({ outcome: 'win', payout: 200 }), false)).toBeUndefined();
    expect(handTag(hand(), true)).toBeUndefined();
  });

  it('shows the result with the hand\'s own net chips', () => {
    expect(handTag(hand({ outcome: 'win', payout: 200 }), true)).toBe('WIN +100');
    expect(handTag(hand({ outcome: 'loss', payout: 0 }), true)).toBe('LOSE -100');
    expect(handTag(hand({ outcome: 'bust', payout: 0 }), true)).toBe('BUST -100');
    expect(handTag(hand({ outcome: 'blackjack', payout: 250 }), true)).toBe('BLACKJACK +150');
  });

  it('shows a push without an amount', () => {
    expect(handTag(hand({ outcome: 'push', payout: 100 }), true)).toBe('PUSH');
  });

  it('counts a doubled hand against its doubled bet', () => {
    expect(handTag(hand({ bet: 200, outcome: 'win', payout: 400 }), true)).toBe('WIN +200');
  });
});

describe('result banner wording', () => {
  it('picks the kind: a blackjack beats a plain win', () => {
    expect(resultKind(result())).toBe('win');
    expect(resultKind(result({ blackjack: true }))).toBe('blackjack');
    expect(resultKind(result({ outcome: 'loss', net: -100 }))).toBe('loss');
    expect(resultKind(result({ outcome: 'push', net: 0 }))).toBe('push');
  });

  it('titles each kind, calling an all-bust loss a BUST', () => {
    expect(resultTitle('blackjack', [])).toBe('BLACKJACK!');
    expect(resultTitle('win', [])).toBe('YOU WIN');
    expect(resultTitle('push', [])).toBe('PUSH');
    expect(resultTitle('loss', [hand({ outcome: 'bust' })])).toBe('BUST');
    expect(resultTitle('loss', [hand({ outcome: 'loss' })])).toBe('YOU LOSE');
    expect(resultTitle('loss', [hand({ outcome: 'bust' }), hand({ outcome: 'loss' })])).toBe('YOU LOSE');
    expect(resultTitle('loss', [])).toBe('YOU LOSE');
  });

  it('states the chips: gained, lost, or returned', () => {
    expect(resultAmount('win', result({ net: 1_250 }))).toBe('+1,250');
    expect(resultAmount('blackjack', result({ net: 37 }))).toBe('+37');
    expect(resultAmount('loss', result({ outcome: 'loss', net: -300 }))).toBe('-300');
    expect(resultAmount('push', result({ outcome: 'push', net: 0 }))).toBe('BET RETURNED');
  });
});

describe('burstParticles', () => {
  it('makes exactly the number asked for, the same way every time', () => {
    expect(burstParticles(28)).toHaveLength(28);
    expect(burstParticles(56)).toHaveLength(56);
    expect(burstParticles(28)).toEqual(burstParticles(28));
  });

  it('keeps every particle on the 4px pixel grid and within sight of the middle', () => {
    for (const particle of burstParticles(56)) {
      // Math.abs: in JavaScript -0 % 4 is -0, which renders as 0px but is not Object.is-equal to 0.
      expect(Math.abs(particle.dx % 4)).toBe(0);
      expect(Math.abs(particle.dy % 4)).toBe(0);
      expect(Math.abs(particle.dx)).toBeLessThanOrEqual(136);
      expect(Math.abs(particle.dy)).toBeLessThanOrEqual(104);
      expect([4, 8]).toContain(particle.size);
      expect(particle.delayMs).toBeLessThan(240);
    }
  });

  it('spreads out in different directions and uses all four colours', () => {
    const particles = burstParticles(56);
    expect(new Set(particles.map((p) => `${p.dx},${p.dy}`)).size).toBeGreaterThan(40);
    expect(new Set(particles.map((p) => p.colour)).size).toBe(4);
    expect(particles.some((p) => p.dx < 0) && particles.some((p) => p.dx > 0)).toBe(true);
    expect(particles.some((p) => p.dy < 0) && particles.some((p) => p.dy > 0)).toBe(true);
  });
});
