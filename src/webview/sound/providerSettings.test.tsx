/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, type Settings } from '../../casino/settings';
import { CUES } from './cues';
import { SoundEngine, type AudioContextLike } from './engine';
import { ButtonSounds, SoundProvider, configureEngine, cueForButton, cueForClick, useSound, type Play } from './SoundProvider';

/** A button as the page sees it, as much of it as the sound code reads. */
interface FakeButton {
  readonly dataset: Record<string, string>;
  readonly disabled: boolean;
  closest(selector: string): unknown;
}

const wrapper = (sound: string | undefined) => ({ dataset: sound === undefined ? {} : { sound } });

function button(options: { sound?: string; disabled?: boolean; wrapperSound?: string } = {}): FakeButton {
  const own: FakeButton = {
    dataset: options.sound === undefined ? {} : { sound: options.sound },
    disabled: options.disabled === true,
    closest: (selector) => {
      if (selector !== '[data-sound]') return null;
      if (options.sound !== undefined) return own;
      return options.wrapperSound === undefined ? null : wrapper(options.wrapperSound);
    },
  };
  return own;
}

const asElement = (value: unknown): Element => value as Element;

/** An audio context that only counts how often the page makes one. */
function countingAudio() {
  const made = { contexts: 0 };
  const create = (): AudioContextLike => {
    made.contexts += 1;
    throw new Error('this test never wants real audio');
  };
  return { made, create };
}

describe('the cue of a button', () => {
  it('is "nav" for the navigation bar\'s buttons, which name it themselves', () => {
    expect(cueForButton(asElement(button({ sound: 'nav' })))).toBe('nav');
  });

  it('can come from a wrapper, for every button inside it', () => {
    expect(cueForButton(asElement(button({ wrapperSound: 'none' })))).toBeUndefined();
    expect(cueForButton(asElement(button({ wrapperSound: 'nav' })))).toBe('nav');
    expect(cueForButton(asElement(button({ wrapperSound: 'chip' })))).toBe('chip');
  });

  it('is the button\'s own word over its wrapper\'s', () => {
    expect(cueForButton(asElement({ ...button({ wrapperSound: 'none' }), dataset: { sound: 'chip' } }))).toBe('chip');
    expect(cueForButton(asElement(button({ sound: 'none', wrapperSound: 'nav' })))).toBeUndefined();
  });

  it('is a click when there is no word anywhere, or the wrapper\'s word is not a cue', () => {
    expect(cueForButton(asElement(button()))).toBe('click');
    expect(cueForButton(asElement(button({ wrapperSound: 'explosion' })))).toBe('click');
  });

  it('knows every cue by its name, including the newest', () => {
    for (const cue of CUES) expect(cueForButton(asElement(button({ sound: cue })))).toBe(cue);
  });
});

describe('the cue of a click', () => {
  it('is the cue of the enabled button that was clicked', () => {
    expect(cueForClick({ closest: () => button() })).toBe('click');
    expect(cueForClick({ closest: () => button({ sound: 'nav' }) })).toBe('nav');
  });

  it('is nothing for a disabled button, for a click that is not on a button, and for anything odd', () => {
    expect(cueForClick({ closest: () => button({ disabled: true }) })).toBeUndefined();
    expect(cueForClick({ closest: () => null })).toBeUndefined();
    expect(cueForClick(null)).toBeUndefined();
    expect(cueForClick(undefined)).toBeUndefined();
    expect(cueForClick('button')).toBeUndefined();
    expect(cueForClick({})).toBeUndefined();
  });

  it('is nothing inside a wrapper that keeps its buttons quiet, such as the sound pack picker', () => {
    expect(cueForClick({ closest: () => button({ wrapperSound: 'none' }) })).toBeUndefined();
  });
});

describe('configureEngine', () => {
  it('keeps the engine silent until the host has sent the saved settings', () => {
    const audio = countingAudio();
    const engine = new SoundEngine(audio.create);
    configureEngine(engine, undefined);
    for (const cue of CUES) expect(engine.play(cue)).toBe(false);
    expect(audio.made.contexts).toBe(0);
  });

  it('hands over sound, volume, pack and groups, and still makes no audio context by itself', () => {
    const audio = countingAudio();
    const engine = new SoundEngine(audio.create);
    const settings: Settings = { ...DEFAULT_SETTINGS, soundPack: 'cyber', soundCategories: { ...DEFAULT_SETTINGS.soundCategories, chips: false } };
    configureEngine(engine, settings);
    expect(audio.made.contexts).toBe(0);
    // A group that is off is silent without even asking for audio...
    expect(engine.play('chip')).toBe(false);
    expect(audio.made.contexts).toBe(0);
    // ...and a cue that is on asks for it only now that it is played.
    engine.play('click');
    expect(audio.made.contexts).toBe(1);
  });

  it('goes quiet again when sound is switched off or the volume is 0', () => {
    const audio = countingAudio();
    const engine = new SoundEngine(audio.create);
    configureEngine(engine, { ...DEFAULT_SETTINGS, sound: false });
    expect(engine.play('click')).toBe(false);
    configureEngine(engine, { ...DEFAULT_SETTINGS, volume: 0 });
    expect(engine.play('click')).toBe(false);
    expect(audio.made.contexts).toBe(0);
  });
});

describe('the sound provider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubAudio() {
    const made = { contexts: 0 };
    class CountingContext {
      constructor() {
        made.contexts += 1;
        throw new Error('no audio in this test');
      }
    }
    vi.stubGlobal('window', { AudioContext: CountingContext });
    return made;
  }

  it('plays nothing, and asks the browser for no audio, when the page opens, with or without settings', () => {
    const made = stubAudio();
    for (const settings of [undefined, DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, soundPack: 'arcade' as const }]) {
      const html = renderToStaticMarkup(
        <SoundProvider settings={settings}>
          <ButtonSounds />
          <span>page</span>
        </SoundProvider>,
      );
      expect(html).toBe('<span>page</span>');
    }
    expect(made.contexts).toBe(0);
  });

  it('hands out a play function that stays silent until the settings have arrived', () => {
    const made = stubAudio();
    let play: Play | undefined;
    function Probe() {
      play = useSound();
      return null;
    }
    renderToStaticMarkup(
      <SoundProvider settings={undefined}>
        <Probe />
      </SoundProvider>,
    );
    for (const cue of CUES) play?.(cue, { force: false });
    expect(play).toBeDefined();
    expect(made.contexts).toBe(0);
  });

  it('only ever plays in answer to a call: the provider\'s one `engine.play` is the function it hands out', () => {
    const source = readFileSync(join(__dirname, 'SoundProvider.tsx'), 'utf8');
    expect(source.match(/engine\.play\(/g)).toHaveLength(1);
    expect(source).toMatch(/useMemo<Play>\(\(\) => \(cue, options\) => void engine\.play\(cue, options\), \[engine\]\)/);
    // The one other thing that plays is a click on a button, which is the player's own.
    expect(source.match(/\bplay\(cue\)/g)).toHaveLength(1);
    expect(source).toMatch(/addEventListener\('click', onClick\)/);
  });
});
