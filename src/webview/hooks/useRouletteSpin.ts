import { useCallback, useState } from 'react';
import type { RouletteView } from '../../game/roulette/view';

export type SpinPhase = 'idle' | 'spinning' | 'result';

export interface RoulettePresentation {
  readonly phase: SpinPhase;
  /** The result arrived while this screen was open (so it gets the banner and effects), rather than being there already. */
  readonly live: boolean;
  /** The number under the pointer once the wheel has stopped. */
  readonly landedOn: number | null;
  /** The wheel calls this when it has stopped. */
  readonly onStopped: (landedOn: number) => void;
}

interface Tracked {
  readonly spin: number;
  readonly phase: SpinPhase;
  readonly live: boolean;
  readonly landedOn: number | null;
}

/**
 * Follows a spin from the host's decision to the wheel stopping. A result that was already there
 * when the screen opened is shown as it is. A new one (while animations are on) is `spinning` until
 * the wheel reports it has stopped, and only then a `result`.
 */
export function useRouletteSpin(view: RouletteView, animate: boolean): RoulettePresentation {
  const [tracked, setTracked] = useState<Tracked>({
    spin: view.spin,
    phase: view.last === undefined ? 'idle' : 'result',
    live: false,
    landedOn: view.last?.pocket.number ?? null,
  });

  // Decided while rendering, so the new result never flashes up before the wheel starts to turn.
  // A result that disappears (the statistics were reset) while the wheel turns ends the wait too:
  // the wheel can never report that it stopped.
  const wiped = view.last === undefined && tracked.phase !== 'idle';
  if (tracked.spin !== view.spin || wiped) {
    const fresh = view.spin > tracked.spin && view.last !== undefined;
    setTracked({
      spin: view.spin,
      phase: fresh ? (animate ? 'spinning' : 'result') : view.last === undefined ? 'idle' : 'result',
      live: fresh,
      landedOn: fresh ? null : (view.last?.pocket.number ?? null),
    });
  }

  const onStopped = useCallback((landedOn: number) => {
    setTracked((current) => ({ ...current, phase: 'result', landedOn }));
  }, []);

  return { phase: tracked.phase, live: tracked.live, landedOn: tracked.landedOn, onStopped };
}
