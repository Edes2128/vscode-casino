import type { ChipValue } from '../../casino/chips';
import { darken, parseHex } from '../color';
import type { Palette } from './pixelRuns';

/**
 * Casino chip, drawn procedurally so any diameter stays clean.
 *   o outline   a edge colour   b edge stripe   d inner ring   c face
 */
export function chipRows(diameter: number, detailed: boolean): string[] {
  const radius = diameter / 2;
  const stripeStep = Math.PI / 4; // eight stripes around the edge, like a real chip
  const bandInner = detailed ? radius * 0.66 : radius * 0.55;
  const ringInner = detailed ? bandInner - 0.9 : bandInner;

  const rows: string[] = [];
  for (let y = 0; y < diameter; y += 1) {
    let row = '';
    for (let x = 0; x < diameter; x += 1) {
      const dx = x + 0.5 - radius;
      const dy = y + 0.5 - radius;
      const r = Math.hypot(dx, dy);

      if (r > radius) {
        row += '.';
      } else if (r > radius - 1) {
        row += 'o';
      } else if (r > bandInner) {
        const offset = ((Math.atan2(dy, dx) % stripeStep) + stripeStep) % stripeStep;
        const distanceToStripe = Math.min(offset, stripeStep - offset) * r;
        row += distanceToStripe < 0.75 ? 'b' : 'a';
      } else if (r > ringInner) {
        row += 'd';
      } else {
        row += 'c';
      }
    }
    rows.push(row);
  }
  return rows;
}

const OUTLINE = '#14171d';
const WHITE = '#f2f0e8';

const chipPalette = (edge: string, stripe: string, ring: string, face: string): Palette => ({
  o: OUTLINE,
  a: edge,
  b: stripe,
  d: ring,
  c: face,
});

/** 10 white, 25 red, 50 blue, 100 black, 500 purple. */
export const CHIP_PALETTES: Readonly<Record<ChipValue, Palette>> = {
  10: chipPalette('#d9d4c2', '#5b8def', '#b3ad98', WHITE),
  25: chipPalette('#e94b4b', WHITE, '#a82f2f', '#f26b6b'),
  50: chipPalette('#4b7be9', WHITE, '#2f55b0', '#6f98f5'),
  100: chipPalette('#3a4150', WHITE, '#1f242e', '#566075'),
  500: chipPalette('#9b4be9', WHITE, '#6a2fb0', '#b87cf5'),
};

/** Gold, for the plain chip that is not tied to a denomination. */
export const GOLD_CHIP_PALETTE: Palette = chipPalette('#f5c451', WHITE, '#c8962b', '#ffe08a');

export const CHIP_ROWS_LARGE = chipRows(13, true);
export const CHIP_ROWS_SMALL = chipRows(9, false);

/**
 * A chip palette with the stripes and the inner ring in `tint`. The edge keeps its denomination's color, so a
 * 25 is still red and a 500 still purple. With no tint, or one that is not a color, the palette is unchanged.
 */
export function tintChip(palette: Palette, tint: string | undefined): Palette {
  const rgb = tint === undefined ? undefined : parseHex(tint);
  if (rgb === undefined) return palette;
  const toHex = (channels: readonly number[]): string => `#${channels.map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;
  return { ...palette, b: toHex(rgb), d: toHex(darken(rgb, 0.35)) };
}
