import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RouletteAnimationId } from '../../state/appearance';
import { ARROW_DOWN, ICON_PALETTE } from '../art/sprites';
import {
  WHEEL_PIXELS,
  numberUnderPointer,
  planSpin,
  renderWheel,
  restingState,
  spinState,
  wheelColoursFor,
  wheelMotion,
  type WheelState,
} from '../art/rouletteWheel';
import { useAppearance } from '../customization/AppearanceContext';
import { BURST_LIFETIME_MS, wheelStyle } from '../customization/rouletteAnimations';
import { cx } from '../cx';
import type { MotionLevel } from '../motion';
import { PixelSprite } from './PixelSprite';
import { WheelBurst } from './WheelBurst';

export { CALM_PAUSE_MS } from '../art/rouletteWheel';

interface RouletteWheelProps {
  /** The latest spin: its number and where the ball lands (an index into the wheel order). */
  readonly spin: { readonly id: number; readonly pocketIndex: number } | undefined;
  /**
   * `full`: the wheel turns, in the animation style. `calm`: it stays still for a moment and then jumps to where
   * it ends up. `off`: it jumps straight there. Only `full` ever shows a style's motion or effect.
   */
  readonly motion: MotionLevel;
  /** Called with the number under the pointer once the wheel has stopped. */
  readonly onStopped: (landedOn: number) => void;
  /** How the wheel spins. Without it, the style the player chose in Customize. */
  readonly animation?: RouletteAnimationId | undefined;
  /** Another class for the wheel's box, such as `rl-wheel--preview` for a smaller one. */
  readonly className?: string | undefined;
}

/** The burst of Pixel Explosion that is on screen: which spin it belongs to, and how many pixels fly. */
interface Burst {
  readonly id: number;
  readonly count: number;
}

/**
 * The pixel-art wheel on a canvas. It draws once while idle and only runs a frame loop during a
 * spin, so it costs nothing at rest. The spin was decided by the host long before this starts: the
 * animation is planned to end with that exact pocket under the pointer, in every style.
 *
 * The style is read when a spin starts. Changing it in the middle of a spin does not disturb that spin: the next
 * one uses the new style.
 */
export function RouletteWheel({ spin, motion, onStopped, animation, className }: RouletteWheelProps) {
  const appearance = useAppearance();
  const style = wheelStyle(animation, appearance.rouletteAnimation);
  const { rim, rimLight, bowl, neon } = appearance.resolved.tokens;
  const colours = useMemo(() => wheelColoursFor({ rim, rimLight, bowl, neon }), [rim, rimLight, bowl, neon]);

  const canvas = useRef<HTMLCanvasElement>(null);
  const image = useRef<ImageData | null>(null);
  const rotation = useRef(restingState(spin?.pocketIndex).rotation);
  /** The last picture painted, so a change of colours can paint it again in the new ones. */
  const lastState = useRef<WheelState>(restingState(spin?.pocketIndex));
  /** The spin whose result is already on the wheel, so a result that was there from the start is not replayed. */
  const shown = useRef(spin?.id);
  const stopped = useRef(onStopped);
  const coloursNow = useRef(colours);
  const styleNow = useRef(style);
  const [burst, setBurst] = useState<Burst>();
  // The effects below depend on these two numbers, not on the `spin` object: the parent builds a new
  // object on every render, and a re-render in the middle of a spin (a setting changed in the other
  // view, the balance being held) must not restart the wheel.
  const spinId = spin?.id;
  const pocketIndex = spin?.pocketIndex;

  useEffect(() => {
    stopped.current = onStopped;
  }, [onStopped]);

  // Declared before the spin effect: a style chosen in this very render is the one the spin uses.
  useEffect(() => {
    styleNow.current = style;
  }, [style]);

  const paint = useCallback((state: WheelState) => {
    lastState.current = state;
    rotation.current = state.rotation;
    const context = canvas.current?.getContext('2d');
    if (context === null || context === undefined) return;
    image.current ??= context.createImageData(WHEEL_PIXELS, WHEEL_PIXELS);
    renderWheel(state, image.current.data, coloursNow.current);
    context.putImageData(image.current, 0, 0);
  }, []);

  // The wheel as it stands when the screen opens, and again whenever the theme's colours change.
  useEffect(() => {
    coloursNow.current = colours;
    paint(lastState.current);
  }, [colours, paint]);

  useEffect(() => {
    if (spinId === undefined || pocketIndex === undefined) {
      // The result was wiped (the statistics were reset): back to the wheel at rest, even mid-spin.
      if (shown.current !== undefined) {
        shown.current = undefined;
        setBurst(undefined);
        paint(restingState(undefined));
      }
      return;
    }
    if (shown.current === spinId) return;
    const before = shown.current;
    shown.current = spinId;
    setBurst(undefined);

    const chosen = styleNow.current;
    const how = wheelMotion(motion, chosen);
    // Where the wheel stops is worked out from the pocket alone: the same in every style and every motion level.
    const plan = planSpin(rotation.current, pocketIndex, chosen);
    const landedOn = numberUnderPointer(plan.endRotation);

    const finalFrame = (): void => paint(spinState(plan, pocketIndex, plan.durationMs));

    if (how.kind === 'jump') {
      finalFrame();
      stopped.current(landedOn);
      return;
    }

    if (how.kind === 'pause') {
      let done = false;
      const timer = window.setTimeout(() => {
        done = true;
        finalFrame();
        stopped.current(landedOn);
      }, how.durationMs);
      return () => {
        window.clearTimeout(timer);
        if (!done) shown.current = before;
      };
    }

    let frame = 0;
    let finished = false;
    const startedAt = performance.now();
    const tick = (now: number): void => {
      const elapsed = now - startedAt;
      paint(spinState(plan, pocketIndex, elapsed));
      if (elapsed < plan.durationMs) {
        frame = requestAnimationFrame(tick);
      } else {
        finished = true;
        if (how.effect === 'burst') setBurst({ id: spinId, count: chosen.effectSize });
        stopped.current(landedOn);
      }
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      // A spin that was cut short did not finish, so the next effect run may start it again.
      if (!finished) shown.current = before;
    };
  }, [spinId, pocketIndex, motion, paint]);

  // The burst plays once and is taken away: nothing of it is left running after the ball has landed.
  useEffect(() => {
    if (burst === undefined) return;
    const timer = window.setTimeout(() => setBurst(undefined), BURST_LIFETIME_MS);
    return () => window.clearTimeout(timer);
  }, [burst]);

  return (
    <div className={cx('rl-wheel', className)} data-animation={style.id}>
      <PixelSprite rows={ARROW_DOWN} palette={ICON_PALETTE} className="rl-wheel__pointer" />
      <canvas
        ref={canvas}
        className="rl-wheel__canvas"
        width={WHEEL_PIXELS}
        height={WHEEL_PIXELS}
        role="img"
        aria-label="Roulette wheel"
      />
      {burst !== undefined && <WheelBurst key={burst.id} count={burst.count} />}
    </div>
  );
}
