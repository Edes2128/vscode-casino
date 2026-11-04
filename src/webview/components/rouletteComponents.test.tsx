import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { IDLE_ROULETTE_VIEW } from '../../game/roulette/view';
import { rouletteView } from '../../game/roulette/testViews';
import { Roulette } from '../pages/Roulette';
import { ColorPicker } from './ColorPicker';
import { OutcomeBanner, OutcomeOverlay } from './ResultEffects';
import { PocketBadge } from './PocketBadge';
import { RouletteWheel } from './RouletteWheel';

const count = (haystack: string, needle: string): number => haystack.split(needle).length - 1;
const noop = (): void => undefined;

describe('PocketBadge', () => {
  it('shows the number in the pocket colour and says both to screen readers', () => {
    const green = renderToStaticMarkup(<PocketBadge pocket={{ number: 0, color: 'green' }} />);
    expect(green).toContain('pocket-badge--green');
    expect(green).toContain('aria-label="green 0"');
    expect(green).toContain('>0<');

    expect(renderToStaticMarkup(<PocketBadge pocket={{ number: 32, color: 'red' }} />)).toContain('pocket-badge--red');
    expect(renderToStaticMarkup(<PocketBadge pocket={{ number: 15, color: 'black' }} />)).toContain('pocket-badge--black');
  });

  it('can be large', () => {
    expect(renderToStaticMarkup(<PocketBadge pocket={{ number: 32, color: 'red' }} size="lg" />)).toContain('pocket-badge--lg');
  });
});

describe('ColorPicker', () => {
  it('offers exactly three bets, red, black and green, with what each pays', () => {
    const html = renderToStaticMarkup(<ColorPicker value={undefined} onChange={noop} />);
    expect(count(html, 'role="radio"')).toBe(3);
    for (const expected of ['RED', 'BLACK', 'GREEN', '>1 TO 1<', '>35 TO 1<']) expect(html).toContain(expected);
    expect(count(html, '>1 TO 1<')).toBe(2); // red and black
    expect(count(html, '>35 TO 1<')).toBe(1); // green
  });

  it('offers no other kind of roulette bet', () => {
    // What the player can read: the text, not the markup (whose class names are not bets).
    const words = renderToStaticMarkup(<ColorPicker value={undefined} onChange={noop} />)
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    expect(words).toBe('RED 1 TO 1 BLACK 1 TO 1 GREEN 35 TO 1');
    for (const forbidden of ['ODD', 'EVEN', 'DOZEN', 'COLUMN', 'HIGH', 'LOW', '1-18', '19-36', 'STRAIGHT', 'SPLIT']) {
      expect(words, forbidden).not.toContain(forbidden);
    }
  });

  it('marks only the chosen colour', () => {
    const html = renderToStaticMarkup(<ColorPicker value="black" onChange={noop} />);
    expect(count(html, 'aria-checked="true"')).toBe(1);
    expect(count(html, 'aria-checked="false"')).toBe(2);
    expect(html).toMatch(/color-pick--selected[^>]*aria-checked="true"|aria-checked="true"[^>]*color-pick--selected/);
    expect(html).toMatch(/aria-checked="true"[^>]*>(?:(?!<button).)*BLACK/s);
  });

  it('is a labelled group and can be switched off while the wheel turns', () => {
    const html = renderToStaticMarkup(<ColorPicker value="red" onChange={noop} disabled />);
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-label="Pick a color to bet on"');
    expect(count(html, 'disabled=""')).toBe(3);
  });
});

describe('RouletteWheel', () => {
  it('is a labelled 64 by 64 pixel canvas with a pointer', () => {
    const html = renderToStaticMarkup(<RouletteWheel spin={undefined} motion="full" onStopped={noop} />);
    expect(html).toContain('<canvas');
    expect(html).toContain('width="64"');
    expect(html).toContain('height="64"');
    expect(html).toContain('aria-label="Roulette wheel"');
    expect(html).toContain('rl-wheel__pointer');
  });
});

describe('OutcomeBanner and OutcomeOverlay', () => {
  it('shows kind, title, amount and detail, and is announced', () => {
    const html = renderToStaticMarkup(<OutcomeBanner kind="win" title="YOU WIN" amount="+100" detail="Red 32. You bet red." />);
    expect(html).toContain('result-banner--win');
    expect(html).toContain('YOU WIN');
    expect(html).toContain('+100');
    expect(html).toContain('Red 32. You bet red.');
    expect(html).toContain('role="status"');
  });

  it('throws confetti for a win, more for a special result, none for a loss', () => {
    const dots = (kind: 'win' | 'special' | 'loss' | 'push') => count(renderToStaticMarkup(<OutcomeOverlay kind={kind} />), 'fx-burst__dot');
    expect(dots('win')).toBe(28);
    expect(dots('special')).toBe(56);
    expect(dots('loss')).toBe(0);
    expect(dots('push')).toBe(0);
  });
});

describe('the Roulette page', () => {
  const page = (view: Parameters<typeof Roulette>[0]['view'], balance: number | undefined = 1_000) =>
    renderToStaticMarkup(
      <Roulette view={view} balance={balance} rejection={undefined} onAction={noop} onBack={noop} onOpenSettings={noop} onShown={noop} />,
    );

  it('waits for the host before it shows a table', () => {
    const html = page(undefined);
    expect(html).toContain('CONNECTING');
    expect(html).not.toContain('rl-stage');
  });

  it('shows the wheel, the three bets and the bet controls before any spin', () => {
    const html = page(IDLE_ROULETTE_VIEW);
    expect(html).toContain('NO SPINS YET');
    expect(html).toContain('<canvas');
    expect(count(html, 'role="radio"')).toBe(3);
    expect(html).toContain('aria-label="Bet amount in chips"');
    expect(html).toContain('RED AND BLACK PAY 1 TO 1. GREEN PAYS 35 TO 1.');
    expect(html).toContain('RECENT RESULTS APPEAR HERE');
    expect(html).toContain('&lt; LOBBY');
  });

  it('asks for a colour first: SPIN stays off until one is picked', () => {
    const html = page(IDLE_ROULETTE_VIEW);
    expect(html).toMatch(/disabled=""[^>]*>PICK A COLOR</);
    expect(html).not.toContain('>SPIN<');
  });

  it('shows the last result and the recent ones when the screen opens on a spin that already happened, without replaying it', () => {
    const html = page(rouletteView([17, 0, 32], ['red', 10], ['red', 10], ['red', 10]));
    expect(html).toContain('LAST');
    expect(html).toContain('RED 32');
    expect(count(html, 'class="pocket-badge')).toBe(4); // the "last" badge and three recent results
    expect(html).not.toContain('result-banner'); // not a live result, so no banner or confetti
    expect(html).not.toContain('result-fx');
    expect(html).not.toContain('NO SPINS YET');
  });

  it('lists the recent results newest first', () => {
    const html = page(rouletteView([5, 6, 7], ['red', 10], ['red', 10], ['red', 10]));
    const order = [...html.matchAll(/class="rl-recent"[\s\S]*?<\/div>/g)][0]?.[0] ?? '';
    expect([...order.matchAll(/aria-label="(?:red|black|green) (\d+)"/g)].map((match) => match[1])).toEqual(['7', '6', '5']);
  });

  it('shows the bet and the chips left', () => {
    const html = page(IDLE_ROULETTE_VIEW, 750);
    expect(html).toMatch(/BET <b>25<\/b>/);
    expect(html).toMatch(/CHIPS <b>750<\/b>/);
  });

  it('says so, instead of offering a bet, when the player is out of chips', () => {
    const html = page(IDLE_ROULETTE_VIEW, 5);
    expect(html).toContain('OUT OF CHIPS');
    expect(html).not.toContain('role="radio"');
    expect(html).not.toContain('bet-controls');
  });
});
