import { isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ROULETTE_ANIMATION_IDS, type RouletteAnimationId } from '../../state/appearance';
import { DEFAULT_SETTINGS, type Settings } from '../../state/settings';
import { POCKET_COUNT, WHEEL_ORDER, colorOfNumber } from '../../game/roulette/wheel';
import { AppearanceProvider, appearanceOf } from '../customization/AppearanceContext';
import { ChoiceCard } from '../customization/ChoiceCard';
import { AnimationsTab } from '../customization/tabs/AnimationsTab';
import { ROULETTE_ANIMATIONS, rouletteAnimation } from '../customization/rouletteAnimations';
import { MotionContext, type MotionLevel } from '../motion';
import { PreviewPanel, IDLE_PREVIEW, demoPocket, previewNote, previewStep, type PreviewState } from './WheelPreview';
import { RouletteWheel } from './RouletteWheel';
import { WheelBurst } from './WheelBurst';
import { WheelThumb } from './WheelThumb';

const count = (haystack: string, needle: string): number => haystack.split(needle).length - 1;
const noop = (): void => undefined;
const settings = (patch: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...patch });

/** Every element of a React tree (not rendered, only as written) for which `match` is true. */
function findAll(node: ReactNode, match: (element: { type: unknown; props: Record<string, unknown> }) => boolean): Array<{ type: unknown; props: Record<string, unknown> }> {
  if (Array.isArray(node)) return node.flatMap((child) => findAll(child as ReactNode, match));
  if (!isValidElement(node)) return [];
  const element = node as unknown as { type: unknown; props: Record<string, unknown> };
  const own = match(element) ? [element] : [];
  return [...own, ...findAll(element.props['children'] as ReactNode, match)];
}

describe('RouletteWheel and its animation style', () => {
  const wheel = (animation?: RouletteAnimationId, chosen?: RouletteAnimationId, extra: Partial<Parameters<typeof RouletteWheel>[0]> = {}) => {
    const element = <RouletteWheel spin={undefined} motion="full" onStopped={noop} {...(animation === undefined ? {} : { animation })} {...extra} />;
    return renderToStaticMarkup(
      chosen === undefined ? (
        element
      ) : (
        <AppearanceProvider value={appearanceOf(settings({ rouletteAnimation: chosen }))}>{element}</AppearanceProvider>
      ),
    );
  };

  it('uses the classic style without a provider or a prop', () => {
    expect(wheel()).toContain('data-animation="classic"');
  });

  it('defaults to the style the player chose', () => {
    for (const id of ROULETTE_ANIMATION_IDS) expect(wheel(undefined, id), id).toContain(`data-animation="${id}"`);
  });

  it('lets the animation prop override the player\'s choice', () => {
    expect(wheel('neon', 'slow')).toContain('data-animation="neon"');
    expect(wheel('classic', 'explosion')).toContain('data-animation="classic"');
    expect(wheel('arcade')).toContain('data-animation="arcade"');
  });

  it('is still the labelled 64 by 64 canvas with its pointer, in every style', () => {
    for (const id of ROULETTE_ANIMATION_IDS) {
      const html = wheel(id);
      expect(html).toContain('width="64"');
      expect(html).toContain('height="64"');
      expect(html).toContain('aria-label="Roulette wheel"');
      expect(html).toContain('rl-wheel__pointer');
    }
  });

  it('takes another class for a smaller wheel, and draws no burst while at rest, in any style', () => {
    expect(wheel('explosion', undefined, { className: 'rl-wheel--preview' })).toContain('rl-wheel rl-wheel--preview');
    for (const id of ROULETTE_ANIMATION_IDS) expect(wheel(id), id).not.toContain('wheel-burst');
  });

  it('shows no burst for a result that was already there when the screen opened', () => {
    const html = renderToStaticMarkup(<RouletteWheel spin={{ id: 4, pocketIndex: 12 }} motion="full" onStopped={noop} animation="explosion" />);
    expect(html).not.toContain('wheel-burst');
  });
});

describe('WheelBurst', () => {
  it('throws the number of pixels it is given and is hidden from screen readers', () => {
    const html = renderToStaticMarkup(<WheelBurst count={28} />);
    expect(count(html, 'wheel-burst__dot ')).toBe(28);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('--burst-ms:1000ms');
    expect(html).not.toContain('wheel-burst--still');
  });

  it('can be a frozen picture for a thumbnail', () => {
    expect(renderToStaticMarkup(<WheelBurst count={10} still />)).toContain('wheel-burst--still');
  });
});

describe('WheelThumb', () => {
  it('draws a canvas for every style and the frozen burst only for the explosion', () => {
    for (const style of ROULETTE_ANIMATIONS) {
      const html = renderToStaticMarkup(<WheelThumb id={style.id} />);
      expect(html, style.id).toContain('<canvas');
      expect(html.includes('wheel-burst--still'), style.id).toBe(style.effect === 'burst');
    }
  });
});

describe('the preview: choosing a pocket', () => {
  it('can land on every pocket but the one it landed on before', () => {
    for (let previous = 0; previous < POCKET_COUNT; previous += 1) {
      const reached = new Set<number>();
      for (let step = 0; step < 36; step += 1) reached.add(demoPocket(previous, () => (step + 0.5) / 36));
      expect(reached.size, `after ${previous}`).toBe(36);
      expect(reached.has(previous), `after ${previous}`).toBe(false);
      for (const index of reached) {
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(POCKET_COUNT);
      }
    }
  });

  it('can land on any of the 37 pockets at the start', () => {
    const reached = new Set(Array.from({ length: 37 }, (_, step) => demoPocket(undefined, () => (step + 0.5) / 37)));
    expect(reached.size).toBe(37);
  });

  it('stays in range at the very edges of the random number', () => {
    expect(demoPocket(undefined, () => 0)).toBe(0);
    expect(demoPocket(undefined, () => 0.999_999_999)).toBe(36);
    expect(demoPocket(36, () => 0.999_999_999)).toBe(35);
    expect(demoPocket(0, () => 0)).toBe(1);
  });
});

describe('the preview: one spin at a time', () => {
  it('starts a spin on a pocket it picks, and counts the spins', () => {
    const first = previewStep(IDLE_PREVIEW, { type: 'try', roll: 0.5 });
    expect(first.running).toBe(true);
    expect(first.spin?.id).toBe(1);
    expect(first.spin?.pocketIndex).toBeGreaterThanOrEqual(0);
    expect(first.landed).toBeUndefined();
  });

  it('ignores TRY IT while a spin is running: nothing changes and no second spin starts', () => {
    const running = previewStep(IDLE_PREVIEW, { type: 'try', roll: 0.3 });
    expect(previewStep(running, { type: 'try', roll: 0.9 })).toBe(running);
    expect(previewStep(previewStep(running, { type: 'try', roll: 0.1 }), { type: 'try', roll: 0.7 })).toBe(running);
  });

  it('is free again once the wheel has stopped, and shows where it landed', () => {
    const running = previewStep(IDLE_PREVIEW, { type: 'try', roll: 0.3 });
    const number = WHEEL_ORDER[running.spin?.pocketIndex ?? 0] ?? 0;
    const done = previewStep(running, { type: 'stopped', landedOn: number });
    expect(done.running).toBe(false);
    expect(done.landed).toEqual({ number, color: colorOfNumber(number) });
    const next = previewStep(done, { type: 'try', roll: 0.6 });
    expect(next.running).toBe(true);
    expect(next.spin?.id).toBe(2);
    expect(next.spin?.pocketIndex).not.toBe(running.spin?.pocketIndex);
    expect(next.landed).toBeUndefined();
  });

  it('never sends anything anywhere: a state is all there is to it', () => {
    expect(Object.keys(IDLE_PREVIEW).sort()).toEqual(['landed', 'running', 'spin']);
  });
});

describe('the preview panel', () => {
  const panel = (state: PreviewState, motion: MotionLevel = 'full', animation: RouletteAnimationId = 'classic') =>
    renderToStaticMarkup(<PreviewPanel animation={animation} motion={motion} state={state} onTry={noop} onStopped={noop} />);

  it('waits to be asked: TRY IT is on, nothing spins, nothing has landed', () => {
    const html = panel(IDLE_PREVIEW);
    expect(html).toContain('>TRY IT<');
    expect(html).not.toMatch(/disabled=""[^>]*>TRY IT</);
    expect(html).toContain('PREVIEW ONLY. NO CHIPS ARE BET.');
    expect(html).not.toContain('LANDED ON');
    expect(html).not.toContain('wheel-burst');
  });

  it('switches TRY IT off, and says SPINNING, while the preview runs', () => {
    const html = panel({ spin: { id: 1, pocketIndex: 5 }, running: true, landed: undefined });
    expect(html).toMatch(/disabled=""[^>]*>SPINNING</);
    expect(html).not.toContain('>TRY IT<');
  });

  it('shows the number and colour it landed on, and is ready for another try', () => {
    const html = panel({ spin: { id: 1, pocketIndex: 5 }, running: false, landed: { number: 17, color: 'black' } });
    expect(html).toContain('LANDED ON');
    expect(html).toContain('aria-label="black 17"');
    expect(html).toContain('BLACK 17');
    expect(html).toContain('>TRY IT<');
  });

  it('is announced to screen readers when the result changes', () => {
    expect(panel(IDLE_PREVIEW)).toContain('role="status"');
  });

  it('follows the motion setting and says why nothing moves', () => {
    expect(panel(IDLE_PREVIEW, 'calm')).toContain('REDUCED MOTION IS ON');
    expect(panel(IDLE_PREVIEW, 'off')).toContain('ANIMATIONS ARE OFF');
    expect(panel(IDLE_PREVIEW, 'full')).toContain('THIS SPIN TAKES ABOUT 5.5 SECONDS.');
    expect(panel(IDLE_PREVIEW, 'full', 'slow')).toContain('ABOUT 9.0 SECONDS');
    expect(previewNote('full', '3.2')).toBe('THIS SPIN TAKES ABOUT 3.2 SECONDS.');
  });

  it('runs the style that is chosen', () => {
    for (const id of ROULETTE_ANIMATION_IDS) expect(panel(IDLE_PREVIEW, 'full', id), id).toContain(`data-animation="${id}"`);
  });

  it('uses a smaller wheel than the game\'s', () => {
    expect(panel(IDLE_PREVIEW)).toContain('rl-wheel--preview');
  });
});

describe('the animations tab', () => {
  const tab = (patch: Partial<Settings> = {}, motion: MotionLevel = 'full') =>
    renderToStaticMarkup(
      <MotionContext.Provider value={motion}>
        <AnimationsTab settings={settings(patch)} onChange={noop} />
      </MotionContext.Provider>,
    );

  it('offers one choice for each of the five styles, one in use', () => {
    const html = tab();
    expect(count(html, 'role="radio"')).toBe(5);
    expect(count(html, 'aria-checked="true"')).toBe(1);
    for (const name of ['CLASSIC SPIN', 'ARCADE SPIN', 'NEON SPIN', 'PIXEL EXPLOSION', 'SLOW MOTION']) expect(html).toContain(name);
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-label="Roulette animation"');
  });

  it('marks the style that is chosen', () => {
    for (const style of ROULETTE_ANIMATIONS) {
      const html = tab({ rouletteAnimation: style.id });
      expect(count(html, 'aria-checked="true"'), style.id).toBe(1);
      expect(html, style.id).toMatch(new RegExp(`aria-checked="true"[^>]*>(?:(?!<button).)*${style.name.toUpperCase()}`, 's'));
    }
  });

  it('describes each style and how long its spin takes', () => {
    const html = tab();
    for (const style of ROULETTE_ANIMATIONS) {
      expect(html).toContain(style.description);
      expect(html).toContain(`About ${(style.durationMs / 1000).toFixed(1)} seconds.`);
    }
  });

  it('shows a thumbnail on every choice', () => {
    const html = tab();
    expect(count(html, 'anim-thumb__canvas')).toBe(5);
  });

  it('chooses a style through onChange, one setting and nothing else', () => {
    const changes: unknown[] = [];
    const cards = findAll(AnimationsTab({ settings: settings(), onChange: (patch) => changes.push(patch) }), (element) => element.type === ChoiceCard);
    expect(cards).toHaveLength(5);
    for (const card of cards) (card.props['onSelect'] as () => void)();
    expect(changes).toEqual(ROULETTE_ANIMATION_IDS.map((id) => ({ rouletteAnimation: id })));
  });

  it('has a preview with TRY IT, and nothing plays by itself', () => {
    const html = tab();
    expect(html).toContain('anim-preview');
    expect(html).toContain('>TRY IT<');
    expect(html).toContain('PREVIEW ONLY. NO CHIPS ARE BET.');
    // The only burst on the screen is the frozen one on the explosion's thumbnail.
    expect(html.match(/class="wheel-burst[ "]/g)).toHaveLength(1);
    expect(count(html, 'wheel-burst--still')).toBe(1);
    expect(html).not.toContain('SPINNING');
  });

  it('runs the preview in the style that is in use', () => {
    for (const id of ROULETTE_ANIMATION_IDS) {
      const html = tab({ rouletteAnimation: id });
      const preview = html.slice(html.indexOf('anim-preview'));
      expect(preview, id).toContain(`data-animation="${id}"`);
    }
    expect(rouletteAnimation('slow').id).toBe('slow');
  });

  it('tells the player when motion is reduced', () => {
    expect(tab({}, 'calm')).toContain('REDUCED MOTION IS ON');
    expect(tab({}, 'off')).toContain('ANIMATIONS ARE OFF');
  });
});
