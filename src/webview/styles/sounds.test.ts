/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, 'sounds.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const main = readFileSync(join(__dirname, '..', 'main.tsx'), 'utf8');

describe('the sounds stylesheet', () => {
  it('is loaded once, before the ambient stylesheet that has to come last', () => {
    const imports = [...main.matchAll(/import '\.\/styles\/([a-z]+\.css)';/g)].map((match) => match[1]);
    expect(imports.filter((name) => name === 'sounds.css')).toHaveLength(1);
    expect(imports.indexOf('sounds.css')).toBeLessThan(imports.indexOf('ambient.css'));
    expect(imports.at(-1)).toBe('ambient.css');
  });

  it('has no animation that loops, so nothing here ever moves for long', () => {
    expect(css).not.toMatch(/infinite/);
    expect(css).not.toMatch(/animation-delay/);
  });

  it('animates only the mark on the sample step, and only with full animation, once', () => {
    const animated = [...css.matchAll(/([^{}]+)\{([^{}]*animation:[^{}]*)\}/g)].map((match) => (match[1] ?? '').trim().replace(/\s+/g, ' '));
    expect(animated).toEqual(['.sample-steps--lively .sample-step--now']);
    expect(css).toMatch(/animation:\s*sample-hop\s+0\.2s\s+steps\(2\)\s+1;/);
  });

  it('sizes every letter by the text size setting, none below the pixel font\'s 11px', () => {
    const sizes = [...css.matchAll(/font-size:\s*([^;]+);/g)].map((match) => (match[1] ?? '').trim());
    expect(sizes.length).toBeGreaterThan(0);
    for (const size of sizes) {
      expect(size).toMatch(/^calc\((\d+(?:\.\d+)?)px \* var\(--text-scale\)\)$/);
      expect(Number(/calc\((\d+(?:\.\d+)?)px/.exec(size)?.[1])).toBeGreaterThanOrEqual(11);
    }
  });
});
