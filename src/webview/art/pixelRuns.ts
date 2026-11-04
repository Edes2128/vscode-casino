/** Maps a sprite character to a CSS colour. `.` (and any unmapped character) is transparent. */
export type Palette = Readonly<Record<string, string>>;

export interface SpriteRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly fill: string;
}

/**
 * Turns an ASCII bitmap into rectangles, one per horizontal run of the same colour.
 * Merging runs keeps the SVG small and avoids hairline seams between neighbouring pixels.
 */
export function spriteRects(rows: readonly string[], palette: Palette): SpriteRect[] {
  const rects: SpriteRect[] = [];

  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const char = row.charAt(x);
      let end = x + 1;
      while (end < row.length && row.charAt(end) === char) end += 1;

      const fill = char === '.' ? undefined : palette[char];
      if (fill !== undefined) rects.push({ x, y, width: end - x, fill });
      x = end;
    }
  });

  return rects;
}
