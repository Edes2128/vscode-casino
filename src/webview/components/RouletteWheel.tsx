import { useCallback, useEffect, useRef } from 'react';
import { ARROW_DOWN, ICON_PALETTE } from '../art/sprites';
import {
  WHEEL_PIXELS,
  numberUnderPointer,
  planSpin,
  renderWheel,
  restingState,
  spinState,
  type WheelState,
} from '../art/rouletteWheel';
import type { MotionLevel } from '../motion';
import { PixelSprite } from './PixelSprite';

/** In calm mode the wheel does not turn: it stays still this long, then shows where the ball landed. */
export const CALM_PAUSE_MS = 900;

interface RouletteWheelProps {
  /** The latest spin: its number and where the ball lands (an index into the wheel order). */
  readonly spin: { readonly id: number; readonly pocketIndex: number } | undefined;
  /**
   * `full`: the wheel turns. `calm`: it stays still for a moment and then jumps to where it ends up.
   * `off`: it jumps straight there.
   */
  readonly motion: MotionLevel;
  /** Called with the number under the pointer once the wheel has stopped. */
  readonly onStopped: (landedOn: number) => void;
}

/**
 * The pixel-art wheel on a canvas. It draws once while idle and only runs a frame loop during a
 * spin, so it costs nothing at rest. The spin was decided by the host long before this starts: the
 * animation is planned to end with that exact pocket under the pointer.
 */
export function RouletteWheel({ spin, motion, onStopped }: RouletteWheelProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const image = useRef<ImageData | null>(null);
  const rotation = useRef(restingState(spin?.pocketIndex).rotation);
  /** The spin whose result is already on the wheel, so a result that was there from the start is not replayed. */
  const shown = useRef(spin?.id);
  const stopped = useRef(onStopped);
  // The effects below depend on these two numbers, not on the `spin` object: the parent builds a new
  // object on every render, and a re-render in the middle of a spin (a setting changed in the other
  // view, the balance being held) must not restart the wheel.
  const spinId = spin?.id;
  const pocketIndex = spin?.pocketIndex;

  useEffect(() => {
    stopped.current = onStopped;
  }, [onStopped]);

  const paint = useCallback((state: WheelState) => {
    const element = canvas.current;
    const context = element?.getContext('2d');
    if (context === null || context === undefined) return;
    image.current ??= context.createImageData(WHEEL_PIXELS, WHEEL_PIXELS);
    renderWheel(state, image.current.data);
    context.putImageData(image.current, 0, 0);
    rotation.current = state.rotation;
  }, []);

  // The wheel as it stands when the screen opens.
  useEffect(() => {
    paint(restingState(spin?.pocketIndex));
    // Only on mount: later spins are handled below.
  }, [paint]);

  useEffect(() => {
    if (spinId === undefined || pocketIndex === undefined) {
      // The result was wiped (the statistics were reset): back to the wheel at rest, even mid-spin.
      if (shown.current !== undefined) {
        shown.current = undefined;
        paint(restingState(undefined));
      }
      return;
    }
    if (shown.current === spinId) return;
    const before = shown.current;
    shown.current = spinId;

    const plan = planSpin(rotation.current, pocketIndex);
    const landedOn = numberUnderPointer(plan.endRotation);

    const finalFrame = (): void => paint(spinState(plan, pocketIndex, plan.durationMs));

    if (motion === 'off') {
      finalFrame();
      stopped.current(landedOn);
      return;
    }

    if (motion === 'calm') {
      let done = false;
      const timer = window.setTimeout(() => {
        done = true;
        finalFrame();
        stopped.current(landedOn);
      }, CALM_PAUSE_MS);
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

  return (
    <div className="rl-wheel">
      <PixelSprite rows={ARROW_DOWN} palette={ICON_PALETTE} className="rl-wheel__pointer" />
      <canvas
        ref={canvas}
        className="rl-wheel__canvas"
        width={WHEEL_PIXELS}
        height={WHEEL_PIXELS}
        role="img"
        aria-label="Roulette wheel"
      />
    </div>
  );
}
