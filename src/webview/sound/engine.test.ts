import { describe, expect, it } from 'vitest';
import { cueTones, masterGain } from './cues';
import { MAX_VOICES, SoundEngine, type AudioContextLike } from './engine';

interface Recorded {
  oscillators: Array<{ type: string; start: number; stop: number; from: number | undefined }>;
  noises: number;
  /** Every value set on a gain node, in order. The first one of each cue is its volume. */
  gainValues: number[];
  created: number;
  resumed: number;
  closed: number;
  ended: Array<() => void>;
}

/** A stand-in for the browser's audio: it records what is scheduled and never makes a sound. */
function fakeAudio(options: { state?: string; throwOnCreate?: boolean; time?: () => number } = {}) {
  const log: Recorded = { oscillators: [], noises: 0, gainValues: [], created: 0, resumed: 0, closed: 0, ended: [] };
  const param = (record?: (value: number) => void) => ({
    setValueAtTime: (value: number) => record?.(value),
    linearRampToValueAtTime: () => undefined,
    exponentialRampToValueAtTime: () => undefined,
  });

  const node = () => ({ connect: () => undefined, disconnect: () => undefined });

  const context: AudioContextLike = {
    get currentTime() {
      return options.time?.() ?? 10;
    },
    sampleRate: 8_000,
    state: options.state ?? 'running',
    destination: {},
    createGain: () => ({ ...node(), gain: param((value) => log.gainValues.push(value)) }),
    createOscillator: () => {
      const record = { type: '', start: 0, stop: 0, from: undefined as number | undefined };
      log.oscillators.push(record);
      const oscillator = {
        ...node(),
        type: '',
        frequency: {
          ...param(),
          setValueAtTime: (value: number) => {
            record.from = value;
          },
        },
        onended: null as (() => void) | null,
        start: (time: number) => {
          record.start = time;
          record.type = oscillator.type;
        },
        stop: (time: number) => {
          record.stop = time;
          log.ended.push(() => oscillator.onended?.());
        },
      };
      return oscillator;
    },
    createBufferSource: () => {
      log.noises += 1;
      const source = {
        ...node(),
        buffer: null as unknown,
        onended: null as (() => void) | null,
        start: () => undefined,
        stop: () => log.ended.push(() => source.onended?.()),
      };
      return source;
    },
    createBuffer: (_channels: number, length: number) => ({ getChannelData: () => new Float32Array(length) }),
    resume: () => {
      log.resumed += 1;
      return Promise.resolve();
    },
    close: () => {
      log.closed += 1;
      return Promise.resolve();
    },
  };

  const create = (): AudioContextLike => {
    log.created += 1;
    if (options.throwOnCreate) throw new Error('no audio device');
    return context;
  };
  return { create, log, context };
}

describe('SoundEngine', () => {
  it('does not create an audio context until the first cue is played', () => {
    const audio = fakeAudio();
    const engine = new SoundEngine(audio.create);
    engine.configure(true, 50);
    expect(audio.log.created).toBe(0);

    expect(engine.play('click')).toBe(true);
    expect(audio.log.created).toBe(1);
    engine.play('chip');
    expect(audio.log.created).toBe(1);
  });

  it('is silent until it has been configured on, and creates nothing', () => {
    const audio = fakeAudio();
    const engine = new SoundEngine(audio.create);
    expect(engine.play('win')).toBe(false);
    expect(audio.log.created).toBe(0);
    expect(engine.played).toBe(0);
  });

  it('plays nothing, and creates nothing, while sound is off', () => {
    const audio = fakeAudio();
    const engine = new SoundEngine(audio.create);
    engine.configure(false, 100);
    for (const cue of ['click', 'card', 'spin', 'bigWin'] as const) expect(engine.play(cue)).toBe(false);
    expect(audio.log.created).toBe(0);
    expect(audio.log.oscillators).toHaveLength(0);
  });

  it('plays nothing at volume 0', () => {
    const audio = fakeAudio();
    const engine = new SoundEngine(audio.create);
    engine.configure(true, 0);
    expect(engine.play('win')).toBe(false);
    expect(audio.log.created).toBe(0);
  });

  it('schedules every tone of a cue, a moment from now, in order', () => {
    const audio = fakeAudio();
    const engine = new SoundEngine(audio.create);
    engine.configure(true, 50);
    engine.play('win');

    const tones = cueTones('win');
    expect(audio.log.oscillators).toHaveLength(tones.length);
    audio.log.oscillators.forEach((oscillator, index) => {
      expect(oscillator.type).toBe('square');
      expect(oscillator.from).toBe(tones[index]?.from);
      expect(oscillator.start).toBeCloseTo(10 + 0.005 + (tones[index]?.at ?? 0), 6);
      expect(oscillator.stop).toBeGreaterThan(oscillator.start);
    });
  });

  it('uses the shared noise for the swish of a card, one per card', () => {
    const audio = fakeAudio();
    const engine = new SoundEngine(audio.create);
    engine.configure(true, 50);
    engine.play('card', { count: 3 });
    expect(audio.log.noises).toBe(3);
    expect(audio.log.oscillators).toHaveLength(0);
  });

  it('plays at the saved volume, and at another when asked to', () => {
    const audio = fakeAudio();
    const engine = new SoundEngine(audio.create);
    engine.configure(true, 40);
    engine.play('click');
    engine.play('click', { volume: 100 });
    engine.configure(true, 80);
    engine.play('click');

    // A click is one tone: per cue, the volume is set first and the tone's own envelope second.
    const volumes = audio.log.gainValues.filter((_, index) => index % 2 === 0);
    expect(volumes).toHaveLength(3);
    expect(volumes[0]).toBeCloseTo(masterGain(40), 9);
    expect(volumes[1]).toBeCloseTo(masterGain(100), 9);
    expect(volumes[2]).toBeCloseTo(masterGain(80), 9);
  });

  it('wakes a suspended audio context, as browsers start them until the player has acted', () => {
    const audio = fakeAudio({ state: 'suspended' });
    const engine = new SoundEngine(audio.create);
    engine.configure(true, 50);
    engine.play('click');
    expect(audio.log.resumed).toBe(1);
  });

  it('counts the cues it played, and a cue made only of dropped tones does not count', () => {
    const audio = fakeAudio();
    const engine = new SoundEngine(audio.create);
    engine.configure(true, 50);
    engine.play('click');
    engine.play('chip');
    expect(engine.played).toBe(2);
  });

  it('schedules every tone of the longest cue, the wheel rattle with its final thud', () => {
    const audio = fakeAudio();
    const engine = new SoundEngine(audio.create);
    engine.configure(true, 50);
    engine.play('spin'); // the full 5.5 seconds
    engine.play('spin', { durationMs: 1_000_000 }); // the longest a cue can be

    const planned = cueTones('spin').length + cueTones('spin', { durationMs: 1_000_000 }).length;
    expect(audio.log.oscillators).toHaveLength(planned);
    expect(planned).toBeLessThan(MAX_VOICES);
  });

  it('keeps a whole spin, the click that started it and the jingle after it within the limit', () => {
    const audio = fakeAudio();
    const engine = new SoundEngine(audio.create);
    engine.configure(true, 50);
    engine.play('click');
    engine.play('spin');
    engine.play('bigWin');
    expect(audio.log.oscillators).toHaveLength(
      cueTones('click').length + cueTones('spin').length + cueTones('bigWin').length,
    );
  });

  it('never has more than a fixed number of sounds going at once', () => {
    const audio = fakeAudio();
    const engine = new SoundEngine(audio.create);
    engine.configure(true, 50);
    for (let index = 0; index < 100; index += 1) engine.play('bigWin');
    expect(audio.log.oscillators.length).toBeLessThanOrEqual(MAX_VOICES);

    // Once sounds have ended there is room again.
    for (const finish of audio.log.ended.splice(0)) finish();
    const before = audio.log.oscillators.length;
    expect(engine.play('win')).toBe(true);
    expect(audio.log.oscillators.length).toBeGreaterThan(before);
  });

  it('goes quiet for good, without throwing, when the browser has no audio', () => {
    const audio = fakeAudio({ throwOnCreate: true });
    const engine = new SoundEngine(audio.create);
    engine.configure(true, 50);
    expect(() => engine.play('click')).not.toThrow();
    expect(engine.play('win')).toBe(false);
    expect(audio.log.created).toBe(1); // it does not keep trying
    expect(engine.played).toBe(0);
  });

  it('closes the audio context when disposed, and makes a new one if used again', () => {
    const audio = fakeAudio();
    const engine = new SoundEngine(audio.create);
    engine.configure(true, 50);
    engine.play('click');
    engine.dispose();
    expect(audio.log.closed).toBe(1);

    engine.play('click');
    expect(audio.log.created).toBe(2);
  });

  it('disposing before anything was played does nothing', () => {
    const audio = fakeAudio();
    const engine = new SoundEngine(audio.create);
    engine.dispose();
    expect(audio.log.closed).toBe(0);
  });

  it('starts a cue later when asked to, but never absurdly late, and never in the past', () => {
    const audio = fakeAudio();
    const engine = new SoundEngine(audio.create);
    engine.configure(true, 50);
    engine.play('click', { delayMs: 500 });
    engine.play('click', { delayMs: -500 });
    engine.play('click', { delayMs: 1_000_000 });
    engine.play('click', { delayMs: Number.NaN });

    const starts = audio.log.oscillators.map((oscillator) => oscillator.start);
    expect(starts[0]).toBeCloseTo(10 + 0.005 + 0.5, 6);
    expect(starts[1]).toBeCloseTo(10 + 0.005, 6);
    expect(starts[2]).toBeCloseTo(10 + 0.005 + 5, 6);
    expect(starts[3]).toBeCloseTo(10 + 0.005, 6);
  });

  it('plays even while sound is off when forced, which only the answer to switching it on does', () => {
    const audio = fakeAudio();
    const engine = new SoundEngine(audio.create);
    engine.configure(false, 50);
    expect(engine.play('click')).toBe(false);
    expect(engine.play('click', { force: true })).toBe(true);
    expect(engine.play('click', { force: false })).toBe(false);
    // Forcing never makes the casino louder than the volume allows: volume 0 stays silent.
    engine.configure(false, 0);
    expect(engine.play('click', { force: true })).toBe(false);
  });

  it('stops being heard as soon as it is configured off again', () => {
    const audio = fakeAudio();
    const engine = new SoundEngine(audio.create);
    engine.configure(true, 50);
    expect(engine.play('click')).toBe(true);
    engine.configure(false, 50);
    expect(engine.play('click')).toBe(false);
  });
});
