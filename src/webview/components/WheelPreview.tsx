import { useCallback, useReducer } from 'react';
import type { RouletteAnimationId } from '../../casino/appearance';
import type { Pocket } from '../../game/roulette/types';
import { POCKET_COUNT, colorOfNumber } from '../../game/roulette/wheel';
import { rouletteAnimation, spinSeconds } from '../customization/rouletteAnimations';
import { useMotion, type MotionLevel } from '../motion';
import { pocketWords } from '../rouletteText';
import { PixelButton } from './PixelButton';
import { PocketBadge } from './PocketBadge';
import { RouletteWheel } from './RouletteWheel';

/**
 * A pocket for the preview to land on: any of the 37 except the one it landed on last, so every try visibly moves.
 * Only the preview uses it. The real game's pocket is always drawn by the host.
 */
export function demoPocket(previous: number | undefined, random: () => number = Math.random): number {
  const others = previous === undefined ? POCKET_COUNT : POCKET_COUNT - 1;
  const pick = Math.min(others - 1, Math.floor(random() * others));
  return previous !== undefined && pick >= previous ? pick + 1 : pick;
}

/** What the preview says about the player's motion setting: why nothing may move, or how long the spin takes. */
export function previewNote(motion: MotionLevel, seconds: string): string {
  if (motion === 'off') return 'ANIMATIONS ARE OFF, SO THE RESULT SHOWS AT ONCE.';
  if (motion === 'calm') return 'REDUCED MOTION IS ON, SO THE WHEEL WAITS AND THEN SHOWS THE RESULT.';
  return `THIS SPIN TAKES ABOUT ${seconds} SECONDS.`;
}

export interface PreviewState {
  /** The spin the preview wheel is showing: counted up from 1, with the pocket picked for it. */
  readonly spin: { readonly id: number; readonly pocketIndex: number } | undefined;
  /** A spin is running. TRY IT is switched off until it has stopped. */
  readonly running: boolean;
  /** Where the last spin stopped. */
  readonly landed: Pocket | undefined;
}

export const IDLE_PREVIEW: PreviewState = { spin: undefined, running: false, landed: undefined };

export type PreviewEvent =
  | { readonly type: 'try'; /** A number from 0 up to (not including) 1, which decides the pocket. Drawn by the caller, so the reducer stays pure. */ readonly roll: number }
  | { readonly type: 'stopped'; readonly landedOn: number };

/**
 * TRY IT starts one spin on a pocket picked here, and only when none is running: a second press while the wheel
 * turns changes nothing. The wheel reports where it stopped, and the preview is free again.
 */
export function previewStep(state: PreviewState, event: PreviewEvent): PreviewState {
  if (event.type === 'stopped') {
    return { ...state, running: false, landed: { number: event.landedOn, color: colorOfNumber(event.landedOn) } };
  }
  if (state.running) return state;
  return {
    spin: { id: (state.spin?.id ?? 0) + 1, pocketIndex: demoPocket(state.spin?.pocketIndex, () => event.roll) },
    running: true,
    landed: undefined,
  };
}

interface PreviewPanelProps {
  readonly animation: RouletteAnimationId;
  readonly motion: MotionLevel;
  readonly state: PreviewState;
  readonly onTry: () => void;
  readonly onStopped: (landedOn: number) => void;
}

/** The preview as it looks for a state: the wheel, what it said last, and the TRY IT button. */
export function PreviewPanel({ animation, motion, state, onTry, onStopped }: PreviewPanelProps) {
  const { running, landed, spin } = state;
  return (
    <section className="anim-preview" aria-label="Try the animation">
      <RouletteWheel className="rl-wheel--preview" spin={spin} motion={motion} animation={animation} onStopped={onStopped} />
      <p className="anim-preview__result" role="status">
        {landed !== undefined ? (
          <>
            LANDED ON <PocketBadge pocket={landed} /> {pocketWords(landed)}
          </>
        ) : running ? (
          'SPINNING'
        ) : (
          'PREVIEW ONLY. NO CHIPS ARE BET.'
        )}
      </p>
      <PixelButton variant="gold" size="lg" block disabled={running} onClick={onTry}>
        {running ? 'SPINNING' : 'TRY IT'}
      </PixelButton>
      <p className="anim-preview__note">{previewNote(motion, spinSeconds(rouletteAnimation(animation)))}</p>
    </section>
  );
}

/**
 * A wheel to try a style on. TRY IT runs one spin in the chosen style on a pocket picked here, nothing more: no
 * chips, no message to the host, no result that is kept. The real game stays host-authoritative. It never starts
 * by itself, follows the player's motion setting, and cannot be started again while it runs.
 */
export function WheelPreview({ animation }: { readonly animation: RouletteAnimationId }) {
  const motion = useMotion();
  const [state, dispatch] = useReducer(previewStep, IDLE_PREVIEW);
  const onTry = useCallback(() => dispatch({ type: 'try', roll: Math.random() }), []);
  const onStopped = useCallback((landedOn: number) => dispatch({ type: 'stopped', landedOn }), []);
  return <PreviewPanel animation={animation} motion={motion} state={state} onTry={onTry} onStopped={onStopped} />;
}
