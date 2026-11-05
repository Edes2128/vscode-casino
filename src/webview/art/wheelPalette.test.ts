import { describe, expect, it } from 'vitest';
import { THEME_IDS } from '../../casino/appearance';
import { resolveAppearance } from '../customization/appearance';
import { WHEEL_PALETTE, wheelPaletteFor } from './wheel';

describe('the palette of the lobby wheel in a theme', () => {
  it('is exactly the old palette in the classic theme', () => {
    expect(wheelPaletteFor(resolveAppearance('classic').tokens)).toEqual(WHEEL_PALETTE);
  });

  it('takes the rim, the hub highlight and the bowl from every theme, and keeps the other colors', () => {
    for (const id of THEME_IDS) {
      const { tokens } = resolveAppearance(id);
      const palette = wheelPaletteFor(tokens);
      expect(palette['y'], id).toBe(tokens.rim);
      expect(palette['h'], id).toBe(tokens.rimLight);
      expect(palette['w'], id).toBe(tokens.bowl);
      for (const key of ['c', 'r', 'k', 'g', 'b']) expect(palette[key], `${id} ${key}`).toBe(WHEEL_PALETTE[key]);
    }
  });

  it('ignores a color it cannot read', () => {
    expect(wheelPaletteFor({ rim: 'gold', rimLight: '#fff', bowl: '' })).toEqual(WHEEL_PALETTE);
  });
});
