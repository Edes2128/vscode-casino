import { useMemo } from 'react';
import { getWheelStripUrl } from '../art/wheelStrip';
import { WHEEL_FRAMES, WHEEL_SIZE, wheelPaletteFor } from '../art/wheel';
import { useAppearance } from '../customization/AppearanceContext';
import { cssVars } from '../cssVars';
import { PixelScene } from './PixelScene';

/**
 * A spinning roulette wheel. All frames are pre-rendered into one strip and CSS steps through
 * it, so the animation costs no JavaScript per frame.
 */
export function RouletteArt() {
  // The rim, hub and bowl wear the theme; the red, black and green pockets stay what they mean.
  const { rim, rimLight, bowl } = useAppearance().resolved.tokens;
  const strip = useMemo(() => getWheelStripUrl(wheelPaletteFor({ rim, rimLight, bowl })), [rim, rimLight, bowl]);

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
