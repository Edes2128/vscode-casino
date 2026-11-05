import { useEffect, useMemo, useRef } from 'react';
import type { RouletteAnimationId } from '../../casino/appearance';
import { WHEEL_PIXELS, renderWheel, thumbnailState, wheelColoursFor } from '../art/rouletteWheel';
import { useAppearance } from '../customization/AppearanceContext';
import { rouletteAnimation } from '../customization/rouletteAnimations';
import { WheelBurst } from './WheelBurst';

/**
 * A still picture of what a style looks like, on the choice card: the wheel with the ball whirling (and, for Neon
 * Spin, its glowing trail), or at rest with the burst of pixels frozen (Pixel Explosion). Drawn once in the
 * theme's colours, and again only when they change. Nothing here moves.
 */
export function WheelThumb({ id }: { readonly id: RouletteAnimationId }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const style = rouletteAnimation(id);
  const { rim, rimLight, bowl, neon } = useAppearance().resolved.tokens;
  const colours = useMemo(() => wheelColoursFor({ rim, rimLight, bowl, neon }), [rim, rimLight, bowl, neon]);

  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (context === null || context === undefined) return;
    const image = context.createImageData(WHEEL_PIXELS, WHEEL_PIXELS);
    renderWheel(thumbnailState(style), image.data, colours);
    context.putImageData(image, 0, 0);
  }, [style, colours]);

  return (
    <span className="anim-thumb">
      <canvas ref={canvas} className="anim-thumb__canvas" width={WHEEL_PIXELS} height={WHEEL_PIXELS} />
      {style.effect === 'burst' && <WheelBurst count={style.effectSize} still />}
    </span>
  );
}
