import type { ReactNode } from 'react';
import type { Palette } from '../art/pixelRuns';
import { cssVars } from '../cssVars';
import { cx } from '../cx';
import { PixelSprite } from './PixelSprite';

interface PixelSceneProps {
  /** Size of the scene in bitmap cells. */
  readonly cols: number;
  readonly rows: number;
  readonly className?: string | undefined;
  readonly children: ReactNode;
}

/** A fixed-size stage that sprites are placed on, measured in bitmap cells. */
export function PixelScene({ cols, rows, className, children }: PixelSceneProps) {
  return (
    <div className={cx('pixel-scene', className)} style={cssVars({ '--cols': cols, '--rows': rows })}>
      {children}
    </div>
  );
}

interface SceneSpriteProps {
  /** Position of the sprite's top-left corner, in bitmap cells. */
  readonly x: number;
  readonly y: number;
  readonly rows: readonly string[];
  readonly palette: Palette;
  readonly className?: string | undefined;
}

/** A sprite placed on a `PixelScene`. The wrapper is the target for CSS animations. */
export function SceneSprite({ x, y, rows, palette, className }: SceneSpriteProps) {
  return (
    <span className={cx('scene-sprite', className)} style={cssVars({ '--x': x, '--y': y })}>
      <PixelSprite rows={rows} palette={palette} />
    </span>
  );
}
