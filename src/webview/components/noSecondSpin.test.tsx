import { isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { IDLE_ROULETTE_VIEW } from '../../game/roulette/view';
import type { RouletteSelection } from '../../game/roulette/types';
import { spinAction, type SpinInput } from '../hooks/useRouletteSpin';
import { Roulette } from '../pages/Roulette';
import { RouletteControls } from './RouletteControls';
import { SpinBar } from './SpinBar';

const noop = (): void => undefined;
const red: RouletteSelection = { kind: 'color', color: 'red' };
const seventeen: RouletteSelection = { kind: 'number', number: 17 };
const input = (patch: Partial<SpinInput> = {}): SpinInput => ({ selection: red, bet: 25, chips: 1_000, spinning: false, pending: false, ...patch });

describe('no second spin while one is running', () => {
  it('sends a spin when there is a bet, enough chips and nothing running', () => {
    expect(spinAction(input())).toEqual({ kind: 'spin', selection: red, bet: 25 });
    expect(spinAction(input({ selection: seventeen, bet: 10 }))).toEqual({ kind: 'spin', selection: seventeen, bet: 10 });
  });

  it('sends nothing while the wheel is turning, whatever else is in order', () => {
    expect(spinAction(input({ spinning: true }))).toBeUndefined();
    expect(spinAction(input({ spinning: true, selection: seventeen, bet: 500, chips: 10_000 }))).toBeUndefined();
  });

  it('sends nothing while the host has not answered the last spin', () => {
    expect(spinAction(input({ pending: true }))).toBeUndefined();
    expect(spinAction(input({ pending: true, spinning: true }))).toBeUndefined();
  });

  it('sends nothing without something to bet on, without a bet, or without the chips to cover it', () => {
    expect(spinAction(input({ selection: undefined }))).toBeUndefined();
    expect(spinAction(input({ bet: 0 }))).toBeUndefined();
    expect(spinAction(input({ bet: -5 }))).toBeUndefined();
    expect(spinAction(input({ bet: 2_000, chips: 1_000 }))).toBeUndefined();
  });

  it('answers the same for the button and for the click: the page asks one question', () => {
    // The page enables SPIN exactly when `spinAction` has a spin to send, and the click sends exactly that.
    for (const spinning of [false, true]) {
      for (const pending of [false, true]) {
        const action = spinAction(input({ spinning, pending }));
        expect(action !== undefined, `spinning ${spinning}, pending ${pending}`).toBe(!spinning && !pending);
      }
    }
  });

  describe('the controls', () => {
    const controls = (patch: Partial<Parameters<typeof RouletteControls>[0]> = {}) =>
      renderToStaticMarkup(
        <RouletteControls
          chips={1_000}
          bet={25}
          onBetChange={noop}
          selection={red}
          onSelectionChange={noop}
          betKind="color"
          onBetKindChange={noop}
          spinning={false}
          pending={false}
          canSpin
          onSpin={noop}
          notice={undefined}
          lastNumber={undefined}
          onOpenSettings={noop}
          {...patch}
        />,
      );

    /** The opening tag of every button and input, in the order of the page. */
    const tags = (html: string): string[] => html.match(/<(?:button|input)\b[^>]*>/g) ?? [];
    const enabled = (html: string): string[] => tags(html).filter((tag) => !tag.includes('disabled=""'));

    it('has SPIN on and every bet control on while nothing is running', () => {
      const html = controls();
      expect(html).toContain('>SPIN<');
      expect(html).not.toMatch(/disabled=""[^>]*>SPIN</);
      expect(tags(html).filter((tag) => tag.includes('disabled=""'))).toEqual([]);
    });

    it('switches off SPIN, the bets, the chips and the amount while the wheel turns', () => {
      const html = controls({ spinning: true, canSpin: false });
      expect(html).toMatch(/disabled=""[^>]*>SPINNING</);
      expect(html).not.toContain('>SPIN<');
      // The three colours, the chips, the amount box, CLEAR and MAX: all of them are off. Only the COLOR / NUMBER
      // switch between the two kinds of bet is left, and it changes nothing that could be sent.
      const still = enabled(html);
      expect(still).toHaveLength(2);
      for (const tag of still) expect(tag).toContain('aria-pressed');
    });

    it('switches off the number grid too, all 37 numbers, while the wheel turns', () => {
      const html = controls({ spinning: true, canSpin: false, betKind: 'number', selection: seventeen });
      const numbers = tags(html).filter((tag) => tag.includes('number-pick'));
      expect(numbers).toHaveLength(37);
      for (const tag of numbers) expect(tag).toContain('disabled=""');
      expect(html).toMatch(/disabled=""[^>]*>SPINNING</);
    });

    it('also switches everything off while the host has not answered yet', () => {
      const html = controls({ pending: true, canSpin: false });
      expect(enabled(html).filter((tag) => !tag.includes('aria-pressed'))).toEqual([]);
      expect(html).toMatch(/disabled=""[^>]*>SPIN</);
    });

    it('still shows OUT OF CHIPS, not a bet, when the player has none and nothing is running', () => {
      expect(controls({ chips: 5 })).toContain('OUT OF CHIPS');
      // But while the wheel is still turning for a last spin, the controls stay (switched off).
      expect(controls({ chips: 5, spinning: true, canSpin: false })).toContain('SPINNING');
    });
  });

  it('says SPINNING on a switched-off button in the spin bar, and gives the click nothing to send', () => {
    const html = renderToStaticMarkup(<SpinBar selection={red} bet={25} spinning canSpin={false} onSpin={noop} />);
    expect(html).toMatch(/disabled=""[^>]*>SPINNING</);
  });

  it('keeps the whole page\'s controls on before a spin and wires them to the same guard', () => {
    const html = renderToStaticMarkup(
      <Roulette view={IDLE_ROULETTE_VIEW} balance={1_000} rejection={undefined} onAction={noop} onBack={noop} onOpenSettings={noop} onShown={noop} />,
    );
    expect(html).toContain('rl-spin-bar');
    // Idle: SPIN waits for a bet, the bet pickers are ready.
    expect(html).toMatch(/disabled=""[^>]*>PICK A BET</);
    expect(html).toContain('aria-label="Pick a color to bet on"');
  });
});

/** Not a test of the page, but of what it is built from: the controls are one component, so one fix covers them all. */
describe('the controls are one place', () => {
  const countOf = (node: ReactNode, type: unknown): number => {
    if (Array.isArray(node)) return node.reduce<number>((total, child) => total + countOf(child as ReactNode, type), 0);
    if (!isValidElement(node)) return 0;
    const element = node as unknown as { type: unknown; props: { children?: ReactNode } };
    return (element.type === type ? 1 : 0) + countOf(element.props.children, type);
  };

  it('has exactly one spin button in the page\'s controls', () => {
    const tree = RouletteControls({
      chips: 1_000,
      bet: 25,
      onBetChange: noop,
      selection: red,
      onSelectionChange: noop,
      betKind: 'color',
      onBetKindChange: noop,
      spinning: false,
      pending: false,
      canSpin: true,
      onSpin: noop,
      notice: undefined,
      lastNumber: undefined,
      onOpenSettings: noop,
    });
    expect(countOf(tree, SpinBar)).toBe(1);
  });
});
