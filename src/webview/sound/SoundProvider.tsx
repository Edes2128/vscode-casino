import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import type { Settings } from '../../casino/settings';
import { CUES, type Cue } from './cues';
import { SoundEngine, type AudioContextLike, type PlayOptions } from './engine';

export type Play = (cue: Cue, options?: PlayOptions) => void;

const SoundContext = createContext<Play>(() => undefined);

/** Plays a sound effect. Does nothing while sound is off, so callers never need to check. */
export const useSound = (): Play => useContext(SoundContext);

/** `data-sound` on a button picks its cue; `none` leaves it silent. Any other button gets a click. */
export const SOUND_ATTRIBUTE = 'sound';

export function cueForButton(button: Element): Cue | undefined {
  const named = (button as HTMLElement).dataset?.[SOUND_ATTRIBUTE];
  if (named === 'none') return undefined;
  return CUES.find((cue) => cue === named) ?? 'click';
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

interface SoundProviderProps {
  /** `undefined` until the host sends the saved settings: nothing is played before that. */
  readonly settings: Settings | undefined;
  readonly children: ReactNode;
}

/** Owns the sound engine for this webview and keeps it in step with the player's settings. */
export function SoundProvider({ settings, children }: SoundProviderProps) {
  const engine = useMemo(() => new SoundEngine(createBrowserAudio), []);

  useEffect(() => {
    engine.configure(settings?.sound === true, settings?.volume ?? 0);
  }, [engine, settings?.sound, settings?.volume]);

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
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest('button');
      if (button === null || button.disabled) return;
      const cue = cueForButton(button);
      if (cue !== undefined) play(cue);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [play]);

  return null;
}
