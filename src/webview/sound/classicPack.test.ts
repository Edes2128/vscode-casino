import { describe, expect, it } from 'vitest';
import { CUES, cueTones, type Cue, type CueOptions, type Tone } from './cues';
import { cueTonesFor, SOUND_PACKS } from './packs';

/**
 * A frozen copy of Lucky Break's sounds as they were before there were sound packs, written out here on purpose and
 * not imported: the Classic Lounge pack must keep sounding exactly like this, whatever happens to `cues.ts`.
 */
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

const note = (at: number, duration: number, from: number, gain = 0.28, wave: Tone['wave'] = 'square'): Tone => ({ at, duration, wave, from, gain });

const LEGACY_MELODIES = {
  win: [C5, E5, G5, C6].map((pitch, index) => note(index * 0.09, 0.13, pitch)),
  bigWin: [
    ...[C5, E5, G5, C6, E6, G6].map((pitch, index) => note(index * 0.08, 0.12, pitch)),
    note(0.5, 0.45, C7, 0.22),
    note(0.5, 0.45, G5, 0.18, 'triangle'),
  ],
  lose: [
    note(0, 0.13, D4, 0.3, 'sawtooth'),
    { at: 0.15, duration: 0.3, wave: 'sawtooth', from: G3 * 1.2, to: G3 * 0.7, gain: 0.3 } satisfies Tone,
  ],
  push: [note(0, 0.09, A4), note(0.14, 0.09, A4)],
};

function legacySpin(durationSeconds: number): Tone[] {
  const requested = Number.isFinite(durationSeconds) ? durationSeconds : 5.5;
  const seconds = Math.min(Math.max(requested, 0.3), 8 - 0.4);
  const ticks = Math.max(4, Math.round(seconds * 9));
  const tones: Tone[] = [];
  for (let index = 0; index < ticks; index += 1) {
    const progress = index / ticks;
    const at = seconds * (1 - (1 - progress) ** (1 / 2.2));
    tones.push({ at, duration: 0.025, wave: 'square', from: 900 + (index % 3) * 140, gain: 0.16 });
  }
  tones.push({ at: seconds, duration: 0.16, wave: 'triangle', from: 220, to: 110, gain: 0.3 });
  return tones;
}

function legacyCueTones(cue: Exclude<Cue, 'nav'>, options: CueOptions = {}): readonly Tone[] {
  switch (cue) {
    case 'click':
      return [{ at: 0, duration: 0.04, wave: 'square', from: 880, to: 660, gain: 0.22 }];
    case 'tick':
      return [note(0, 0.02, 1200, 0.2)];
    case 'chip':
      return [{ at: 0, duration: 0.03, wave: 'noise', from: 0, gain: 0.3 }, note(0.045, 0.05, 1568, 0.2)];
    case 'card': {
      const requested = options.count !== undefined && Number.isFinite(options.count) ? Math.trunc(options.count) : 1;
      const count = Math.min(Math.max(requested, 1), 8);
      return Array.from({ length: count }, (_, index): Tone => ({ at: index * 0.14, duration: 0.08, wave: 'noise', from: 0, gain: 0.34 }));
    }
    case 'flip':
      return [
        { at: 0, duration: 0.05, wave: 'noise', from: 0, gain: 0.3 },
        { at: 0.03, duration: 0.1, wave: 'square', from: 420, to: 840, gain: 0.2 },
      ];
    case 'spin':
      return legacySpin((options.durationMs ?? 5.5 * 1000) / 1000);
    case 'win':
      return LEGACY_MELODIES.win;
    case 'bigWin':
      return LEGACY_MELODIES.bigWin;
    case 'lose':
      return LEGACY_MELODIES.lose;
    case 'push':
      return LEGACY_MELODIES.push;
  }
}

const OPTIONS: readonly CueOptions[] = [
  {},
  { count: 1 },
  { count: 2 },
  { count: 8 },
  { count: 0 },
  { count: -4 },
  { count: 2.9 },
  { count: 5_000 },
  { count: Number.NaN },
  { count: Number.POSITIVE_INFINITY },
  { durationMs: 0 },
  { durationMs: 1 },
  { durationMs: 300 },
  { durationMs: 900 },
  { durationMs: 1_200 },
  { durationMs: 5_500 },
  { durationMs: 7_600 },
  { durationMs: 1_000_000 },
  { durationMs: -50 },
  { durationMs: Number.NaN },
  { durationMs: Number.POSITIVE_INFINITY },
  { count: 3, durationMs: 2_345 },
];

const LEGACY_CUES = CUES.filter((cue): cue is Exclude<Cue, 'nav'> => cue !== 'nav');

describe('the Classic Lounge pack', () => {
  it('is Lucky Break\'s own sounds, tone for tone, for every cue and every kind of request', () => {
    for (const cue of LEGACY_CUES) {
      for (const options of OPTIONS) {
        expect(cueTonesFor('classic', cue, options), `${cue} ${JSON.stringify(options)}`).toEqual(legacyCueTones(cue, options));
        expect(cueTones(cue, options), `${cue} ${JSON.stringify(options)}`).toEqual(legacyCueTones(cue, options));
      }
    }
  });

  it('has the same ten sounds as before, and one new one for the navigation bar', () => {
    expect(CUES).toEqual([...LEGACY_CUES, 'nav']);
  });

  it('is what plays when no pack is named, and for a pack id nobody has heard of', () => {
    for (const cue of CUES) {
      expect(cueTonesFor('classic', cue)).toEqual(cueTones(cue));
      expect(cueTonesFor('nonexistent' as never, cue)).toEqual(cueTones(cue));
    }
  });

  it('is built from `cueTones` itself, so there is one Classic Lounge, not two', () => {
    for (const cue of CUES) expect(SOUND_PACKS.classic[cue]({ count: 3, durationMs: 2_000 })).toEqual(cueTones(cue, { count: 3, durationMs: 2_000 }));
  });
});
