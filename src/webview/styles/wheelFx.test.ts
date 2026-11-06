/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, 'roulette.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** The declarations of the rule whose selector list contains `selector` exactly. */
function bodyOf(selector: string): string {
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = (match[1] ?? '').split(',').map((entry) => entry.trim().replace(/\s+/g, ' '));
    if (selectors.includes(selector)) return match[2] ?? '';
  }
  throw new Error(`no rule for ${selector}`);
}

describe('the stylesheet of the wheel effects', () => {
  it('plays the burst once and holds its last picture: no loop, so nothing runs after the burst', () => {
    const animation = /animation:\s*([^;]+);/.exec(bodyOf('.wheel-burst__dot'))?.[1] ?? '';
    expect(animation).toContain('wheel-burst-fly');
    expect(animation).not.toContain('infinite');
    expect(animation).toMatch(/\s1\sboth$/);
  });

  it('has no loop anywhere in the wheel styles', () => {
    const wheelPart = css.slice(css.indexOf('.rl-wheel--preview'));
    expect(wheelPart.length).toBeGreaterThan(500);
    expect(wheelPart).not.toMatch(/infinite/);
    // The ambient rule: delays live in the shorthand, never in `animation-delay`.
    expect(wheelPart).not.toMatch(/animation-delay/);
  });

  it('defines the burst\'s keyframes, ending invisible', () => {
    const keyframes = /@keyframes wheel-burst-fly\s*\{([\s\S]*?\})\s*\}/.exec(css)?.[1] ?? '';
    expect(keyframes).toContain('from');
    expect(keyframes).toMatch(/to\s*\{[^}]*opacity:\s*0/);
  });

  it('hides the burst in calm and off, but leaves the frozen one on a thumbnail alone', () => {
    expect(css).toContain(".lb-app[data-motion='calm'] .wheel-burst:not(.wheel-burst--still)");
    expect(css).toContain(".lb-app[data-motion='off'] .wheel-burst:not(.wheel-burst--still)");
    expect(bodyOf(".lb-app[data-motion='calm'] .wheel-burst:not(.wheel-burst--still)")).toContain('display: none');
    expect(bodyOf('.wheel-burst--still .wheel-burst__dot')).toContain('animation: none');
  });

  it('takes the burst\'s colours from the theme, with the classic gold as a fallback', () => {
    expect(bodyOf('.wheel-burst__dot')).toContain('var(--c-rim, var(--c-gold))');
    expect(bodyOf('.wheel-burst__dot--light')).toContain('var(--c-rim-light, var(--c-gold))');
    expect(bodyOf('.wheel-burst__dot--neon')).toContain('var(--c-neon)');
    expect(bodyOf('.wheel-burst__dot--white')).toContain('var(--c-white)');
  });

  it('sizes the burst and the thumbnails in wheel pixels, so they scale with the wheel', () => {
    expect(bodyOf('.wheel-burst__dot')).toContain('var(--wheel-cell)');
    expect(bodyOf('.anim-thumb__canvas')).toContain('calc(64 * var(--wheel-cell))');
    expect(bodyOf('.rl-wheel--preview')).toContain('--wheel-cell');
  });

  it('draws nothing but whole pixels: the wheel and the thumbnails are scaled without smoothing', () => {
    expect(bodyOf('.anim-thumb__canvas')).toContain('image-rendering: pixelated');
    expect(bodyOf('.rl-wheel__canvas')).toContain('image-rendering: pixelated');
  });
});
