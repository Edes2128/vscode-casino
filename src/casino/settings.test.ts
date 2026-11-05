import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  isSettings,
  parseSettingsPatch,
  sanitizeSettings,
  SETTINGS_KEY,
  SettingsStore,
  type Settings,
} from './settings';
import { MemoryStorage } from './testing';

function setup(storage = new MemoryStorage()) {
  const errors: string[] = [];
  const store = new SettingsStore(storage, { onError: (message) => errors.push(message) });
  return { storage, store, errors };
}

describe('the defaults', () => {
  it('are valid, with sound on at half volume and animations on', () => {
    expect(isSettings(DEFAULT_SETTINGS)).toBe(true);
    expect(DEFAULT_SETTINGS).toEqual({
      sound: true,
      volume: 50,
      animations: true,
      reducedMotion: false,
      textSize: 'normal',
      theme: 'classic',
      cardDesign: 'classic',
      rouletteAnimation: 'classic',
      soundPack: 'classic',
      soundCategories: { interface: true, chips: true, cards: true, roulette: true, results: true },
      colors: {},
    });
  });
});

describe('isSettings', () => {
  it('accepts a complete valid set and rejects anything else', () => {
    expect(isSettings({ ...DEFAULT_SETTINGS, sound: false, volume: 0, reducedMotion: true, textSize: 'large' })).toBe(true);
    expect(isSettings({ ...DEFAULT_SETTINGS, sound: false, volume: 100, animations: false, textSize: 'xlarge' })).toBe(true);

    expect(isSettings(undefined)).toBe(false);
    expect(isSettings(null)).toBe(false);
    expect(isSettings([])).toBe(false);
    expect(isSettings({ ...DEFAULT_SETTINGS, volume: 101 })).toBe(false);
    expect(isSettings({ ...DEFAULT_SETTINGS, volume: -1 })).toBe(false);
    expect(isSettings({ ...DEFAULT_SETTINGS, volume: 40.5 })).toBe(false);
    expect(isSettings({ ...DEFAULT_SETTINGS, volume: Number.NaN })).toBe(false);
    expect(isSettings({ ...DEFAULT_SETTINGS, volume: '40' })).toBe(false);
    expect(isSettings({ ...DEFAULT_SETTINGS, sound: 'yes' })).toBe(false);
    expect(isSettings({ sound: true, volume: 40, animations: true })).toBe(false);
  });
});

describe('parseSettingsPatch', () => {
  it('accepts one or several valid settings', () => {
    expect(parseSettingsPatch({ sound: false })).toEqual({ sound: false });
    expect(parseSettingsPatch({ volume: 75 })).toEqual({ volume: 75 });
    expect(parseSettingsPatch({ volume: 0 })).toEqual({ volume: 0 });
    expect(parseSettingsPatch({ volume: 100, animations: false, reducedMotion: true, sound: true })).toEqual({
      volume: 100,
      animations: false,
      reducedMotion: true,
      sound: true,
    });
  });

  it('rejects the whole message when anything in it is wrong', () => {
    for (const bad of [
      undefined,
      null,
      'sound',
      7,
      [],
      {},
      { sound: 'on' },
      { sound: 1 },
      { volume: 101 },
      { volume: -5 },
      { volume: 12.5 },
      { volume: '50' },
      { volume: null },
      { volume: Number.POSITIVE_INFINITY },
      { animations: undefined },
      { reducedMotion: 0 },
      { sound: true, volume: 500 },
      { sound: true, extra: true },
      { balance: 1_000_000 },
      { __proto__: { sound: true } },
    ]) {
      expect(parseSettingsPatch(bad), JSON.stringify(bad)).toBeUndefined();
    }
  });
});

describe('sanitizeSettings', () => {
  it('keeps every valid field and defaults every invalid or missing one', () => {
    expect(sanitizeSettings({ ...DEFAULT_SETTINGS, sound: false, volume: 80, animations: false, reducedMotion: true, textSize: 'large' })).toEqual({
      ...DEFAULT_SETTINGS,
      sound: false,
      volume: 80,
      animations: false,
      reducedMotion: true,
      textSize: 'large',
    });
    expect(sanitizeSettings({ sound: false, volume: 9_999, animations: 'maybe' })).toEqual({
      ...DEFAULT_SETTINGS,
      sound: false,
    });
    expect(sanitizeSettings({ version: 1, volume: 10 })).toEqual({ ...DEFAULT_SETTINGS, volume: 10 });
  });

  it('falls back to the defaults for anything that is not an object', () => {
    for (const raw of [undefined, null, 'loud', 42, [], true]) expect(sanitizeSettings(raw)).toEqual(DEFAULT_SETTINGS);
  });
});

describe('the text size', () => {
  it('is one of three sizes, and normal unless chosen', () => {
    expect(DEFAULT_SETTINGS.textSize).toBe('normal');
    for (const textSize of ['normal', 'large', 'xlarge']) expect(isSettings({ ...DEFAULT_SETTINGS, textSize })).toBe(true);
    for (const textSize of ['huge', 'LARGE', '', 1.2, null, undefined]) expect(isSettings({ ...DEFAULT_SETTINGS, textSize })).toBe(false);
  });

  it('can be changed with a patch, and a patch with a bad size is refused whole', () => {
    expect(parseSettingsPatch({ textSize: 'large' })).toEqual({ textSize: 'large' });
    expect(parseSettingsPatch({ textSize: 'xlarge', volume: 10 })).toEqual({ textSize: 'xlarge', volume: 10 });
    for (const bad of [{ textSize: 'huge' }, { textSize: 2 }, { textSize: null }, { textSize: 'large', volume: 500 }]) {
      expect(parseSettingsPatch(bad), JSON.stringify(bad)).toBeUndefined();
    }
  });

  it('keeps a valid saved size and falls back to normal for an invalid or missing one', () => {
    expect(sanitizeSettings({ textSize: 'xlarge' }).textSize).toBe('xlarge');
    expect(sanitizeSettings({ textSize: 'gigantic' }).textSize).toBe('normal');
    expect(sanitizeSettings({ volume: 10 }).textSize).toBe('normal'); // saved before the setting existed
  });

  it('is saved and restored like the other settings', async () => {
    const first = setup();
    first.store.update({ textSize: 'large' });
    await first.store.flush();
    expect(setup(first.storage).store.settings.textSize).toBe('large');
  });
});

describe('SettingsStore', () => {
  it('starts with the defaults and writes nothing until something changes', async () => {
    const { store, storage } = setup();
    await store.flush();
    expect(store.settings).toEqual(DEFAULT_SETTINGS);
    expect(storage.writes).toEqual([]);
  });

  it('applies a change, tells the listeners and saves it under its own key', async () => {
    const { store, storage } = setup();
    const seen: Settings[] = [];
    store.onDidChange((settings) => seen.push(settings));

    const next = store.update({ volume: 90, sound: false });
    await store.flush();

    expect(next).toEqual({ ...DEFAULT_SETTINGS, volume: 90, sound: false });
    expect(store.settings).toBe(next);
    expect(seen).toEqual([next]);
    expect(storage.writes).toEqual([{ key: SETTINGS_KEY, value: { version: 2, ...next } }]);
  });

  it('leaves everything else alone', () => {
    const { store } = setup();
    store.update({ animations: false });
    expect(store.settings).toEqual({ ...DEFAULT_SETTINGS, animations: false });
  });

  it('does nothing at all for a change that changes nothing', async () => {
    const { store, storage } = setup();
    const seen: Settings[] = [];
    store.onDidChange((settings) => seen.push(settings));

    expect(store.update({ volume: DEFAULT_SETTINGS.volume, sound: true })).toBe(store.settings);
    await store.flush();

    expect(seen).toEqual([]);
    expect(storage.writes).toEqual([]);
  });

  it('refuses a change that would make the settings invalid, even if the caller skipped validation', async () => {
    const { store, storage } = setup();
    const before = store.settings;

    store.update({ volume: 500 });
    store.update({ sound: 'yes' } as unknown as Partial<Settings>);
    await store.flush();

    expect(store.settings).toBe(before);
    expect(storage.writes).toEqual([]);
  });

  it('folds a burst of changes into one save of the final settings', async () => {
    const { store, storage } = setup();
    for (let volume = 1; volume <= 20; volume += 1) store.update({ volume });
    await store.flush();

    expect(storage.writes).toHaveLength(1);
    expect(storage.writes[0]?.value).toMatchObject({ volume: 20 });
  });

  it('restores saved settings after a restart', async () => {
    const first = setup();
    first.store.update({ sound: false, volume: 15, reducedMotion: true });
    await first.store.flush();

    const second = setup(first.storage);
    expect(second.store.settings).toEqual({ ...DEFAULT_SETTINGS, sound: false, volume: 15, reducedMotion: true });
  });

  it('starts from the defaults when the saved data is damaged, keeping the parts that are fine', () => {
    const storage = new MemoryStorage();
    storage.seed(SETTINGS_KEY, { version: 1, sound: false, volume: 'LOUD', animations: null });
    const { store } = setup(storage);
    expect(store.settings).toEqual({ ...DEFAULT_SETTINGS, sound: false });

    const garbage = new MemoryStorage();
    garbage.seed(SETTINGS_KEY, 'not settings');
    expect(setup(garbage).store.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('stops calling a listener once it has unsubscribed, and survives one that throws', () => {
    const { store, errors } = setup();
    const calls: string[] = [];
    store.onDidChange(() => {
      throw new Error('boom');
    });
    const stop = store.onDidChange(() => calls.push('second'));

    store.update({ volume: 1 });
    expect(calls).toEqual(['second']);
    expect(errors).toEqual(['A settings listener failed']);

    stop();
    store.update({ volume: 2 });
    expect(calls).toEqual(['second']);
  });

  it('reports a failed save, keeps running and saves the latest settings next time', async () => {
    const { store, storage, errors } = setup();
    storage.failWrites = true;
    store.update({ volume: 10 });
    await store.flush();
    expect(errors).toEqual(['Saving the settings failed']);
    expect(store.settings.volume).toBe(10);

    storage.failWrites = false;
    store.update({ volume: 20 });
    await store.flush();
    expect(storage.writes.at(-1)?.value).toMatchObject({ volume: 20 });
  });

  it('is independent of the casino state key', () => {
    expect(SETTINGS_KEY).not.toBe('casino.state');
  });
});
