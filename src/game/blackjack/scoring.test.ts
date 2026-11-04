import { describe, expect, it } from 'vitest';
import { createDeck, createShuffledDeck } from './deck';
import { isBlackjack, isBust, isPair, scoreHand } from './scoring';
import { cards } from './testing';
import { seededRng } from '../rng';

const score = (spec: string) => scoreHand(cards(spec));

describe('scoreHand', () => {
  it('counts number cards at face value and face cards at 10', () => {
    expect(score('2S 3H')).toEqual({ total: 5, soft: false });
    expect(score('9S 10H')).toEqual({ total: 19, soft: false });
    expect(score('KS QH')).toEqual({ total: 20, soft: false });
    expect(score('JS 5D 6C')).toEqual({ total: 21, soft: false });
  });

  describe('aces (1 or 11)', () => {
    it('counts an ace as 11 when that does not bust', () => {
      expect(score('AS 5H')).toEqual({ total: 16, soft: true });
      expect(score('AS KH')).toEqual({ total: 21, soft: true });
      expect(score('AS 9H')).toEqual({ total: 20, soft: true });
    });

    it('counts an ace as 1 when 11 would bust, making the hand hard', () => {
      expect(score('AS 5H 10D')).toEqual({ total: 16, soft: false });
      expect(score('AS 9H 9D')).toEqual({ total: 19, soft: false });
      expect(score('AS KH 5D')).toEqual({ total: 16, soft: false });
    });

    it('demotes only as many aces as needed', () => {
      expect(score('AS AH')).toEqual({ total: 12, soft: true });
      expect(score('AS AH 9D')).toEqual({ total: 21, soft: true });
      expect(score('AS AH AD')).toEqual({ total: 13, soft: true });
      expect(score('AS AH AD AC')).toEqual({ total: 14, soft: true });
      expect(score('AS AH 10D')).toEqual({ total: 12, soft: false });
      expect(score('AS AH 9D 10C')).toEqual({ total: 21, soft: false });
    });

    it('lets a soft hand take a card without busting', () => {
      expect(score('AS 6H 4D')).toEqual({ total: 21, soft: true });
      expect(score('AS 6H 5D')).toEqual({ total: 12, soft: false });
    });
  });

  it('reports the lowest total when the hand has busted', () => {
    expect(score('KS QH 2D')).toEqual({ total: 22, soft: false });
    expect(score('10S 6H KD')).toEqual({ total: 26, soft: false });
  });

  it('scores an empty hand as 0', () => {
    expect(scoreHand([])).toEqual({ total: 0, soft: false });
  });
});

describe('isBlackjack', () => {
  it('is an ace and a ten-value card', () => {
    for (const hand of ['AS KH', 'AS QH', 'AS JH', 'AS 10H', 'KH AS']) {
      expect(isBlackjack(cards(hand)), hand).toBe(true);
    }
  });

  it('is not a three-card 21 or any other two-card total', () => {
    expect(isBlackjack(cards('7S 7H 7D'))).toBe(false);
    expect(isBlackjack(cards('AS 5H 5D'))).toBe(false);
    expect(isBlackjack(cards('KS QH'))).toBe(false);
    expect(isBlackjack(cards('AS 9H'))).toBe(false);
    expect(isBlackjack(cards('AS AH'))).toBe(false);
  });
});

describe('isBust', () => {
  it('is a total over 21 only', () => {
    expect(isBust(cards('KS QH 2D'))).toBe(true);
    expect(isBust(cards('KS QH AD'))).toBe(false); // 21: the ace counts as 1
    expect(isBust(cards('10S 6H 5D'))).toBe(false);
    expect(isBust(cards('10S 6H 6D'))).toBe(true);
  });
});

describe('isPair', () => {
  it('is two cards of the same rank, whatever the suits', () => {
    expect(isPair(cards('8S 8D'))).toBe(true);
    expect(isPair(cards('AS AH'))).toBe(true);
    expect(isPair(cards('KS KH'))).toBe(true);
  });

  it('is not two different ranks, even with the same value', () => {
    expect(isPair(cards('10S KD'))).toBe(false);
    expect(isPair(cards('QS JD'))).toBe(false);
    expect(isPair(cards('8S 9D'))).toBe(false);
  });

  it('is not a hand of three cards', () => {
    expect(isPair(cards('8S 8D 8H'))).toBe(false);
  });
});

describe('the deck', () => {
  it('has 52 distinct cards: 13 per suit, 4 per rank', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map((card) => `${card.rank}${card.suit}`)).size).toBe(52);
    for (const suit of ['spades', 'hearts', 'diamonds', 'clubs']) {
      expect(deck.filter((card) => card.suit === suit)).toHaveLength(13);
    }
    for (const rank of ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']) {
      expect(deck.filter((card) => card.rank === rank)).toHaveLength(4);
    }
  });

  it('is worth 380 points: four suits of A(11) + 2..10 + three tens', () => {
    const total = createDeck().reduce((sum, card) => sum + scoreHand([card]).total, 0);
    expect(total).toBe(4 * (11 + (2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10) + 30));
  });

  it('shuffles into the same 52 cards in a different order, repeatably per seed', () => {
    const ordered = createDeck();
    const first = createShuffledDeck(seededRng(11));
    expect(first).toHaveLength(52);
    expect(new Set(first.map((card) => `${card.rank}${card.suit}`)).size).toBe(52);
    expect(first).not.toEqual(ordered);
    expect(createShuffledDeck(seededRng(11))).toEqual(first);
    expect(createShuffledDeck(seededRng(12))).not.toEqual(first);
  });
});

describe('cards() test helper', () => {
  it('parses ranks and suit letters, and rejects nonsense', () => {
    expect(cards('10D')).toEqual([{ rank: '10', suit: 'diamonds' }]);
    expect(cards('  AS   KH ')).toEqual([
      { rank: 'A', suit: 'spades' },
      { rank: 'K', suit: 'hearts' },
    ]);
    expect(() => cards('1S')).toThrow('Bad card');
    expect(() => cards('AX')).toThrow('Bad card');
  });
});
