import { describe, expect, it } from 'vitest';
import { SOUND_CATEGORIES, SOUND_PACK_IDS, type SoundPackId } from '../../casino/appearance';
import { CARD_GAP_SECONDS, CUES, CUE_CATEGORY, MAX_CUE_SECONDS, SPIN_TAIL_SECONDS, categoryOf, type Cue, type CueOptions, type Tone } from './cues';
import { MAX_VOICES } from './engine';
import { cueTonesFor, hz, SOUND_PACKS } from './packs';

const WAVES: readonly string[] = ['square', 'triangle', 'sawtooth', 'sine', 'noise'];

const end = (tone: Tone): number => tone.at + tone.duration;
const length = (tones: readonly Tone[]): number => Math.max(...tones.map(end));
const pitched = (tones: readonly Tone[]): Tone[] => tones.filter((tone) => tone.wave !== 'noise');
const lastPitch = (tone: Tone): number => tone.to ?? tone.from;

/** Everything a request can ask of a cue, the odd requests included. */
const REQUESTS: readonly CueOptions[] = [
  {},
  { count: 1 },
  { count: 4 },
  { count: 8 },
  { count: 0 },
  { count: -3 },
  { count: 5_000 },
  { count: Number.NaN },
  { durationMs: 0 },
  { durationMs: 900 },
  { durationMs: 5_500 },
  { durationMs: 1_000_000 },
  { durationMs: Number.NaN },
  { durationMs: Number.POSITIVE_INFINITY },
];

/** What is wrong with a cue's tones, in words; an empty list means nothing. */
function problems(tones: readonly Tone[]): string[] {
  const found: string[] = [];
  if (tones.length === 0) found.push('no tones');
  tones.forEach((tone, index) => {
    const where = `tone ${index}`;
    if (!WAVES.includes(tone.wave)) found.push(`${where}: unknown wave ${String(tone.wave)}`);
    if (!Number.isFinite(tone.at) || tone.at < 0) found.push(`${where}: at ${tone.at}`);
    if (!Number.isFinite(tone.duration) || tone.duration <= 0) found.push(`${where}: duration ${tone.duration}`);
    if (!Number.isFinite(tone.gain) || tone.gain <= 0 || tone.gain > 0.5) found.push(`${where}: gain ${tone.gain}`);
    if (tone.wave === 'noise') {
      if (tone.to !== undefined) found.push(`${where}: noise has a pitch to glide to`);
    } else {
      if (!Number.isFinite(tone.from) || tone.from < 80 || tone.from > 4_000) found.push(`${where}: pitch ${tone.from}`);
      if (tone.to !== undefined && (!Number.isFinite(tone.to) || tone.to < 60 || tone.to > 4_000)) found.push(`${where}: glide to ${tone.to}`);
    }
  });
  if (tones.length > 0 && length(tones) > MAX_CUE_SECONDS) found.push(`lasts ${length(tones)} seconds`);
  return found;
}

const round = (value: number | undefined): number | undefined => (value === undefined ? undefined : Math.round(value * 1e4) / 1e4);
const fingerprint = (tones: readonly Tone[]): string => JSON.stringify(tones.map((tone) => [tone.wave, round(tone.at), round(tone.duration), round(tone.from), round(tone.to), round(tone.gain)]));

const wavesOf = (pack: SoundPackId): Set<string> =>
  new Set(CUES.flatMap((cue) => cueTonesFor(pack, cue, { count: 3, durationMs: 3_000 }).map((tone) => tone.wave)));

describe('note names', () => {
  it('are in equal temperament, with A4 at 440', () => {
    expect(hz('A4')).toBeCloseTo(440, 9);
    expect(hz('A5')).toBeCloseTo(880, 9);
    expect(hz('A3')).toBeCloseTo(220, 9);
    expect(hz('C4')).toBeCloseTo(261.6256, 3);
    expect(hz('C#6')).toBeCloseTo(1108.731, 2);
    expect(hz('G7')).toBeCloseTo(3135.963, 2);
  });
});

describe('the sound packs', () => {
  it('are the five the settings know, and each one has a sound for every cue', () => {
    expect(Object.keys(SOUND_PACKS).sort()).toEqual([...SOUND_PACK_IDS].sort());
    expect(SOUND_PACK_IDS).toHaveLength(5);
    for (const id of SOUND_PACK_IDS) {
      expect(Object.keys(SOUND_PACKS[id]).sort(), id).toEqual([...CUES].sort());
      for (const cue of CUES) expect(typeof SOUND_PACKS[id][cue], `${id}/${cue}`).toBe('function');
    }
  });

  describe.each(SOUND_PACK_IDS)('"%s"', (id) => {
    it.each(CUES)('plays "%s" as a short, audible, well formed cue, however it is asked', (cue) => {
      for (const options of REQUESTS) {
        expect(problems(cueTonesFor(id, cue, options)), `${id}/${cue} ${JSON.stringify(options)}`).toEqual([]);
      }
    });

    it('never makes one cue so busy that a spin, a jingle and a deal could not share the voices', () => {
      const count = (cue: Cue, options: CueOptions = {}): number => cueTonesFor(id, cue, options).length;
      for (const cue of CUES) expect(count(cue, { count: 8, durationMs: 1_000_000 }), cue).toBeLessThanOrEqual(100);
      const together = count('click') + count('spin', { durationMs: 1_000_000 }) + count('bigWin') + count('card', { count: 8 });
      expect(together).toBeLessThan(MAX_VOICES);
    });

    it('gives every cue a sound of its own', () => {
      const shapes = CUES.map((cue) => fingerprint(cueTonesFor(id, cue)));
      expect(new Set(shapes).size).toBe(CUES.length);
    });

    it('keeps the quick sounds under a quarter of a second, so a button never feels laggy', () => {
      for (const cue of ['click', 'tick', 'chip', 'flip', 'nav'] as const) expect(length(cueTonesFor(id, cue)), cue).toBeLessThan(0.25);
    });

    it('makes one sound per card, at the pace of the cards, and never an absurd number', () => {
      const one = cueTonesFor(id, 'card').length;
      const starts = (options: CueOptions) => [...new Set(cueTonesFor(id, 'card', options).map((tone) => tone.at))];
      expect(starts({ count: 4 })).toEqual([0, 1, 2, 3].map((index) => index * CARD_GAP_SECONDS));
      expect(cueTonesFor(id, 'card', { count: 4 })).toHaveLength(4 * one);
      for (const count of [0, -3, Number.NaN]) expect(cueTonesFor(id, 'card', { count })).toHaveLength(one);
      expect(starts({ count: 5_000 })).toHaveLength(8);
    });

    it('rattles for as long as the wheel turns, slowing down, and ends when it stops', () => {
      const tones = cueTonesFor(id, 'spin', { durationMs: 3_000 });
      expect(Math.max(...tones.map((tone) => tone.at))).toBeCloseTo(3, 6);
      // The pocket ticks are the short sounds before the stop.
      const times = tones.filter((tone) => tone.duration <= 0.04 && tone.at < 3).map((tone) => tone.at).sort((a, b) => a - b);
      expect(times.length).toBeGreaterThan(6);
      const gaps = times.slice(1).map((time, index) => time - (times[index] ?? 0));
      for (let index = 1; index < gaps.length; index += 1) expect(gaps[index], `gap ${index}`).toBeGreaterThanOrEqual((gaps[index - 1] ?? 0) - 1e-9);
    });

    it('fits the time it is asked for, short or long, and falls back to the usual spin for nonsense', () => {
      expect(length(cueTonesFor(id, 'spin', { durationMs: 900 }))).toBeLessThanOrEqual(0.9 + SPIN_TAIL_SECONDS + 1e-9);
      expect(length(cueTonesFor(id, 'spin', { durationMs: 1_000_000 }))).toBeLessThanOrEqual(MAX_CUE_SECONDS);
      const usual = fingerprint(cueTonesFor(id, 'spin'));
      expect(fingerprint(cueTonesFor(id, 'spin', { durationMs: Number.NaN }))).toBe(usual);
      expect(fingerprint(cueTonesFor(id, 'spin', { durationMs: 5_500 }))).toBe(usual);
    });

    it('lets a win climb, a loss fall, and a big win outdo a win', () => {
      const win = cueTonesFor(id, 'win');
      const peak = Math.max(...pitched(win).map((tone) => Math.max(tone.from, lastPitch(tone))));
      expect(peak).toBeGreaterThan(pitched(win)[0]?.from ?? Infinity);

      const lose = pitched(cueTonesFor(id, 'lose'));
      const first = [...lose].sort((a, b) => a.at - b.at)[0];
      const last = [...lose].sort((a, b) => end(a) - end(b)).at(-1);
      expect(lastPitch(last as Tone)).toBeLessThan(first?.from ?? 0);

      expect(length(cueTonesFor(id, 'bigWin'))).toBeGreaterThan(length(win));
      expect(cueTonesFor(id, 'bigWin').length).toBeGreaterThan(win.length);
    });
  });
});

describe('the packs next to each other', () => {
  const pairs = SOUND_PACK_IDS.flatMap((a, index) => SOUND_PACK_IDS.slice(index + 1).map((b) => [a, b] as const));

  it('are ten different pairs', () => {
    expect(pairs).toHaveLength(10);
  });

  it.each(pairs)('"%s" and "%s" sound different, cue by cue', (a, b) => {
    const same: string[] = [];
    for (const cue of CUES) {
      for (const options of [{}, { count: 3 }, { durationMs: 2_000 }]) {
        if (fingerprint(cueTonesFor(a, cue, options)) === fingerprint(cueTonesFor(b, cue, options))) same.push(`${cue} ${JSON.stringify(options)}`);
      }
    }
    expect(same, `identical in both packs: ${same.join(', ')}`).toEqual([]);
  });

  it.each(pairs)('"%s" and "%s" hardly share a tone: they are not one pack with a few cues changed', (a, b) => {
    const tonesOf = (id: SoundPackId): Set<string> => new Set(CUES.flatMap((cue) => cueTonesFor(id, cue).map((tone) => fingerprint([tone]))));
    const left = tonesOf(a);
    const right = tonesOf(b);
    const shared = [...right].filter((tone) => left.has(tone));
    expect(shared.length / Math.min(left.size, right.size)).toBeLessThan(0.05);
  });
});

describe('what gives each pack its character', () => {
  it('Classic Casino keeps its square waves, its noise and its low saw for a loss', () => {
    const waves = wavesOf('classic');
    expect(waves.has('square') && waves.has('noise') && waves.has('sawtooth') && waves.has('triangle')).toBe(true);
  });

  it('Retro Arcade is chiptune: only square and triangle waves, never noise', () => {
    const waves = wavesOf('arcade');
    expect([...waves].sort()).toEqual(['square', 'triangle']);
  });

  it('Pixel Adventure is a music box: triangle and sine, with a little noise for the cards, and no harsh waves', () => {
    const waves = wavesOf('adventure');
    expect(waves.has('triangle') && waves.has('sine')).toBe(true);
    expect(waves.has('square') || waves.has('sawtooth')).toBe(false);
  });

  it('Pixel Adventure plays its win in a major key: a fanfare ending on a major chord', () => {
    const chord = cueTonesFor('adventure', 'win').filter((tone) => tone.at >= 0.27).map((tone) => tone.from).sort((a, b) => a - b);
    expect(chord).toHaveLength(3);
    // G, B, D: a major third and a minor third on top, whatever the octave.
    const [low = 1, mid = 1, high = 1] = chord;
    expect(mid / low).toBeCloseTo(2 ** (4 / 12), 2);
    expect(high / mid).toBeCloseTo(2 ** (3 / 12), 1);
  });

  it('Neon Cyber is sawtooth pairs a little out of tune, in nearly every cue', () => {
    const withSaw = CUES.filter((cue) => cueTonesFor('cyber', cue).some((tone) => tone.wave === 'sawtooth'));
    expect(withSaw.length).toBeGreaterThanOrEqual(9);

    const win = cueTonesFor('cyber', 'win').filter((tone) => tone.wave === 'sawtooth');
    const beats = win.filter((tone) => win.some((other) => other.at === tone.at && other.from > tone.from && other.from / tone.from < 1.02));
    expect(beats.length).toBeGreaterThanOrEqual(5);
  });

  it('Neon Cyber slides a long way: its sweeps cover at least two octaves', () => {
    const widest = Math.max(...CUES.flatMap((cue) => cueTonesFor('cyber', cue).map((tone) => (tone.to === undefined ? 1 : Math.max(tone.from, tone.to) / Math.min(tone.from, tone.to)))));
    expect(widest).toBeGreaterThanOrEqual(4);
  });

  it('Minimal Sounds is only soft sine tones, quiet, and a click, a chip or a nav is one or two of them', () => {
    expect([...wavesOf('minimal')]).toEqual(['sine']);
    for (const cue of CUES) {
      for (const tone of cueTonesFor('minimal', cue)) expect(tone.gain, cue).toBeLessThanOrEqual(0.25);
    }
    for (const cue of ['click', 'tick', 'chip', 'flip', 'push', 'nav'] as const) expect(cueTonesFor('minimal', cue).length, cue).toBeLessThanOrEqual(2);
  });

  it('Minimal Sounds is the quietest and the briefest of the packs', () => {
    const loudest = (id: SoundPackId): number => Math.max(...CUES.flatMap((cue) => cueTonesFor(id, cue).map((tone) => tone.gain)));
    const tonesIn = (id: SoundPackId): number => CUES.reduce((sum, cue) => sum + cueTonesFor(id, cue).length, 0);
    for (const other of SOUND_PACK_IDS.filter((id) => id !== 'minimal')) {
      expect(loudest('minimal'), other).toBeLessThan(loudest(other));
      expect(tonesIn('minimal'), other).toBeLessThan(tonesIn(other));
    }
  });
});

describe('the groups of sounds', () => {
  it('give every cue exactly one category, and every category at least one cue', () => {
    expect(Object.keys(CUE_CATEGORY).sort()).toEqual([...CUES].sort());
    for (const cue of CUES) expect(SOUND_CATEGORIES).toContain(CUE_CATEGORY[cue]);
    for (const category of SOUND_CATEGORIES) expect(CUES.filter((cue) => CUE_CATEGORY[cue] === category).length, category).toBeGreaterThan(0);
  });

  it('put the cues where a player would look for them', () => {
    expect(CUES.filter((cue) => CUE_CATEGORY[cue] === 'interface').sort()).toEqual(['click', 'nav', 'tick']);
    expect(CUES.filter((cue) => CUE_CATEGORY[cue] === 'chips')).toEqual(['chip']);
    expect(CUES.filter((cue) => CUE_CATEGORY[cue] === 'cards').sort()).toEqual(['card', 'flip']);
    expect(CUES.filter((cue) => CUE_CATEGORY[cue] === 'roulette')).toEqual(['spin']);
    expect(CUES.filter((cue) => CUE_CATEGORY[cue] === 'results').sort()).toEqual(['bigWin', 'lose', 'push', 'win']);
  });

  it('say nothing for something that is not a cue', () => {
    expect(categoryOf('click')).toBe('interface');
    expect(categoryOf('explosion' as Cue)).toBeUndefined();
    expect(categoryOf('toString' as Cue)).toBeUndefined();
  });
});
