import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { cueForButton } from './SoundProvider';
import { OWN_PLAY_MS, useOwnPlay, type OwnPlay } from './useOwnPlay';

const button = (sound?: string): Element => {
  const attributes = new Map<string, string>();
  const dataset: Record<string, string> = {};
  if (sound !== undefined) dataset['sound'] = sound;
  return { dataset, getAttribute: (name: string) => attributes.get(name) } as unknown as Element;
};

describe('cueForButton', () => {
  it('gives an ordinary button a click', () => {
    expect(cueForButton(button())).toBe('click');
  });

  it('gives a chip its own sound, and any known cue by name', () => {
    expect(cueForButton(button('chip'))).toBe('chip');
    expect(cueForButton(button('tick'))).toBe('tick');
  });

  it('keeps a button silent when it says none', () => {
    expect(cueForButton(button('none'))).toBeUndefined();
  });

  it('falls back to a click for a name that is not a cue, never an error', () => {
    expect(cueForButton(button('explosion'))).toBe('click');
    expect(cueForButton(button(''))).toBe('click');
  });
});

describe('useOwnPlay', () => {
  function capture(clock: () => number): OwnPlay {
    let captured: OwnPlay | undefined;
    function Probe() {
      captured = useOwnPlay(clock);
      return null;
    }
    renderToStaticMarkup(<Probe />);
    if (captured === undefined) throw new Error('hook did not run');
    return captured;
  }

  it('is not the player\'s until they do something', () => {
    let time = 1_000_000;
    const own = capture(() => time);
    expect(own.isMine()).toBe(false);
    time += 1;
    expect(own.isMine()).toBe(false);
  });

  it('is theirs for a while after an action, and not any longer', () => {
    let time = 1_000_000;
    const own = capture(() => time);
    own.mark();
    expect(own.isMine()).toBe(true);
    time += OWN_PLAY_MS - 1;
    expect(own.isMine()).toBe(true);
    time += 1;
    expect(own.isMine()).toBe(false);
  });

  it('starts the wait again with every action', () => {
    let time = 0;
    const own = capture(() => time);
    own.mark();
    time += OWN_PLAY_MS - 1_000;
    own.mark();
    time += OWN_PLAY_MS - 1_000;
    expect(own.isMine()).toBe(true);
  });

  it('is long enough for a whole roulette spin and its result', () => {
    expect(OWN_PLAY_MS).toBeGreaterThan(5_500 + 2_000);
  });
});
