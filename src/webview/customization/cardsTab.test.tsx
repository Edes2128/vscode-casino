import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CARD_DESIGN_IDS, type CardDesignId } from '../../state/appearance';
import { DEFAULT_SETTINGS, type Settings, type SettingsPatch } from '../../state/settings';
import { CUSTOMIZE_TABS } from '../pages/Customize';
import { AppearanceProvider, DEFAULT_APPEARANCE } from './AppearanceContext';
import { ChoiceCard, ChoiceGrid } from './ChoiceCard';
import { CARD_DESIGNS } from './cardDesigns';
import { CardsTab } from './tabs/CardsTab';

const count = (haystack: string, needle: string): number => haystack.split(needle).length - 1;
const settings = (cardDesign: CardDesignId = 'classic'): Settings => ({ ...DEFAULT_SETTINGS, cardDesign });

/** Every element in a React tree, for any component that is not itself called: the props are what a click would use. */
function elementsOf(node: ReactNode, into: ReactElement[] = []): ReactElement[] {
  if (Array.isArray(node)) {
    for (const child of node) elementsOf(child, into);
  } else if (isValidElement(node)) {
    into.push(node);
    elementsOf((node.props as { children?: ReactNode }).children, into);
  }
  return into;
}

interface ChoiceProps {
  readonly selected: boolean;
  readonly label: string;
  readonly description?: string;
  readonly onSelect: () => void;
}

/** The tab's choices as the picker will hand them to the browser: what is selected, and what a click does. */
function choicesOf(current: CardDesignId, onChange: (patch: SettingsPatch) => void): ChoiceProps[] {
  const tree = CardsTab({ settings: settings(current), onChange });
  return elementsOf(tree)
    .filter((element) => element.type === ChoiceCard)
    .map((element) => element.props as ChoiceProps);
}

/** The text a person reads: everything between tags, none of the attributes. */
const visibleText = (html: string): string[] => [...html.matchAll(/>([^<>]+)</g)].map((match) => (match[1] ?? '').trim()).filter(Boolean);

const render = (current: CardDesignId = 'classic', context?: CardDesignId) => {
  const tab = <CardsTab settings={settings(current)} onChange={() => undefined} />;
  return renderToStaticMarkup(context === undefined ? tab : <AppearanceProvider value={{ ...DEFAULT_APPEARANCE, cardDesign: context }}>{tab}</AppearanceProvider>);
};

describe('the cards tab', () => {
  it('is the Cards tab of the Customize screen', () => {
    const tab = CUSTOMIZE_TABS.find((entry) => entry.id === 'cards');
    expect(tab?.Panel).toBe(CardsTab);
  });

  it('offers one choice per design, in order, in one radio group', () => {
    const html = render();
    expect(count(html, 'role="radio"')).toBe(CARD_DESIGN_IDS.length);
    expect(count(html, 'role="radiogroup"')).toBe(1);
    expect(html).toContain('aria-label="Playing card design"');
    const labels = choicesOf('classic', () => undefined).map((choice) => choice.label);
    expect(labels).toEqual(['CLASSIC PIXEL', 'RETRO 8-BIT', 'NEON', 'MEDIEVAL FANTASY', 'MINIMAL PIXEL', 'DARK DECK']);
  });

  it.each(CARD_DESIGN_IDS)('marks exactly one choice, the one in use, when the design is %s', (current) => {
    const choices = choicesOf(current, () => undefined);
    expect(choices.filter((choice) => choice.selected)).toHaveLength(1);
    const index = CARD_DESIGN_IDS.indexOf(current);
    expect(choices[index]?.selected).toBe(true);

    const html = render(current);
    expect(count(html, 'aria-checked="true"')).toBe(1);
    expect(count(html, 'aria-checked="false"')).toBe(CARD_DESIGN_IDS.length - 1);
    expect(count(html, 'IN USE')).toBe(1);
    expect(count(html, 'choice--selected')).toBe(1);
    expect(html).toMatch(new RegExp(`aria-checked="true"[^>]*>(?:(?!<button).)*${CARD_DESIGNS[index]?.name.toUpperCase()}`, 's'));
  });

  it('saves the design that is clicked: onChange gets exactly { cardDesign: id } and nothing else', () => {
    const onChange = vi.fn();
    const choices = choicesOf('classic', onChange);
    choices.forEach((choice) => choice.onSelect());
    expect(onChange.mock.calls).toEqual(CARD_DESIGN_IDS.map((id) => [{ cardDesign: id }]));
  });

  it('saves nothing by being drawn: only a click calls onChange', () => {
    const onChange = vi.fn();
    renderToStaticMarkup(<CardsTab settings={settings('neon')} onChange={onChange} />);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('describes each design in capitals, under its name', () => {
    const choices = choicesOf('classic', () => undefined);
    CARD_DESIGNS.forEach((design, index) => {
      expect(choices[index]?.description).toBe(design.blurb.toUpperCase());
    });
    for (const text of visibleText(render())) expect(text, text).toBe(text.toUpperCase());
  });

  it('is never a button inside a button, nor a card that could be pressed: every button is closed before the next opens', () => {
    const html = render();
    expect(html).not.toMatch(/<button[^>]*>(?:(?!<\/button>).)*<button/s);
    // Inside a choice, the previews are pictures: no button, link or form control in them.
    for (const piece of html.split('<button').slice(1)) {
      const preview = /choice__preview[\s\S]*?choice__name/.exec(piece)?.[0] ?? '';
      expect(preview).not.toMatch(/<(button|a |input|select|textarea)/);
    }
  });
});

describe('the previews', () => {
  const html = render();
  const choices = html.split('<button').slice(1).map((piece) => piece.split('</button>')[0] ?? '');

  it('show a small hand in each choice: two cards face up and one face down', () => {
    expect(choices).toHaveLength(CARD_DESIGN_IDS.length);
    for (const choice of choices) {
      expect(count(choice, 'playing-card--face'), 'face up').toBe(2);
      expect(count(choice, 'playing-card--back'), 'face down').toBe(1);
      expect(choice).toContain('aria-label="ace of spades"');
      expect(choice).toContain('aria-label="king of hearts"');
      expect(choice).toContain('aria-label="Face-down card"');
    }
  });

  it('draw each choice in its own design, through the real card', () => {
    choices.forEach((choice, index) => {
      const id = CARD_DESIGN_IDS[index] as CardDesignId;
      expect(count(choice, `data-design="${id}"`), id).toBe(3);
      expect(count(choice, 'data-design='), id).toBe(3);
    });
  });

  it('keep their own design whichever one is in use or in the page', () => {
    const inUse = render('minimal', 'dark');
    const previews = inUse.split('<button').slice(1).map((piece) => piece.split('</button>')[0] ?? '');
    previews.forEach((choice, index) => expect(choice).toContain(`data-design="${CARD_DESIGN_IDS[index]}"`));
  });

  it('are pictures for people who can see them: hidden from screen readers, which hear the name and the line', () => {
    expect(count(html, 'choice__preview" aria-hidden="true"')).toBe(CARD_DESIGN_IDS.length);
  });

  it('sit in a patch of felt of their own, which the stylesheet keeps still', () => {
    expect(count(html, 'class="card-preview"')).toBe(CARD_DESIGN_IDS.length);
  });
});

describe('the showcase of the design in use', () => {
  const showcase = (current: CardDesignId, context?: CardDesignId): string => /<section class="card-showcase"[\s\S]*<\/section>/.exec(render(current, context))?.[0] ?? '';

  it.each(CARD_DESIGNS)('is titled and drawn in $name when that is the design in use', (design) => {
    const html = showcase(design.id);
    expect(html).toContain(`PREVIEW: ${design.name.toUpperCase()}`);
    expect(html).toContain(`aria-label="Preview of the ${design.name} cards"`);
    const designs = [...html.matchAll(/data-design="(\w+)"/g)].map((match) => match[1]);
    expect(designs.length).toBeGreaterThanOrEqual(10);
    expect(new Set(designs)).toEqual(new Set([design.id]));
  });

  it('follows the saved design, not the page: a different design in the context changes nothing', () => {
    expect(showcase('retro', 'dark')).toBe(showcase('retro'));
  });

  it('shows all four suits', () => {
    const html = showcase('classic');
    for (const name of ['ace of spades', 'ace of hearts', 'ace of clubs', 'ace of diamonds']) expect(html).toContain(`aria-label="${name}"`);
  });

  it('shows the ace, the three picture cards and the ten, in both inks, and a card back', () => {
    const html = showcase('classic');
    for (const name of ['ace of spades', 'king of hearts', 'queen of clubs', 'jack of diamonds', '10 of spades']) expect(html).toContain(`aria-label="${name}"`);
    expect(count(html, 'playing-card--back')).toBe(1);
    expect(count(html, 'playing-card--red')).toBeGreaterThanOrEqual(3);
    expect(count(html, 'playing-card--face')).toBeGreaterThanOrEqual(9);
  });

  it('wraps on a narrow sidebar and holds nothing to press', () => {
    const html = showcase('neon');
    expect(html).toContain('card-showcase__row');
    expect(html).not.toMatch(/<(button|a |input)/);
  });
});

describe('the tab in the customize screen', () => {
  it('is rendered by the tab list with the settings it is given', () => {
    const Panel = CUSTOMIZE_TABS.find((entry) => entry.id === 'cards')?.Panel;
    expect(Panel).toBeDefined();
    if (Panel === undefined) return;
    const html = renderToStaticMarkup(<Panel settings={settings('medieval')} onChange={() => undefined} />);
    expect(html).toContain('PREVIEW: MEDIEVAL FANTASY');
    expect(html).toContain('IN USE');
  });

  it('still uses the shared choice parts, so it looks like the other tabs', () => {
    const types = elementsOf(CardsTab({ settings: settings(), onChange: () => undefined })).map((element) => element.type);
    expect(types).toContain(ChoiceGrid);
    expect(types).toContain(ChoiceCard);
  });
});
