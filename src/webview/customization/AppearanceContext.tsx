import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import type { CardDesignId, RouletteAnimationId, SoundPackId } from '../../state/appearance';
import { DEFAULT_SETTINGS, type Settings } from '../../state/settings';
import { appearanceAttributes, resolveAppearance, type ResolvedAppearance } from './appearance';

/**
 * What the player chose about how things look, as the screens need it. The colors are already worked out
 * (theme, then the player's own colors, then the readability pass), so a component reads a color and never
 * has to know where it came from.
 */
export interface AppearanceValue {
  readonly resolved: ResolvedAppearance;
  readonly cardDesign: CardDesignId;
  readonly rouletteAnimation: RouletteAnimationId;
  readonly soundPack: SoundPackId;
}

type AppearanceSettings = Pick<Settings, 'theme' | 'colors' | 'cardDesign' | 'rouletteAnimation' | 'soundPack'>;

export const appearanceOf = (settings: AppearanceSettings): AppearanceValue => ({
  resolved: resolveAppearance(settings.theme, settings.colors),
  cardDesign: settings.cardDesign,
  rouletteAnimation: settings.rouletteAnimation,
  soundPack: settings.soundPack,
});

export const DEFAULT_APPEARANCE: AppearanceValue = appearanceOf(DEFAULT_SETTINGS);

const AppearanceContext = createContext<AppearanceValue>(DEFAULT_APPEARANCE);

/** The appearance the player chose. Without a provider (a test, the style guide) it is the classic one. */
export const useAppearance = (): AppearanceValue => useContext(AppearanceContext);

/** Memoised on the choices themselves, so settings that do not change the look never rebuild it. */
export function useAppearanceValue(settings: AppearanceSettings): AppearanceValue {
  const { theme, colors, cardDesign, rouletteAnimation, soundPack } = settings;
  return useMemo(
    () => appearanceOf({ theme, colors, cardDesign, rouletteAnimation, soundPack }),
    [theme, colors, cardDesign, rouletteAnimation, soundPack],
  );
}

export function AppearanceProvider({ value, children }: { readonly value: AppearanceValue; readonly children: ReactNode }) {
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

/** The part of the page root that appearance touches: what a test can stand in for. */
export interface AppearanceRoot {
  readonly style: { setProperty(name: string, value: string): void; removeProperty(name: string): unknown };
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}

const ROOT_ATTRIBUTES = ['data-theme', 'data-pattern', 'data-glow', 'data-cards', 'data-wheel'] as const;

/** Writes the colors and the look's names where the stylesheets read them. */
export function applyAppearanceTo(root: AppearanceRoot, value: AppearanceValue): void {
  const { resolved } = value;
  for (const [name, color] of Object.entries(resolved.vars)) root.style.setProperty(name, color);
  for (const [name, attribute] of Object.entries(appearanceAttributes(resolved))) root.setAttribute(name, attribute);
  root.setAttribute('data-cards', value.cardDesign);
  root.setAttribute('data-wheel', value.rouletteAnimation);
}

/** Hands the page back to its stylesheet: the colors and names this module set are taken away. */
export function clearAppearanceFrom(root: AppearanceRoot): void {
  for (const name of Object.keys(DEFAULT_APPEARANCE.resolved.vars)) root.style.removeProperty(name);
  for (const name of ROOT_ATTRIBUTES) root.removeAttribute(name);
}

/**
 * Puts the player's look on the page root. Changing a choice changes the next paint: nothing is reloaded.
 */
export function useApplyAppearance(value: AppearanceValue): void {
  useEffect(() => {
    applyAppearanceTo(document.documentElement, value);
  }, [value]);

  // Leaving (a test, a hot reload) hands the page back to its stylesheet.
  useEffect(() => () => clearAppearanceFrom(document.documentElement), []);
}
