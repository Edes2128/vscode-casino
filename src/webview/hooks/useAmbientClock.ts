import { useEffect, useRef, type RefObject } from 'react';
import { AMBIENT_TICK_MS, REPORT_EVERY_TICKS, REST_AFTER_MS, ambientSeconds } from '../ambientTiming';

export { AMBIENT_TICK_MS, REPORT_EVERY_TICKS, REST_AFTER_MS, ambientSeconds } from '../ambientTiming';

export interface AmbientState {
  /** The clock is ticking right now. */
  readonly running: boolean;
  /** The clock is stopped because the player has not touched the casino for a while, and starts again when they do. */
  readonly resting: boolean;
  readonly ticks: number;
}

/** Things the player does that show they are there. Any of them wakes the decorations. */
const ACTIVITY_EVENTS = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart', 'focus', 'visibilitychange'] as const;

/**
 * Runs the clock that moves every ambient loop (see styles/ambient.css), and lets it rest.
 *
 * - While `running` is false (the loops are not wanted at all) no timer exists.
 * - The clock ticks only while the page is visible and the player has done something in the last
 *   REST_AFTER_MS. Past that it stops, which stops the page from presenting frames altogether: a
 *   casino left open in the sidebar while you work costs nothing. Any activity starts it again, and
 *   so does a change of `activityKey` (a new screen).
 * - `report` hears when the clock starts, stops, rests, and every few seconds while it ticks.
 */
export function useAmbientClock(
  target: RefObject<HTMLElement | null>,
  running: boolean,
  report: (state: AmbientState) => void,
  activityKey: unknown,
): void {
  // The clock's zero is the same for the whole life of the page, so waking up never rewinds a loop.
  const origin = useRef(performance.now());
  const wake = useRef<() => void>(() => undefined);

  useEffect(() => {
    const element = target.current;
    if (!running || element === null) {
      wake.current = () => undefined;
      report({ running: false, resting: false, ticks: 0 });
      return;
    }

    let lastActivity = performance.now();
    let timer: number | undefined;
    let ticks = 0;

    const stop = (resting: boolean): void => {
      if (timer !== undefined) window.clearInterval(timer);
      timer = undefined;
      report({ running: false, resting, ticks });
    };
    const tick = (): void => {
      const now = performance.now();
      if (now - lastActivity >= REST_AFTER_MS) {
        stop(true);
        return;
      }
      // A page nobody can see has nothing to animate.
      if (document.hidden) return;
      element.style.setProperty('--t', ambientSeconds(now - origin.current));
      ticks += 1;
      if (ticks % REPORT_EVERY_TICKS === 0) report({ running: true, resting: false, ticks });
    };
    const start = (): void => {
      if (timer !== undefined) return;
      tick();
      if (timer !== undefined) return; // the very first tick found the player already gone
      timer = window.setInterval(tick, AMBIENT_TICK_MS);
      report({ running: true, resting: false, ticks });
    };
    const touch = (): void => {
      lastActivity = performance.now();
      start();
    };

    wake.current = touch;
    for (const name of ACTIVITY_EVENTS) document.addEventListener(name, touch, { passive: true, capture: true });
    window.addEventListener('focus', touch);
    start();

    return () => {
      for (const name of ACTIVITY_EVENTS) document.removeEventListener(name, touch, { capture: true });
      window.removeEventListener('focus', touch);
      wake.current = () => undefined;
      stop(false);
    };
  }, [target, running, report]);

  // A new screen is the player doing something, even when it was the host that sent them there.
  useEffect(() => wake.current(), [activityKey]);
}
