import {
  ALL_SOUND_CATEGORIES_ON,
  isCardDesignId,
  isCustomColors,
  isRouletteAnimationId,
  isSoundCategories,
  isSoundPackId,
  isThemeId,
  sameCustomColors,
  sameSoundCategories,
  sanitizeCustomColors,
  sanitizeSoundCategories,
  type CardDesignId,
  type CustomColors,
  type RouletteAnimationId,
  type SoundCategories,
  type SoundPackId,
  type ThemeId,
} from './appearance';
import { isRecord } from './snapshot';
import type { KeyValueStorage } from './persistence';
import { WriteQueue } from './writeQueue';

export const TEXT_SIZES = ['normal', 'large', 'xlarge'] as const;

/** How big the interface's text is: the normal size, 20% bigger, or 40% bigger. */
export type TextSize = (typeof TEXT_SIZES)[number];

export const isTextSize = (value: unknown): value is TextSize => (TEXT_SIZES as readonly unknown[]).includes(value);

/** The player's preferences. They are kept apart from the chips, so no reset can touch them. */
export interface Settings {
  /** Sound effects on or off. */
  readonly sound: boolean;
  /** Loudness of every effect, a whole number from 0 to 100. */
  readonly volume: number;
  /** Game animations: dealing, the dealer's reveal, the wheel spin. Off shows every result at once. */
  readonly animations: boolean;
  /** Calm screen: no floating, flickering, shaking or flashing, and nothing on a card or the wheel moves. */
  readonly reducedMotion: boolean;
  /** The size of all text. */
  readonly textSize: TextSize;
  /** Break Room Arcade's look: palette, frames, buttons. */
  readonly theme: ThemeId;
  /** How the playing cards are drawn. */
  readonly cardDesign: CardDesignId;
  /** How the roulette wheel spins. It always stops on the number the host chose. */
  readonly rouletteAnimation: RouletteAnimationId;
  /** Which set of sound effects plays. */
  readonly soundPack: SoundPackId;
  /** Which groups of sound effects are on. */
  readonly soundCategories: SoundCategories;
  /** Colors the player picked. A color that is not here follows the theme. */
  readonly colors: CustomColors;
}

export const MIN_VOLUME = 0;
export const MAX_VOLUME = 100;

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  volume: 50,
  animations: true,
  reducedMotion: false,
  textSize: 'normal',
  theme: 'classic',
  cardDesign: 'classic',
  rouletteAnimation: 'classic',
  soundPack: 'classic',
  soundCategories: ALL_SOUND_CATEGORIES_ON,
  colors: {},
};

/** One or more settings to change. Anything not listed stays as it is. */
export type SettingsPatch = Partial<Settings>;

const SETTING_KEYS = [
  'sound',
  'volume',
  'animations',
  'reducedMotion',
  'textSize',
  'theme',
  'cardDesign',
  'rouletteAnimation',
  'soundPack',
  'soundCategories',
  'colors',
] as const;

export const isVolume = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= MIN_VOLUME && value <= MAX_VOLUME;

/** Whether `value` is a complete, valid set of settings. */
export function isSettings(value: unknown): value is Settings {
  return (
    isRecord(value) &&
    typeof value['sound'] === 'boolean' &&
    isVolume(value['volume']) &&
    typeof value['animations'] === 'boolean' &&
    typeof value['reducedMotion'] === 'boolean' &&
    isTextSize(value['textSize']) &&
    isThemeId(value['theme']) &&
    isCardDesignId(value['cardDesign']) &&
    isRouletteAnimationId(value['rouletteAnimation']) &&
    isSoundPackId(value['soundPack']) &&
    isSoundCategories(value['soundCategories']) &&
    isCustomColors(value['colors'])
  );
}

/**
 * Validates a change sent by the webview. Strict: one unknown name or one invalid value rejects the
 * whole message, so a change is applied completely or not at all.
 */
export function parseSettingsPatch(raw: unknown): SettingsPatch | undefined {
  if (!isRecord(raw)) return undefined;

  const keys = Object.keys(raw);
  if (keys.length === 0 || keys.some((key) => !(SETTING_KEYS as readonly string[]).includes(key))) return undefined;

  const patch: { -readonly [K in keyof Settings]?: Settings[K] } = {};
  for (const key of keys) {
    const value = raw[key];
    if (key === 'volume') {
      if (!isVolume(value)) return undefined;
      patch.volume = value;
    } else if (key === 'textSize') {
      if (!isTextSize(value)) return undefined;
      patch.textSize = value;
    } else if (key === 'theme') {
      if (!isThemeId(value)) return undefined;
      patch.theme = value;
    } else if (key === 'cardDesign') {
      if (!isCardDesignId(value)) return undefined;
      patch.cardDesign = value;
    } else if (key === 'rouletteAnimation') {
      if (!isRouletteAnimationId(value)) return undefined;
      patch.rouletteAnimation = value;
    } else if (key === 'soundPack') {
      if (!isSoundPackId(value)) return undefined;
      patch.soundPack = value;
    } else if (key === 'soundCategories') {
      // All categories at once: a half-described set is a mistake, not a request.
      if (!isSoundCategories(value)) return undefined;
      patch.soundCategories = value;
    } else if (key === 'colors') {
      // The whole set of picked colors; an empty one hands every color back to the theme.
      if (!isCustomColors(value)) return undefined;
      patch.colors = value;
    } else {
      if (typeof value !== 'boolean') return undefined;
      patch[key as 'sound' | 'animations' | 'reducedMotion'] = value;
    }
  }
  return patch;
}

/**
 * Reads saved settings leniently: every valid field is kept and every missing or invalid one falls
 * back to its default, so one bad value never throws away the others.
 */
export function sanitizeSettings(raw: unknown): Settings {
  if (!isRecord(raw)) return DEFAULT_SETTINGS;
  const pick = <K extends keyof Settings>(key: K, valid: (value: unknown) => boolean): Settings[K] =>
    valid(raw[key]) ? (raw[key] as Settings[K]) : DEFAULT_SETTINGS[key];
  const isBoolean = (value: unknown): boolean => typeof value === 'boolean';

  return {
    sound: pick('sound', isBoolean),
    volume: pick('volume', isVolume),
    animations: pick('animations', isBoolean),
    reducedMotion: pick('reducedMotion', isBoolean),
    textSize: pick('textSize', isTextSize),
    theme: pick('theme', isThemeId),
    cardDesign: pick('cardDesign', isCardDesignId),
    rouletteAnimation: pick('rouletteAnimation', isRouletteAnimationId),
    soundPack: pick('soundPack', isSoundPackId),
    soundCategories: sanitizeSoundCategories(raw['soundCategories']),
    colors: sanitizeCustomColors(raw['colors']),
  };
}

// ---------------------------------------------------------------- the store

/** Saved under its own key, apart from Break Room Arcade state. */
export const SETTINGS_KEY = 'breakRoom.settings';

/** Bump when the saved shape changes, and teach `sanitizeSettings` to read the old version. */
export const SETTINGS_VERSION = 2;

const sameSettings = (a: Settings, b: Settings): boolean =>
  SETTING_KEYS.every((key) => {
    if (key === 'soundCategories') return sameSoundCategories(a.soundCategories, b.soundCategories);
    if (key === 'colors') return sameCustomColors(a.colors, b.colors);
    return a[key] === b[key];
  });

export interface SettingsStoreOptions {
  /** Called when saving fails or a change listener throws. Break Room Arcade keeps running either way. */
  readonly onError?: (message: string, error: unknown) => void;
}

/** The player's settings. Lives in the extension host, so every open view shows the same ones. */
export class SettingsStore {
  readonly #storage: KeyValueStorage;
  readonly #onError: (message: string, error: unknown) => void;
  readonly #queue: WriteQueue;
  readonly #listeners = new Set<(settings: Settings) => void>();

  #settings: Settings;

  constructor(storage: KeyValueStorage, options: SettingsStoreOptions = {}) {
    this.#storage = storage;
    this.#onError = options.onError ?? (() => undefined);
    this.#queue = new WriteQueue(
      () => this.#storage.update(SETTINGS_KEY, { version: SETTINGS_VERSION, ...this.#settings }),
      (error) => this.#onError('Saving the settings failed', error),
    );
    this.#settings = sanitizeSettings(storage.get(SETTINGS_KEY));
  }

  get settings(): Settings {
    return this.#settings;
  }

  /** Applies a change. Does nothing, writes nothing and tells nobody when it would change nothing. */
  update(patch: SettingsPatch): Settings {
    const next: Settings = { ...this.#settings, ...patch };
    // The patch is validated by the caller, but this is the last line before the disk.
    if (!isSettings(next) || sameSettings(next, this.#settings)) return this.#settings;

    this.#settings = next;
    this.#queue.schedule();
    for (const listener of [...this.#listeners]) {
      try {
        listener(next);
      } catch (error) {
        this.#onError('A settings listener failed', error);
      }
    }
    return next;
  }

  /** Calls `listener` after every change. Returns a function that stops listening. */
  onDidChange(listener: (settings: Settings) => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  /** Resolves once everything changed so far has been written. Call before shutting down. */
  flush(): Promise<void> {
    return this.#queue.flush();
  }
}
