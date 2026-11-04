/**
 * The sound effects, as plain data: a list of simple tones per cue, in the spirit of an 8-bit
 * console. Nothing here touches the audio system, so the shapes can be checked in a unit test.
 */

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
  | 'push';

export const CUES: readonly Cue[] = ['click', 'chip', 'card', 'flip', 'tick', 'spin', 'win', 'bigWin', 'lose', 'push'];

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

/** The rattle of the ball: ticks that start close together and spread out as the wheel slows. */
function spinTones(durationSeconds: number): Tone[] {
  const requested = Number.isFinite(durationSeconds) ? durationSeconds : DEFAULT_SPIN_SECONDS;
  const seconds = Math.min(Math.max(requested, 0.3), MAX_CUE_SECONDS - 0.4);
  const ticks = Math.max(4, Math.round(seconds * 9));
  const tones: Tone[] = [];
  for (let index = 0; index < ticks; index += 1) {
    // Each tick is a pocket going by. The wheel eases out, so the time of the n-th pocket is the inverse
    // of that curve: the first ticks come quickly and the gaps widen as the wheel slows.
    const progress = index / ticks;
    const at = seconds * (1 - (1 - progress) ** (1 / SLOWDOWN));
    tones.push({ at, duration: 0.025, wave: 'square', from: 900 + (index % 3) * 140, gain: 0.16 });
  }
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
    case 'card': {
      const requested = options.count !== undefined && Number.isFinite(options.count) ? Math.trunc(options.count) : 1;
      const count = Math.min(Math.max(requested, 1), MAX_CARDS);
      return Array.from({ length: count }, (_, index): Tone => ({
        at: index * CARD_GAP_SECONDS,
        duration: 0.08,
        wave: 'noise',
        from: 0,
        gain: 0.34,
      }));
    }
    case 'flip':
      return [
        { at: 0, duration: 0.05, wave: 'noise', from: 0, gain: 0.3 },
        { at: 0.03, duration: 0.1, wave: 'square', from: 420, to: 840, gain: 0.2 },
      ];
    case 'spin':
      return spinTones((options.durationMs ?? DEFAULT_SPIN_SECONDS * 1000) / 1000);
    case 'win':
      return MELODIES.win;
    case 'bigWin':
      return MELODIES.bigWin;
    case 'lose':
      return MELODIES.lose;
    case 'push':
      return MELODIES.push;
  }
}

/** The loudness for a volume setting of 0 to 100: gentle at the bottom, full at the top. */
export function masterGain(volume: number): number {
  const clamped = Math.min(Math.max(Number.isFinite(volume) ? volume : 0, 0), 100);
  return (clamped / 100) ** 1.5;
}
