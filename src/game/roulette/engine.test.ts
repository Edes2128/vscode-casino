import { describe, expect, it } from 'vitest';
import { cryptoRng, seededRng } from '../rng';
import { NUMBER_ODDS, PAYOUT_ODDS, describeSelection, oddsOf, payoutFor, selectionWins } from './betting';
import { resolveSpin, spinWheel } from './engine';
import {
  HIGHEST_NUMBER,
  ROULETTE_COLORS,
  isRouletteColor,
  isRouletteNumber,
  isRouletteSelection,
  parseSelection,
  sameSelection,
  type RouletteColor,
  type RouletteSelection,
} from './types';
import { POCKETS, POCKET_COUNT, WHEEL_ORDER, colorOfNumber, describePocket, parsePocket, pocketIndexOfNumber } from './wheel';

/** A bet on a colour, and a bet on a number. */
const on = (color: RouletteColor): RouletteSelection => ({ kind: 'color', color });
const number = (n: number): RouletteSelection => ({ kind: 'number', number: n });

/** A generator that lands on a chosen wheel position. */
const landingOn = (index: number) => () => (index + 0.5) / POCKET_COUNT;

describe('the European wheel', () => {
  it('has 37 pockets holding the numbers 0 to 36, each exactly once', () => {
    expect(POCKETS).toHaveLength(37);
    expect(POCKET_COUNT).toBe(37);
    expect([...WHEEL_ORDER].sort((a, b) => a - b)).toEqual(Array.from({ length: 37 }, (_, n) => n));
  });

  it('is laid out in the real European order, clockwise from the zero', () => {
    expect(WHEEL_ORDER.slice(0, 8)).toEqual([0, 32, 15, 19, 4, 21, 2, 25]);
    expect(WHEEL_ORDER.slice(-6)).toEqual([7, 28, 12, 35, 3, 26]);
    expect(pocketIndexOfNumber(0)).toBe(0);
    expect(pocketIndexOfNumber(26)).toBe(36);
    expect(pocketIndexOfNumber(17)).toBe(8);
    expect(pocketIndexOfNumber(37)).toBe(-1);
  });

  it('has exactly one green pocket, the zero, and 18 each of red and black', () => {
    const count = (color: RouletteColor) => POCKETS.filter((pocket) => pocket.color === color).length;
    expect(count('green')).toBe(1);
    expect(count('red')).toBe(18);
    expect(count('black')).toBe(18);
    expect(POCKETS.find((pocket) => pocket.color === 'green')?.number).toBe(0);
  });

  it('colours all 37 numbers correctly', () => {
    const red = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    const black = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];
    for (const number of red) expect(colorOfNumber(number), `${number}`).toBe('red');
    for (const number of black) expect(colorOfNumber(number), `${number}`).toBe('black');
    expect(colorOfNumber(0)).toBe('green');
    expect([...red, ...black, 0].sort((a, b) => a - b)).toEqual(Array.from({ length: 37 }, (_, n) => n));
  });

  it('alternates red and black all the way round the wheel, which only the true order does', () => {
    for (let index = 1; index < POCKET_COUNT; index += 1) {
      const colour = POCKETS[index]?.color;
      const previous = POCKETS[index - 1]?.color;
      if (index === 1) expect(previous).toBe('green');
      else expect(colour, `pocket ${index}`).not.toBe(previous);
      expect(colour).not.toBe('green');
    }
    expect(POCKETS.at(-1)?.color).toBe('black'); // and the zero follows it
  });

  it('writes a result for the history and reads it back', () => {
    for (const pocket of POCKETS) expect(parsePocket(describePocket(pocket)), `${pocket.number}`).toEqual(pocket);
    expect(describePocket({ number: 17, color: 'black' })).toBe('Black 17');
    expect(describePocket({ number: 0, color: 'green' })).toBe('Green 0');
    expect(describePocket({ number: 23, color: 'red' })).toBe('Red 23');
  });

  it('only reads back results it wrote', () => {
    for (const text of ['', 'Round abandoned', 'Red 99', 'Red 0', 'Green 5', 'Black 17 ', 'black 17', 'Red 017', 'Blue 3']) {
      expect(parsePocket(text), text).toBeUndefined();
    }
  });
});

describe('what can be bet on: a colour, or one number', () => {
  it('offers the three colours', () => {
    expect([...ROULETTE_COLORS]).toEqual(['red', 'black', 'green']);
    for (const color of ROULETTE_COLORS) expect(isRouletteColor(color)).toBe(true);
  });

  it('refuses every other kind of bet: columns, dozens, odd/even, high/low, and anything not a colour', () => {
    for (const value of ['odd', 'even', 'dozen1', 'column2', '17', 17, 0, 'high', 'low', '', null, undefined, 'RED']) {
      expect(isRouletteColor(value), String(value)).toBe(false);
    }
  });

  it('accepts exactly the whole numbers 0 to 36 as a number bet', () => {
    for (let n = 0; n <= HIGHEST_NUMBER; n += 1) expect(isRouletteNumber(n), String(n)).toBe(true);
    for (const value of [-1, 37, 100, 1.5, 0.1, Number.NaN, Number.POSITIVE_INFINITY, '17', null, undefined, [17], { n: 17 }, true]) {
      expect(isRouletteNumber(value), String(value)).toBe(false);
    }
  });

  it('reads a selection only when it is exactly a colour bet or a number bet, and drops everything extra', () => {
    expect(parseSelection({ kind: 'color', color: 'red' })).toEqual({ kind: 'color', color: 'red' });
    expect(parseSelection({ kind: 'number', number: 0 })).toEqual({ kind: 'number', number: 0 });
    expect(parseSelection({ kind: 'number', number: 36, extra: true, payout: 1e9 })).toEqual({ kind: 'number', number: 36 });
    for (const bad of [
      undefined,
      null,
      'red',
      17,
      [],
      {},
      { kind: 'color' },
      { kind: 'color', color: 'purple' },
      { kind: 'color', color: 17 },
      { kind: 'number' },
      { kind: 'number', number: 37 },
      { kind: 'number', number: -1 },
      { kind: 'number', number: '5' },
      { kind: 'number', number: 2.5 },
      { kind: 'number', color: 'red' },
      { kind: 'color', number: 5 },
      { kind: 'dozen', dozen: 1 },
      { kind: 'odd' },
      { kind: 'numbers', numbers: [1, 2] },
    ]) {
      expect(parseSelection(bad), JSON.stringify(bad)).toBeUndefined();
      expect(isRouletteSelection(bad), JSON.stringify(bad)).toBe(false);
    }
  });

  it('knows when two selections are the same bet', () => {
    expect(sameSelection(on('red'), on('red'))).toBe(true);
    expect(sameSelection(on('red'), on('black'))).toBe(false);
    expect(sameSelection(number(17), number(17))).toBe(true);
    expect(sameSelection(number(17), number(18))).toBe(false);
    expect(sameSelection(number(0), on('green'))).toBe(false);
    expect(sameSelection(undefined, on('red'))).toBe(false);
    expect(sameSelection(undefined, undefined)).toBe(false);
  });
});

describe('number bets', () => {
  const pocket = (n: number) => POCKETS.find((candidate) => candidate.number === n) ?? { number: -1, color: 'red' as const };

  it('pay 35 to 1: the stake back plus 35 times the bet', () => {
    expect(NUMBER_ODDS).toBe(35);
    expect(oddsOf(number(17))).toBe(35);
    expect(payoutFor(number(17), 10, pocket(17))).toBe(360);
    expect(payoutFor(number(0), 100, pocket(0))).toBe(3_600);
    expect(payoutFor(number(36), 500, pocket(36))).toBe(18_000);
  });

  it('lose on every other number, and never win on a near miss', () => {
    for (const landed of POCKETS) {
      for (const n of [0, 1, 17, 18, 35, 36]) {
        expect(payoutFor(number(n), 10, landed) > 0, `bet ${n}, landed ${landed.number}`).toBe(landed.number === n);
        expect(selectionWins(number(n), landed)).toBe(landed.number === n);
      }
    }
  });

  it('win on exactly one of the 37 pockets, whichever number is chosen, with a fair house edge of 1 in 37', () => {
    let returned = 0;
    for (let n = 0; n <= HIGHEST_NUMBER; n += 1) {
      const winners = POCKETS.filter((landed) => selectionWins(number(n), landed));
      expect(winners.map((landed) => landed.number), `bet ${n}`).toEqual([n]);
      for (const landed of POCKETS) returned += payoutFor(number(n), 1, landed);
    }
    // Over every number and every pocket, 37 x 37 spins of one chip: 37 wins of 36 chips come back, so 36/37 on average.
    expect(returned).toBe(37 * 36);
    expect(returned / (37 * 37)).toBeCloseTo(36 / 37, 12);
  });

  it('beat a colour bet on the same pocket only in the winnings, not the chance', () => {
    // A straight-up on a red number and a bet on red both win on that number, and pay different amounts.
    expect(payoutFor(number(32), 10, pocket(32))).toBe(360);
    expect(payoutFor(on('red'), 10, pocket(32))).toBe(20);
    expect(payoutFor(on('red'), 10, pocket(15))).toBe(0);
    expect(payoutFor(number(32), 10, pocket(15))).toBe(0);
  });

  it('are named in words for the result banner', () => {
    expect(describeSelection(number(17))).toBe('number 17');
    expect(describeSelection(number(0))).toBe('number 0');
    expect(describeSelection(on('green'))).toBe('green');
  });

  it('resolve into the right result, with the net chips', () => {
    expect(resolveSpin({ number: 17, color: 'black' }, number(17), 10)).toEqual({
      pocket: { number: 17, color: 'black' },
      selection: { kind: 'number', number: 17 },
      bet: 10,
      won: true,
      payout: 360,
      net: 350,
    });
    expect(resolveSpin({ number: 18, color: 'red' }, number(17), 10)).toMatchObject({ won: false, payout: 0, net: -10 });
  });
});

describe('payouts', () => {
  const red17 = { number: 17, color: 'black' as const };
  const pocket = (number: number) => POCKETS.find((candidate) => candidate.number === number) ?? red17;

  it('pays red 1:1', () => {
    expect(PAYOUT_ODDS.red).toBe(1);
    expect(payoutFor(on('red'), 100, pocket(32))).toBe(200); // stake back plus 100
    expect(payoutFor(on('red'), 10, pocket(1))).toBe(20);
  });

  it('pays black 1:1', () => {
    expect(PAYOUT_ODDS.black).toBe(1);
    expect(payoutFor(on('black'), 100, pocket(15))).toBe(200);
    expect(payoutFor(on('black'), 500, pocket(26))).toBe(1_000);
  });

  it('pays green 35:1', () => {
    expect(PAYOUT_ODDS.green).toBe(35);
    expect(payoutFor(on('green'), 10, pocket(0))).toBe(360); // stake back plus 350
    expect(payoutFor(on('green'), 100, pocket(0))).toBe(3_600);
    expect(payoutFor(on('green'), 500, pocket(0))).toBe(18_000);
  });

  it('pays nothing when the colour is wrong, for every pocket and every colour', () => {
    for (const bet of ROULETTE_COLORS) {
      for (const landed of POCKETS) {
        const expected = landed.color === bet ? 100 * (PAYOUT_ODDS[bet] + 1) : 0;
        expect(payoutFor(on(bet), 100, landed), `${bet} bet, ${landed.number}`).toBe(expected);
      }
    }
  });

  it('wins a green bet only on the zero, and a colour bet never on the zero', () => {
    for (const landed of POCKETS) {
      expect(payoutFor(on('green'), 10, landed) > 0).toBe(landed.number === 0);
      if (landed.number === 0) {
        expect(payoutFor(on('red'), 10, landed)).toBe(0);
        expect(payoutFor(on('black'), 10, landed)).toBe(0);
      }
    }
  });

  it('takes the house edge: the zero loses every red and black bet', () => {
    // A fair 36-number wheel would pay 18/37 of spins at 1:1 evenly; the zero is the house advantage.
    const zero = pocket(0);
    expect(resolveSpin(zero, on('red'), 100)).toMatchObject({ won: false, payout: 0, net: -100 });
    expect(resolveSpin(zero, on('black'), 100)).toMatchObject({ won: false, payout: 0, net: -100 });
  });
});

describe('resolveSpin', () => {
  it('reports a win with the net chips', () => {
    expect(resolveSpin({ number: 32, color: 'red' }, on('red'), 100)).toEqual({
      pocket: { number: 32, color: 'red' },
      selection: { kind: 'color', color: 'red' },
      bet: 100,
      won: true,
      payout: 200,
      net: 100,
    });
  });

  it('reports a loss as losing the bet', () => {
    expect(resolveSpin({ number: 15, color: 'black' }, on('red'), 50)).toMatchObject({ won: false, payout: 0, net: -50 });
  });

  it('reports a green win as +35 times the bet', () => {
    expect(resolveSpin({ number: 0, color: 'green' }, on('green'), 10)).toMatchObject({ won: true, payout: 360, net: 350 });
  });

  it('keeps net equal to payout minus bet for every bet and outcome', () => {
    for (const color of ROULETTE_COLORS) {
      for (const pocket of POCKETS) {
        const result = resolveSpin(pocket, on(color), 25);
        expect(result.net).toBe(result.payout - result.bet);
        expect(result.won).toBe(result.net > 0);
      }
    }
  });
});

describe('spinWheel (a fair spin)', () => {
  it('lands on the pocket the random number points at, in wheel order', () => {
    expect(spinWheel(() => 0)).toEqual(POCKETS[0]);
    expect(spinWheel(() => 0.9999999999999999)).toEqual(POCKETS[36]);
    for (let index = 0; index < POCKET_COUNT; index += 1) expect(spinWheel(landingOn(index))).toEqual(POCKETS[index]);
  });

  it('can land on every pocket, and only on real pockets', () => {
    const rng = seededRng(37);
    const seen = new Set<number>();
    for (let i = 0; i < 5_000; i += 1) {
      const pocket = spinWheel(rng);
      expect(WHEEL_ORDER).toContain(pocket.number);
      seen.add(pocket.number);
    }
    expect(seen.size).toBe(37);
  });

  it('is repeatable for a seed and different for another', () => {
    const run = (seed: number) => Array.from({ length: 20 }, ((rng) => () => spinWheel(rng).number)(seededRng(seed)));
    expect(run(5)).toEqual(run(5));
    expect(run(5)).not.toEqual(run(6));
  });

  it('gives every pocket an equal chance over many spins', () => {
    const rng = seededRng(2_026);
    const counts = new Map<number, number>();
    const spins = 74_000;
    for (let i = 0; i < spins; i += 1) {
      const { number } = spinWheel(rng);
      counts.set(number, (counts.get(number) ?? 0) + 1);
    }
    // 2,000 each with a standard deviation of about 44: five sigmas is 220.
    for (const number of WHEEL_ORDER) {
      const count = counts.get(number) ?? 0;
      expect(count, `pocket ${number}`).toBeGreaterThan(1_780);
      expect(count, `pocket ${number}`).toBeLessThan(2_220);
    }
  });

  it('lands on each colour in proportion to its pockets', () => {
    const rng = seededRng(99);
    const tally: Record<RouletteColor, number> = { red: 0, black: 0, green: 0 };
    const spins = 74_000;
    for (let i = 0; i < spins; i += 1) tally[spinWheel(rng).color] += 1;
    expect(tally.red / spins).toBeCloseTo(18 / 37, 1);
    expect(tally.black / spins).toBeCloseTo(18 / 37, 1);
    expect(tally.green / spins).toBeGreaterThan(0.025);
    expect(tally.green / spins).toBeLessThan(0.029);
  });

  it('works with the Web Crypto generator and never leaves the wheel', () => {
    const numbers = new Set<number>();
    for (let i = 0; i < 3_000; i += 1) {
      const pocket = spinWheel(cryptoRng);
      expect(pocket.number).toBeGreaterThanOrEqual(0);
      expect(pocket.number).toBeLessThanOrEqual(36);
      numbers.add(pocket.number);
    }
    expect(numbers.size).toBeGreaterThan(30);
  });

  it('refuses a generator that breaks its contract instead of inventing a pocket', () => {
    expect(() => spinWheel(() => 1)).toThrow(RangeError);
    expect(() => spinWheel(() => -0.5)).toThrow(RangeError);
  });
});
