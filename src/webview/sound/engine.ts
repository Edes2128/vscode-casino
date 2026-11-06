import { ALL_SOUND_CATEGORIES_ON, type SoundCategories, type SoundPackId } from '../../state/appearance';
import { categoryOf, masterGain, type Cue, type CueOptions, type Tone } from './cues';
import { cueTonesFor } from './packs';

// The few parts of the Web Audio API Lucky Break uses. The real AudioContext fits them, and a test can
// stand in with a fake that records what was scheduled.

export interface AudioParamLike {
  setValueAtTime(value: number, time: number): unknown;
  linearRampToValueAtTime(value: number, time: number): unknown;
  exponentialRampToValueAtTime(value: number, time: number): unknown;
}

export interface AudioNodeLike {
  connect(destination: unknown): unknown;
  disconnect(): void;
}

export interface SourceLike extends AudioNodeLike {
  start(time: number): void;
  stop(time: number): void;
  onended: ((event: Event) => unknown) | null;
}

export interface OscillatorLike extends SourceLike {
  type: string;
  readonly frequency: AudioParamLike;
}

export interface BufferSourceLike extends SourceLike {
  buffer: unknown;
}

export interface GainLike extends AudioNodeLike {
  readonly gain: AudioParamLike;
}

export interface AudioContextLike {
  readonly currentTime: number;
  readonly sampleRate: number;
  readonly state: string;
  readonly destination: unknown;
  createOscillator(): OscillatorLike;
  createGain(): GainLike;
  createBufferSource(): BufferSourceLike;
  createBuffer(channels: number, length: number, sampleRate: number): { getChannelData(channel: number): Float32Array };
  resume(): PromiseLike<void>;
  close(): PromiseLike<void>;
}

export interface PlayOptions extends CueOptions {
  /** Play at this volume (0 to 100) instead of the saved one. The slider uses it while it is dragged. */
  readonly volume?: number;
  /** Start this many milliseconds from now, such as a jingle that waits for the cards to land. */
  readonly delayMs?: number;
  /** Play even though sound is switched off. Only for the answer to switching it on. */
  readonly force?: boolean;
  /** Play this pack's version of the cue instead of the saved pack, such as the one just picked, which is not saved yet. */
  readonly pack?: SoundPackId;
  /**
   * Play even though the cue's category is switched off. Only for the answer to switching that category on,
   * which is not saved yet. Sound being off still silences it: that is `force`.
   */
  readonly ignoreCategory?: boolean;
}

/** No cue is ever put off for longer than this. */
const MAX_DELAY_SECONDS = 5;

/**
 * Tones waiting to sound or sounding, across every cue. Tones are scheduled ahead of time on the audio
 * clock, so a whole wheel rattle (about fifty ticks) is queued at once and must fit with room to spare.
 * Past this many, new tones are dropped, so a stuck loop can never become a roar.
 */
export const MAX_VOICES = 200;

/** A moment between "now" and the first sound, so scheduling never lands in the past. */
const LEAD_SECONDS = 0.005;
const ATTACK_SECONDS = 0.003;
const SILENCE = 0.0001;
const NOISE_SECONDS = 0.12;

/**
 * Plays the sound effects. It makes no sound, and does not even create an audio context, until the
 * first cue is played, which only ever follows something the player did, so nothing plays on opening.
 */
export class SoundEngine {
  readonly #createContext: () => AudioContextLike;

  #enabled = false;
  #volume = 0;
  #pack: SoundPackId = 'classic';
  #categories: SoundCategories = ALL_SOUND_CATEGORIES_ON;
  #context: AudioContextLike | undefined;
  #noise: unknown;
  #voices = 0;
  #broken = false;

  /** How many cues have actually been scheduled. For diagnostics and tests. */
  played = 0;

  constructor(createContext: () => AudioContextLike) {
    this.#createContext = createContext;
  }

  /**
   * Applies the player's settings: sound on or off, the volume, which sound pack plays and which groups of
   * sounds are on. Takes effect from the next cue. Does not make a sound, or an audio context, by itself.
   */
  configure(
    enabled: boolean,
    volume: number,
    pack: SoundPackId = 'classic',
    categories: SoundCategories = ALL_SOUND_CATEGORIES_ON,
  ): void {
    this.#enabled = enabled;
    this.#volume = volume;
    this.#pack = pack;
    this.#categories = categories;
  }

  /** Plays `cue` if sound is on and audible. Returns whether anything was scheduled. Never throws. */
  play(cue: Cue, options: PlayOptions = {}): boolean {
    const level = masterGain(options.volume ?? this.#volume);
    if ((!this.#enabled && options.force !== true) || level === 0 || this.#broken) return false;
    // A group of sounds that is switched off is silent. Anything that is not a cue belongs to no group, and is silent too.
    const category = categoryOf(cue);
    if (category === undefined || (!this.#categories[category] && options.ignoreCategory !== true)) return false;

    try {
      const context = this.#ensureContext();
      if (context.state === 'suspended') void Promise.resolve(context.resume()).catch(() => undefined);

      const bus = context.createGain();
      bus.gain.setValueAtTime(level, context.currentTime);
      bus.connect(context.destination);

      const delay = options.delayMs !== undefined && Number.isFinite(options.delayMs) ? options.delayMs / 1000 : 0;
      const start = context.currentTime + LEAD_SECONDS + Math.min(Math.max(delay, 0), MAX_DELAY_SECONDS);
      let scheduled = 0;
      for (const tone of cueTonesFor(options.pack ?? this.#pack, cue, options)) {
        if (this.#voices >= MAX_VOICES) break;
        this.#schedule(context, bus, tone, start);
        scheduled += 1;
      }
      if (scheduled === 0) return false;

      this.played += 1;
      return true;
    } catch {
      // No audio device, or the browser refuses: Lucky Break is silent, and carries on.
      this.#broken = true;
      return false;
    }
  }

  /** Releases the audio context. The engine can still be used afterwards: it makes a new one. */
  dispose(): void {
    const context = this.#context;
    this.#context = undefined;
    this.#noise = undefined;
    this.#voices = 0;
    if (context !== undefined) void Promise.resolve(context.close()).catch(() => undefined);
  }

  #ensureContext(): AudioContextLike {
    this.#context ??= this.#createContext();
    return this.#context;
  }

  #schedule(context: AudioContextLike, bus: GainLike, tone: Tone, start: number): void {
    const from = start + tone.at;
    const to = from + tone.duration;

    const envelope = context.createGain();
    envelope.gain.setValueAtTime(SILENCE, from);
    envelope.gain.linearRampToValueAtTime(tone.gain, from + Math.min(ATTACK_SECONDS, tone.duration / 2));
    envelope.gain.exponentialRampToValueAtTime(SILENCE, to);
    envelope.connect(bus);

    let source: SourceLike;
    if (tone.wave === 'noise') {
      const noise = context.createBufferSource();
      noise.buffer = this.#noiseBuffer(context);
      source = noise;
    } else {
      const oscillator = context.createOscillator();
      oscillator.type = tone.wave;
      oscillator.frequency.setValueAtTime(tone.from, from);
      if (tone.to !== undefined) oscillator.frequency.exponentialRampToValueAtTime(tone.to, to);
      source = oscillator;
    }

    source.connect(envelope);
    this.#voices += 1;
    source.onended = () => {
      this.#voices = Math.max(0, this.#voices - 1);
      source.disconnect();
      envelope.disconnect();
    };
    source.start(from);
    source.stop(to + 0.02);
  }

  /** A short burst of random samples, made once and shared: the "swish" of a card and the clack of a chip. */
  #noiseBuffer(context: AudioContextLike): unknown {
    if (this.#noise === undefined) {
      const length = Math.ceil(context.sampleRate * NOISE_SECONDS);
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let index = 0; index < length; index += 1) samples[index] = Math.random() * 2 - 1;
      this.#noise = buffer;
    }
    return this.#noise;
  }
}
