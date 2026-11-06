import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CARD_DESIGN_IDS, type CardDesignId } from '../../state/appearance';
import { deal, SPLIT, tableView } from '../../game/blackjack/testViews';
import { RANKS, SUITS, type Card, type Rank } from '../../game/blackjack/types';
import { CARD_GLYPHS } from '../art/cardSuits';
import { isRedSuit, SUIT_GLYPHS } from '../art/suits';
import { AppearanceProvider, DEFAULT_APPEARANCE } from '../customization/AppearanceContext';
import { BlackjackTable } from './BlackjackTable';
import { CardFan } from './CardFan';
import { CLASSIC_BASELINE } from './classicCard.fixture';
import { PlayingCard } from './PlayingCard';

const count = (haystack: string, needle: string): number => haystack.split(needle).length - 1;
const WORDS: Partial<Record<Rank, string>> = { A: 'ace', J: 'jack', Q: 'queen', K: 'king' };
const nameOf = (card: Card): string => `${WORDS[card.rank] ?? card.rank} of ${card.suit}`;
const ALL_CARDS: readonly Card[] = SUITS.flatMap((suit) => RANKS.map((rank) => ({ rank, suit })));
const withDesign = (design: CardDesignId, node: ReactNode) => (
  <AppearanceProvider value={{ ...DEFAULT_APPEARANCE, cardDesign: design }}>{node}</AppearanceProvider>
);
/** The markup of the card centre's suit alone: the first top-level sprite after the first index. */
const centreSprite = (html: string): string => /<svg class="pixel-sprite playing-card__suit".*?<\/svg>/.exec(html)?.[0] ?? '';

describe('every design draws every card', () => {
  it('has 52 cards to draw', () => {
    expect(ALL_CARDS).toHaveLength(52);
  });

  describe.each(CARD_DESIGN_IDS)('the %s design', (design) => {
    it('draws all 52 cards with the right name, rank in two corners, a centre suit and the design', () => {
      for (const card of ALL_CARDS) {
        const html = renderToStaticMarkup(<PlayingCard card={card} design={design} />);
        expect(html, nameOf(card)).toContain(`aria-label="${nameOf(card)}"`);
        expect(html, nameOf(card)).toContain(`data-design="${design}"`);
        expect(html).toContain('role="img"');
        expect(count(html, `<span class="playing-card__rank">${card.rank}</span>`), `${nameOf(card)} rank corners`).toBe(2);
        expect(count(html, '<span class="playing-card__index'), `${nameOf(card)} indexes`).toBe(2);
        expect(count(html, 'playing-card__suit'), `${nameOf(card)} centre suit`).toBe(1);
        expect(count(html, 'playing-card__mini'), `${nameOf(card)} corner suits`).toBe(2);
        expect(html.includes('playing-card--red'), `${nameOf(card)} red`).toBe(isRedSuit(card.suit));
      }
    });

    it('draws a face-down card with the same design and no rank', () => {
      const html = renderToStaticMarkup(<PlayingCard card={null} design={design} />);
      expect(html).toContain('playing-card--back');
      expect(html).toContain(`data-design="${design}"`);
      expect(html).toContain('aria-label="Face-down card"');
      expect(html).not.toContain('playing-card__rank');
      expect(html).not.toContain('playing-card--face');
    });

    it('tells the four suits apart by shape in the centre and in the corners, not by color alone', () => {
      const glyphs = CARD_GLYPHS[design];
      for (const part of ['centre', 'mini'] as const) {
        const shapes = SUITS.map((suit) => glyphs[part][suit].join('/'));
        expect(new Set(shapes).size, `${design} ${part} suits`).toBe(4);
      }
      const centres = SUITS.map((suit) => centreSprite(renderToStaticMarkup(<PlayingCard card={{ rank: 'A', suit }} design={design} />)));
      expect(new Set(centres).size).toBe(4);
    });

    it('is drawn from its own glyph set', () => {
      const html = renderToStaticMarkup(<PlayingCard card={{ rank: 'Q', suit: 'spades' }} design={design} />);
      const classic = renderToStaticMarkup(<PlayingCard card={{ rank: 'Q', suit: 'spades' }} design="classic" />);
      if (design === 'classic') expect(html).toBe(classic);
      else expect(html.replace(`data-design="${design}"`, '')).not.toBe(classic.replace('data-design="classic"', ''));
    });
  });
});

describe('which design a card uses', () => {
  const ace: Card = { rank: 'A', suit: 'spades' };

  it('is the classic one with no appearance provider at all', () => {
    expect(renderToStaticMarkup(<PlayingCard card={ace} />)).toContain('data-design="classic"');
    expect(renderToStaticMarkup(<PlayingCard card={null} />)).toContain('data-design="classic"');
  });

  it('follows the design the player chose, which the appearance context carries', () => {
    for (const design of CARD_DESIGN_IDS) {
      expect(renderToStaticMarkup(withDesign(design, <PlayingCard card={ace} />))).toContain(`data-design="${design}"`);
      expect(renderToStaticMarkup(withDesign(design, <PlayingCard card={null} />))).toContain(`data-design="${design}"`);
    }
  });

  it('is the one asked for when a preview asks, whatever is in use', () => {
    const html = renderToStaticMarkup(withDesign('neon', <PlayingCard card={ace} design="medieval" />));
    expect(html).toContain('data-design="medieval"');
    expect(html).not.toContain('data-design="neon"');
    expect(renderToStaticMarkup(withDesign('dark', <PlayingCard card={null} design="retro" />))).toContain('data-design="retro"');
  });

  it('can show a design next to the one in use on the same screen', () => {
    const html = renderToStaticMarkup(
      withDesign(
        'minimal',
        <>
          <PlayingCard card={ace} />
          <PlayingCard card={ace} design="dark" />
        </>,
      ),
    );
    expect([...html.matchAll(/data-design="(\w+)"/g)].map((match) => match[1])).toEqual(['minimal', 'dark']);
  });
});

describe('the classic design is exactly what it was before the designs existed', () => {
  const noDesign = (html: string): string => html.replace(' data-design="classic"', '');

  it('renders the same markup, class for class and pixel for pixel, apart from data-design', () => {
    expect(noDesign(renderToStaticMarkup(<PlayingCard card={{ rank: 'A', suit: 'spades' }} />))).toBe(CLASSIC_BASELINE.ace);
    expect(noDesign(renderToStaticMarkup(<PlayingCard card={{ rank: 'K', suit: 'hearts' }} dealDelayMs={360} />))).toBe(CLASSIC_BASELINE.king);
    expect(noDesign(renderToStaticMarkup(<PlayingCard card={{ rank: '10', suit: 'clubs' }} />))).toBe(CLASSIC_BASELINE.ten);
    expect(noDesign(renderToStaticMarkup(<PlayingCard card={{ rank: '7', suit: 'diamonds' }} />))).toBe(CLASSIC_BASELINE.dia);
    expect(noDesign(renderToStaticMarkup(<PlayingCard card={null} />))).toBe(CLASSIC_BASELINE.back);
  });

  it('is the same whether it is the default or is asked for', () => {
    const card: Card = { rank: 'Q', suit: 'diamonds' };
    expect(renderToStaticMarkup(<PlayingCard card={card} design="classic" />)).toBe(renderToStaticMarkup(<PlayingCard card={card} />));
    expect(renderToStaticMarkup(withDesign('classic', <PlayingCard card={card} />))).toBe(renderToStaticMarkup(<PlayingCard card={card} />));
  });

  it('draws its suits from the original art, untouched', () => {
    expect(CARD_GLYPHS.classic.mini).toBe(SUIT_GLYPHS);
    expect(CARD_GLYPHS.classic.centre).toBe(SUIT_GLYPHS);
  });

  it('puts no class on the card that the other designs would need: they are keyed off data-design alone', () => {
    for (const design of CARD_DESIGN_IDS) {
      const html = renderToStaticMarkup(<PlayingCard card={{ rank: 'A', suit: 'hearts' }} design={design} />);
      expect(/<div class="([^"]*)"/.exec(html)?.[1]).toBe('playing-card playing-card--face playing-card--red');
    }
  });
});

describe('the designs in a hand', () => {
  it.each(CARD_DESIGN_IDS)('draws a fan of cards, face down ones too, in the %s design', (design) => {
    const cards = [{ rank: 'K', suit: 'spades' }, null, { rank: '7', suit: 'diamonds' }] as const;
    const html = renderToStaticMarkup(withDesign(design, <CardFan cards={cards} owner="dealer" />));
    expect(count(html, `data-design="${design}"`)).toBe(3);
    expect(count(html, 'playing-card--back')).toBe(1);
    expect(html).toContain('--n:3');
  });

  it.each(CARD_DESIGN_IDS)('draws split hands, side by side, up to four, all in the %s design', (design) => {
    const two = tableView('8S 6H 8D 10C 3S 2H 9C', deal(100), SPLIT);
    const four = tableView('8S 6H 8D 10C 8H 8C 8S 8D 3S 2H 9C 5C 5D', deal(100), SPLIT, SPLIT, SPLIT);
    expect(two.hands).toHaveLength(2);
    expect(four.hands).toHaveLength(4);
    for (const view of [two, four]) {
      const html = renderToStaticMarkup(
        withDesign(
          design,
          <BlackjackTable dealerCards={view.dealer.cards} dealerTotal={null} hands={view.hands} showOutcomes={false} shake={false} />,
        ),
      );
      const total = view.dealer.cards.length + view.hands.reduce((sum, hand) => sum + hand.cards.length, 0);
      expect([...html.matchAll(/<div class="hand[ "]/g)], 'hands').toHaveLength(view.hands.length);
      expect(count(html, 'data-design='), 'cards').toBe(total);
      expect(count(html, `data-design="${design}"`), 'cards in the design').toBe(total);
    }
  });
});
