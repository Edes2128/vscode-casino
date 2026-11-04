import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../casino/settings';
import { IDLE_VIEW } from '../../game/blackjack/view';
import { IDLE_ROULETTE_VIEW } from '../../game/roulette/view';
import { NAV_ITEMS } from '../navigation';
import { Blackjack } from '../pages/Blackjack';
import { Roulette } from '../pages/Roulette';
import { Settings } from '../pages/Settings';
import { NavBar } from './NavBar';
import { OutOfChips } from './OutOfChips';
import { Toggle } from './Toggle';
import { VolumeSlider } from './VolumeSlider';

const noop = (): void => undefined;
const count = (haystack: string, needle: string): number => haystack.split(needle).length - 1;

describe('Toggle', () => {
  it('is a switch that says whether it is on', () => {
    const on = renderToStaticMarkup(<Toggle label="Sound effects" checked onChange={noop} />);
    expect(on).toContain('role="switch"');
    expect(on).toContain('aria-checked="true"');
    expect(on).toContain('aria-label="Sound effects"');
    expect(on).toContain('px-toggle--on');
    expect(on).toContain('>ON<');

    const off = renderToStaticMarkup(<Toggle label="Sound effects" checked={false} onChange={noop} />);
    expect(off).toContain('aria-checked="false"');
    expect(off).not.toContain('px-toggle--on');
    expect(off).toContain('>OFF<');
  });

  it('makes no click sound of its own only when told to be silent', () => {
    expect(renderToStaticMarkup(<Toggle label="x" checked onChange={noop} silent />)).toContain('data-sound="none"');
    expect(renderToStaticMarkup(<Toggle label="x" checked onChange={noop} />)).not.toContain('data-sound');
  });

  it('can be disabled and never submits a form', () => {
    const html = renderToStaticMarkup(<Toggle label="x" checked={false} onChange={noop} disabled />);
    expect(html).toContain('disabled=""');
    expect(html).toContain('type="button"');
  });
});

describe('VolumeSlider', () => {
  it('is a labelled slider from 0 to 100 in steps of 5, showing its value', () => {
    const html = renderToStaticMarkup(<VolumeSlider volume={40} onChange={noop} />);
    expect(html).toContain('type="range"');
    expect(html).toContain('min="0"');
    expect(html).toContain('max="100"');
    expect(html).toContain('step="5"');
    expect(html).toContain('value="40"');
    expect(html).toContain('aria-label="Volume"');
    expect(html).toContain('aria-valuetext="40%"');
    expect(html).toContain('>40%<');
    expect(html).toContain('--fill:40%');
  });

  it('can be disabled', () => {
    expect(renderToStaticMarkup(<VolumeSlider volume={0} onChange={noop} disabled />)).toContain('disabled=""');
  });
});

describe('the navigation bar', () => {
  it('has a settings tab, last, and one button per screen', () => {
    expect(NAV_ITEMS.map((item) => item.page)).toEqual(['home', 'blackjack', 'roulette', 'statistics', 'settings']);
    const html = renderToStaticMarkup(<NavBar current="settings" onNavigate={noop} />);
    expect(count(html, 'nav-bar__item"')).toBe(5);
    expect(html).toMatch(/aria-current="page"[^>]*>(?:(?!<button).)*SETTINGS/s);
  });
});

const baseProps = {
  settings: DEFAULT_SETTINGS,
  version: '0.1.0',
  motion: 'full' as const,
  systemReducedMotion: false,
  resetResult: undefined,
  onChange: noop,
  onReset: noop,
  onSupport: noop,
};

describe('the settings screen', () => {
  it('has a sound, a motion, a data and an about section', () => {
    const html = renderToStaticMarkup(<Settings {...baseProps} />);
    for (const title of ['SOUND', 'MOTION', 'YOUR DATA', 'ABOUT']) expect(html).toContain(`>${title}</h2>`);
    expect(html).toContain('SETTINGS</h1>');
  });

  it('shows each setting as it is saved', () => {
    const html = renderToStaticMarkup(
      <Settings {...baseProps} settings={{ sound: false, volume: 85, animations: false, reducedMotion: true }} />,
    );
    expect(html).toContain('aria-label="Sound effects"');
    expect(html).toMatch(/aria-checked="false"[^>]*aria-label="Sound effects"/);
    expect(html).toMatch(/aria-checked="false"[^>]*aria-label="Animations"/);
    expect(html).toMatch(/aria-checked="true"[^>]*aria-label="Reduced motion"/);
    expect(html).toContain('value="85"');
  });

  it('greys out the volume and the test while sound is off, and the test at volume 0', () => {
    const off = renderToStaticMarkup(<Settings {...baseProps} settings={{ ...DEFAULT_SETTINGS, sound: false }} />);
    expect(off).toMatch(/<input[^>]*disabled=""[^>]*aria-label="Volume"|<input[^>]*aria-label="Volume"[^>]*disabled=""/);
    expect(off).toMatch(/disabled=""[^>]*>TEST SOUND/);
    expect(off).toContain('Sound is off.');

    const silent = renderToStaticMarkup(<Settings {...baseProps} settings={{ ...DEFAULT_SETTINGS, volume: 0 }} />);
    expect(silent).toMatch(/disabled=""[^>]*>TEST SOUND/);

    const on = renderToStaticMarkup(<Settings {...baseProps} />);
    expect(on).not.toMatch(/disabled=""[^>]*>TEST SOUND/);
  });

  it('keeps only the sound switch silent: it answers itself, every other switch clicks', () => {
    const html = renderToStaticMarkup(<Settings {...baseProps} />);
    expect(html).toMatch(/data-sound="none"[^>]*class="px-toggle[^"]*"|aria-label="Sound effects"[^>]*data-sound="none"|data-sound="none"[^>]*aria-label="Sound effects"/);
    expect(count(html, 'data-sound="none"')).toBe(1);
    expect(html).toMatch(/<button[^>]*aria-label="Sound effects"[^>]*data-sound="none"/);
    expect(html).not.toMatch(/<button[^>]*aria-label="Animations"[^>]*data-sound/);
    expect(html).not.toMatch(/<button[^>]*aria-label="Reduced motion"[^>]*data-sound/);
  });

  it('offers the three resets, each saying what it touches, and promises a confirmation', () => {
    const html = renderToStaticMarkup(<Settings {...baseProps} />);
    for (const label of ['RESET BALANCE', 'RESET STATISTICS', 'RESET ALL']) expect(html).toContain(label);
    expect(html).toContain('EVERY RESET ASKS YOU TO CONFIRM FIRST');
    expect(html).toContain('Back to 1,000 chips. Statistics are kept.');
    expect(html).toContain('Settings are kept.');
    expect(html).toContain('px-button--danger');
  });

  it('says it is waiting when a reset is being confirmed, and never starts a second one', () => {
    // The waiting state is set by a click, which static markup cannot do; the idle screen must at least be enabled.
    const html = renderToStaticMarkup(<Settings {...baseProps} />);
    expect(html).not.toContain('WAITING FOR YOU');
    expect(count(html, 'RESET')).toBeGreaterThanOrEqual(3);
  });

  it('forces reduced motion on, and says why, when the system asks for it', () => {
    const html = renderToStaticMarkup(<Settings {...baseProps} motion="calm" systemReducedMotion />);
    expect(html).toMatch(/aria-checked="true"[^>]*disabled=""[^>]*aria-label="Reduced motion"|aria-checked="true"[^>]*aria-label="Reduced motion"[^>]*disabled=""|disabled=""[^>]*aria-checked="true"[^>]*aria-label="Reduced motion"/);
    expect(html).toContain('YOUR SYSTEM ASKS FOR REDUCED MOTION');
  });

  it('says in words what the casino is doing with motion', () => {
    expect(renderToStaticMarkup(<Settings {...baseProps} motion="full" />)).toContain('FULL ANIMATION');
    expect(renderToStaticMarkup(<Settings {...baseProps} motion="calm" />)).toContain('CALM: STEP BY STEP, NO MOVEMENT');
    expect(renderToStaticMarkup(<Settings {...baseProps} motion="off" />)).toContain('ANIMATION OFF: RESULTS AT ONCE');
  });

  it('shows the version, the virtual-chips promise and the support button', () => {
    const html = renderToStaticMarkup(<Settings {...baseProps} version="1.2.3" />);
    expect(html).toContain('VERSION 1.2.3');
    expect(html).toContain('VIRTUAL CHIPS ONLY. NO REAL MONEY. EVER.');
    expect(html).toContain('BUY ME CHIPS');
    expect(renderToStaticMarkup(<Settings {...baseProps} version={undefined} />)).toContain('VERSION ?');
  });
});

describe('running out of chips', () => {
  it('offers a button to the settings, where the balance can be reset', () => {
    const html = renderToStaticMarkup(<OutOfChips onOpenSettings={noop} />);
    expect(html).toContain('OUT OF CHIPS');
    expect(html).toContain('RESET YOUR BALANCE IN SETTINGS');
    expect(html).toContain('OPEN SETTINGS</button>');
  });

  it('replaces the bet controls on both game screens when the balance is under the minimum bet', () => {
    const roulette = renderToStaticMarkup(
      <Roulette view={IDLE_ROULETTE_VIEW} balance={5} rejection={undefined} onAction={noop} onBack={noop} onOpenSettings={noop} onShown={noop} />,
    );
    expect(roulette).toContain('OPEN SETTINGS</button>');
    expect(roulette).not.toContain('>SPIN<');
    expect(roulette).not.toContain('PICK A COLOR');

    const blackjack = renderToStaticMarkup(
      <Blackjack view={IDLE_VIEW} balance={5} rejection={undefined} onAction={noop} onBack={noop} onOpenSettings={noop} onShown={noop} />,
    );
    expect(blackjack).toContain('OPEN SETTINGS</button>');
    expect(blackjack).not.toContain('>DEAL<');
  });

  it('keeps the bet controls when there are enough chips', () => {
    const roulette = renderToStaticMarkup(
      <Roulette view={IDLE_ROULETTE_VIEW} balance={500} rejection={undefined} onAction={noop} onBack={noop} onOpenSettings={noop} onShown={noop} />,
    );
    expect(roulette).not.toContain('OPEN SETTINGS');
    expect(roulette).toContain('PICK A COLOR');
  });
});
