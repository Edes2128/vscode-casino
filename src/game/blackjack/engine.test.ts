import { describe, expect, it } from 'vitest';
import { seededRng } from '../rng';
import { createShuffledDeck } from './deck';
import {
  availableActions,
  blackjackPayout,
  doubleDown,
  hit,
  MAX_HANDS,
  split,
  stand,
  startRound,
  type EngineResult,
} from './engine';
import { isBlackjack, isBust, scoreHand } from './scoring';
import { cards } from './testing';
import type { Round } from './types';

/** Unwraps a successful action. */
function next(result: EngineResult): Round {
  if (!result.ok) throw new Error(`Action refused: ${result.error}`);
  return result.round;
}

const settlementOf = (round: Round) => {
  if (round.settlement === undefined) throw new Error('Round is not settled');
  return round.settlement;
};

const total = (round: Round, hand = 0): number => scoreHand(round.hands[hand]?.cards ?? []).total;

// Cards are dealt: player, dealer (up), player, dealer (hole), then drawn in order.

describe('the deal', () => {
  const round = startRound(cards('9S 6H 7D 10C 2S 3S'), 100);

  it('deals player, dealer, player, dealer, in that order', () => {
    expect(round.hands[0]?.cards).toEqual(cards('9S 7D'));
    expect(round.dealer).toEqual(cards('6H 10C')); // 6H is face up, 10C is the hole card
    expect(round.deck).toEqual(cards('2S 3S'));
  });

  it('opens the player turn on a single hand with the bet taken', () => {
    expect(round.phase).toBe('player');
    expect(round.active).toBe(0);
    expect(round.hands).toHaveLength(1);
    expect(round.hands[0]).toMatchObject({ bet: 100, origin: 'dealt', doubled: false, stood: false });
    expect(round.settlement).toBeUndefined();
  });

  it('refuses an invalid bet or a deck too small to deal', () => {
    for (const bad of [0, -5, 2.5, Number.NaN]) {
      expect(() => startRound(cards('9S 6H 7D 10C'), bad), `bet ${bad}`).toThrow(RangeError);
    }
    expect(() => startRound(cards('9S 6H 7D'), 10)).toThrow('at least four cards');
  });
});

describe('blackjack (natural)', () => {
  it('pays 3:2 straight away and the dealer does not draw', () => {
    const round = startRound(cards('AS 9H KD 7C 5S'), 100);
    expect(round.phase).toBe('settled');
    expect(round.dealer).toEqual(cards('9H 7C')); // no draw
    expect(round.deck).toEqual(cards('5S'));
    expect(settlementOf(round)).toMatchObject({
      hands: [{ outcome: 'blackjack', payout: 250 }],
      staked: 100,
      payout: 250,
      net: 150,
      dealerBlackjack: false,
    });
  });

  it('is a push when the dealer also has blackjack', () => {
    const round = startRound(cards('AS AH KD KC'), 100);
    expect(round.phase).toBe('settled');
    expect(settlementOf(round)).toMatchObject({
      hands: [{ outcome: 'push', payout: 100 }],
      net: 0,
      dealerBlackjack: true,
    });
  });

  it('loses at once when only the dealer has blackjack', () => {
    const round = startRound(cards('9S AH 8D KC 5S'), 100);
    expect(round.phase).toBe('settled');
    expect(settlementOf(round)).toMatchObject({
      hands: [{ outcome: 'loss', payout: 0 }],
      net: -100,
      dealerBlackjack: true,
    });
  });

  it('beats a dealer 21 made of three cards? No: a three-card 21 is not a blackjack', () => {
    // Dealer 6 + 5 + 10 = 21 after drawing is not a natural. A player 20 loses to it, but is not
    // treated as losing to a blackjack at the deal.
    let round = startRound(cards('10S 6H 10D 5C 10H'), 100);
    expect(round.phase).toBe('player');
    round = next(stand(round));
    expect(settlementOf(round)).toMatchObject({ dealerTotal: 21, dealerBlackjack: false, hands: [{ outcome: 'loss' }] });
  });

  it('pays the right chips for different bets, rounding a half chip down', () => {
    expect(blackjackPayout(10)).toBe(25); // 10 + 15
    expect(blackjackPayout(25)).toBe(62); // 25 + 37 (37.5 rounded down)
    expect(blackjackPayout(100)).toBe(250);
    expect(blackjackPayout(500)).toBe(1_250);
    expect(settlementOf(startRound(cards('AS 9H KD 7C'), 25))).toMatchObject({ payout: 62, net: 37 });
  });

  it('is not available to a hand that came from a split', () => {
    // Split aces, one gets a king: 21 with two cards, but it pays 1:1, not 3:2.
    const round = next(split(startRound(cards('AS 6H AD 10C KS 9H 9C'), 100)));
    expect(settlementOf(round).hands[0]).toEqual({ outcome: 'win', payout: 200 });
  });
});

describe('hit and bust', () => {
  it('adds the next card from the deck to the active hand', () => {
    let round = startRound(cards('2S 6H 3D 10C 4S 5S'), 100); // player 5
    round = next(hit(round));
    expect(round.hands[0]?.cards).toEqual(cards('2S 3D 4S'));
    expect(total(round)).toBe(9);
    expect(round.deck).toEqual(cards('5S'));
    expect(round.phase).toBe('player');
  });

  it('busts over 21 and loses, and the dealer does not draw when everyone has busted', () => {
    let round = startRound(cards('10S 6H 6D 10C KS 5S'), 100); // player 16, dealer 16
    round = next(hit(round));
    expect(isBust(round.hands[0]?.cards ?? [])).toBe(true);
    expect(round.phase).toBe('settled');
    expect(round.dealer).toEqual(cards('6H 10C')); // stayed on 16
    expect(round.deck).toEqual(cards('5S')); // nothing was drawn for the dealer
    expect(settlementOf(round)).toMatchObject({ hands: [{ outcome: 'bust', payout: 0 }], net: -100 });
  });

  it('stands automatically on exactly 21', () => {
    let round = startRound(cards('10S 6H 5D 10C 6S 9H'), 100); // player 15, dealer 16
    round = next(hit(round)); // 21
    expect(total(round)).toBe(21);
    expect(round.phase).toBe('settled'); // no more decisions: the dealer plays
    expect(round.dealer).toEqual(cards('6H 10C 9H')); // 25, bust
    expect(settlementOf(round).hands[0]).toEqual({ outcome: 'win', payout: 200 });
  });

  it('lets a soft hand keep hitting without busting', () => {
    let round = startRound(cards('AS 6H 5D 10C KS 2S 9S'), 100); // soft 16
    round = next(hit(round)); // A + 5 + K = 16 hard
    expect(round.phase).toBe('player');
    expect(scoreHand(round.hands[0]?.cards ?? [])).toEqual({ total: 16, soft: false });
  });
});

describe('stand and the dealer', () => {
  it('stands on 17 without drawing, and a higher player total wins', () => {
    const round = next(stand(startRound(cards('10S 7H 10D 10C 5S'), 100))); // 20 vs 17
    expect(round.dealer).toEqual(cards('7H 10C'));
    expect(settlementOf(round)).toMatchObject({ hands: [{ outcome: 'win', payout: 200 }], dealerTotal: 17, net: 100 });
  });

  it('draws on 16 and stands on the result', () => {
    const round = next(stand(startRound(cards('10S 6H 7D 10C 2S'), 100))); // 17 vs 16 -> 18
    expect(round.dealer).toEqual(cards('6H 10C 2S'));
    expect(settlementOf(round)).toMatchObject({ hands: [{ outcome: 'loss', payout: 0 }], dealerTotal: 18, net: -100 });
  });

  it('stands on soft 17', () => {
    const round = next(stand(startRound(cards('10S AH 8D 6C 5S'), 100))); // 18 vs soft 17
    expect(round.dealer).toEqual(cards('AH 6C')); // no draw
    expect(round.deck).toEqual(cards('5S'));
    expect(settlementOf(round)).toMatchObject({ hands: [{ outcome: 'win' }], dealerTotal: 17 });
  });

  it('hits soft 16 and keeps going while under 17', () => {
    const round = next(stand(startRound(cards('10S AH 8D 5C KS 3S'), 100))); // A+5 soft 16, +K hard 16, +3 = 19
    expect(round.dealer).toEqual(cards('AH 5C KS 3S'));
    expect(settlementOf(round)).toMatchObject({ dealerTotal: 19, hands: [{ outcome: 'loss' }] });
  });

  it('pushes on equal totals and returns the bet', () => {
    const round = next(stand(startRound(cards('10S 8H 8D 10C'), 100))); // 18 vs 18
    expect(settlementOf(round)).toMatchObject({ hands: [{ outcome: 'push', payout: 100 }], net: 0 });
  });

  it('pays the player when the dealer busts', () => {
    const round = next(stand(startRound(cards('10S 6H 2D 10C KS'), 100))); // 12 vs 16 -> 26
    expect(settlementOf(round)).toMatchObject({
      hands: [{ outcome: 'win', payout: 200 }],
      dealerBust: true,
      dealerTotal: 26,
      net: 100,
    });
  });
});

describe('double down', () => {
  it('doubles the bet, takes exactly one card and stands, then pays double on a win', () => {
    const start = startRound(cards('5S 6H 6D 10C 9S 8S'), 100); // player 11
    expect(availableActions(start).double).toBe(true);

    const round = next(doubleDown(start)); // draws 9S -> 20; dealer 16 draws 8S -> 24
    expect(round.hands[0]).toMatchObject({ bet: 200, doubled: true, stood: true });
    expect(round.hands[0]?.cards).toEqual(cards('5S 6D 9S'));
    expect(round.phase).toBe('settled');
    expect(settlementOf(round)).toMatchObject({ staked: 200, payout: 400, net: 200, hands: [{ outcome: 'win', payout: 400 }] });
  });

  it('loses the whole doubled stake on a loss', () => {
    const round = next(doubleDown(startRound(cards('5S 6H 6D 10C 2S 2D'), 100))); // 13 vs 18
    expect(settlementOf(round)).toMatchObject({ staked: 200, payout: 0, net: -200, hands: [{ outcome: 'loss' }] });
  });

  it('returns the doubled stake on a push', () => {
    const round = next(doubleDown(startRound(cards('5S 6H 6D 10C 7S 2D'), 100))); // 18 vs 16+2 = 18
    expect(settlementOf(round)).toMatchObject({ staked: 200, payout: 200, net: 0, hands: [{ outcome: 'push' }] });
  });

  it('busts on a bad card', () => {
    const round = next(doubleDown(startRound(cards('10S 6H 6D 10C KS 2D'), 100))); // 16 + K = 26
    expect(settlementOf(round)).toMatchObject({ staked: 200, net: -200, hands: [{ outcome: 'bust' }] });
  });

  it('is only allowed on a two-card hand', () => {
    const afterHit = next(hit(startRound(cards('2S 6H 3D 10C 4S 9S'), 100)));
    expect(afterHit.hands[0]?.cards).toHaveLength(3);
    expect(availableActions(afterHit).double).toBe(false);
    expect(doubleDown(afterHit)).toEqual({ ok: false, error: 'not-allowed' });
  });

  it('allows no further action once the hand has doubled', () => {
    const round = next(doubleDown(startRound(cards('5S 6H 6D 10C 9S 8S'), 100)));
    expect(hit(round)).toEqual({ ok: false, error: 'not-allowed' });
    expect(stand(round)).toEqual({ ok: false, error: 'not-allowed' });
  });
});

describe('split', () => {
  it('turns a pair into two hands with a card each and the same bet', () => {
    const round = next(split(startRound(cards('8S 6H 8D 10C 3S 2H 9C'), 100)));
    expect(round.hands).toHaveLength(2);
    expect(round.hands[0]?.cards).toEqual(cards('8S 3S'));
    expect(round.hands[1]?.cards).toEqual(cards('8D 2H'));
    expect(round.hands.map((hand) => hand.bet)).toEqual([100, 100]);
    expect(round.hands.every((hand) => hand.origin === 'split')).toBe(true);
    expect(round.active).toBe(0);
    expect(round.phase).toBe('player');
  });

  it('plays the hands one after another, then the dealer', () => {
    let round = next(split(startRound(cards('8S 6H 8D 10C 3S 2H 9C'), 100)));
    round = next(stand(round)); // first hand done
    expect(round.active).toBe(1);
    expect(round.phase).toBe('player');
    round = next(stand(round)); // second hand done: dealer 16 draws 9C -> 25, bust
    expect(round.phase).toBe('settled');
    expect(settlementOf(round)).toMatchObject({
      hands: [
        { outcome: 'win', payout: 200 },
        { outcome: 'win', payout: 200 },
      ],
      staked: 200,
      payout: 400,
      net: 200,
    });
  });

  it('settles each hand on its own: a push and a loss nets a loss', () => {
    let round = next(split(startRound(cards('8S 6H 8D 10C 10S 5H 2C'), 100))); // 18 and 13
    round = next(stand(next(stand(round)))); // dealer 16 + 2 = 18
    expect(settlementOf(round)).toMatchObject({
      hands: [
        { outcome: 'push', payout: 100 },
        { outcome: 'loss', payout: 0 },
      ],
      staked: 200,
      payout: 100,
      net: -100,
    });
  });

  it('lets each split hand hit independently', () => {
    let round = next(split(startRound(cards('8S 6H 8D 10C 2S 3H 4S 5D 9C'), 100))); // 10 and 11
    round = next(hit(round)); // first hand: 10 + 4 = 14
    expect(round.hands[0]?.cards).toEqual(cards('8S 2S 4S'));
    expect(round.active).toBe(0);
    round = next(stand(round));
    round = next(hit(round)); // second hand: 11 + 5 = 16
    expect(round.hands[1]?.cards).toEqual(cards('8D 3H 5D'));
  });

  it('moves on when a split hand busts', () => {
    let round = next(split(startRound(cards('8S 6H 8D 10C 10S 3H KS 2C'), 100))); // 18 and 11
    round = next(hit(round)); // 18 + K = 28, bust
    expect(round.active).toBe(1);
    expect(round.phase).toBe('player');
    round = next(stand(round)); // second hand 11; dealer 16 + 2 = 18
    expect(settlementOf(round).hands.map((result) => result.outcome)).toEqual(['bust', 'loss']);
  });

  it('allows doubling a split hand', () => {
    let round = next(split(startRound(cards('5S 6H 5D 10C 6S 2H 9S 4C'), 100))); // 11 and 7
    expect(availableActions(round).double).toBe(true);
    round = next(doubleDown(round)); // first hand: 11 + 9 = 20, bet 200
    expect(round.hands[0]).toMatchObject({ bet: 200, doubled: true });
    expect(round.active).toBe(1);
    round = next(stand(round)); // dealer 16 + 4 = 20
    expect(settlementOf(round)).toMatchObject({
      hands: [
        { outcome: 'push', payout: 200 },
        { outcome: 'loss', payout: 0 },
      ],
      staked: 300,
      payout: 200,
      net: -100,
    });
  });

  it('gives split aces one card each, with no further play', () => {
    const round = next(split(startRound(cards('AS 6H AD 10C KS 9H 9C'), 100)));
    expect(round.hands.map((hand) => hand.cards.length)).toEqual([2, 2]);
    expect(round.phase).toBe('settled'); // straight to the dealer
    expect(hit(round)).toEqual({ ok: false, error: 'not-allowed' });
    expect(settlementOf(round).hands).toEqual([
      { outcome: 'win', payout: 200 }, // A + K = 21, a plain 21 (not 3:2)
      { outcome: 'win', payout: 200 }, // A + 9 = 20 against a dealer bust
    ]);
  });

  it('can only split a pair of the same rank', () => {
    const tenAndKing = startRound(cards('10S 6H KD 10C 2S'), 100);
    expect(availableActions(tenAndKing).split).toBe(false);
    expect(split(tenAndKing)).toEqual({ ok: false, error: 'not-allowed' });
    expect(availableActions(startRound(cards('8S 6H 9D 10C'), 100)).split).toBe(false);
  });

  it('can only split a two-card hand', () => {
    const afterHit = next(hit(startRound(cards('2S 6H 2D 10C 2H 9S'), 100))); // 2 + 2 + 2: three cards
    expect(availableActions(afterHit).split).toBe(false);
  });

  it(`allows at most ${MAX_HANDS} hands`, () => {
    let round = startRound(cards('8S 6H 8H 10D 8C 8D 8S 8H 8C 8D'), 100);
    for (let expected = 2; expected <= MAX_HANDS; expected += 1) {
      expect(availableActions(round).split, `before split to ${expected} hands`).toBe(true);
      round = next(split(round));
      expect(round.hands).toHaveLength(expected);
    }
    expect(round.hands).toHaveLength(MAX_HANDS);
    expect(availableActions(round).split).toBe(false);
    expect(split(round)).toEqual({ ok: false, error: 'not-allowed' });
  });
});

describe('preventing invalid actions', () => {
  it('allows nothing once the round is settled', () => {
    const settled = next(stand(startRound(cards('10S 7H 10D 10C'), 100)));
    expect(availableActions(settled)).toEqual({ hit: false, stand: false, double: false, split: false });
    for (const action of [hit, stand, doubleDown, split]) {
      expect(action(settled)).toEqual({ ok: false, error: 'not-allowed' });
    }
  });

  it('allows nothing after a natural ends the round at the deal', () => {
    const round = startRound(cards('AS 9H KD 7C'), 100);
    expect(availableActions(round)).toEqual({ hit: false, stand: false, double: false, split: false });
  });

  it('offers hit and stand on any live hand', () => {
    expect(availableActions(startRound(cards('9S 6H 7D 10C'), 100))).toEqual({
      hit: true,
      stand: true,
      double: true,
      split: false,
    });
  });

  it('never modifies the round it is given', () => {
    const round = startRound(cards('9S 6H 7D 10C 2S 3S'), 100);
    const snapshot = JSON.stringify(round);
    hit(round);
    stand(round);
    doubleDown(round);
    expect(JSON.stringify(round)).toBe(snapshot);
  });
});

describe('invariants over thousands of random rounds', () => {
  it('keeps every card unique, every payout consistent and the dealer on the rules', () => {
    const rng = seededRng(31_337);
    const outcomes = new Map<string, number>();
    let splits = 0;
    let doubles = 0;
    let naturals = 0;

    for (let game = 0; game < 4_000; game += 1) {
      const bet = 10 * (1 + Math.floor(rng() * 20));
      let round = startRound(createShuffledDeck(rng), bet);
      if (round.hands.some((hand) => isBlackjack(hand.cards))) naturals += 1;

      // A random but legal player: any available action, chosen at random.
      for (let guard = 0; round.phase === 'player' && guard < 60; guard += 1) {
        const actions = availableActions(round);
        const choices = ([hit, stand, doubleDown, split] as const).filter(
          (_, index) => [actions.hit, actions.stand, actions.double, actions.split][index],
        );
        const choice = choices[Math.floor(rng() * choices.length)];
        if (choice === doubleDown) doubles += 1;
        if (choice === split) splits += 1;
        round = next((choice ?? stand)(round));
      }
      expect(round.phase).toBe('settled');
      const settlement = settlementOf(round);

      // 52 cards, none duplicated, none invented.
      const everyCard = [...round.deck, ...round.dealer, ...round.hands.flatMap((hand) => hand.cards)];
      expect(everyCard).toHaveLength(52);
      expect(new Set(everyCard.map((card) => `${card.rank}${card.suit}`)).size).toBe(52);

      // The money adds up.
      const staked = round.hands.reduce((sum, hand) => sum + hand.bet, 0);
      expect(settlement.staked).toBe(staked);
      expect(settlement.payout).toBe(settlement.hands.reduce((sum, result) => sum + result.payout, 0));
      expect(settlement.net).toBe(settlement.payout - settlement.staked);
      expect(Number.isSafeInteger(settlement.payout)).toBe(true);

      // Each hand is judged by the rules.
      const dealerTotal = scoreHand(round.dealer).total;
      expect(settlement.dealerTotal).toBe(dealerTotal);
      round.hands.forEach((hand, index) => {
        const result = settlement.hands[index];
        const playerTotal = scoreHand(hand.cards).total;
        outcomes.set(result?.outcome ?? '?', (outcomes.get(result?.outcome ?? '?') ?? 0) + 1);
        switch (result?.outcome) {
          case 'bust':
            expect(playerTotal).toBeGreaterThan(21);
            expect(result.payout).toBe(0);
            break;
          case 'blackjack':
            expect(hand.origin).toBe('dealt');
            expect(result.payout).toBe(blackjackPayout(hand.bet));
            break;
          case 'win':
            expect(result.payout).toBe(hand.bet * 2);
            expect(playerTotal <= 21 && (settlement.dealerBust || playerTotal > dealerTotal)).toBe(true);
            break;
          case 'push':
            expect(result.payout).toBe(hand.bet);
            break;
          case 'loss':
            expect(result.payout).toBe(0);
            break;
          default:
            throw new Error('missing result');
        }
      });

      // The dealer follows the rules: at least 17 unless nobody was left to play against.
      const someoneLive = round.hands.some((hand) => !isBust(hand.cards) && !(hand.origin === 'dealt' && isBlackjack(hand.cards)));
      if (someoneLive && !settlement.dealerBlackjack) {
        expect(dealerTotal).toBeGreaterThanOrEqual(17);
      }
      if (round.dealer.length > 2) {
        // Every card the dealer drew was needed: the hand before the last card was under 17.
        expect(scoreHand(round.dealer.slice(0, -1)).total).toBeLessThan(17);
      }
    }

    // The run really exercised every branch.
    for (const outcome of ['bust', 'win', 'push', 'loss', 'blackjack']) {
      expect(outcomes.get(outcome) ?? 0, `outcome ${outcome}`).toBeGreaterThan(20);
    }
    expect(splits).toBeGreaterThan(50);
    expect(doubles).toBeGreaterThan(200);
    expect(naturals).toBeGreaterThan(100);
  });
});
