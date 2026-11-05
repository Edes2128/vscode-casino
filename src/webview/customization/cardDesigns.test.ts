/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CARD_DESIGN_IDS } from '../../casino/appearance';
import { contrastOfHex, MIN_TEXT_CONTRAST } from '../color';
import { CARD_DESIGNS, DEFAULT_CARD_DESIGN, cardDesignOf } from './cardDesigns';

const HEX = /^#[0-9a-f]{6}$/;
const STYLES = join(__dirname, '..', 'styles');
const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');
const cards = stripComments(readFileSync(join(STYLES, 'cards.css'), 'utf8'));

/** Every rule of the stylesheet: its selectors and its declarations. Rules inside `@media` are found too. */
function rules(css: string): Array<{ selectors: string[]; body: string }> {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    // Commas inside parentheses (`:is(a, b)`) belong to one selector.
    selectors: (match[1] ?? '').split(/,(?![^()]*\))/).map((selector) => selector.trim().replace(/\s+/g, ' ')),
    body: match[2] ?? '',
  }));
}

/** The custom properties a design's rule sets on `.playing-card[data-design='id']` itself. */
function inksOf(id: string): Record<string, string> {
  const rule = rules(cards).find(({ selectors, body }) => selectors.length === 1 && selectors[0] === `.playing-card[data-design='${id}']` && body.includes('--card-face'));
  if (rule === undefined) throw new Error(`no inks for ${id} in cards.css`);
  return Object.fromEntries([...rule.body.matchAll(/(--[a-z-]+):\s*([^;]+);/g)].map((match) => [match[1] ?? '', (match[2] ?? '').trim()]));
}

describe('the card designs', () => {
  it('are the six of the brief, one per id, in order', () => {
    expect(CARD_DESIGNS.map((design) => design.id)).toEqual([...CARD_DESIGN_IDS]);
    expect(CARD_DESIGNS.map((design) => design.name)).toEqual(['Classic Pixel', 'Retro 8-Bit', 'Neon', 'Medieval Fantasy', 'Minimal Pixel', 'Dark Casino']);
  });

  it('make the classic one the default, as the settings do', () => {
    expect(DEFAULT_CARD_DESIGN.id).toBe('classic');
    expect(cardDesignOf('classic')).toBe(DEFAULT_CARD_DESIGN);
    expect(cardDesignOf('gone' as never)).toBe(DEFAULT_CARD_DESIGN);
    for (const id of CARD_DESIGN_IDS) expect(cardDesignOf(id).id).toBe(id);
  });

  it('describe themselves for the picker in a line, with nothing locked or priced', () => {
    for (const design of CARD_DESIGNS) {
      expect(design.blurb.length, design.id).toBeGreaterThan(10);
      expect(design.blurb.length, design.id).toBeLessThan(60);
      expect(Object.keys(design).sort(), design.id).toEqual(['back', 'backAccent', 'backEdge', 'blurb', 'face', 'id', 'ink', 'name', 'redInk']);
    }
  });

  it('are different from each other: no two share a paper and an ink', () => {
    expect(new Set(CARD_DESIGNS.map((design) => `${design.face}/${design.ink}/${design.redInk}`)).size).toBe(CARD_DESIGNS.length);
    expect(new Set(CARD_DESIGNS.map((design) => `${design.back}/${design.backAccent}`)).size).toBe(CARD_DESIGNS.length);
  });

  it('write every color as #rrggbb', () => {
    for (const design of CARD_DESIGNS) {
      for (const key of ['face', 'ink', 'redInk', 'back', 'backAccent', 'backEdge'] as const) expect(design[key], `${design.id}.${key}`).toMatch(HEX);
    }
  });
});

describe.each(CARD_DESIGNS)('readability of $name', (design) => {
  it('prints the rank and the suit of the black suits at 4.5 to 1 or better on the face', () => {
    expect(contrastOfHex(design.ink, design.face)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it('prints the red suits at 4.5 to 1 or better on the face too', () => {
    expect(contrastOfHex(design.redInk, design.face)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it('keeps red and black apart in color as well as in shape', () => {
    expect(design.redInk).not.toBe(design.ink);
    expect(contrastOfHex(design.redInk, design.ink)).toBeGreaterThanOrEqual(1.5);
  });

  it('draws a back whose pattern and border can be seen against its ground', () => {
    expect(contrastOfHex(design.backAccent, design.back)).toBeGreaterThanOrEqual(1.5);
    expect(contrastOfHex(design.backEdge, design.back)).toBeGreaterThanOrEqual(1.5);
  });

  it('has a back that is not mistaken for a face', () => {
    expect(design.back).not.toBe(design.face);
  });
});

describe('the stylesheet agrees with the table', () => {
  it.each(CARD_DESIGNS.filter((design) => design.id !== 'classic'))('paints the $name inks and back with exactly the table colors', (design) => {
    const css = inksOf(design.id);
    expect(css['--card-face']).toBe(design.face);
    expect(css['--card-ink']).toBe(design.ink);
    expect(css['--card-ink-red']).toBe(design.redInk);
    expect(css['--card-back']).toBe(design.back);
    expect(css['--card-back-accent']).toBe(design.backAccent);
    expect(css['--card-back-edge']).toBe(design.backEdge);
  });

  it('gives the classic design the colors it has always had: the base card in blackjack.css, with the default theme', () => {
    const blackjack = stripComments(readFileSync(join(STYLES, 'blackjack.css'), 'utf8'));
    const global = stripComments(readFileSync(join(STYLES, 'global.css'), 'utf8'));
    const classic = cardDesignOf('classic');
    const token = (name: string): string | undefined => new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(global)?.[1]?.toLowerCase();
    expect(token('c-white')).toBe(classic.face);
    expect(token('c-card-red')).toBe(classic.redInk);
    expect(token('c-red')).toBe(classic.back);
    expect(token('c-red-shade') ?? '#a82f2f').toBe(classic.backAccent);
    expect(blackjack).toContain('color: #20242c;');
    expect(blackjack).toContain('#e94b4b 25%, #a82f2f');
    expect(classic.ink).toBe('#20242c');
  });
});

describe('cards.css', () => {
  const all = rules(cards);
  const designRules = all.filter(({ selectors }) => selectors.some((selector) => selector.includes('[data-design=')));

  it('is found: the scan sees the rules that exist', () => {
    expect(all.length).toBeGreaterThan(30);
    for (const design of CARD_DESIGNS.filter((entry) => entry.id !== 'classic')) {
      expect(designRules.some(({ selectors }) => selectors.some((selector) => selector.includes(`'${design.id}'`))), design.id).toBe(true);
    }
  });

  it('leaves the classic design to the base card: no rule names it', () => {
    expect(cards).not.toContain("'classic'");
  });

  it('keys every card rule off data-design and never off the page, so a preview can show any design', () => {
    for (const { selectors } of all) {
      for (const selector of selectors) {
        if (!selector.includes('.playing-card')) continue;
        const inPreview = selector.startsWith('.card-preview') || selector.startsWith('.card-showcase');
        expect(inPreview || selector.includes("[data-design='"), `card rule without a design: ${selector}`).toBe(true);
        expect(selector, selector).not.toMatch(/data-cards|data-theme|\.casino-app|:root/);
      }
    }
  });

  it('never changes where anything is: the size, the layout and the animations of a card are the base card', () => {
    const forbidden = /(^|[;\s])(width|height|min-width|min-height|max-width|max-height|margin[a-z-]*|padding[a-z-]*|display|position|top|left|right|bottom|transform|animation[a-z-]*|--card-w|--card-h|--card-cell|--card-mini):/;
    for (const { selectors, body } of designRules) {
      for (const selector of selectors) {
        const onTheCard = /\.playing-card(--face|--back)?(\.playing-card--red)?\[data-design='[a-z]+'\]$/.test(selector);
        if (onTheCard) expect(body, `${selector} moves things`).not.toMatch(forbidden);
      }
    }
  });

  it('loops nothing, and never sets an animation of its own on a card (the deal and flip belong to the base card)', () => {
    expect(cards).not.toMatch(/\binfinite\b/);
    expect(cards).not.toMatch(/@keyframes/);
    expect(cards).not.toMatch(/animation-delay/);
    for (const { body } of all) {
      for (const match of body.matchAll(/animation\s*:\s*([^;]+);/g)) expect((match[1] ?? '').trim()).toBe('none');
    }
  });

  it('keeps the previews of the Cards tab still: they are not dealt in, and overlap like a hand', () => {
    const still = all.filter(({ selectors }) => selectors.includes('.card-preview .playing-card, .card-showcase .playing-card') || selectors.includes('.card-preview .playing-card'));
    expect(still.length).toBeGreaterThan(0);
    expect(still.some(({ body }) => /animation:\s*none/.test(body))).toBe(true);
    expect(cards).toMatch(/\.card-preview \.playing-card \+ \.playing-card\s*\{[^}]*margin-left:/);
  });

  it('makes no request: no images, no web addresses, no imports', () => {
    expect(cards).not.toMatch(/url\(/);
    expect(cards).not.toMatch(/https?:/);
    expect(cards).not.toMatch(/@import/);
  });

  it('keeps the rank readable: pixel text is never below 11px and the rank is never set to a bare size', () => {
    for (const { body } of all) {
      for (const match of body.matchAll(/font-size:\s*([^;]+);/g)) {
        const value = (match[1] ?? '').trim();
        expect(value.includes('var(--text-scale)') || value.startsWith('var(--card-font)'), `font-size: ${value}`).toBe(true);
      }
    }
    // The rank's size is the card's own --card-font; a design may choose its font's size but never under 12px.
    for (const { body } of designRules) {
      for (const match of body.matchAll(/--card-font:\s*(\d+)px;/g)) expect(Number(match[1])).toBeGreaterThanOrEqual(12);
    }
  });

  it('is imported by the webview, after the base card and before the ambient clock', () => {
    const main = readFileSync(join(__dirname, '..', 'main.tsx'), 'utf8');
    const imports = [...main.matchAll(/import '\.\/styles\/([a-z]+\.css)';/g)].map((match) => match[1]);
    expect(imports).toContain('cards.css');
    expect(imports.indexOf('cards.css')).toBeGreaterThan(imports.indexOf('blackjack.css'));
    expect(imports.at(-1)).toBe('ambient.css');
  });
});
