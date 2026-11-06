import type { SoundCategory, SoundPackId } from '../../state/appearance';
import type { Cue, CueOptions } from './cues';
import type { PlayOptions } from './engine';

/** One step of the sample: what plays, and how long after the button was pressed. */
export interface SampleStep {
  /** Shown under the sample while it plays. */
  readonly label: string;
  readonly cue: Cue;
  readonly options?: CueOptions;
  /** Milliseconds after the button was pressed. */
  readonly atMs: number;
}

/**
 * The short tour of a pack that PLAY SAMPLE plays: a button, a chip, two cards, a flip, a win, a loss and a few
 * turns of the wheel. It follows the player's switches like any other sound, so a group that is off stays
 * silent in it too.
 */
export const SAMPLE_STEPS: readonly SampleStep[] = [
  { label: 'CLICK', cue: 'click', atMs: 0 },
  { label: 'CHIP', cue: 'chip', atMs: 350 },
  { label: 'DEAL', cue: 'card', options: { count: 2 }, atMs: 750 },
  { label: 'FLIP', cue: 'flip', atMs: 1_200 },
  { label: 'WIN', cue: 'win', atMs: 1_650 },
  { label: 'LOSS', cue: 'lose', atMs: 2_550 },
  { label: 'SPIN', cue: 'spin', options: { durationMs: 1_200 }, atMs: 3_400 },
];

/** How long the whole sample lasts, wheel included, so the screen can say when it is done. */
export const SAMPLE_TOTAL_MS = 3_400 + 1_200 + 600;

export interface CategorySample {
  readonly cue: Cue;
  readonly options?: CueOptions;
}

/** What plays to answer a group of sounds being switched on, so the player hears what they just got back. */
export const CATEGORY_SAMPLES: Readonly<Record<SoundCategory, CategorySample>> = {
  interface: { cue: 'click' },
  chips: { cue: 'chip' },
  cards: { cue: 'card', options: { count: 2 } },
  roulette: { cue: 'spin', options: { durationMs: 900 } },
  results: { cue: 'win' },
};

/** The timers a sample runs on. The browser's, unless a test supplies its own. */
export interface SampleTimers {
  set(callback: () => void, ms: number): number;
  clear(id: number): void;
}

const browserTimers: SampleTimers = {
  set: (callback, ms) => window.setTimeout(callback, ms),
  clear: (id) => window.clearTimeout(id),
};

/**
 * Plays the sample of `pack`, one step at a time, and tells `onStep` which step is sounding (and `undefined` when
 * it is over). The first sound is made at once, inside the button press, as browsers want audio to begin; the
 * rest follow on timers. Returns a function that stops whatever has not played yet.
 */
export function startSample(
  play: (cue: Cue, options?: PlayOptions) => void,
  pack: SoundPackId,
  onStep: (step: number | undefined) => void,
  timers: SampleTimers = browserTimers,
): () => void {
  const pending: number[] = [];
  const sound = (index: number): void => {
    const entry = SAMPLE_STEPS[index];
    if (entry === undefined) return;
    onStep(index);
    play(entry.cue, { ...entry.options, pack });
  };
  SAMPLE_STEPS.forEach((entry, index) => {
    if (entry.atMs <= 0) sound(index);
    else pending.push(timers.set(() => sound(index), entry.atMs));
  });
  pending.push(timers.set(() => onStep(undefined), SAMPLE_TOTAL_MS));
  return () => pending.forEach((id) => timers.clear(id));
}
