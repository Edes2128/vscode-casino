import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createInitialSnapshot } from '../../state/snapshot';
import { sampleHistory, sampleSnapshot } from '../dev/sampleSnapshot';
import { Statistics } from '../pages/Statistics';
import { BalanceDisplay } from './BalanceDisplay';
import { GameCard } from './GameCard';
import { GameHistory } from './GameHistory';
import { NavBar } from './NavBar';
import { PixelButton } from './PixelButton';
import { PixelCard } from './PixelCard';
import { PixelChip } from './PixelChip';
import { RESULT_BAR_BLOCKS, ResultBar } from './ResultBar';
import { SegmentedControl } from './SegmentedControl';
import { StatTile } from './StatTile';

const count = (haystack: string, needle: string): number => haystack.split(needle).length - 1;
const noop = (): void => undefined;

describe('PixelButton', () => {
  it('renders variant, size and block classes on a non-submitting button', () => {
    const html = renderToStaticMarkup(
      <PixelButton variant="gold" size="lg" block>
        PLAY
      </PixelButton>,
    );
    expect(html).toContain('px-button--gold');
    expect(html).toContain('px-button--lg');
    expect(html).toContain('px-button--block');
    expect(html).toContain('type="button"');
    expect(html).toContain('PLAY');
  });

  it('defaults to a medium primary button and passes native attributes through', () => {
    const html = renderToStaticMarkup(<PixelButton disabled>GO</PixelButton>);
    expect(html).toContain('px-button--primary');
    expect(html).toContain('px-button--md');
    expect(html).toContain('disabled');
  });
});

describe('PixelChip', () => {
  it('is a labelled image when it is only decoration', () => {
    const html = renderToStaticMarkup(<PixelChip value={25} />);
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="25 chip"');
    expect(html).not.toContain('<button');
    expect(html).toContain('>25<');
  });

  it('is a toggle button when it can be selected', () => {
    const html = renderToStaticMarkup(<PixelChip value={100} selected onSelect={noop} />);
    expect(html).toContain('<button');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('px-chip--selected');
    expect(html).toContain('px-chip--v100');
  });

  it('prints no value on the small size', () => {
    expect(renderToStaticMarkup(<PixelChip value={500} size="sm" />)).not.toContain('>500<');
  });
});

describe('BalanceDisplay', () => {
  it('shows a grouped balance with an accessible label', () => {
    const html = renderToStaticMarkup(<BalanceDisplay balance={1725} />);
    expect(html).toContain('1,725');
    expect(html).toContain('aria-label="Balance: 1,725 chips"');
  });

  it('steps the large size down as the number gets longer so it never has to wrap', () => {
    const size = (balance: number) => renderToStaticMarkup(<BalanceDisplay balance={balance} size="lg" />);
    // "9,999" is 5 characters, "12,500" and "125,000" are 6 and 7, "1,234,567" is 9.
    expect(size(1_000)).toContain('balance--short');
    expect(size(9_999)).toContain('balance--short');
    expect(size(12_500)).toContain('balance--medium');
    expect(size(125_000)).toContain('balance--medium');
    expect(size(1_234_567)).toContain('balance--long');
    expect(size(1_234_567)).not.toContain('balance--short');
  });

  it('shows dashes until the host has answered', () => {
    expect(renderToStaticMarkup(<BalanceDisplay balance={undefined} />)).toContain('---');
  });
});

describe('PixelCard', () => {
  it('names its section after its title', () => {
    const html = renderToStaticMarkup(<PixelCard title="YOUR CHIPS">x</PixelCard>);
    expect(html).toContain('aria-labelledby');
    expect(html).toContain('YOUR CHIPS');
  });

  it('has no label without a title', () => {
    expect(renderToStaticMarkup(<PixelCard>x</PixelCard>)).not.toContain('aria-labelledby');
  });
});

describe('StatTile', () => {
  it('formats its value and carries its tone', () => {
    const html = renderToStaticMarkup(<StatTile label="WINS" value={1200} tone="win" />);
    expect(html).toContain('WINS');
    expect(html).toContain('1,200');
    expect(html).toContain('stat-tile--win');
  });
});

describe('NavBar', () => {
  it('marks only the current page', () => {
    const html = renderToStaticMarkup(<NavBar current="roulette" onNavigate={noop} />);
    expect(count(html, 'aria-current="page"')).toBe(1);
    expect(html).toMatch(/aria-current="page"[^>]*>(?:(?!<button).)*ROULETTE/s);
    for (const label of ['HOME', 'BLACKJACK', 'ROULETTE', 'STATS']) expect(html).toContain(label);
  });
});

describe('SegmentedControl', () => {
  it('is a labelled group with exactly one pressed option', () => {
    const html = renderToStaticMarkup(
      <SegmentedControl
        label="Statistics for"
        options={[
          { value: 'a', label: 'ALL' },
          { value: 'b', label: 'BLACKJACK' },
        ]}
        value="b"
        onChange={noop}
      />,
    );
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Statistics for"');
    expect(count(html, 'aria-pressed="true"')).toBe(1);
    expect(count(html, 'aria-pressed="false"')).toBe(1);
    expect(html).toMatch(/aria-pressed="true"[^>]*>BLACKJACK</);
  });
});

describe('ResultBar', () => {
  const blocks = (html: string, kind: string): number => count(html, `result-bar__block--${kind}"`);

  it('is an empty bar, with an honest label, before any game', () => {
    const html = renderToStaticMarkup(<ResultBar stats={createInitialSnapshot().stats.overall} />);
    expect(blocks(html, 'empty')).toBe(RESULT_BAR_BLOCKS);
    expect(blocks(html, 'win') + blocks(html, 'loss') + blocks(html, 'push')).toBe(0);
    expect(html).toContain('aria-label="No games played yet"');
  });

  it('splits the bar by results and describes them', () => {
    const html = renderToStaticMarkup(<ResultBar stats={sampleSnapshot.stats.overall} />); // 6 / 5 / 1
    expect(blocks(html, 'empty')).toBe(0);
    expect(blocks(html, 'win') + blocks(html, 'loss') + blocks(html, 'push')).toBe(RESULT_BAR_BLOCKS);
    expect(blocks(html, 'win')).toBe(10);
    expect(blocks(html, 'loss')).toBe(8);
    expect(blocks(html, 'push')).toBe(2);
    expect(html).toContain('aria-label="Results: 6 wins, 5 losses, 1 push"');
  });

  it('uses the singular for a single result', () => {
    const stats = { ...createInitialSnapshot().stats.overall, gamesPlayed: 3, wins: 1, losses: 1, pushes: 1 };
    expect(renderToStaticMarkup(<ResultBar stats={stats} />)).toContain('Results: 1 win, 1 loss, 1 push');
  });
});

describe('Statistics screen', () => {
  it('shows every required statistic for the whole game', () => {
    const html = renderToStaticMarkup(<Statistics snapshot={sampleSnapshot} />);
    for (const expected of [
      'STATISTICS',
      'WHOLE GAME',
      'CURRENT BALANCE',
      '1,725',
      'GAMES PLAYED',
      'WINS',
      'LOSSES',
      'PUSHES',
      'WIN RATE',
      '50.0%',
      'BIGGEST WIN',
      '+350',
      'BIGGEST LOSS',
      '-100',
      'CHIPS WAGERED',
      '1,835',
    ]) {
      expect(html, expected).toContain(expected);
    }
  });

  it('offers the whole game, Blackjack and Roulette, starting on the whole game', () => {
    const html = renderToStaticMarkup(<Statistics snapshot={sampleSnapshot} />);
    expect(html).toMatch(/aria-pressed="true"[^>]*>ALL</);
    expect(html).toContain('>BLACKJACK<');
    expect(html).toContain('>ROULETTE<');
  });

  it('lists the history with game, result, bet, payout and time', () => {
    const html = renderToStaticMarkup(<Statistics snapshot={sampleSnapshot} />);
    expect(html).toContain('GAME HISTORY');
    expect(count(html, '<li')).toBe(sampleHistory.length);
    for (const expected of ['Blackjack!', 'Bust with 24', 'Red 23', 'BET 500', '+150', '-50']) {
      expect(html, expected).toContain(expected);
    }
    expect(html).toContain('<time');
  });

  it('is honest about a brand-new game: zeros, an empty bar and an empty history', () => {
    const html = renderToStaticMarkup(<Statistics snapshot={createInitialSnapshot()} />);
    expect(html).toContain('1,000');
    expect(html).toContain('0.0%');
    expect(html).toContain('No games played yet');
    expect(html).toContain('NO GAMES YET');
    expect(html).not.toContain('NaN');
  });
});

describe('GameCard', () => {
  it('has a descriptive play button and a decorative illustration', () => {
    const html = renderToStaticMarkup(
      <GameCard title="BLACKJACK" tagline="Beat the dealer." tone="felt" art={<i>art</i>} onPlay={noop} />,
    );
    expect(html).toContain('aria-label="Play BLACKJACK"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('Beat the dealer.');
  });
});

describe('GameHistory', () => {
  it('invites the player to sit down when nothing has been played', () => {
    expect(renderToStaticMarkup(<GameHistory entries={[]} />)).toContain('NO GAMES YET');
  });

  it('lists game, outcome, signed payout, detail and bet for each round', () => {
    const html = renderToStaticMarkup(<GameHistory entries={sampleHistory} />);
    expect(count(html, '<li')).toBe(sampleHistory.length);
    for (const expected of ['ROULETTE', 'BLACKJACK', 'WIN', 'LOSS', 'PUSH', '+100', '-50', 'Red 23', 'BET 500']) {
      expect(html).toContain(expected);
    }
    expect(html).toContain('history__row--win');
    expect(html).toContain('history__row--loss');
    expect(html).toContain('history__row--push');
  });

  it('can be limited to the most recent rounds', () => {
    const html = renderToStaticMarkup(<GameHistory entries={sampleHistory} limit={2} />);
    expect(count(html, '<li')).toBe(2);
    expect(html).toContain('Red 23');
    expect(html).not.toContain('Push on 19');
  });
});
