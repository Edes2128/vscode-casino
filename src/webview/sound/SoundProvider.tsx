import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import type { Settings } from '../../state/settings';
import { CUES, type Cue } from './cues';
import { SoundEngine, type AudioContextLike, type PlayOptions } from './engine';

export type Play = (cue: Cue, options?: PlayOptions) => void;

const SoundContext = createContext<Play>(() => undefined);

/** Plays a sound effect. Does nothing while sound is off, so callers never need to check. */
export const useSound = (): Play => useContext(SoundContext);

/**
 * `data-sound` on a button picks its cue; `none` leaves it silent. On a wrapper it does the same for every
 * button inside, unless the button names its own. Any other button gets a click.
 */
export const SOUND_ATTRIBUTE = 'sound';

export function cueForButton(button: Element): Cue | undefined {
  const named = (button as HTMLElement).dataset?.[SOUND_ATTRIBUTE] ?? nearestWrapperName(button);
  if (named === 'none') return undefined;
  return CUES.find((cue) => cue === named) ?? 'click';
}

/** The `data-sound` of the closest wrapper of `button`, if there is one. */
function nearestWrapperName(button: Element): string | undefined {
  if (typeof button.closest !== 'function') return undefined;
  return (button.closest(`[data-${SOUND_ATTRIBUTE}]`) as HTMLElement | null)?.dataset[SOUND_ATTRIBUTE];
}

/** The cue a click on `target` makes: none unless it landed on an enabled button. */
export function cueForClick(target: unknown): Cue | undefined {
  if (typeof target !== 'object' || target === null || typeof (target as Element).closest !== 'function') return undefined;
  const button = (target as Element).closest('button');
  if (button === null || button.disabled) return undefined;
  return cueForButton(button);
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

function createBrowserAudio(): AudioContextLike {
  const Context = window.AudioContext ?? window.webkitAudioContext;
  if (Context === undefined) throw new Error('This webview has no Web Audio');
  return new Context();
}

/**
 * Hands the player's settings to the engine. Until the host has sent them there are none, and the engine
 * stays silent. Neither this nor the settings themselves play anything: a sound only ever follows a cue.
 */
export function configureEngine(engine: SoundEngine, settings: Settings | undefined): void {
  if (settings === undefined) engine.configure(false, 0);
  else engine.configure(settings.sound, settings.volume, settings.soundPack, settings.soundCategories);
}

interface SoundProviderProps {
  /** `undefined` until the host sends the saved settings: nothing is played before that. */
  readonly settings: Settings | undefined;
  readonly children: ReactNode;
}

/** Owns the sound engine for this webview and keeps it in step with the player's settings. */
export function SoundProvider({ settings, children }: SoundProviderProps) {
  const engine = useMemo(() => new SoundEngine(createBrowserAudio), []);

  // The pack, the groups and the volume take effect from the next cue: no restart, and nothing is played here.
  useEffect(() => configureEngine(engine, settings), [engine, settings]);

  useEffect(() => () => engine.dispose(), [engine]);

  const play = useMemo<Play>(() => (cue, options) => void engine.play(cue, options), [engine]);
  return <SoundContext.Provider value={play}>{children}</SoundContext.Provider>;
}

/**
 * A click on any enabled button makes its sound: one listener on the page instead of one on every
 * button. A click is always something the player just did, so this is also what lets the browser
 * start the audio on the very first button pressed, never before.
 */
export function ButtonSounds() {
  const play = useSound();

  useEffect(() => {
    const onClick = (event: MouseEvent): void => {
      const cue = cueForClick(event.target);
      if (cue !== undefined) play(cue);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [play]);

  return null;
}
