import type { Palette } from './pixelRuns';
import { WHEEL_FRAMES, WHEEL_PALETTE, WHEEL_SIZE, wheelFrameRows } from './wheel';

let cached: string | null | undefined;

/**
 * All wheel frames side by side as one PNG data URL (WHEEL_FRAMES * WHEEL_SIZE wide).
 * CSS steps through it with `background-position`, so the animation costs no JavaScript per
 * frame. Built once, on first use. Returns `undefined` if canvas is unavailable.
 */
export function getWheelStripUrl(): string | undefined {
  if (cached === undefined) cached = buildStrip();
  return cached ?? undefined;
}

function buildStrip(): string | null {
  const canvas = document.createElement('canvas');
  canvas.width = WHEEL_SIZE * WHEEL_FRAMES;
  canvas.height = WHEEL_SIZE;
  const context = canvas.getContext('2d');
  if (context === null) return null;

  const colours = parsePalette(WHEEL_PALETTE);
  const image = context.createImageData(canvas.width, canvas.height);

  for (let frame = 0; frame < WHEEL_FRAMES; frame += 1) {
    wheelFrameRows(frame).forEach((row, y) => {
      for (let x = 0; x < row.length; x += 1) {
        const rgb = colours.get(row.charAt(x));
        if (rgb === undefined) continue;
        const offset = (y * canvas.width + frame * WHEEL_SIZE + x) * 4;
        image.data[offset] = rgb[0];
        image.data[offset + 1] = rgb[1];
        image.data[offset + 2] = rgb[2];
        image.data[offset + 3] = 255;
      }
    });
  }

  context.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}

function parsePalette(palette: Palette): Map<string, readonly [number, number, number]> {
  const colours = new Map<string, readonly [number, number, number]>();
  for (const [char, hex] of Object.entries(palette)) {
    colours.set(char, [
      Number.parseInt(hex.slice(1, 3), 16),
      Number.parseInt(hex.slice(3, 5), 16),
      Number.parseInt(hex.slice(5, 7), 16),
    ]);
  }
  return colours;
}
