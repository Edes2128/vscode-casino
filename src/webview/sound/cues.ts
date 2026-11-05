/**
 * The sound effects, as plain data: a list of simple tones per cue, in the spirit of an 8-bit
 * console. Nothing here touches the audio system, so the shapes can be checked in a unit test.
 *
 * This file is the Classic Casino sound pack. The other packs, and the way a pack is picked, are in
 * `packs.ts`; they build on the cue vocabulary and the helpers exported here.
 */

import type { SoundCategory } from '../../casino/appearance';

export type Wave = 'square' | 'triangle' | 'sawtooth' | 'sine' | 'noise';

export interface Tone {
  /** Seconds after the cue starts. */
  readonly at: number;
  /** Seconds the tone lasts. */
  readonly duration: number;
  readonly wave: Wave;
  /** Pitch in Hz at the start (ignored for noise). */
  readonly from: number;
  /** Pitch in Hz at the end: the tone glides there. Omitted for a steady pitch. */
  readonly to?: number;
  /** Loudness from 0 to 1, before the player's volume is applied. */
  readonly gain: number;
}

export type Cue =
  /** Any button. */
  | 'click'
  /** A chip is chosen for the bet. */
  | 'chip'
  /** A card lands on the table. */
  | 'card'
  /** The hole card is turned over. */
  | 'flip'
  /** A single tick, such as the volume slider moving. */
  | 'tick'
  /** The wheel turns and the ball rattles, slowing down. */
  | 'spin'
  | 'win'
  /** A natural blackjack, or the ball landing on the green. */
  | 'bigWin'
  | 'lose'
  | 'push'
  /** A page or menu change: the navigation bar. */
  | 'nav';

export const CUES: readonly Cue[] = ['click', 'chip', 'card', 'flip', 'tick', 'spin', 'win', 'bigWin', 'lose', 'push', 'nav'];

/**
 * Which switch of the Customize screen owns each cue. A category that is off silences every cue in it.
 * Written as a record over every cue, so a new cue cannot be added without choosing its category.
 */
export const CUE_CATEGORY: Readonly<Record<Cue, SoundCategory>> = {
  click: 'interface',
  tick: 'interface',
  nav: 'interface',
  chip: 'chips',
  card: 'cards',
  flip: 'cards',
  spin: 'roulette',
  win: 'results',
  bigWin: 'results',
  lose: 'results',
  push: 'results',
};

/** The category a cue belongs to, or `undefined` for anything that is not a cue. */
export const categoryOf = (cue: Cue): SoundCategory | undefined => (Object.hasOwn(CUE_CATEGORY, cue) ? CUE_CATEGORY[cue] : undefined);

export interface CueOptions {
  /** `card`: how many cards land, one after the other. */
  readonly count?: number;
  /** `spin`: how long the wheel turns, so the rattle ends when the ball stops. */
  readonly durationMs?: number;
}

/** The longest any single cue may last, whatever it is asked for. */
export const MAX_CUE_SECONDS = 8;

/** Gap between the cards of a deal, a little shorter than the cards' own staggered arrival. */
export const CARD_GAP_SECONDS = 0.14;

const MAX_CARDS = 8;

/** The room left at the end of a spin for the sound of the wheel stopping, so the whole cue fits in `MAX_CUE_SECONDS`. */
export const SPIN_TAIL_SECONDS = 0.4;

/** How long the wheel turns unless the screen says otherwise: the same as the wheel's own spin. */
const DEFAULT_SPIN_SECONDS = 5.5;

/** How sharply the wheel eases out. Higher means the end of the spin is more drawn out. */
const SLOWDOWN = 2.2;

const note = (at: number, duration: number, from: number, gain = 0.28, wave: Wave = 'square'): Tone => ({
  at,
  duration,
  wave,
  from,
  gain,
});

// Pitches (Hz) for the little melodies.
const C5 = 523.25;
const D4 = 293.66;
const E5 = 659.25;
const G3 = 196;
const G5 = 783.99;
const A4 = 440;
const C6 = 1046.5;
const E6 = 1318.5;
const G6 = 1568;
const C7 = 2093;

const MELODIES = {
  win: [C5, E5, G5, C6].map((pitch, index) => note(index * 0.09, 0.13, pitch)),
  bigWin: [
    ...[C5, E5, G5, C6, E6, G6].map((pitch, index) => note(index * 0.08, 0.12, pitch)),
    note(0.5, 0.45, C7, 0.22),
    note(0.5, 0.45, G5, 0.18, 'triangle'),
  ],
  lose: [note(0, 0.13, D4, 0.3, 'sawtooth'), { at: 0.15, duration: 0.3, wave: 'sawtooth', from: G3 * 1.2, to: G3 * 0.7, gain: 0.3 } satisfies Tone],
  push: [note(0, 0.09, A4), note(0.14, 0.09, A4)],
} as const;

/** How many cards land for a request of `options.count`: a whole number from 1 to 8, whatever is asked. */
export function cardCount(options: CueOptions): number {
  const requested = options.count !== undefined && Number.isFinite(options.count) ? Math.trunc(options.count) : 1;
  return Math.min(Math.max(requested, 1), MAX_CARDS);
}

/** How long the rattle of the wheel's cue lasts, in seconds: the time asked for, kept within what a cue may be. */
export function spinSeconds(options: CueOptions): number {
  const durationSeconds = (options.durationMs ?? DEFAULT_SPIN_SECONDS * 1000) / 1000;
  const requested = Number.isFinite(durationSeconds) ? durationSeconds : DEFAULT_SPIN_SECONDS;
  return Math.min(Math.max(requested, 0.3), MAX_CUE_SECONDS - SPIN_TAIL_SECONDS);
}

/**
 * When each pocket goes by, in seconds after the spin starts. Each tick is a pocket. The wheel eases out,
 * so the time of the n-th pocket is the inverse of that curve: the first ticks come quickly and the gaps
 * widen as the wheel slows.
 */
export function spinTickTimes(seconds: number): number[] {
  const ticks = Math.max(4, Math.round(seconds * 9));
  return Array.from({ length: ticks }, (_, index) => {
    const progress = index / ticks;
    return seconds * (1 - (1 - progress) ** (1 / SLOWDOWN));
  });
}

/** The rattle of the ball: ticks that start close together and spread out as the wheel slows. */
function spinTones(options: CueOptions): Tone[] {
  const seconds = spinSeconds(options);
  const tones: Tone[] = spinTickTimes(seconds).map((at, index) => ({
    at,
    duration: 0.025,
    wave: 'square',
    from: 900 + (index % 3) * 140,
    gain: 0.16,
  }));
  tones.push({ at: seconds, duration: 0.16, wave: 'triangle', from: 220, to: 110, gain: 0.3 });
  return tones;
}

/** The tones of a cue. Always at least one, never longer than `MAX_CUE_SECONDS`, and never odd values. */
export function cueTones(cue: Cue, options: CueOptions = {}): readonly Tone[] {
  switch (cue) {
    case 'click':
      return [{ at: 0, duration: 0.04, wave: 'square', from: 880, to: 660, gain: 0.22 }];
    case 'tick':
      return [note(0, 0.02, 1200, 0.2)];
    case 'chip':
      return [
        { at: 0, duration: 0.03, wave: 'noise', from: 0, gain: 0.3 },
        note(0.045, 0.05, 1568, 0.2),
      ];
    case 'card':
      return Array.from({ length: cardCount(options) }, (_, index): Tone => ({
        at: index * CARD_GAP_SECONDS,
        duration: 0.08,
        wave: 'noise',
        from: 0,
        gain: 0.34,
      }));
    case 'flip':
      return [
        { at: 0, duration: 0.05, wave: 'noise', from: 0, gain: 0.3 },
        { at: 0.03, duration: 0.1, wave: 'square', from: 420, to: 840, gain: 0.2 },
      ];
    case 'spin':
      return spinTones(options);
    case 'win':
      return MELODIES.win;
    case 'bigWin':
      return MELODIES.bigWin;
    case 'lose':
      return MELODIES.lose;
    case 'push':
      return MELODIES.push;
    case 'nav':
      return [note(0, 0.04, 660, 0.18), note(0.05, 0.05, 990, 0.18)];
  }
}

/** The loudness for a volume setting of 0 to 100: gentle at the bottom, full at the top. */
export function masterGain(volume: number): number {
  const clamped = Math.min(Math.max(Number.isFinite(volume) ? volume : 0, 0), 100);
  return (clamped / 100) ** 1.5;
}
