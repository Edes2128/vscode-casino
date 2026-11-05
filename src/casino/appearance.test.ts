import { describe, expect, it } from 'vitest';
import {
  ALL_SOUND_CATEGORIES_ON,
  CARD_DESIGN_IDS,
  COLOR_SLOTS,
  isCustomColors,
  isHexColor,
  isSoundCategories,
  ROULETTE_ANIMATION_IDS,
  sanitizeCustomColors,
  sanitizeSoundCategories,
  SOUND_CATEGORIES,
  SOUND_PACK_IDS,
  THEME_IDS,
} from './appearance';
import { DEFAULT_SETTINGS, isSettings, parseSettingsPatch, sanitizeSettings, SETTINGS_KEY, SettingsStore } from './settings';
import { MemoryStorage } from './testing';

describe('what can be chosen', () => {
  it('offers the eight themes, six card designs, five wheel animations and five sound packs of the brief', () => {
    expect(THEME_IDS).toHaveLength(8);
    expect(CARD_DESIGN_IDS).toHaveLength(6);
    expect(ROULETTE_ANIMATION_IDS).toHaveLength(5);
    expect(SOUND_PACK_IDS).toHaveLength(5);
    expect(COLOR_SLOTS).toEqual(['table', 'background', 'accent', 'button', 'text', 'chip']);
  });

  it('has no duplicate ids, and the defaults are the first of each', () => {
    for (const ids of [THEME_IDS, CARD_DESIGN_IDS, ROULETTE_ANIMATION_IDS, SOUND_PACK_IDS, SOUND_CATEGORIES]) {
      expect(new Set(ids).size).toBe(ids.length);
    }
    expect(DEFAULT_SETTINGS.theme).toBe(THEME_IDS[0]);
    expect(DEFAULT_SETTINGS.cardDesign).toBe(CARD_DESIGN_IDS[0]);
    expect(DEFAULT_SETTINGS.rouletteAnimation).toBe(ROULETTE_ANIMATION_IDS[0]);
    expect(DEFAULT_SETTINGS.soundPack).toBe(SOUND_PACK_IDS[0]);
  });
});

describe('colors', () => {
  it('are #rrggbb in lower case, nothing else', () => {
    for (const good of ['#000000', '#ffffff', '#1a2b3c']) expect(isHexColor(good)).toBe(true);
    for (const bad of ['#FFF', '#ffffff00', 'ffffff', '#12345g', '#ABCDEF', 'red', '', 7, null, undefined]) {
      expect(isHexColor(bad), String(bad)).toBe(false);
    }
  });

  it('are a set of known slots only', () => {
    expect(isCustomColors({})).toBe(true);
    expect(isCustomColors({ table: '#174d36', chip: '#f5c451' })).toBe(true);
    for (const bad of [{ glow: '#ffffff' }, { table: 'green' }, { table: 5 }, [], null, 'x', { table: '#FFFFFF' }]) {
      expect(isCustomColors(bad), JSON.stringify(bad)).toBe(false);
    }
  });

  it('are read leniently: valid slots kept, upper case folded, the rest dropped', () => {
    expect(sanitizeCustomColors({ table: '#174D36', accent: 'nope', glow: '#ffffff', text: '#ffffff' })).toEqual({
      table: '#174d36',
      text: '#ffffff',
    });
    expect(sanitizeCustomColors('x')).toEqual({});
    expect(sanitizeCustomColors(null)).toEqual({});
  });
});

describe('sound categories', () => {
  it('need all five, each on or off', () => {
    expect(isSoundCategories(ALL_SOUND_CATEGORIES_ON)).toBe(true);
    expect(isSoundCategories({ ...ALL_SOUND_CATEGORIES_ON, cards: false })).toBe(true);
    const { cards: _cards, ...missing } = ALL_SOUND_CATEGORIES_ON;
    for (const bad of [missing, { ...ALL_SOUND_CATEGORIES_ON, extra: true }, { ...ALL_SOUND_CATEGORIES_ON, cards: 'no' }, null, []]) {
      expect(isSoundCategories(bad), JSON.stringify(bad)).toBe(false);
    }
  });

  it('are read leniently: anything unreadable stays on', () => {
    expect(sanitizeSoundCategories({ cards: false, chips: 'off', roulette: 0 })).toEqual({
      interface: true,
      chips: true,
      cards: false,
      roulette: true,
      results: true,
    });
    expect(sanitizeSoundCategories(undefined)).toEqual(ALL_SOUND_CATEGORIES_ON);
  });
});

describe('the appearance settings', () => {
  it('round-trip every theme, card design, animation and sound pack', () => {
    for (const theme of THEME_IDS) expect(parseSettingsPatch({ theme })).toEqual({ theme });
    for (const cardDesign of CARD_DESIGN_IDS) expect(parseSettingsPatch({ cardDesign })).toEqual({ cardDesign });
    for (const rouletteAnimation of ROULETTE_ANIMATION_IDS) expect(parseSettingsPatch({ rouletteAnimation })).toEqual({ rouletteAnimation });
    for (const soundPack of SOUND_PACK_IDS) expect(parseSettingsPatch({ soundPack })).toEqual({ soundPack });
  });

  it('refuse an unknown id, so a change is applied completely or not at all', () => {
    for (const bad of [
      { theme: 'gold' },
      { theme: 'CLASSIC' },
      { theme: 3 },
      { cardDesign: 'fancy' },
      { rouletteAnimation: 'fast' },
      { soundPack: 'loud' },
      { theme: 'neon', soundPack: 'loud' },
      { soundCategories: { cards: false } },
      { soundCategories: { ...ALL_SOUND_CATEGORIES_ON, cards: 1 } },
      { colors: { table: 'green' } },
      { colors: { glow: '#ffffff' } },
      { colors: [] },
    ]) {
      expect(parseSettingsPatch(bad), JSON.stringify(bad)).toBeUndefined();
    }
  });

  it('accept a whole set of categories and a whole set of colors, and an empty set of colors', () => {
    const categories = { ...ALL_SOUND_CATEGORIES_ON, roulette: false };
    expect(parseSettingsPatch({ soundCategories: categories })).toEqual({ soundCategories: categories });
    expect(parseSettingsPatch({ colors: { accent: '#ff00aa' } })).toEqual({ colors: { accent: '#ff00aa' } });
    expect(parseSettingsPatch({ colors: {} })).toEqual({ colors: {} });
  });

  it('make a settings object invalid when any of them is invalid', () => {
    expect(isSettings({ ...DEFAULT_SETTINGS, theme: 'neon', cardDesign: 'medieval' })).toBe(true);
    expect(isSettings({ ...DEFAULT_SETTINGS, theme: 'tiger' })).toBe(false);
    expect(isSettings({ ...DEFAULT_SETTINGS, soundPack: undefined })).toBe(false);
    expect(isSettings({ ...DEFAULT_SETTINGS, colors: { text: 'white' } })).toBe(false);
    expect(isSettings({ ...DEFAULT_SETTINGS, soundCategories: undefined })).toBe(false);
  });

  it('are read from settings saved by the first version, which had none of them', () => {
    // Version 1 saved only these five.
    const saved = { version: 1, sound: false, volume: 30, animations: false, reducedMotion: true, textSize: 'large' };
    expect(sanitizeSettings(saved)).toEqual({ ...DEFAULT_SETTINGS, sound: false, volume: 30, animations: false, reducedMotion: true, textSize: 'large' });
  });

  it('are read one by one: an outdated or damaged choice falls back, the others stay', () => {
    expect(
      sanitizeSettings({
        theme: 'royal',
        cardDesign: 'a-design-from-the-future',
        rouletteAnimation: 'slow',
        soundPack: 42,
        soundCategories: { cards: false, results: 'no' },
        colors: { table: '#102030', accent: 'blue' },
      }),
    ).toEqual({
      ...DEFAULT_SETTINGS,
      theme: 'royal',
      rouletteAnimation: 'slow',
      soundCategories: { ...ALL_SOUND_CATEGORIES_ON, cards: false },
      colors: { table: '#102030' },
    });
  });
});

describe('saving the appearance', () => {
  const setup = (storage = new MemoryStorage()) => ({ storage, store: new SettingsStore(storage) });

  it('keeps every choice across a restart', async () => {
    const first = setup();
    first.store.update({
      theme: 'cyber',
      cardDesign: 'neon',
      rouletteAnimation: 'explosion',
      soundPack: 'adventure',
      soundCategories: { ...ALL_SOUND_CATEGORIES_ON, chips: false },
      colors: { table: '#003344', chip: '#ffcc00' },
    });
    await first.store.flush();

    expect(first.storage.writes.at(-1)).toMatchObject({ key: SETTINGS_KEY, value: { version: 2, theme: 'cyber' } });
    expect(setup(first.storage).store.settings).toEqual(first.store.settings);
  });

  it('writes nothing when a choice would change nothing, even a deep one', async () => {
    const { store, storage } = setup();
    store.update({ colors: { table: '#003344' }, soundCategories: { ...ALL_SOUND_CATEGORIES_ON, cards: false } });
    await store.flush();
    const writes = storage.writes.length;

    let heard = 0;
    store.onDidChange(() => (heard += 1));
    store.update({ colors: { table: '#003344' }, soundCategories: { ...ALL_SOUND_CATEGORIES_ON, cards: false } });
    store.update({ theme: 'classic' });
    await store.flush();

    expect(heard).toBe(0);
    expect(storage.writes).toHaveLength(writes);
  });

  it('applies a change to the sound categories alone, and a change to the colors alone', async () => {
    const { store, storage } = setup();
    let heard = 0;
    store.onDidChange(() => (heard += 1));

    store.update({ soundCategories: { ...ALL_SOUND_CATEGORIES_ON, cards: false } });
    expect(store.settings.soundCategories.cards).toBe(false);
    store.update({ colors: { chip: '#ffcc00' } });
    expect(store.settings.colors).toEqual({ chip: '#ffcc00' });
    await store.flush();

    expect(heard).toBe(2);
    expect(storage.writes.at(-1)?.value).toMatchObject({ soundCategories: { cards: false }, colors: { chip: '#ffcc00' } });
  });

  it('hands every color back to the theme when the set is emptied', () => {
    const { store } = setup();
    store.update({ colors: { table: '#003344', text: '#eeeeee' } });
    expect(store.settings.colors).toEqual({ table: '#003344', text: '#eeeeee' });
    store.update({ colors: {} });
    expect(store.settings.colors).toEqual({});
  });
});
