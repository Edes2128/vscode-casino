/**
 * The five sound packs, as plain data. A pack says, for every cue, which tones make it. Like the cues
 * themselves, nothing here touches the audio system: the packs are synthesized patches (oscillators and
 * a burst of noise), never audio files, so they work offline and there is nothing to download or license.
 *
 * The melodies are original. What gives a pack its character is the waveform, the register and the
 * rhythm, so each one is built from its own palette:
 *
 * - Classic Lounge: Break Room Arcade's own sounds, exactly as they have always been (`cues.ts`).
 * - Retro Arcade: chiptune. Square and triangle blips, quick arpeggios, pitch slides, no noise.
 * - Pixel Adventure: bright and major. Triangle and sine like a music box or a harp, a fanfare for a win.
 * - Neon Cyber: sawtooth pairs a hair out of tune, long sweeps, zaps and bursts of static.
 * - Minimal Sounds: tiny, soft sine ticks. Nothing busy.
 */

import { isSoundPackId, type SoundPackId } from '../../state/appearance';
import {
  CARD_GAP_SECONDS,
  cardCount,
  cueTones,
  spinSeconds,
  spinTickTimes,
  type Cue,
  type CueOptions,
  type Tone,
  type Wave,
} from './cues';

/** How one cue sounds in one pack. It is given the options of the request, such as how many cards land. */
export type CueRecipe = (options: CueOptions) => readonly Tone[];

/** A sound pack: a recipe for every cue. The type is a record over `Cue`, so a pack cannot miss one. */
export type SoundPack = Readonly<Record<Cue, CueRecipe>>;

// ---------------------------------------------------------------- notes and tone builders

type NoteLetter = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';

/** A pitch such as `C5` or `F#6`. Only names that really are notes type-check. */
type NoteName = `${NoteLetter}${2 | 3 | 4 | 5 | 6 | 7}`;

const SEMITONES: Readonly<Record<NoteLetter, number>> = {
  C: 0,
  'C#': 1,
  D: 2,
  'D#': 3,
  E: 4,
  F: 5,
  'F#': 6,
  G: 7,
  'G#': 8,
  A: 9,
  'A#': 10,
  B: 11,
};

/** The frequency of a note in Hz, in equal temperament with A4 at 440. */
export function hz(name: NoteName): number {
  const letter = name.slice(0, -1) as NoteLetter;
  const octave = Number(name.slice(-1));
  return 440 * 2 ** ((octave * 12 + SEMITONES[letter] - (4 * 12 + 9)) / 12);
}

/** `to` is left out of the tone, not set to `undefined`, when the pitch stays put. */
const tone = (at: number, duration: number, wave: Wave, from: number, gain: number, to?: number): Tone =>
  to === undefined ? { at, duration, wave, from, gain } : { at, duration, wave, from, gain, to };

type Voice = (at: number, duration: number, from: number, gain: number, to?: number) => Tone;

/** A builder of tones in one waveform: `square(at, duration, pitch, gain, glideTo?)`. */
const voice =
  (wave: Wave): Voice =>
  (at, duration, from, gain, to) =>
    tone(at, duration, wave, from, gain, to);

const square = voice('square');
const triangle = voice('triangle');
const saw = voice('sawtooth');
const sine = voice('sine');
/** A burst of static: no pitch. */
const noise = (at: number, duration: number, gain: number): Tone => tone(at, duration, 'noise', 0, gain);

interface RunOptions {
  /** Start of the first note, in seconds. */
  readonly at?: number;
  /** Time from one note to the next. */
  readonly step: number;
  /** How long each note lasts. */
  readonly length: number;
  readonly gain: number;
}

/** Notes one after another, as a melody or an arpeggio. */
const run = (build: Voice, notes: readonly NoteName[], { at = 0, step, length, gain }: RunOptions): Tone[] =>
  notes.map((name, index) => build(at + index * step, length, hz(name), gain));

/** Notes sounding together. */
const chord = (build: Voice, notes: readonly NoteName[], at: number, length: number, gain: number): Tone[] =>
  notes.map((name) => build(at, length, hz(name), gain));

/** How far the second voice of a pair is out of tune, as a ratio: about 20 cents, enough to shimmer. */
const DETUNE = 1.012;

/** Every pitched tone doubled by a quieter copy a little out of tune, so the two beat against each other. */
function detuned(tones: readonly Tone[]): Tone[] {
  return tones.flatMap((original) => [
    original,
    tone(
      original.at,
      original.duration,
      original.wave,
      original.from * DETUNE,
      original.gain * 0.75,
      original.to === undefined ? undefined : original.to * DETUNE,
    ),
  ]);
}

/** A cue that is always the same, whatever it is asked for. */
const fixed =
  (tones: readonly Tone[]): CueRecipe =>
  () =>
    tones;

/** Cards landing one after the other, each made by `one(at)`. They keep Break Room Arcade's own pace: the cards move to it. */
const dealt =
  (one: (at: number) => readonly Tone[]): CueRecipe =>
  (options) =>
    Array.from({ length: cardCount(options) }, (_, index) => one(index * CARD_GAP_SECONDS)).flat();

/**
 * The rattle of the ball, for as long as the wheel turns. It is given when each pocket goes by (the same
 * easing out for every pack) and when the wheel stops, and answers with the tones.
 */
const rattle =
  (make: (seconds: number, pockets: readonly number[]) => readonly Tone[]): CueRecipe =>
  (options) => {
    const seconds = spinSeconds(options);
    return make(seconds, spinTickTimes(seconds));
  };

// ---------------------------------------------------------------- Classic Lounge

/** Break Room Arcade's own sounds. They are defined in `cues.ts`, and never change. */
const CLASSIC: SoundPack = {
  click: (options) => cueTones('click', options),
  chip: (options) => cueTones('chip', options),
  card: (options) => cueTones('card', options),
  flip: (options) => cueTones('flip', options),
  tick: (options) => cueTones('tick', options),
  spin: (options) => cueTones('spin', options),
  win: (options) => cueTones('win', options),
  bigWin: (options) => cueTones('bigWin', options),
  lose: (options) => cueTones('lose', options),
  push: (options) => cueTones('push', options),
  nav: (options) => cueTones('nav', options),
};

// ---------------------------------------------------------------- Retro Arcade

/** Chiptune: two square blips for a button, a quick arpeggio for a flip, a power-down for the wheel stopping. */
const ARCADE: SoundPack = {
  click: fixed([square(0, 0.028, hz('C6'), 0.2), square(0.03, 0.035, hz('G5'), 0.2)]),
  tick: fixed([square(0, 0.014, hz('C7'), 0.14)]),
  chip: fixed([triangle(0, 0.1, hz('G5'), 0.2), square(0, 0.03, hz('G6'), 0.17), square(0.035, 0.07, hz('D7'), 0.15)]),
  card: dealt((at) => [square(at, 0.07, 1100, 0.18, 260), triangle(at, 0.06, 220, 0.26, 110)]),
  flip: fixed(run(square, ['C5', 'G5', 'C6', 'E6'], { step: 0.03, length: 0.04, gain: 0.18 })),
  spin: rattle((seconds, pockets) => [
    ...pockets.map((at, index) => square(at, 0.02, 1400 + (index % 4) * 200, 0.13)),
    square(seconds, 0.2, 523, 0.22, 131),
    triangle(seconds, 0.2, 262, 0.3, 131),
  ]),
  win: fixed([
    ...run(square, ['G5', 'B5', 'D6', 'G6', 'D6'], { step: 0.06, length: 0.07, gain: 0.2 }),
    square(0.3, 0.2, hz('G6'), 0.2),
    triangle(0, 0.5, hz('G4'), 0.22),
  ]),
  bigWin: fixed([
    ...run(square, ['C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6', 'G6'], { step: 0.05, length: 0.06, gain: 0.2 }),
    square(0.5, 0.5, hz('C7'), 0.17),
    square(0.5, 0.5, hz('G6'), 0.15),
    triangle(0.5, 0.5, hz('C5'), 0.26),
    ...run(square, ['A6', 'G6', 'A6', 'G6', 'A6', 'G6'], { at: 0.55, step: 0.05, length: 0.05, gain: 0.12 }),
  ]),
  lose: fixed([
    ...run(square, ['A4', 'F4', 'D4', 'A3'], { step: 0.12, length: 0.11, gain: 0.24 }),
    triangle(0.5, 0.3, hz('G3'), 0.3, hz('G3') / 2),
  ]),
  push: fixed([
    square(0, 0.05, hz('E5'), 0.2),
    square(0.08, 0.05, hz('E5'), 0.2),
    square(0.16, 0.09, hz('E5'), 0.2),
  ]),
  nav: fixed([square(0, 0.07, 600, 0.16, hz('E6'))]),
};

// ---------------------------------------------------------------- Pixel Adventure

/** Bright and in a major key: a music box for the wheel, a little fanfare for a win, a soft bell for a button. */
const ADVENTURE: SoundPack = {
  click: fixed([triangle(0, 0.05, hz('E6'), 0.2), sine(0, 0.03, hz('E7'), 0.08)]),
  tick: fixed([triangle(0, 0.025, hz('B6'), 0.16)]),
  chip: fixed([
    triangle(0, 0.06, hz('G6'), 0.18),
    sine(0.035, 0.12, hz('D7'), 0.14),
    sine(0.035, 0.08, hz('G7'), 0.08),
  ]),
  card: dealt((at) => [noise(at, 0.05, 0.13), triangle(at, 0.08, 640, 0.26, 320)]),
  flip: fixed([triangle(0, 0.12, hz('C5'), 0.2, hz('C6')), sine(0, 0.12, hz('C6'), 0.1, hz('C7'))]),
  spin: rattle((seconds, pockets) => {
    const scale: readonly NoteName[] = ['C6', 'D6', 'E6', 'G6', 'A6'];
    return [
      ...pockets.map((at, index) => sine(at, 0.035, hz(scale[index % scale.length] ?? 'C6'), 0.15)),
      triangle(seconds, 0.4, hz('C5'), 0.26),
      sine(seconds, 0.4, hz('G5'), 0.16),
      sine(seconds, 0.35, hz('E6'), 0.1),
    ];
  }),
  win: fixed([
    ...run(triangle, ['D5', 'G5', 'B5'], { step: 0.08, length: 0.1, gain: 0.22 }),
    triangle(0.27, 0.4, hz('D6'), 0.24),
    sine(0.27, 0.4, hz('G5'), 0.16),
    sine(0.27, 0.4, hz('B5'), 0.14),
  ]),
  bigWin: fixed([
    ...run(triangle, ['C5', 'E5', 'G5'], { step: 0.09, length: 0.1, gain: 0.22 }),
    ...run(triangle, ['E5', 'G5', 'C6'], { at: 0.3, step: 0.09, length: 0.1, gain: 0.22 }),
    triangle(0.62, 0.7, hz('C6'), 0.24),
    sine(0.62, 0.7, hz('E6'), 0.16),
    sine(0.62, 0.7, hz('G6'), 0.14),
    triangle(0.62, 0.7, hz('C4'), 0.26),
    ...run(sine, ['E7', 'G7', 'C7', 'E7'], { at: 0.8, step: 0.08, length: 0.12, gain: 0.09 }),
  ]),
  lose: fixed([
    ...run(triangle, ['E5', 'C5', 'A4'], { step: 0.13, length: 0.12, gain: 0.24 }),
    triangle(0.4, 0.35, hz('E4'), 0.3, hz('C#4')),
  ]),
  push: fixed([triangle(0, 0.1, hz('G5'), 0.2), sine(0, 0.1, hz('C6'), 0.08), triangle(0.12, 0.14, hz('E5'), 0.2)]),
  nav: fixed([sine(0, 0.09, 880, 0.15, hz('E6')), triangle(0.05, 0.05, hz('A6'), 0.1)]),
};

// ---------------------------------------------------------------- Neon Cyber

/** Sawtooth pairs a little out of tune, sweeps that slide a long way, and static: a synth with a bad attitude. */
const CYBER: SoundPack = {
  click: fixed(detuned([saw(0, 0.05, 1800, 0.13, 450)])),
  tick: fixed([square(0, 0.014, 3000, 0.1, 2200)]),
  chip: fixed([noise(0, 0.02, 0.2), ...detuned([saw(0.01, 0.08, 500, 0.13, 2000)])]),
  card: dealt((at) => [...detuned([saw(at, 0.09, 3200, 0.13, 220)]), square(at, 0.08, 1600, 0.08, 160)]),
  flip: fixed([...detuned([saw(0, 0.14, 220, 0.13, 2600)]), square(0.13, 0.03, 2600, 0.1)]),
  spin: rattle((seconds, pockets) => [
    // A hum that winds down with the wheel, under a radar ping for every pocket.
    ...detuned([saw(0, seconds, 360, 0.09, 90)]),
    ...pockets.map((at, index) => square(at, 0.02, 1500 + (index % 2) * 500, 0.11, 900)),
    ...detuned([saw(seconds, 0.3, 330, 0.26, 110)]),
    noise(seconds, 0.08, 0.2),
  ]),
  win: fixed([
    ...detuned(run(saw, ['A4', 'E5', 'A5', 'C#6', 'E6'], { step: 0.065, length: 0.08, gain: 0.18 })),
    ...detuned([saw(0.35, 0.25, 440, 0.14, 1760)]),
  ]),
  bigWin: fixed([
    ...run(square, ['A4', 'B4', 'C#5', 'E5', 'F#5', 'A5', 'B5', 'C#6', 'E6', 'F#6', 'A6', 'B6'], {
      step: 0.045,
      length: 0.05,
      gain: 0.15,
    }),
    ...detuned(chord(saw, ['A5', 'C#6', 'E6'], 0.6, 0.7, 0.15)),
    ...detuned([saw(0.55, 0.5, 200, 0.12, 3200)]),
    noise(0.55, 0.1, 0.25),
  ]),
  lose: fixed([
    ...detuned([saw(0, 0.45, 660, 0.2, 110)]),
    square(0, 0.05, 400, 0.16),
    square(0.07, 0.05, 300, 0.16),
    square(0.14, 0.05, 220, 0.16),
  ]),
  push: fixed([...detuned([saw(0, 0.07, 330, 0.16)]), ...detuned([saw(0.1, 0.07, 330, 0.16)])]),
  nav: fixed([...detuned([saw(0, 0.1, 300, 0.12, 1800)]), square(0.09, 0.03, 2400, 0.09)]),
};

// ---------------------------------------------------------------- Minimal Sounds

/** Soft sine ticks and a couple of quiet notes. Each cue is one or two tones, and the wheel ticks half as often. */
const MINIMAL: SoundPack = {
  click: fixed([sine(0, 0.035, 1100, 0.14, 900)]),
  tick: fixed([sine(0, 0.015, 1500, 0.09)]),
  chip: fixed([sine(0, 0.05, 880, 0.16), sine(0.035, 0.05, 1320, 0.1)]),
  card: dealt((at) => [sine(at, 0.05, 520, 0.15, 300)]),
  flip: fixed([sine(0, 0.08, 400, 0.13, 800)]),
  spin: rattle((seconds, pockets) => [
    ...pockets.filter((_, index) => index % 2 === 0).map((at, index) => sine(at, 0.015, index % 2 === 0 ? 1000 : 1250, 0.07)),
    sine(seconds, 0.2, 240, 0.2, 180),
  ]),
  win: fixed([...run(sine, ['C6', 'E6'], { step: 0.1, length: 0.12, gain: 0.15 }), sine(0.2, 0.25, hz('G6'), 0.15)]),
  bigWin: fixed([
    ...run(sine, ['C6', 'E6', 'G6', 'C7'], { step: 0.09, length: 0.12, gain: 0.15 }),
    sine(0.27, 0.5, hz('C6'), 0.1),
    sine(0.27, 0.5, hz('G6'), 0.1),
  ]),
  lose: fixed([sine(0, 0.12, hz('A4'), 0.17), sine(0.14, 0.2, hz('F4'), 0.17, hz('E4'))]),
  push: fixed([sine(0, 0.12, 700, 0.14)]),
  nav: fixed([sine(0, 0.06, 700, 0.11, 950)]),
};

/** Every pack, by id. Typed over the ids, so a pack added to `SOUND_PACK_IDS` has to be added here. */
export const SOUND_PACKS: Readonly<Record<SoundPackId, SoundPack>> = {
  classic: CLASSIC,
  arcade: ARCADE,
  adventure: ADVENTURE,
  cyber: CYBER,
  minimal: MINIMAL,
};

/**
 * The tones of `cue` in `pack`. Always at least one, never longer than `MAX_CUE_SECONDS`, never odd values.
 * A pack that is not one of ours (a saved setting from some other version) sounds like the Classic Lounge.
 */
export function cueTonesFor(pack: SoundPackId, cue: Cue, options: CueOptions = {}): readonly Tone[] {
  const sounds = isSoundPackId(pack) ? SOUND_PACKS[pack] : CLASSIC;
  return sounds[cue](options);
}
