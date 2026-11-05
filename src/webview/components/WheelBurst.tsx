import { wheelBurstDots } from '../art/wheelBurst';
import { BURST_MS } from '../customization/rouletteAnimations';
import { cssVars } from '../cssVars';
import { cx } from '../cx';

interface WheelBurstProps {
  /** How many pixels fly out. */
  readonly count: number;
  /** A frozen picture of the burst, for the style's thumbnail: nothing moves. */
  readonly still?: boolean;
}

/**
 * The pixels Pixel Explosion throws out of the pocket the ball has landed in (the one under the pointer). It is
 * placed over the wheel, plays once for `BURST_MS` and is taken away by whoever put it there, so nothing keeps
 * running afterwards. The colours are the theme's own. Hidden for calm and off, and never even drawn in them.
 */
export function WheelBurst({ count, still = false }: WheelBurstProps) {
  return (
    <span className={cx('wheel-burst', still && 'wheel-burst--still')} aria-hidden="true" style={cssVars({ '--burst-ms': `${BURST_MS}ms` })}>
      {wheelBurstDots(count).map((dot, index) => (
        <span
          key={index}
          className={cx('wheel-burst__dot', `wheel-burst__dot--${dot.tint}`)}
          style={cssVars({ '--dx': dot.dx, '--dy': dot.dy, '--size': dot.size, '--delay': `${dot.delayMs}ms` })}
        />
      ))}
    </span>
  );
}
