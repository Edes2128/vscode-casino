import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SOUND_CATEGORIES, SOUND_PACK_IDS, type SoundCategory } from '../../../casino/appearance';
import { DEFAULT_SETTINGS, type Settings } from '../../../casino/settings';
import { MotionContext, type MotionLevel } from '../../motion';
import { SAMPLE_STEPS } from '../../sound/sample';
import { SOUND_CATEGORY_INFO, SOUND_PACK_CATALOG } from '../soundPacks';
import { SampleSteps, SoundsTab } from './SoundsTab';

const noop = (): void => undefined;
const settings = (patch: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...patch });
const render = (value: Settings, motion: MotionLevel = 'full'): string =>
  renderToStaticMarkup(
    <MotionContext.Provider value={motion}>
      <SoundsTab settings={value} onChange={noop} />
    </MotionContext.Provider>,
  );

/** The opening tags of every button with this role. */
const tagsWithRole = (markup: string, role: string): string[] => [...markup.matchAll(new RegExp(`<button[^>]*role="${role}"[^>]*>`, 'g'))].map((match) => match[0]);
const attribute = (tag: string, name: string): string | undefined => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];

/** The switch with this accessible name: whether it is on, and whether it is disabled. */
function switchNamed(markup: string, label: string): { on: boolean; disabled: boolean; silent: boolean } {
  const tag = tagsWithRole(markup, 'switch').find((candidate) => attribute(candidate, 'aria-label') === label);
  if (tag === undefined) throw new Error(`no switch named ${label}`);
  return { on: attribute(tag, 'aria-checked') === 'true', disabled: / disabled=""/.test(tag), silent: attribute(tag, 'data-sound') === 'none' };
}

/** The PLAY SAMPLE button's opening tag. */
const sampleButton = (markup: string): string => /<button[^>]*>PLAY SAMPLE<\/button>/.exec(markup)?.[0] ?? '';

describe('the sound pack picker', () => {
  const markup = render(settings());

  it('is a radio group of five packs, named, in order, each with a line about it', () => {
    expect(markup).toContain('role="radiogroup"');
    expect(markup).toContain('aria-label="Sound pack"');
    expect(tagsWithRole(markup, 'radio')).toHaveLength(5);
    const names = ['CLASSIC CASINO', 'RETRO ARCADE', 'PIXEL ADVENTURE', 'NEON CYBER', 'MINIMAL SOUNDS'];
    const positions = names.map((name) => markup.indexOf(name));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    for (const entry of SOUND_PACK_CATALOG) expect(markup).toContain(entry.blurb.toUpperCase().replace(/'/g, '&#x27;'));
  });

  it('marks exactly one pack as in use: the one in the settings', () => {
    for (const id of SOUND_PACK_IDS) {
      const html = render(settings({ soundPack: id }));
      const radios = tagsWithRole(html, 'radio');
      expect(radios.filter((tag) => attribute(tag, 'aria-checked') === 'true')).toHaveLength(1);
      expect(html.match(/IN USE/g)).toHaveLength(1);
      const name = SOUND_PACK_CATALOG.find((entry) => entry.id === id)?.name.toUpperCase() ?? '';
      // The card that is in use is the one that carries its name, its mark and the pack's gold frame.
      const card = html.split('role="radio"').slice(1).find((chunk) => chunk.includes('aria-checked="true"')) ?? '';
      expect(card).toContain(name);
      expect(card).toContain('IN USE');
      expect(card).toContain('choice--selected');
    }
  });

  it('puts no button inside another, so every card works from the keyboard and a screen reader', () => {
    for (const chunk of markup.split('role="radio"').slice(1)) {
      const card = chunk.slice(0, chunk.indexOf('</button>'));
      expect(card).not.toContain('<button');
    }
  });

  it('draws each pack\'s waveform, and the pictures are hidden from screen readers', () => {
    expect(markup.match(/<svg class="sound-glyph"/g)).toHaveLength(5);
    expect(markup.match(/<svg[^>]*aria-hidden="true"/g)).toHaveLength(5);
    const lines = [...markup.matchAll(/class="sound-glyph__line" d="([^"]+)"/g)].map((match) => match[1]);
    expect(new Set(lines).size).toBe(5);
  });

  it('keeps the ordinary button click quiet inside it: the pack that is picked plays its own click', () => {
    expect(markup).toMatch(/<div class="sound-packs" data-sound="none"><div class="choice-grid" role="radiogroup"/);
  });
});

describe('sound on or off, and the volume', () => {
  it('has the master switch and the volume slider, showing the settings', () => {
    const on = render(settings({ sound: true, volume: 35 }));
    expect(switchNamed(on, 'Sound effects')).toMatchObject({ on: true, disabled: false });
    expect(on).toContain('aria-label="Volume"');
    expect(on).toContain('value="35"');
    expect(on).toContain('>35%<');

    const off = render(settings({ sound: false }));
    expect(switchNamed(off, 'Sound effects')).toMatchObject({ on: false });
    expect(off).toMatch(/<input[^>]*aria-label="Volume"[^>]*disabled=""|<input[^>]*disabled=""[^>]*aria-label="Volume"/);
  });

  it('answers a switch with its own sound, not an ordinary click', () => {
    expect(switchNamed(render(settings()), 'Sound effects').silent).toBe(true);
  });
});

describe('what plays: one switch for each group of sounds', () => {
  it('lists the five groups in order, each with a line about it', () => {
    const markup = render(settings());
    const order = SOUND_CATEGORIES.map((category) => markup.indexOf(`>${SOUND_CATEGORY_INFO[category].label.toUpperCase()}<`));
    expect(order.every((position) => position >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(SOUND_CATEGORIES.map((category) => SOUND_CATEGORY_INFO[category].label)).toEqual(['Interface', 'Chips', 'Cards', 'Roulette', 'Results']);
    for (const category of SOUND_CATEGORIES) expect(markup).toContain(SOUND_CATEGORY_INFO[category].hint);
  });

  it.each(SOUND_CATEGORIES)('has a switch for "%s" that shows what the settings say', (category) => {
    for (const on of [true, false]) {
      const markup = render(settings({ soundCategories: { ...DEFAULT_SETTINGS.soundCategories, [category]: on } }));
      const label = `${SOUND_CATEGORY_INFO[category].label} sounds`;
      expect(switchNamed(markup, label).on, `${label} should be ${on ? 'on' : 'off'}`).toBe(on);
      // Every other group is as it was.
      for (const other of SOUND_CATEGORIES.filter((entry) => entry !== category)) {
        expect(switchNamed(markup, `${SOUND_CATEGORY_INFO[other].label} sounds`).on).toBe(true);
      }
    }
  });

  it('has exactly six switches: sound itself and the five groups, none of them loud on their own', () => {
    const switches = tagsWithRole(render(settings()), 'switch');
    expect(switches).toHaveLength(6);
    expect(switches.every((tag) => attribute(tag, 'data-sound') === 'none')).toBe(true);
  });

  it('keeps the groups switchable while sound is off, and says why nothing plays', () => {
    const markup = render(settings({ sound: false }));
    for (const category of SOUND_CATEGORIES) expect(switchNamed(markup, `${SOUND_CATEGORY_INFO[category].label} sounds`).disabled).toBe(false);
    expect(markup).toContain('SOUND IS OFF, SO NOTHING PLAYS.');
    expect(render(settings())).not.toContain('SOUND IS OFF, SO NOTHING PLAYS.');
  });
});

describe('the sample', () => {
  it('is a PLAY SAMPLE button, named for the pack that is in use, and it keeps its own sounds for itself', () => {
    for (const entry of SOUND_PACK_CATALOG) {
      const markup = render(settings({ soundPack: entry.id }));
      expect(markup).toContain(`class="sound-sample__name">${entry.name.toUpperCase()}<`);
    }
    const button = sampleButton(render(settings()));
    expect(button).toContain('data-sound="none"');
    expect(button).toContain('type="button"');
  });

  it('is on while sound is on, the volume is up and some group is on', () => {
    const markup = render(settings());
    expect(sampleButton(markup)).not.toContain('disabled');
    expect(markup).not.toContain('sound-sample-hint');
  });

  it('is disabled while sound is off, and says so', () => {
    const markup = render(settings({ sound: false }));
    expect(sampleButton(markup)).toContain('disabled=""');
    expect(sampleButton(markup)).toContain('aria-describedby="sound-sample-hint"');
    expect(markup).toContain('id="sound-sample-hint"');
    expect(markup).toContain('SOUND IS OFF. SWITCH IT ON TO HEAR A SAMPLE.');
  });

  it('is disabled at volume 0, and when every group is off, and says so', () => {
    const quiet = render(settings({ volume: 0 }));
    expect(sampleButton(quiet)).toContain('disabled=""');
    expect(quiet).toContain('THE VOLUME IS AT 0.');

    const everyGroupOff = render(settings({ soundCategories: { interface: false, chips: false, cards: false, roulette: false, results: false } }));
    expect(sampleButton(everyGroupOff)).toContain('disabled=""');
    expect(everyGroupOff).toContain('EVERY KIND OF SOUND IS OFF BELOW.');

    // One group on is enough.
    const one = render(settings({ soundCategories: { interface: false, chips: false, cards: false, roulette: true, results: false } }));
    expect(sampleButton(one)).not.toContain('disabled');
  });

  it('is never playing when the screen opens: no step is marked', () => {
    expect(render(settings())).not.toContain('sample-step--now');
    expect(render(settings())).not.toContain('aria-current="step"');
  });
});

describe('the steps of the sample', () => {
  it('list the sounds in the order they play', () => {
    const markup = renderToStaticMarkup(<SampleSteps current={undefined} motion="full" />);
    expect(markup.match(/<li /g)).toHaveLength(SAMPLE_STEPS.length);
    expect([...markup.matchAll(/<li[^>]*>([A-Z]+)<\/li>/g)].map((match) => match[1])).toEqual(['CLICK', 'CHIP', 'DEAL', 'FLIP', 'WIN', 'LOSS', 'SPIN']);
    expect(markup).toContain('<ol');
    expect(markup).toContain('aria-label="The sounds of the sample, in order"');
  });

  it('mark the one that is playing, for the eye and for a screen reader, and only that one', () => {
    SAMPLE_STEPS.forEach((step, index) => {
      const markup = renderToStaticMarkup(<SampleSteps current={index} motion="full" />);
      expect(markup.match(/sample-step--now/g)).toHaveLength(1);
      expect(markup.match(/aria-current="step"/g)).toHaveLength(1);
      expect(markup).toMatch(new RegExp(`<li[^>]*sample-step--now[^>]*>${step.label}</li>|<li[^>]*aria-current="step"[^>]*>${step.label}</li>`));
    });
  });

  it('hop as they arrive only with full animation: calm and off never animate', () => {
    expect(renderToStaticMarkup(<SampleSteps current={1} motion="full" />)).toContain('sample-steps--lively');
    expect(renderToStaticMarkup(<SampleSteps current={1} motion="calm" />)).not.toContain('sample-steps--lively');
    expect(renderToStaticMarkup(<SampleSteps current={1} motion="off" />)).not.toContain('sample-steps--lively');
  });

  it('follow the motion the player has chosen when the whole tab is drawn', () => {
    expect(render(settings(), 'full')).toContain('sample-steps--lively');
    expect(render(settings(), 'calm')).not.toContain('sample-steps--lively');
    expect(render(settings(), 'off')).not.toContain('sample-steps--lively');
  });
});

describe('the tab as a whole', () => {
  it('says the sounds are made on the spot, so there is nothing to download', () => {
    expect(render(settings())).toContain('NOTHING TO DOWNLOAD');
  });

  it('is the same markup whichever group is checked: every category has a switch and none is missing', () => {
    const labels = tagsWithRole(render(settings()), 'switch').map((tag) => attribute(tag, 'aria-label'));
    const categories: SoundCategory[] = [...SOUND_CATEGORIES];
    expect(labels).toEqual(['Sound effects', ...categories.map((category) => `${SOUND_CATEGORY_INFO[category].label} sounds`)]);
  });
});
