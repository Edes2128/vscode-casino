import { describe, expect, it } from 'vitest';
import { CARD_GAP_SECONDS, CUES, cueTones, masterGain, MAX_CUE_SECONDS, type Cue, type Tone } from './cues';

const end = (tone: Tone): number => tone.at + tone.duration;
const length = (tones: readonly Tone[]): number => Math.max(...tones.map(end));

describe('every cue', () => {
  it.each(CUES)('"%s" is short, audible and well formed', (cue) => {
    const tones = cueTones(cue);
    expect(tones.length).toBeGreaterThan(0);
    for (const tone of tones) {
      expect(tone.at).toBeGreaterThanOrEqual(0);
      expect(tone.duration).toBeGreaterThan(0);
      expect(tone.gain).toBeGreaterThan(0);
      expect(tone.gain).toBeLessThanOrEqual(0.5);
      if (tone.wave !== 'noise') {
        expect(tone.from).toBeGreaterThanOrEqual(80);
        expect(tone.from).toBeLessThanOrEqual(4_000);
        if (tone.to !== undefined) {
          expect(tone.to).toBeGreaterThanOrEqual(60);
          expect(tone.to).toBeLessThanOrEqual(4_000);
        }
      }
    }
    expect(length(tones)).toBeLessThanOrEqual(MAX_CUE_SECONDS);
  });

  it('is different from every other cue', () => {
    const shapes = CUES.map((cue) => JSON.stringify(cueTones(cue)));
    expect(new Set(shapes).size).toBe(CUES.length);
  });
});

describe('the quick sounds', () => {
  it('stay under a quarter of a second, so a button never feels laggy', () => {
    for (const cue of ['click', 'tick', 'chip', 'flip'] as const) expect(length(cueTones(cue))).toBeLessThan(0.25);
  });
});

describe('cards', () => {
  it('make one swish per card, spaced evenly', () => {
    const tones = cueTones('card', { count: 4 });
    expect(tones).toHaveLength(4);
    expect(tones.map((tone) => tone.at)).toEqual([0, 1, 2, 3].map((index) => index * CARD_GAP_SECONDS));
    expect(tones.every((tone) => tone.wave === 'noise')).toBe(true);
  });

  it('make one swish by default, and never an absurd number', () => {
    expect(cueTones('card')).toHaveLength(1);
    expect(cueTones('card', { count: 0 })).toHaveLength(1);
    expect(cueTones('card', { count: -3 })).toHaveLength(1);
    expect(cueTones('card', { count: 2.9 })).toHaveLength(2);
    expect(cueTones('card', { count: 5_000 }).length).toBeLessThanOrEqual(8);
    expect(cueTones('card', { count: Number.NaN })).toHaveLength(1);
  });
});

describe('the wheel rattle', () => {
  const ticks = (tones: readonly Tone[]) => tones.filter((tone) => tone.wave === 'square');

  it('ends when the wheel stops, with a thud', () => {
    const tones = cueTones('spin', { durationMs: 5_500 });
    const thud = tones.at(-1);
    expect(thud?.wave).toBe('triangle');
    expect(thud?.at).toBeCloseTo(5.5, 5);
  });

  it('slows down: each gap between ticks is longer than the one before', () => {
    const times = ticks(cueTones('spin', { durationMs: 5_500 })).map((tone) => tone.at);
    expect(times.length).toBeGreaterThan(20);
    const gaps = times.slice(1).map((time, index) => time - (times[index] ?? 0));
    for (let index = 1; index < gaps.length; index += 1) {
      expect(gaps[index]).toBeGreaterThanOrEqual((gaps[index - 1] ?? 0) - 1e-9);
    }
  });

  it('fits the time it is asked for, short or long', () => {
    expect(length(cueTones('spin', { durationMs: 900 }))).toBeLessThanOrEqual(0.9 + 0.2);
    expect(length(cueTones('spin', { durationMs: 1_000_000 }))).toBeLessThanOrEqual(MAX_CUE_SECONDS);
    expect(cueTones('spin', { durationMs: 0 }).length).toBeGreaterThan(1);
    expect(cueTones('spin', { durationMs: Number.NaN }).length).toBeGreaterThan(1);
  });
});

describe('the result jingles', () => {
  const pitches = (cue: Cue) => cueTones(cue).map((tone) => tone.from);

  it('a win climbs and a loss falls', () => {
    const win = pitches('win');
    expect([...win].sort((a, b) => a - b)).toEqual(win);
    const lose = cueTones('lose');
    expect((lose.at(-1)?.to ?? 0) < (lose[0]?.from ?? 0)).toBe(true);
  });

  it('a natural blackjack or a hit on the green is a bigger celebration than a win', () => {
    expect(length(cueTones('bigWin'))).toBeGreaterThan(length(cueTones('win')));
    expect(cueTones('bigWin').length).toBeGreaterThan(cueTones('win').length);
  });
});

describe('masterGain', () => {
  it('is silent at 0 and full at 100', () => {
    expect(masterGain(0)).toBe(0);
    expect(masterGain(100)).toBe(1);
  });

  it('only ever gets louder as the volume goes up', () => {
    let previous = -1;
    for (let volume = 0; volume <= 100; volume += 5) {
      const gain = masterGain(volume);
      expect(gain).toBeGreaterThan(previous);
      previous = gain;
    }
  });

  it('stays between 0 and 1 for any input, including nonsense', () => {
    for (const volume of [-50, 250, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const gain = masterGain(volume);
      expect(gain).toBeGreaterThanOrEqual(0);
      expect(gain).toBeLessThanOrEqual(1);
    }
  });
});
