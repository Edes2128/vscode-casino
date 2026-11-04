import { useMemo } from 'react';
import { spriteRects, type Palette } from '../art/pixelRuns';
import { cssVars } from '../cssVars';
import { cx } from '../cx';

interface PixelSpriteProps {
  readonly rows: readonly string[];
  readonly palette: Palette;
  readonly className?: string | undefined;
  /** Accessible name. Leave out for purely decorative sprites. */
  readonly label?: string | undefined;
}

/**
 * Draws an ASCII bitmap as crisp SVG. One bitmap cell is `--sprite-cell` pixels wide
 * (defaults to the responsive `--art-cell`), so sprites always scale in whole pixels.
 */
export function PixelSprite({ rows, palette, className, label }: PixelSpriteProps) {
  const rects = useMemo(() => spriteRects(rows, palette), [rows, palette]);
  const cols = rows[0]?.length ?? 0;

  return (
    <svg
      className={cx('pixel-sprite', className)}
      style={cssVars({ '--cols': cols, '--rows': rows.length })}
      viewBox={`0 0 ${cols} ${rows.length}`}
      shapeRendering="crispEdges"
      focusable="false"
      {...(label === undefined ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label })}
    >
      {rects.map((rect) => (
        <rect key={`${rect.x}-${rect.y}`} x={rect.x} y={rect.y} width={rect.width} height={1} fill={rect.fill} />
      ))}
    </svg>
  );
}
