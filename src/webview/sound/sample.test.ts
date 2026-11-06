import { describe, expect, it, vi } from 'vitest';
import { SOUND_CATEGORIES } from '../../state/appearance';
import { CUE_CATEGORY, MAX_CUE_SECONDS } from './cues';
import { cueTonesFor } from './packs';
import { CATEGORY_SAMPLES, SAMPLE_STEPS, SAMPLE_TOTAL_MS, startSample, type SampleTimers } from './sample';

/** Timers that only record what was asked of them, and run it when told to. */
function fakeTimers() {
  let next = 1;
  const pending = new Map<number, { ms: number; callback: () => void }>();
  const timers: SampleTimers = {
    set: (callback, ms) => {
      const id = next++;
      pending.set(id, { ms, callback });
      return id;
    },
    clear: (id) => void pending.delete(id),
  };
  /** Runs everything due at or before `ms`, earliest first. */
  const advanceTo = (ms: number): void => {
    for (const [id, entry] of [...pending].filter(([, item]) => item.ms <= ms).sort((a, b) => a[1].ms - b[1].ms)) {
      pending.delete(id);
      entry.callback();
    }
  };
  return { timers, pending, advanceTo };
}

describe('the sample', () => {
  it('is a click, a chip, two cards, a flip, a win, a loss and a short spin, in that order', () => {
    expect(SAMPLE_STEPS.map((step) => step.cue)).toEqual(['click', 'chip', 'card', 'flip', 'win', 'lose', 'spin']);
    expect(SAMPLE_STEPS.map((step) => step.label)).toEqual(['CLICK', 'CHIP', 'DEAL', 'FLIP', 'WIN', 'LOSS', 'SPIN']);
    expect(SAMPLE_STEPS[2]?.options).toEqual({ count: 2 });
    expect(SAMPLE_STEPS.at(-1)?.options?.durationMs).toBeLessThanOrEqual(2_000);
  });

  it('starts at once, and each step comes later than the one before', () => {
    expect(SAMPLE_STEPS[0]?.atMs).toBe(0);
    for (let index = 1; index < SAMPLE_STEPS.length; index += 1) {
      expect(SAMPLE_STEPS[index]?.atMs ?? 0).toBeGreaterThan(SAMPLE_STEPS[index - 1]?.atMs ?? 0);
    }
  });

  it('leaves each sound room to finish before the next begins', () => {
    SAMPLE_STEPS.slice(0, -1).forEach((step, index) => {
      const gap = ((SAMPLE_STEPS[index + 1]?.atMs ?? 0) - step.atMs) / 1000;
      for (const pack of ['classic', 'arcade', 'adventure', 'cyber', 'minimal'] as const) {
        const tones = cueTonesFor(pack, step.cue, step.options);
        const length = Math.max(...tones.map((tone) => tone.at + tone.duration));
        // A win may ring a little into the next sound; nothing may run over it for long.
        expect(length, `${pack}/${step.label}`).toBeLessThanOrEqual(gap + 0.5);
      }
    });
  });

  it('is over a moment after the wheel stops, and well inside the longest a cue may be put off', () => {
    const spin = SAMPLE_STEPS.at(-1);
    expect(SAMPLE_TOTAL_MS).toBeGreaterThan((spin?.atMs ?? 0) + (spin?.options?.durationMs ?? 0));
    expect(SAMPLE_TOTAL_MS).toBeLessThan(MAX_CUE_SECONDS * 1000);
  });

  it('touches every group of sounds, so the sample is a fair picture of the pack', () => {
    expect(new Set(SAMPLE_STEPS.map((step) => CUE_CATEGORY[step.cue]))).toEqual(new Set(SOUND_CATEGORIES));
  });
});

describe('the answer to switching a group on', () => {
  it('is a cue of that very group, for each group', () => {
    expect(Object.keys(CATEGORY_SAMPLES).sort()).toEqual([...SOUND_CATEGORIES].sort());
    for (const category of SOUND_CATEGORIES) expect(CUE_CATEGORY[CATEGORY_SAMPLES[category].cue], category).toBe(category);
  });

  it('is short: the wheel only turns for a moment', () => {
    expect(CATEGORY_SAMPLES.roulette.options?.durationMs).toBeLessThanOrEqual(1_000);
  });
});

describe('startSample', () => {
  it('plays the first step before it returns, and the others when their time comes, in the pack it was given', () => {
    const play = vi.fn();
    const onStep = vi.fn();
    const clock = fakeTimers();
    startSample(play, 'arcade', onStep, clock.timers);

    expect(play).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenLastCalledWith('click', { pack: 'arcade' });
    expect(onStep.mock.calls).toEqual([[0]]);
    expect(clock.pending.size).toBe(SAMPLE_STEPS.length);

    clock.advanceTo(SAMPLE_TOTAL_MS);
    expect(play.mock.calls.map((call) => call[0])).toEqual(SAMPLE_STEPS.map((step) => step.cue));
    for (const call of play.mock.calls) expect(call[1]).toMatchObject({ pack: 'arcade' });
    expect(play.mock.calls[2]?.[1]).toEqual({ count: 2, pack: 'arcade' });
    expect(play.mock.calls[6]?.[1]).toEqual({ durationMs: 1_200, pack: 'arcade' });
    expect(onStep.mock.calls.map((call) => call[0])).toEqual([...SAMPLE_STEPS.keys(), undefined]);
    expect(clock.pending.size).toBe(0);
  });

  it('waits for each step\'s time and not before', () => {
    const play = vi.fn();
    const clock = fakeTimers();
    startSample(play, 'classic', vi.fn(), clock.timers);
    clock.advanceTo(749);
    expect(play).toHaveBeenCalledTimes(2);
    clock.advanceTo(750);
    expect(play).toHaveBeenCalledTimes(3);
  });

  it('stops what has not played yet when cancelled, and says nothing more', () => {
    const play = vi.fn();
    const onStep = vi.fn();
    const clock = fakeTimers();
    const cancel = startSample(play, 'minimal', onStep, clock.timers);
    clock.advanceTo(800);
    expect(play).toHaveBeenCalledTimes(3);

    cancel();
    clock.advanceTo(60_000);
    expect(play).toHaveBeenCalledTimes(3);
    expect(onStep).toHaveBeenCalledTimes(3);
    expect(clock.pending.size).toBe(0);
  });

  it('can be started again, and the first run can be cancelled without touching the second', () => {
    const play = vi.fn();
    const clock = fakeTimers();
    const first = startSample(play, 'classic', vi.fn(), clock.timers);
    first();
    startSample(play, 'cyber', vi.fn(), clock.timers);
    clock.advanceTo(SAMPLE_TOTAL_MS);
    expect(play.mock.calls.map((call) => (call[1] as { pack: string }).pack)).toEqual([
      'classic',
      ...SAMPLE_STEPS.map(() => 'cyber'),
    ]);
  });
});
