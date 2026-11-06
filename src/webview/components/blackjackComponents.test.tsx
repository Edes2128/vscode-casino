import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { cards } from '../../game/blackjack/testing';
import { deal, HIT, SPLIT, STAND, tableView } from '../../game/blackjack/testViews';
import { IDLE_VIEW } from '../../game/blackjack/view';
import { Blackjack } from '../pages/Blackjack';
import { ActionBar } from './ActionBar';
import { BetControls } from './BetControls';
import { BlackjackTable } from './BlackjackTable';
import { CardFan } from './CardFan';
import { PixelBurst } from './PixelBurst';
import { PlayingCard } from './PlayingCard';
import { ResultBanner, ResultOverlay } from './ResultEffects';

const count = (haystack: string, needle: string): number => haystack.split(needle).length - 1;
/** Counts whole elements of one class, not the `class__part` elements nested inside them. */
const elements = (html: string, tag: string, className: string): number =>
  [...html.matchAll(new RegExp(`<${tag} class="${className}[ "]`, 'g'))].length;
const noop = (): void => undefined;
const [ace, king, seven, ten] = cards('AS KH 7D 10C') as [never, never, never, never];

describe('PlayingCard', () => {
  it('shows the rank and the suit, and is described for screen readers', () => {
    const html = renderToStaticMarkup(<PlayingCard card={ace} />);
    expect(html).toContain('aria-label="ace of spades"');
    expect(html).toContain('playing-card--face');
    expect(count(html, '>A<')).toBe(2); // top-left and bottom-right
    expect(html).not.toContain('playing-card--red');
  });

  it('is red for hearts and diamonds and not for spades and clubs', () => {
    expect(renderToStaticMarkup(<PlayingCard card={king} />)).toContain('playing-card--red'); // hearts
    expect(renderToStaticMarkup(<PlayingCard card={seven} />)).toContain('playing-card--red'); // diamonds
    expect(renderToStaticMarkup(<PlayingCard card={ten} />)).not.toContain('playing-card--red'); // clubs
  });

  it('names face cards in words and shows 10 as 10', () => {
    expect(renderToStaticMarkup(<PlayingCard card={king} />)).toContain('king of hearts');
    expect(renderToStaticMarkup(<PlayingCard card={ten} />)).toContain('10 of clubs');
  });

  it('is a plain back with no rank when face down', () => {
    const html = renderToStaticMarkup(<PlayingCard card={null} />);
    expect(html).toContain('playing-card--back');
    expect(html).toContain('aria-label="Face-down card"');
    expect(html).not.toContain('playing-card__rank');
  });

  it('carries its deal delay', () => {
    expect(renderToStaticMarkup(<PlayingCard card={ace} dealDelayMs={360} />)).toContain('--deal-delay:360ms');
  });
});

describe('CardFan', () => {
  it('draws one card per entry, face-down ones included, and tells the CSS how many', () => {
    const html = renderToStaticMarkup(<CardFan cards={[ace, null, king]} owner="dealer" />);
    expect(elements(html, 'div', 'playing-card')).toBe(3);
    expect(count(html, 'playing-card--back')).toBe(1);
    expect(html).toContain('--n:3');
  });

  it('delays the opening cards so they arrive in turn: player, dealer, player, dealer', () => {
    const player = renderToStaticMarkup(<CardFan cards={[ace, king, seven]} owner="player" />);
    const dealer = renderToStaticMarkup(<CardFan cards={[ace, null, king]} owner="dealer" />);
    expect([...player.matchAll(/--deal-delay:(\d+)ms/g)].map((m) => m[1])).toEqual(['0', '360', '0']);
    expect([...dealer.matchAll(/--deal-delay:(\d+)ms/g)].map((m) => m[1])).toEqual(['180', '540', '0']);
  });
});

describe('ActionBar', () => {
  const all = { hit: true, stand: true, double: true, split: true };

  it('offers every move when all are allowed', () => {
    const html = renderToStaticMarkup(<ActionBar actions={all} disabled={false} onMove={noop} />);
    for (const label of ['HIT', 'STAND', 'DOUBLE', 'SPLIT']) expect(html).toContain(`>${label}<`);
    expect(count(html, 'disabled')).toBe(0);
  });

  it('disables exactly the moves the host does not allow', () => {
    const html = renderToStaticMarkup(
      <ActionBar actions={{ hit: true, stand: true, double: false, split: false }} disabled={false} onMove={noop} />,
    );
    expect(count(html, 'disabled=""')).toBe(2);
    expect(html).toMatch(/disabled=""[^>]*>DOUBLE</);
    expect(html).toMatch(/disabled=""[^>]*>SPLIT</);
  });

  it('disables everything while waiting for the host to answer', () => {
    const html = renderToStaticMarkup(<ActionBar actions={all} disabled onMove={noop} />);
    expect(count(html, 'disabled=""')).toBe(4);
  });
});

describe('BetControls', () => {
  it('shows all five chips, the amount, and how many chips the player has', () => {
    const html = renderToStaticMarkup(<BetControls balance={1_000} bet={125} onBetChange={noop} />);
    for (const value of [10, 25, 50, 100, 500]) expect(html).toContain(`aria-label="${value} chip"`);
    expect(html).toContain('value="125"');
    expect(html).toContain('YOU HAVE 1,000 CHIPS');
    expect(html).toContain('aria-invalid="false"');
  });

  it('turns off a chip the player cannot afford', () => {
    const html = renderToStaticMarkup(<BetControls balance={60} bet={0} onBetChange={noop} />);
    expect(html).toMatch(/aria-label="100 chip"[^>]*disabled=""|disabled=""[^>]*aria-label="100 chip"/);
    expect(html).not.toMatch(/aria-label="25 chip"[^>]*disabled=""|disabled=""[^>]*aria-label="25 chip"/);
  });

  it('explains a bet that is too big or too small', () => {
    expect(renderToStaticMarkup(<BetControls balance={100} bet={500} onBetChange={noop} />)).toContain('NOT ENOUGH CHIPS');
    expect(renderToStaticMarkup(<BetControls balance={100} bet={5} onBetChange={noop} />)).toContain('MIN BET IS 10');
    expect(renderToStaticMarkup(<BetControls balance={100} bet={500} onBetChange={noop} />)).toContain('aria-invalid="true"');
  });

  it('keeps CLEAR off for an empty bet and shows an empty box', () => {
    const html = renderToStaticMarkup(<BetControls balance={100} bet={0} onBetChange={noop} />);
    expect(html).toContain('value=""');
    expect(html).toMatch(/disabled=""[^>]*>CLEAR</);
  });

  it('turns everything off while a request is in flight', () => {
    const html = renderToStaticMarkup(<BetControls balance={1_000} bet={50} onBetChange={noop} disabled />);
    expect(html).toContain('disabled=""');
    expect(html.match(/<button/g)).toHaveLength(7); // five chips, CLEAR and MAX
    expect(html.match(/<button[^>]*>/g)?.every((tag) => tag.includes('disabled=""'))).toBe(true);
  });
});

describe('BlackjackTable', () => {
  const view = tableView('9S 6H 7D 10C 2S', deal(100));

  it('shows the dealer with the hole card face down and no total', () => {
    const html = renderToStaticMarkup(
      <BlackjackTable dealerCards={view.dealer.cards} dealerTotal={null} hands={view.hands} showOutcomes={false} shake={false} />,
    );
    expect(html).toContain('DEALER');
    expect(html).toContain('>?<');
    expect(count(html, 'playing-card--back')).toBe(1);
    expect(html).toContain('6 of hearts');
    expect(html).not.toContain('10 of clubs'); // the hole card
  });

  it('marks the hand being played and shows its total and bet', () => {
    const html = renderToStaticMarkup(
      <BlackjackTable dealerCards={view.dealer.cards} dealerTotal={null} hands={view.hands} showOutcomes={false} shake={false} />,
    );
    expect(html).toContain('hand--active');
    expect(html).toContain('>16<');
    expect(html).toContain('BET 100');
    expect(html).toContain('YOU');
    expect(html).not.toContain('hand__tag');
  });

  it('prints the table rules in the centre strip until a result replaces them', () => {
    const plain = renderToStaticMarkup(
      <BlackjackTable dealerCards={[]} dealerTotal={null} hands={[]} showOutcomes={false} shake={false} />,
    );
    expect(plain).toContain('BLACKJACK PAYS 3 TO 2');
    expect(plain).toContain('PLACE YOUR BET');

    const withBanner = renderToStaticMarkup(
      <BlackjackTable dealerCards={[]} dealerTotal={null} hands={[]} showOutcomes={false} shake={false} banner={<b>RESULT</b>} />,
    );
    expect(withBanner).toContain('RESULT');
    expect(withBanner).not.toContain('BLACKJACK PAYS 3 TO 2');
  });

  it('shows split hands side by side, each with its own bet', () => {
    const split = tableView('8S 6H 8D 10C 3S 2H 9C', deal(100), SPLIT);
    const html = renderToStaticMarkup(
      <BlackjackTable dealerCards={split.dealer.cards} dealerTotal={null} hands={split.hands} showOutcomes={false} shake={false} />,
    );
    expect(html).toContain('YOUR HANDS');
    expect(elements(html, 'div', 'hand')).toBe(2);
    expect(count(html, 'BET 100')).toBe(2);
    expect(count(html, 'hand--active')).toBe(1);
  });

  it('turns a busted total red', () => {
    const bust = tableView('10S 6H 6D 10C KS 5S', deal(100), HIT);
    const html = renderToStaticMarkup(
      <BlackjackTable dealerCards={bust.dealer.cards} dealerTotal={bust.dealer.total} hands={bust.hands} showOutcomes={false} shake={false} />,
    );
    expect(html).toContain('hand--over');
    expect(html).toContain('>BUST<');
  });

  it('shakes when the round was lost', () => {
    const html = renderToStaticMarkup(
      <BlackjackTable dealerCards={[]} dealerTotal={null} hands={[]} showOutcomes={false} shake />,
    );
    expect(html).toContain('bj-table--shake');
  });
});

describe('result effects', () => {
  const settled = (deck: string, ...actions: Parameters<typeof tableView>[1][]) => {
    const view = tableView(deck, deal(100), ...actions);
    if (view.result === undefined) throw new Error('round did not settle');
    return { result: view.result, hands: view.hands };
  };

  it('announces a win with the chips won and why', () => {
    const { result, hands } = settled('10S 7H 10D 10C', STAND);
    const html = renderToStaticMarkup(<ResultBanner result={result} hands={hands} />);
    expect(html).toContain('result-banner--win');
    expect(html).toContain('YOU WIN');
    expect(html).toContain('+100');
    expect(html).toContain('Win 20 vs 17');
    expect(html).toContain('role="status"');
  });

  it('announces a blackjack with 3:2', () => {
    const { result, hands } = settled('AS 9H KD 7C');
    const html = renderToStaticMarkup(<ResultBanner result={result} hands={hands} />);
    expect(html).toContain('result-banner--special');
    expect(html).toContain('BLACKJACK!');
    expect(html).toContain('+150');
  });

  it('calls a busted hand a BUST and shows the chips lost', () => {
    const { result, hands } = settled('10S 6H 6D 10C KS 5S', HIT);
    const html = renderToStaticMarkup(<ResultBanner result={result} hands={hands} />);
    expect(html).toContain('result-banner--loss');
    expect(html).toContain('>BUST<');
    expect(html).toContain('-100');
  });

  it('announces a push with the bet returned', () => {
    const { result, hands } = settled('10S 8H 8D 10C', STAND);
    const html = renderToStaticMarkup(<ResultBanner result={result} hands={hands} />);
    expect(html).toContain('PUSH');
    expect(html).toContain('BET RETURNED');
  });

  it('throws confetti for a win, more for a blackjack, and none for a loss or a push', () => {
    const dots = (deck: string, ...actions: Parameters<typeof tableView>[1][]) =>
      count(renderToStaticMarkup(<ResultOverlay result={settled(deck, ...actions).result} />), 'fx-burst__dot');
    expect(dots('10S 7H 10D 10C', STAND)).toBe(28);
    expect(dots('AS 9H KD 7C')).toBe(56);
    expect(dots('10S 6H 6D 10C KS 5S', HIT)).toBe(0);
    expect(dots('10S 8H 8D 10C', STAND)).toBe(0);
  });

  it('flashes the screen only for a blackjack, and hides all of it from screen readers', () => {
    const blackjack = renderToStaticMarkup(<ResultOverlay result={settled('AS 9H KD 7C').result} />);
    const win = renderToStaticMarkup(<ResultOverlay result={settled('10S 7H 10D 10C', STAND).result} />);
    expect(blackjack).toContain('result-fx__flash');
    expect(win).not.toContain('result-fx__flash');
    expect(blackjack).toContain('aria-hidden="true"');
  });

  it('PixelBurst draws the number of particles it is asked for', () => {
    expect(count(renderToStaticMarkup(<PixelBurst count={12} />), 'fx-burst__dot')).toBe(12);
  });
});

describe('the Blackjack page', () => {
  const page = (view: Parameters<typeof Blackjack>[0]['view'], balance: number | undefined = 1_000) =>
    renderToStaticMarkup(
      <Blackjack view={view} balance={balance} rejection={undefined} onAction={noop} onBack={noop} onOpenSettings={noop} onShown={noop} />,
    );

  it('waits for the host before it shows a table', () => {
    const html = page(undefined);
    expect(html).toContain('CONNECTING');
    expect(html).not.toContain('bj-table');
  });

  it('lets the player place a bet before the first deal', () => {
    const html = page(IDLE_VIEW);
    expect(html).toContain('PLACE YOUR BET');
    expect(html).toContain('>DEAL<');
    expect(html).toContain('aria-label="Bet amount in chips"');
    expect(html.match(/class="px-chip px-chip--/g)).toHaveLength(5);
    expect(html).not.toContain('action-bar');
    expect(html).toContain('&lt; LOBBY');
  });

  it('shows the moves, the bet in play and the chips left once cards are dealt', () => {
    const html = page(tableView('9S 6H 7D 10C 2S', deal(100)), 900);
    expect(html).toContain('action-bar');
    expect(html).not.toContain('>DEAL<');
    expect(html).toMatch(/BET <b>100<\/b>/);
    expect(html).toMatch(/CHIPS <b>900<\/b>/);
    expect(count(html, 'playing-card--back')).toBe(1);
  });

  it('shows the result, the hand outcome and NEW ROUND once a round has settled', () => {
    const html = page(tableView('10S 7H 10D 10C', deal(100), STAND), 1_100);
    expect(html).toContain('YOU WIN');
    expect(html).toContain('WIN +100');
    expect(html).toContain('>NEW ROUND<');
    expect(html).not.toContain('action-bar');
    expect(html).not.toContain('>DEAL<');
    expect(count(html, 'playing-card--back')).toBe(0); // the hole card is face up
  });

  it('says so, instead of offering a bet, when the player is out of chips', () => {
    const html = page(IDLE_VIEW, 5);
    expect(html).toContain('OUT OF CHIPS');
    expect(html).not.toContain('>DEAL<');
    expect(html).not.toContain('bet-controls');
  });

  it('shows the dealer total only once the hole card is face up', () => {
    const playing = page(tableView('9S 6H 7D 10C 2S', deal(100)));
    const settled = page(tableView('10S 7H 10D 10C', deal(100), STAND));
    expect(playing).toContain('>?<');
    expect(settled).toContain('>17<');
  });
});

