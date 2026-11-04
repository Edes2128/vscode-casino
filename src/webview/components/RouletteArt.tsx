import { useMemo } from 'react';
import { getWheelStripUrl } from '../art/wheelStrip';
import { WHEEL_FRAMES, WHEEL_SIZE } from '../art/wheel';
import { cssVars } from '../cssVars';
import { PixelScene } from './PixelScene';

/**
 * A spinning roulette wheel. All frames are pre-rendered into one strip and CSS steps through
 * it, so the animation costs no JavaScript per frame.
 */
export function RouletteArt() {
  const strip = useMemo(() => getWheelStripUrl(), []);

  return (
    <PixelScene cols={WHEEL_SIZE} rows={WHEEL_SIZE} className="rl-art">
      <div
        className="rl-art__wheel"
        style={{
          ...cssVars({ '--frames': WHEEL_FRAMES }),
          ...(strip === undefined ? {} : { backgroundImage: `url(${strip})` }),
        }}
      />
    </PixelScene>
  );
}
