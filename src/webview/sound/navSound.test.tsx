import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NavBar } from '../components/NavBar';
import { NAV_ITEMS } from '../navigation';
import { CUE_CATEGORY, CUES } from './cues';
import { cueForButton } from './SoundProvider';

const noop = (): void => undefined;

describe('the navigation bar\'s sound', () => {
  const html = renderToStaticMarkup(<NavBar current="home" onNavigate={noop} />);
  const buttons = [...html.matchAll(/<button[^>]*>/g)].map((match) => match[0]);

  it('is the "nav" cue on every one of its buttons', () => {
    expect(buttons).toHaveLength(NAV_ITEMS.length);
    for (const tag of buttons) expect(tag).toContain('data-sound="nav"');
    expect(html.match(/data-sound="nav"/g)).toHaveLength(NAV_ITEMS.length);
  });

  it('is a real cue, owned by the interface group, which is what makes it a page transition sound', () => {
    expect(CUES).toContain('nav');
    expect(CUE_CATEGORY.nav).toBe('interface');
  });

  it('reaches the engine: a button that says "nav" gets the nav cue and not a click', () => {
    const dataset = { sound: 'nav' };
    expect(cueForButton({ dataset } as unknown as Element)).toBe('nav');
  });
});
