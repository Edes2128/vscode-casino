import { createContext, useContext, useSyncExternalStore } from 'react';
import type { Settings } from '../state/settings';

/**
 * How much Lucky Break moves.
 *
 * - `full`: everything. Cards fly, the wheel spins, the screen shakes on a loss, sparks float by.
 * - `calm`: nothing moves and nothing flashes or floats, but a result still arrives step by step: the
 *   dealer's cards turn up one at a time, and the wheel stays still for a moment before it shows
 *   where the ball landed.
 * - `off`: no animation and no pauses at all. Every result is shown at once.
 */
export type MotionLevel = 'full' | 'calm' | 'off';

/** `animations` is the master switch. Reduced motion (the setting, or the system's own) makes it calm. */
export function motionLevel(settings: Pick<Settings, 'animations' | 'reducedMotion'>, systemReduced: boolean): MotionLevel {
  if (!settings.animations) return 'off';
  return settings.reducedMotion || systemReduced ? 'calm' : 'full';
}

const QUERY = '(prefers-reduced-motion: reduce)';

const subscribe = (onChange: () => void): (() => void) => {
  if (typeof matchMedia !== 'function') return () => undefined;
  const query = matchMedia(QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
};

const systemReducesMotion = (): boolean => typeof matchMedia === 'function' && matchMedia(QUERY).matches;

/** Whether the operating system asks for reduced motion. Follows the system as it changes. */
export function useSystemReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, systemReducesMotion, () => false);
}

export const MotionContext = createContext<MotionLevel>('full');

/** The level the player has chosen. Screens use it to decide what to animate. */
export const useMotion = (): MotionLevel => useContext(MotionContext);
