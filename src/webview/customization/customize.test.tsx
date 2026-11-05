import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ALL_SOUND_CATEGORIES_ON, CARD_DESIGN_IDS, ROULETTE_ANIMATION_IDS, SOUND_PACK_IDS, THEME_IDS } from '../../casino/appearance';
import { DEFAULT_SETTINGS, type Settings } from '../../casino/settings';
import { NAV_ITEMS } from '../navigation';
import { CUSTOMIZE_TABS, Customize } from '../pages/Customize';
import { appearanceOf, applyAppearanceTo, clearAppearanceFrom, DEFAULT_APPEARANCE, type AppearanceRoot } from './AppearanceContext';
import { ChoiceCard, ChoiceGrid } from './ChoiceCard';
import { ScenePreview } from './ScenePreview';
import { resolveAppearance } from './appearance';
import { ColorsTab } from './tabs/ColorsTab';
import { ThemesTab } from './tabs/ThemesTab';

const count = (haystack: string, needle: string): number => haystack.split(needle).length - 1;
const noop = (): void => undefined;
const settings = (patch: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...patch });

describe('ChoiceCard', () => {
  it('is a radio that says it is selected in words, not only in color', () => {
    const on = renderToStaticMarkup(
      <ChoiceCard selected label="NEON" description="BRIGHT" onSelect={noop}>
        <i />
      </ChoiceCard>,
    );
    expect(on).toContain('role="radio"');
    expect(on).toContain('aria-checked="true"');
    expect(on).toContain('choice--selected');
    expect(on).toContain('IN USE');
    expect(on).toContain('BRIGHT');

    const off = renderToStaticMarkup(
      <ChoiceCard selected={false} label="NEON" onSelect={noop}>
        <i />
      </ChoiceCard>,
    );
    expect(off).toContain('aria-checked="false"');
    expect(off).not.toContain('IN USE');
    expect(off).not.toContain('choice--selected');
  });

  it('hides its preview from screen readers, which hear the name and the description', () => {
    const html = renderToStaticMarkup(
      <ChoiceCard selected={false} label="X" description="Y" onSelect={noop}>
        <i />
      </ChoiceCard>,
    );
    expect(html).toMatch(/choice__preview" aria-hidden="true"/);
    expect(html).toContain('aria-describedby=');
  });

  it('groups choices as a labelled radio group', () => {
    const html = renderToStaticMarkup(
      <ChoiceGrid label="Casino theme">
        <span />
      </ChoiceGrid>,
    );
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-label="Casino theme"');
  });
});

describe('the themes tab', () => {
  it('shows all eight themes, with one in use', () => {
    const html = renderToStaticMarkup(<ThemesTab settings={settings()} onChange={noop} />);
    expect(count(html, 'role="radio"')).toBe(THEME_IDS.length);
    expect(count(html, 'aria-checked="true"')).toBe(1);
    for (const name of ['CLASSIC CASINO', 'NEON ARCADE', 'RETRO 8-BIT', 'MIDNIGHT CASINO', 'BLOOD CASINO', 'CYBER CASINO', 'FOREST CASINO', 'ROYAL CASINO']) {
      expect(html).toContain(name);
    }
  });

  it('marks the theme that is chosen', () => {
    const html = renderToStaticMarkup(<ThemesTab settings={settings({ theme: 'royal' })} onChange={noop} />);
    expect(html).toMatch(/aria-checked="true"[^>]*>(?:(?!<button).)*ROYAL CASINO/s);
  });

  it('previews each theme in its own colors', () => {
    const html = renderToStaticMarkup(<ThemesTab settings={settings()} onChange={noop} />);
    expect(count(html, 'class="scene"')).toBe(THEME_IDS.length);
    expect(html).toContain('--c-bg:#0a0420'); // neon's page color, set on its own preview
    expect(html).toContain('--c-felt:#3d1a70'); // royal's table
  });
});

describe('the scene preview', () => {
  it('sets every color variable on itself and is decoration unless it is given a title', () => {
    const resolved = resolveAppearance('forest');
    const decoration = renderToStaticMarkup(<ScenePreview resolved={resolved} />);
    expect(decoration).toContain('aria-hidden="true"');
    for (const name of Object.keys(resolved.vars)) expect(decoration).toContain(`${name}:`);

    const titled = renderToStaticMarkup(<ScenePreview resolved={resolved} title="Preview" />);
    expect(titled).toContain('role="img"');
    expect(titled).toContain('aria-label="Preview"');
    expect(titled).not.toContain('aria-hidden="true" class="scene"');
  });

  it('draws the casino\'s own parts: header, table, two cards, a chip and a button', () => {
    const html = renderToStaticMarkup(<ScenePreview resolved={resolveAppearance('classic')} />);
    expect(html).toContain('scene__bar');
    expect(html).toContain('scene__table');
    expect(count(html, 'playing-card')).toBeGreaterThanOrEqual(2);
    expect(html).toContain('px-chip');
    expect(html).toContain('px-button');
  });

  it('is never a button inside a button: the choice around it is the only one', () => {
    const html = renderToStaticMarkup(<ThemesTab settings={settings()} onChange={noop} />);
    // Every <button> is closed before the next one opens.
    expect(html).not.toMatch(/<button[^>]*>(?:(?!<\/button>).)*<button/s);
  });
});

describe('the colors tab', () => {
  const render = (patch: Partial<Settings> = {}) => renderToStaticMarkup(<ColorsTab settings={settings(patch)} onChange={noop} />);

  it('has a field for each of the six colors, a picker and a hex box each', () => {
    const html = render();
    expect(count(html, 'type="color"')).toBe(6);
    expect(count(html, 'color-field__hex')).toBe(6);
    for (const label of ['TABLE', 'BACKGROUND', 'ACCENT', 'MAIN BUTTON', 'TEXT', 'CHIPS']) expect(html).toContain(label);
  });

  it('offers presets and a reset that is off while nothing is customised', () => {
    const html = render();
    expect(html).toContain('LUCKY GREEN');
    expect(html).toContain('OCEAN');
    expect(html).toMatch(/disabled=""[^>]*>RESET TO THEME COLORS/);
  });

  it('turns the reset on once a color is picked, and shows what is picked', () => {
    const html = render({ colors: { table: '#224466' } });
    expect(html).not.toMatch(/disabled=""[^>]*>RESET TO THEME COLORS/);
    expect(html).toContain('value="#224466"');
    expect(html).toContain('--c-felt:#224466'); // the live preview already wears it
  });

  it('says so when a pick had to be adjusted so text stays readable', () => {
    const html = render({ colors: { text: '#101010' } });
    expect(html).toContain('ADJUSTED SO TEXT STAYS READABLE');
  });

  it('says nothing about adjusting when every pick reads fine', () => {
    expect(render({ colors: { table: '#224466' } })).not.toContain('ADJUSTED SO TEXT');
  });

  it('shows a preview and names the theme the colors sit on', () => {
    const html = render({ theme: 'midnight' });
    expect(html).toContain('colors-preview');
    expect(html).toContain('MIDNIGHT CASINO THEME');
  });
});

describe('the Customize page', () => {
  it('has the five tabs of the brief, in order, with the first one open', () => {
    expect(CUSTOMIZE_TABS.map((tab) => tab.label)).toEqual(['THEMES', 'CARDS', 'WHEEL', 'SOUNDS', 'COLORS']);
    const html = renderToStaticMarkup(<Customize settings={settings()} onChange={noop} />);
    expect(html).toContain('CUSTOMIZE');
    expect(count(html, 'role="tab"')).toBe(5);
    expect(count(html, 'aria-selected="true"')).toBe(1);
    expect(html).toMatch(/aria-selected="true"[^>]*>THEMES</);
    expect(html).toContain('role="tabpanel"');
  });

  it('says everything is free', () => {
    expect(renderToStaticMarkup(<Customize settings={settings()} onChange={noop} />)).toContain('EVERYTHING HERE IS FREE. NOTHING IS LOCKED, EVER.');
  });

  it('is reachable from the navigation bar', () => {
    expect(NAV_ITEMS.map((item) => item.page)).toContain('customize');
  });

  it('has a tab panel for every area, each given the settings', () => {
    for (const tab of CUSTOMIZE_TABS) {
      const html = renderToStaticMarkup(<tab.Panel settings={settings()} onChange={noop} />);
      expect(html.length, tab.id).toBeGreaterThan(50);
    }
  });
});

describe('what the player chose, as the screens get it', () => {
  it('is the classic look by default', () => {
    expect(DEFAULT_APPEARANCE.resolved.theme.id).toBe('classic');
    expect(DEFAULT_APPEARANCE.cardDesign).toBe('classic');
    expect(DEFAULT_APPEARANCE.rouletteAnimation).toBe('classic');
    expect(DEFAULT_APPEARANCE.soundPack).toBe('classic');
  });

  it('follows every choice', () => {
    const value = appearanceOf(settings({ theme: 'cyber', cardDesign: 'neon', rouletteAnimation: 'explosion', soundPack: 'arcade', colors: { table: '#112233' } }));
    expect(value.resolved.theme.id).toBe('cyber');
    expect(value.resolved.tokens.felt).toBe('#112233');
    expect(value.cardDesign).toBe('neon');
    expect(value.rouletteAnimation).toBe('explosion');
    expect(value.soundPack).toBe('arcade');
  });

  it('has an option for each id the settings accept', () => {
    expect(THEME_IDS).toHaveLength(8);
    expect(CARD_DESIGN_IDS).toHaveLength(6);
    expect(ROULETTE_ANIMATION_IDS).toHaveLength(5);
    expect(SOUND_PACK_IDS).toHaveLength(5);
    expect(Object.values(ALL_SOUND_CATEGORIES_ON).every(Boolean)).toBe(true);
  });
});

describe('putting the look on the page', () => {
  const fakeRoot = () => {
    const properties = new Map<string, string>();
    const attributes = new Map<string, string>();
    const root: AppearanceRoot = {
      style: {
        setProperty: (name, value) => void properties.set(name, value),
        removeProperty: (name) => properties.delete(name),
      },
      setAttribute: (name, value) => void attributes.set(name, value),
      removeAttribute: (name) => void attributes.delete(name),
    };
    return { root, properties, attributes };
  };

  it('sets every color and every name the stylesheets read', () => {
    const { root, properties, attributes } = fakeRoot();
    applyAppearanceTo(root, appearanceOf(settings({ theme: 'neon', cardDesign: 'medieval', rouletteAnimation: 'slow' })));
    expect(properties.get('--c-bg')).toBe('#0a0420');
    expect(properties.get('--c-neon')).toBe('#2ef2ff');
    expect(properties.get('--c-chip')).toBe('#2ef2ff');
    expect(Object.fromEntries(attributes)).toEqual({
      'data-theme': 'neon',
      'data-pattern': 'grid',
      'data-glow': 'on',
      'data-cards': 'medieval',
      'data-wheel': 'slow',
    });
  });

  it('switches from one look to another without leaving any of the first behind', () => {
    const { root, properties, attributes } = fakeRoot();
    applyAppearanceTo(root, appearanceOf(settings({ theme: 'neon' })));
    applyAppearanceTo(root, appearanceOf(settings({ theme: 'classic' })));
    expect(properties.get('--c-bg')).toBe('#101216');
    expect(properties.get('--c-chip')).toBe('transparent'); // classic chips keep their own colors again
    expect(attributes.get('data-theme')).toBe('classic');
    expect(attributes.get('data-glow')).toBe('off');
  });

  it('lets custom colors show on top of the theme', () => {
    const { root, properties } = fakeRoot();
    applyAppearanceTo(root, appearanceOf(settings({ theme: 'classic', colors: { table: '#224466' } })));
    expect(properties.get('--c-felt')).toBe('#224466');
  });

  it('hands the page back to its stylesheet', () => {
    const { root, properties, attributes } = fakeRoot();
    applyAppearanceTo(root, appearanceOf(settings({ theme: 'royal' })));
    clearAppearanceFrom(root);
    expect(properties.size).toBe(0);
    expect(attributes.size).toBe(0);
  });
});
