/**
 * What the player can choose about how the casino looks and sounds: the ids and how to check them.
 *
 * Only ids live here, so the extension host can save and validate a choice without knowing anything
 * about drawing. What each id looks like is in `src/webview/customization`. Every option is free: no
 * id is ever locked, and nothing in the game rules reads any of this.
 */

export const THEME_IDS = ['classic', 'neon', 'retro', 'midnight', 'blood', 'cyber', 'forest', 'royal'] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export const CARD_DESIGN_IDS = ['classic', 'retro', 'neon', 'medieval', 'minimal', 'dark'] as const;
export type CardDesignId = (typeof CARD_DESIGN_IDS)[number];

export const ROULETTE_ANIMATION_IDS = ['classic', 'arcade', 'neon', 'explosion', 'slow'] as const;
export type RouletteAnimationId = (typeof ROULETTE_ANIMATION_IDS)[number];

export const SOUND_PACK_IDS = ['classic', 'arcade', 'adventure', 'cyber', 'minimal'] as const;
export type SoundPackId = (typeof SOUND_PACK_IDS)[number];

/** Groups of sound effects the player can switch on or off one by one. */
export const SOUND_CATEGORIES = ['interface', 'chips', 'cards', 'roulette', 'results'] as const;
export type SoundCategory = (typeof SOUND_CATEGORIES)[number];

/** Which sound categories are on. Every category is always present. */
export type SoundCategories = Readonly<Record<SoundCategory, boolean>>;

export const ALL_SOUND_CATEGORIES_ON: SoundCategories = {
  interface: true,
  chips: true,
  cards: true,
  roulette: true,
  results: true,
};

/** The colors the player may change. A slot that is missing follows the chosen theme. */
export const COLOR_SLOTS = ['table', 'background', 'accent', 'button', 'text', 'chip'] as const;
export type ColorSlot = (typeof COLOR_SLOTS)[number];

export type CustomColors = Readonly<Partial<Record<ColorSlot, string>>>;

const oneOf =
  <T extends string>(ids: readonly T[]) =>
  (value: unknown): value is T =>
    typeof value === 'string' && (ids as readonly string[]).includes(value);

export const isThemeId = oneOf(THEME_IDS);
export const isCardDesignId = oneOf(CARD_DESIGN_IDS);
export const isRouletteAnimationId = oneOf(ROULETTE_ANIMATION_IDS);
export const isSoundPackId = oneOf(SOUND_PACK_IDS);
export const isSoundCategory = oneOf(SOUND_CATEGORIES);
export const isColorSlot = oneOf(COLOR_SLOTS);

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A color written `#rrggbb`, in lower case: the only form that is ever saved. */
export const isHexColor = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/.test(value);

/** Whether `value` names every sound category exactly once, each on or off. */
export function isSoundCategories(value: unknown): value is SoundCategories {
  return (
    isPlainRecord(value) &&
    Object.keys(value).length === SOUND_CATEGORIES.length &&
    SOUND_CATEGORIES.every((category) => typeof value[category] === 'boolean')
  );
}

/** Whether `value` is a set of colors: only known slots, each a `#rrggbb`. Empty means "follow the theme". */
export function isCustomColors(value: unknown): value is CustomColors {
  return isPlainRecord(value) && Object.entries(value).every(([slot, color]) => isColorSlot(slot) && isHexColor(color));
}

/** Reads saved categories leniently: a missing or invalid one stays on. */
export function sanitizeSoundCategories(raw: unknown): SoundCategories {
  if (!isPlainRecord(raw)) return ALL_SOUND_CATEGORIES_ON;
  const pick = (category: SoundCategory): boolean => (typeof raw[category] === 'boolean' ? raw[category] : true);
  return {
    interface: pick('interface'),
    chips: pick('chips'),
    cards: pick('cards'),
    roulette: pick('roulette'),
    results: pick('results'),
  };
}

/** Reads saved colors leniently: every slot that is a valid color is kept (`#RRGGBB` is folded to lower case), the rest are dropped. */
export function sanitizeCustomColors(raw: unknown): CustomColors {
  if (!isPlainRecord(raw)) return {};
  const colors: { -readonly [K in ColorSlot]?: string } = {};
  for (const slot of COLOR_SLOTS) {
    const value = raw[slot];
    if (typeof value !== 'string') continue;
    const lower = value.toLowerCase();
    if (isHexColor(lower)) colors[slot] = lower;
  }
  return colors;
}

export const sameSoundCategories = (a: SoundCategories, b: SoundCategories): boolean =>
  SOUND_CATEGORIES.every((category) => a[category] === b[category]);

export const sameCustomColors = (a: CustomColors, b: CustomColors): boolean =>
  COLOR_SLOTS.every((slot) => a[slot] === b[slot]);
