import { describe, expect, it } from 'vitest';
import { COLOR_SLOTS, isCustomColors } from '../../casino/appearance';
import { contrastOfHex, MIN_TEXT_CONTRAST } from '../color';
import { resolveAppearance } from './appearance';
import { COLOR_PRESETS, COLOR_SLOT_INFO, normalizeHex } from './colorPresets';
import { THEMES } from './themes';

describe('the color presets', () => {
  it('are valid sets of colors with their own names', () => {
    expect(COLOR_PRESETS.length).toBeGreaterThanOrEqual(5);
    expect(new Set(COLOR_PRESETS.map((preset) => preset.id)).size).toBe(COLOR_PRESETS.length);
    for (const preset of COLOR_PRESETS) {
      expect(isCustomColors(preset.colors), preset.id).toBe(true);
      expect(Object.keys(preset.colors).length).toBeGreaterThan(1);
    }
  });

  it('are different from each other', () => {
    const keys = COLOR_PRESETS.map((preset) => JSON.stringify(preset.colors));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('stay readable on every theme', () => {
    for (const preset of COLOR_PRESETS) {
      for (const theme of THEMES) {
        const { tokens } = resolveAppearance(theme.id, preset.colors);
        for (const surface of [tokens.bg, tokens.bg2, tokens.felt]) {
          expect(contrastOfHex(tokens.white, surface), `${preset.id} on ${theme.id}`).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
        }
        expect(contrastOfHex(tokens.buttonText, tokens.button), `${preset.id} on ${theme.id}`).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
      }
    }
  });
});

describe('describing a color slot', () => {
  it('has a label and a hint for every slot', () => {
    for (const slot of COLOR_SLOTS) {
      expect(COLOR_SLOT_INFO[slot].label.length).toBeGreaterThan(2);
      expect(COLOR_SLOT_INFO[slot].hint.length).toBeGreaterThan(8);
    }
  });
});

describe('normalizeHex', () => {
  it('accepts what a person types and gives #rrggbb in lower case', () => {
    expect(normalizeHex('#1A2B3C')).toBe('#1a2b3c');
    expect(normalizeHex('1a2b3c')).toBe('#1a2b3c');
    expect(normalizeHex('  #abc ')).toBe('#aabbcc');
    expect(normalizeHex('FFF')).toBe('#ffffff');
  });

  it('refuses anything that is not a color', () => {
    for (const bad of ['', '#', '#12', '#12345', '#1234567', '#ggg', 'red', 'rgb(1,2,3)', '#12 34 56']) expect(normalizeHex(bad), bad).toBeUndefined();
  });
});
