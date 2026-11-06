import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SOUND_CATEGORIES, SOUND_PACK_IDS, type SoundCategory } from '../../../state/appearance';
import { DEFAULT_SETTINGS, type Settings, type SettingsPatch } from '../../../state/settings';
import { CUE_CATEGORY } from '../../sound/cues';
import { CATEGORY_SAMPLES, SAMPLE_STEPS } from '../../sound/sample';
import { SoundsTab } from './SoundsTab';

// What the player's presses do, checked by calling the handlers the tab hands to its parts. The parts are
// stand-ins that only record what they were given, so a press is a call and nothing needs a browser.
const captured = vi.hoisted(() => ({
  play: vi.fn(),
  toggles: [] as Array<{ label: string; checked: boolean; onChange: (checked: boolean) => void }>,
  choices: [] as Array<{ label: string; selected: boolean; onSelect: () => void }>,
  buttons: [] as Array<{ children: unknown; disabled?: boolean; onClick?: () => void }>,
  sliders: [] as Array<{ volume: number; onChange: (volume: number) => void }>,
}));

vi.mock('../../sound/SoundProvider', () => ({ useSound: () => captured.play }));
vi.mock('../../components/Toggle', () => ({
  Toggle: (props: (typeof captured.toggles)[number]) => {
    captured.toggles.push(props);
    return null;
  },
}));
vi.mock('../../components/PixelButton', () => ({
  PixelButton: (props: (typeof captured.buttons)[number]) => {
    captured.buttons.push(props);
    return null;
  },
}));
vi.mock('../../components/VolumeSlider', () => ({
  VolumeSlider: (props: (typeof captured.sliders)[number]) => {
    captured.sliders.push(props);
    return null;
  },
}));
vi.mock('../ChoiceCard', () => ({
  ChoiceGrid: ({ children }: { children: unknown }) => children,
  ChoiceCard: (props: (typeof captured.choices)[number]) => {
    captured.choices.push(props);
    return null;
  },
}));

const settings = (patch: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...patch });

function mount(value: Settings): { onChange: ReturnType<typeof vi.fn> } {
  captured.toggles.length = 0;
  captured.choices.length = 0;
  captured.buttons.length = 0;
  captured.sliders.length = 0;
  captured.play.mockClear();
  const onChange = vi.fn<(patch: SettingsPatch) => void>();
  renderToStaticMarkup(<SoundsTab settings={value} onChange={onChange} />);
  return { onChange };
}

const toggle = (label: string) => {
  const found = captured.toggles.find((entry) => entry.label === label);
  if (found === undefined) throw new Error(`no switch ${label}`);
  return found;
};

const labelOf = (category: SoundCategory): string => `${category[0]?.toUpperCase()}${category.slice(1)} sounds`;

describe('picking a sound pack', () => {
  it.each(SOUND_PACK_IDS)('saves "%s" and answers with that pack\'s own click, before it is even saved', (id) => {
    const { onChange } = mount(settings({ soundPack: id === 'classic' ? 'minimal' : 'classic' }));
    const card = captured.choices.find((entry) => entry.label === ({ classic: 'CLASSIC LOUNGE', arcade: 'RETRO ARCADE', adventure: 'PIXEL ADVENTURE', cyber: 'NEON CYBER', minimal: 'MINIMAL SOUNDS' })[id]);
    expect(card).toBeDefined();
    card?.onSelect();
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ soundPack: id });
    expect(captured.play).toHaveBeenCalledExactlyOnceWith('click', { pack: id });
  });

  it('lets the player hear the pack that is already in use again, and saves nothing new that matters', () => {
    const { onChange } = mount(settings({ soundPack: 'cyber' }));
    captured.choices.find((entry) => entry.selected)?.onSelect();
    expect(onChange).toHaveBeenCalledWith({ soundPack: 'cyber' });
    expect(captured.play).toHaveBeenCalledWith('click', { pack: 'cyber' });
  });
});

describe('the groups of sounds', () => {
  it.each(SOUND_CATEGORIES)('switching "%s" off saves all five groups with only that one changed, and plays nothing', (category) => {
    const { onChange } = mount(settings());
    toggle(labelOf(category)).onChange(false);
    expect(onChange).toHaveBeenCalledOnce();
    const patch = onChange.mock.calls[0]?.[0] as { soundCategories: Record<string, boolean> };
    expect(Object.keys(patch)).toEqual(['soundCategories']);
    expect(Object.keys(patch.soundCategories).sort()).toEqual([...SOUND_CATEGORIES].sort());
    for (const other of SOUND_CATEGORIES) expect(patch.soundCategories[other], other).toBe(other !== category);
    expect(captured.play).not.toHaveBeenCalled();
  });

  it.each(SOUND_CATEGORIES)('switching "%s" back on saves it and plays a sample of it, which has to ignore the switch that is not saved yet', (category) => {
    const off = Object.fromEntries(SOUND_CATEGORIES.map((entry) => [entry, entry !== category])) as Record<SoundCategory, boolean>;
    const { onChange } = mount(settings({ soundCategories: off, soundPack: 'adventure' }));
    toggle(labelOf(category)).onChange(true);

    const patch = onChange.mock.calls[0]?.[0] as { soundCategories: Record<string, boolean> };
    expect(Object.values(patch.soundCategories)).toEqual([true, true, true, true, true]);

    const sample = CATEGORY_SAMPLES[category];
    expect(CUE_CATEGORY[sample.cue]).toBe(category);
    expect(captured.play).toHaveBeenCalledExactlyOnceWith(sample.cue, { ...sample.options, pack: 'adventure', ignoreCategory: true });
  });

  it('carries the other groups as they are, not as the defaults', () => {
    const { onChange } = mount(settings({ soundCategories: { interface: true, chips: false, cards: true, roulette: false, results: true } }));
    toggle('Cards sounds').onChange(false);
    expect(onChange).toHaveBeenCalledWith({ soundCategories: { interface: true, chips: false, cards: false, roulette: false, results: true } });
  });
});

describe('sound on or off, and the volume', () => {
  it('saves the switch, and answers switching sound on with a forced click in the pack in use', () => {
    const { onChange } = mount(settings({ sound: false, soundPack: 'arcade' }));
    toggle('Sound effects').onChange(true);
    expect(onChange).toHaveBeenCalledWith({ sound: true });
    expect(captured.play).toHaveBeenCalledExactlyOnceWith('click', { force: true, pack: 'arcade' });
  });

  it('says nothing when sound is switched off', () => {
    const { onChange } = mount(settings());
    toggle('Sound effects').onChange(false);
    expect(onChange).toHaveBeenCalledWith({ sound: false });
    expect(captured.play).not.toHaveBeenCalled();
  });

  it('saves the volume and ticks at the new loudness while sliding', () => {
    const { onChange } = mount(settings());
    captured.sliders[0]?.onChange(80);
    expect(onChange).toHaveBeenCalledWith({ volume: 80 });
    expect(captured.play).toHaveBeenCalledWith('tick', { volume: 80 });
  });
});

describe('PLAY SAMPLE', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('window', globalThis);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const press = (): void => {
    const button = captured.buttons.find((entry) => entry.children === 'PLAY SAMPLE');
    expect(button?.disabled).toBe(false);
    button?.onClick?.();
  };

  it('makes the first sound at once and the rest in time, all in the pack that is in use', () => {
    mount(settings({ soundPack: 'cyber' }));
    press();
    expect(captured.play).toHaveBeenCalledTimes(1);
    expect(captured.play).toHaveBeenLastCalledWith('click', { pack: 'cyber' });

    SAMPLE_STEPS.slice(1).forEach((step, index) => {
      vi.advanceTimersByTime(step.atMs - (SAMPLE_STEPS[index]?.atMs ?? 0));
      expect(captured.play, step.label).toHaveBeenCalledTimes(index + 2);
      expect(captured.play, step.label).toHaveBeenLastCalledWith(step.cue, { ...step.options, pack: 'cyber' });
    });
  });

  it('plays nothing it was not asked to: no sound until the button is pressed, however long the screen is open', () => {
    mount(settings());
    vi.advanceTimersByTime(60_000);
    expect(captured.play).not.toHaveBeenCalled();
  });

  it('is a real button press that does it, never the screen opening or a setting changing', () => {
    mount(settings());
    mount(settings({ soundPack: 'minimal' }));
    mount(settings({ volume: 20 }));
    vi.advanceTimersByTime(10_000);
    expect(captured.play).not.toHaveBeenCalled();
  });

  it('is disabled while sound is off', () => {
    mount(settings({ sound: false }));
    expect(captured.buttons.find((entry) => entry.children === 'PLAY SAMPLE')?.disabled).toBe(true);
  });
});
