/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AMBIENT_TICK_MS, REPORT_EVERY_TICKS, REST_AFTER_MS, ambientSeconds } from '../ambientTiming';

const STYLES = __dirname;
const files = readdirSync(STYLES).filter((name) => name.endsWith('.css'));
const read = (name: string): string => readFileSync(join(STYLES, name), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Every selector of every rule: `[selectors, declarations]`. Nothing here nests, so a flat scan is enough. */
function rules(css: string): Array<[string[], string]> {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => [
    (match[1] ?? '').split(',').map((selector) => selector.trim().replace(/\s+/g, ' ')),
    match[2] ?? '',
  ]);
}

const ambientSelectors = new Set(rules(read('ambient.css')).flatMap(([selectors]) => selectors));

describe('the ambient loops', () => {
  const loops = files
    .filter((name) => name !== 'ambient.css')
    .flatMap((name) => rules(read(name)).filter(([, body]) => /\banimation\s*:[^;]*\binfinite\b/.test(body)).map(([selectors]) => selectors))
    .flat();

  it('are found: the scan sees the loops that exist', () => {
    expect(loops.length).toBeGreaterThanOrEqual(10);
    expect(loops).toContain('.marquee');
    expect(loops).toContain('.particles__dot');
  });

  it('are all handed to the ambient clock: no CSS animation runs forever on its own', () => {
    const unlisted = loops.filter((selector) => !ambientSelectors.has(selector));
    expect(unlisted, `loops missing from ambient.css: ${unlisted.join(', ')}`).toEqual([]);
  });

  it('are not listed there by mistake: everything listed really is a loop', () => {
    const loopSet = new Set(loops);
    const extra = [...ambientSelectors].filter((selector) => !loopSet.has(selector));
    expect(extra, `ambient.css lists things that do not loop: ${extra.join(', ')}`).toEqual([]);
  });

  it('keep their own head start only through --ambient-delay: no other stylesheet sets animation-delay at all', () => {
    // A loop's modifier classes (such as the second die) are not loops themselves in the scan above, so
    // the safe rule is the blunt one. A finished animation that needs a delay can use the shorthand.
    for (const name of files.filter((entry) => entry !== 'ambient.css')) {
      for (const [selectors, body] of rules(read(name))) {
        expect(body, `${selectors.join(', ')} in ${name}`).not.toMatch(/animation-delay/);
      }
    }
  });

  it('are paused and moved by the clock in the last stylesheet', () => {
    const ambient = read('ambient.css');
    expect(ambient).toContain('animation-play-state: paused');
    expect(ambient).toContain('calc(var(--ambient-delay, 0s) - var(--t, 0) * 1s)');
    // It must load after every other stylesheet, so the import order is what counts.
    const main = readFileSync(join(STYLES, '..', 'main.tsx'), 'utf8');
    const imports = [...main.matchAll(/import '\.\/styles\/([a-z]+\.css)';/g)].map((match) => match[1]);
    expect(imports.at(-1)).toBe('ambient.css');
  });
});

describe('the ambient clock', () => {
  it('ticks five times a second: a frame has a fixed price, and stepped pixel animation needs no more', () => {
    expect(AMBIENT_TICK_MS).toBe(200);
  });

  it('lets the decorations rest after fifteen seconds without the player, and tells the host often enough to be seen', () => {
    expect(REST_AFTER_MS).toBe(15_000);
    expect(REPORT_EVERY_TICKS * AMBIENT_TICK_MS).toBeLessThanOrEqual(3_000);
    expect(REPORT_EVERY_TICKS * AMBIENT_TICK_MS).toBeGreaterThanOrEqual(1_000);
  });

  it('reads in seconds as of the last tick, never ahead of the time that has passed', () => {
    expect(ambientSeconds(0)).toBe('0.00');
    expect(ambientSeconds(199)).toBe('0.00');
    expect(ambientSeconds(200)).toBe('0.20');
    expect(ambientSeconds(1_234)).toBe('1.20');
    expect(ambientSeconds(60_000)).toBe('60.00');
    expect(ambientSeconds(3_600_000)).toBe('3600.00');
  });

  it('keeps the beat of the loops on its grid: a loop that toggles lasts a whole number of ticks per half', () => {
    // These are the rhythmic ones. If a duration here changes, the beat would limp (200 ms, 400 ms, 200 ms ...).
    const halves: Array<[string, RegExp]> = [
      ['.marquee', /animation:\s*marquee-chase\s+([\d.]+)s\s+steps\(2/],
      ['.bj-table__empty', /animation:\s*cursor-blink\s+([\d.]+)s\s+steps\(1/],
      ['.logo__die', /animation:\s*die-bounce\s+([\d.]+)s\s+steps\(1/],
    ];
    for (const [label, pattern] of halves) {
      const css = files.map(read).join('\n');
      const seconds = Number(pattern.exec(css)?.[1]);
      expect(Number.isFinite(seconds), label).toBe(true);
      const halfInTicks = (seconds * 1000) / 2 / AMBIENT_TICK_MS;
      expect(Number.isInteger(Number(halfInTicks.toFixed(6))), `${label}: half a cycle is ${halfInTicks} ticks`).toBe(true);
    }
  });
});
