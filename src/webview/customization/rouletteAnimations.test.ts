import { describe, expect, it } from 'vitest';
import { ROULETTE_ANIMATION_IDS, isRouletteAnimationId, type RouletteAnimationId } from '../../casino/appearance';
import { DEFAULT_SETTINGS } from '../../casino/settings';
import {
  BURST_LIFETIME_MS,
  BURST_MS,
  DEFAULT_ROULETTE_ANIMATION,
  ROULETTE_ANIMATIONS,
  rouletteAnimation,
  spinSeconds,
  wheelStyle,
} from './rouletteAnimations';

describe('the roulette animation catalog', () => {
  it('has exactly one style for every id the settings can hold, in the same order', () => {
    expect(ROULETTE_ANIMATIONS.map((style) => style.id)).toEqual([...ROULETTE_ANIMATION_IDS]);
    expect(ROULETTE_ANIMATIONS).toHaveLength(5);
    for (const id of ROULETTE_ANIMATION_IDS) expect(rouletteAnimation(id).id).toBe(id);
  });

  it('names the five styles the brief asks for', () => {
    expect(ROULETTE_ANIMATIONS.map((style) => style.name)).toEqual([
      'Classic Spin',
      'Arcade Spin',
      'Neon Spin',
      'Pixel Explosion',
      'Slow Motion',
    ]);
  });

  it('gives every style a name and a one-line description that can be shown in capitals', () => {
    for (const style of ROULETTE_ANIMATIONS) {
      expect(style.name.trim(), style.id).not.toBe('');
      expect(style.name.toUpperCase()).toMatch(/^[A-Z ]+$/);
      expect(style.description.trim(), style.id).not.toBe('');
      expect(style.description, style.id).not.toMatch(/\n/);
    }
    expect(new Set(ROULETTE_ANIMATIONS.map((style) => style.name)).size).toBe(5);
  });

  it('keeps the classic spin as it always was, and sets the others\' durations as designed', () => {
    const classic = rouletteAnimation('classic');
    expect(classic.durationMs).toBe(5_500);
    expect(classic.wheelTurns).toBe(4);
    expect(classic.ballTurns).toBe(14);
    expect(classic.wheelEase).toBe(3);
    expect(classic.ballEase).toBe(2);
    expect(classic.settle).toBeUndefined();
    expect(classic.effect).toBe('none');
    expect(rouletteAnimation('arcade').durationMs).toBe(3_200);
    expect(rouletteAnimation('slow').durationMs).toBe(9_000);
  });

  it('keeps every duration sensible: long enough to watch, short enough not to be a wait', () => {
    for (const style of ROULETTE_ANIMATIONS) {
      expect(style.durationMs, style.id).toBeGreaterThanOrEqual(2_500);
      expect(style.durationMs, style.id).toBeLessThanOrEqual(10_000);
    }
    const durations = ROULETTE_ANIMATIONS.map((style) => style.durationMs);
    expect(Math.min(...durations)).toBe(rouletteAnimation('arcade').durationMs); // arcade is the quickest
    expect(Math.max(...durations)).toBe(rouletteAnimation('slow').durationMs); // slow motion is the longest
  });

  it('makes the styles distinct: no two share all their numbers', () => {
    const key = (id: RouletteAnimationId): string => {
      const style = rouletteAnimation(id);
      return JSON.stringify([style.durationMs, style.wheelTurns, style.ballTurns, style.wheelEase, style.ballEase, style.settle, style.effect, style.effectSize]);
    };
    expect(new Set(ROULETTE_ANIMATION_IDS.map(key)).size).toBe(ROULETTE_ANIMATION_IDS.length);
  });

  it('keeps the numbers inside what the wheel can draw', () => {
    for (const style of ROULETTE_ANIMATIONS) {
      expect(style.wheelTurns, style.id).toBeGreaterThanOrEqual(2);
      expect(style.wheelTurns, style.id).toBeLessThanOrEqual(6);
      expect(style.ballTurns, style.id).toBeGreaterThanOrEqual(6);
      expect(style.ballTurns, style.id).toBeLessThanOrEqual(16);
      expect(style.wheelEase, style.id).toBeGreaterThanOrEqual(1);
      expect(style.ballEase, style.id).toBeGreaterThanOrEqual(1);
      if (style.settle !== undefined) {
        expect(style.settle.fraction, style.id).toBeGreaterThan(0);
        expect(style.settle.fraction, style.id).toBeLessThanOrEqual(0.3);
        expect(style.settle.hop, style.id).toBeGreaterThan(0);
        expect(style.settle.hop, style.id).toBeLessThanOrEqual(3); // the pocket ring is 6.5 pixels deep
        expect(style.settle.rock, style.id).toBeGreaterThan(0);
        expect(style.settle.rock, style.id).toBeLessThanOrEqual(0.2); // about one pocket (0.17 rad)
        expect(Number.isInteger(style.settle.bounces), style.id).toBe(true);
      }
    }
  });

  it('gives only the two effect styles an effect, and a size to go with it', () => {
    const byEffect = (effect: string): string[] => ROULETTE_ANIMATIONS.filter((style) => style.effect === effect).map((style) => style.id);
    expect(byEffect('trail')).toEqual(['neon']);
    expect(byEffect('burst')).toEqual(['explosion']);
    expect(byEffect('none')).toEqual(['classic', 'arcade', 'slow']);
    for (const style of ROULETTE_ANIMATIONS) expect(style.effectSize > 0, style.id).toBe(style.effect !== 'none');
  });

  it('lets the bouncy styles bounce and the plain ones simply drop', () => {
    expect(rouletteAnimation('arcade').settle).toBeDefined();
    expect(rouletteAnimation('slow').settle).toBeDefined();
    expect(rouletteAnimation('classic').settle).toBeUndefined();
    expect(rouletteAnimation('neon').settle).toBeUndefined();
  });

  it('falls back to the classic style for an id it does not know, and the default setting is that style', () => {
    expect(DEFAULT_ROULETTE_ANIMATION).toBe('classic');
    expect(DEFAULT_SETTINGS.rouletteAnimation).toBe(DEFAULT_ROULETTE_ANIMATION);
    expect(rouletteAnimation('mystery' as RouletteAnimationId).id).toBe('classic');
    expect(isRouletteAnimationId('mystery')).toBe(false);
  });

  it('uses the style a wheel is asked for, or else the one the player chose', () => {
    expect(wheelStyle(undefined, 'slow').id).toBe('slow');
    expect(wheelStyle('arcade', 'slow').id).toBe('arcade');
    expect(wheelStyle('classic', 'neon').id).toBe('classic');
  });

  it('writes a duration in seconds, and keeps the burst\'s own timing consistent', () => {
    expect(ROULETTE_ANIMATIONS.map(spinSeconds)).toEqual(['5.5', '3.2', '5.0', '4.8', '9.0']);
    expect(BURST_MS).toBeLessThanOrEqual(1_500);
    expect(BURST_LIFETIME_MS).toBeGreaterThan(BURST_MS);
  });
});
