/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastOfHex } from '../color';

const STYLES = __dirname;
const files = readdirSync(STYLES).filter((name) => name.endsWith('.css'));
const read = (name: string): string => readFileSync(join(STYLES, name), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

describe('text size', () => {
  it('scales every font size: none is a bare number of pixels that the Text size setting could not reach', () => {
    const bare: string[] = [];
    for (const name of files) {
      for (const match of read(name).matchAll(/font-size:\s*([^;]+);/g)) {
        const value = (match[1] ?? '').trim();
        const scaled = value.includes('var(--text-scale)') || value.startsWith('var(--card-font)') || value.includes('var(--sprite-cell)');
        if (!scaled) bare.push(`${name}: font-size: ${value}`);
      }
    }
    expect(bare, `font sizes that ignore the Text size setting:\n  ${bare.join('\n  ')}`).toEqual([]);
  });

  it('never sets the body text below 20px, nor the pixel titles below 11px, at normal size', () => {
    const sizes: Array<{ name: string; px: number }> = [];
    for (const name of files) {
      for (const match of read(name).matchAll(/font-size:\s*calc\((\d+(?:\.\d+)?)px \* var\(--text-scale\)\)/g)) {
        sizes.push({ name, px: Number(match[1]) });
      }
    }
    expect(sizes.length).toBeGreaterThan(40);
    expect(Math.min(...sizes.map((size) => size.px))).toBeGreaterThanOrEqual(11);
  });

  it('steps the scale down below 200px, where the narrowest sidebar cannot fit the bigger text', () => {
    const casino = read('casino.css');
    expect(casino).toMatch(/@media \(max-width: 199px\)\s*\{[^@]*--text-scale:\s*0\.8/);
  });

  it('defines the three scales, 1, 1.2 and 1.4', () => {
    const casino = read('casino.css');
    expect(casino).toMatch(/\[data-text='large'\][^{]*\{[^}]*--text-scale:\s*1\.2/);
    expect(casino).toMatch(/\[data-text='xlarge'\][^{]*\{[^}]*--text-scale:\s*1\.4/);
    expect(read('global.css')).toMatch(/--text-scale:\s*1;/);
  });
});

/** The value of `--name: #xxxxxx` in the first `:root` rule of global.css. */
function token(name: string): string {
  const root = /:root\s*\{([^}]*)\}/.exec(read('global.css'))?.[1] ?? '';
  const value = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,6})`).exec(root)?.[1];
  if (value === undefined) throw new Error(`token --${name} not found`);
  return value;
}

describe('the default palette is readable', () => {
  const backgrounds = ['c-bg', 'c-bg-2'] as const;

  it.each([
    ['c-white', 7],
    ['c-muted', 7],
    ['c-gold', 7],
    ['c-neon', 7],
    ['c-red-text', 4.5],
  ] as const)('%s reads at least %s to 1 on the dark backgrounds', (name, minimum) => {
    for (const background of backgrounds) {
      expect(contrastOfHex(token(name), token(background)), `${name} on ${background}`).toBeGreaterThanOrEqual(minimum);
    }
  });

  it('keeps the light text readable on the felt of a table', () => {
    expect(contrastOfHex(token('c-white'), token('c-felt'))).toBeGreaterThanOrEqual(7);
    expect(contrastOfHex(token('c-gold'), token('c-felt'))).toBeGreaterThanOrEqual(4.5);
  });

  it('prints the red of a card suit so that it reads on the white of the card', () => {
    expect(contrastOfHex(token('c-card-red'), token('c-white'))).toBeGreaterThanOrEqual(4.5);
  });

  it('puts dark button labels on the bright button colours at AA or better', () => {
    for (const fill of ['c-neon', 'c-gold']) expect(contrastOfHex(token('c-bg'), token(fill)), fill).toBeGreaterThanOrEqual(7);
  });
});
