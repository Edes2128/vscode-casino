import { describe, expect, it } from 'vitest';
import { dealerMustDraw, playDealer } from './dealer';
import { scoreHand } from './scoring';
import { cards } from './testing';

describe('dealer rules', () => {
  it('must draw on 16 or less', () => {
    for (const hand of ['10S 6H', '9S 7H', 'KS 2H', '2S 3H', '10S 5H']) {
      expect(dealerMustDraw(cards(hand)), hand).toBe(true);
    }
  });

  it('stands on hard 17 and above', () => {
    for (const hand of ['10S 7H', '10S 8H', '10S 9H', 'KS QH', '9S 8H']) {
      expect(dealerMustDraw(cards(hand)), hand).toBe(false);
    }
  });

  it('stands on soft 17 (the dealer stands on ALL 17s)', () => {
    expect(dealerMustDraw(cards('AS 6H'))).toBe(false);
    expect(dealerMustDraw(cards('AS 2H 4D'))).toBe(false); // soft 17 with three cards
    expect(dealerMustDraw(cards('AS AH 5D'))).toBe(false); // 11 + 1 + 5 = 17 soft
  });

  it('draws on soft 16 and below', () => {
    expect(dealerMustDraw(cards('AS 5H'))).toBe(true);
    expect(dealerMustDraw(cards('AS 2H 3D'))).toBe(true);
  });

  it('stands on soft 18 and above', () => {
    expect(dealerMustDraw(cards('AS 7H'))).toBe(false);
    expect(dealerMustDraw(cards('AS KH'))).toBe(false);
  });

  it('draws again once a soft hand turns hard below 17', () => {
    // A + 5 is soft 16. Drawing a king makes it hard 16, so the dealer must draw again.
    const played = playDealer(cards('AS 5H'), cards('KS 3D'));
    expect(played.dealer).toEqual(cards('AS 5H KS 3D'));
    expect(scoreHand(played.dealer).total).toBe(19);
  });
});

describe('playDealer', () => {
  it('does not draw when the dealer already stands', () => {
    const played = playDealer(cards('10S 7H'), cards('2S 3S'));
    expect(played.dealer).toEqual(cards('10S 7H'));
    expect(played.deck).toEqual(cards('2S 3S'));
  });

  it('draws one card at a time from the top of the deck until it reaches 17 or more', () => {
    const played = playDealer(cards('2S 3H'), cards('4D 5C 6S 9H KS'));
    expect(played.dealer).toEqual(cards('2S 3H 4D 5C 6S')); // 2+3+4+5+6 = 20
    expect(played.deck).toEqual(cards('9H KS'));
  });

  it('can bust', () => {
    const played = playDealer(cards('10S 6H'), cards('KD'));
    expect(scoreHand(played.dealer).total).toBe(26);
    expect(played.deck).toEqual([]);
  });

  it('does not modify its inputs', () => {
    const hand = cards('10S 6H');
    const deck = cards('2D 9C');
    playDealer(hand, deck);
    expect(hand).toEqual(cards('10S 6H'));
    expect(deck).toEqual(cards('2D 9C'));
  });

  it('refuses to draw from an empty deck instead of inventing a card', () => {
    expect(() => playDealer(cards('10S 6H'), [])).toThrow('ran out');
  });
});
