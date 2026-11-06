import { describe, expect, it } from 'vitest';
import { LuckyBreakStore } from '../../state/store';
import { MemoryStorage } from '../../state/testing';
import { POCKETS } from './wheel';
import { RouletteTable } from './table';
import { IDLE_ROULETTE_VIEW, MAX_RECENT, isPocket, isRouletteView, parseRouletteAction, type RouletteView } from './view';

function realView(): RouletteView {
  const table = new RouletteTable(new LuckyBreakStore(new MemoryStorage()), { rng: () => 0.5 });
  table.perform({ kind: 'spin', selection: { kind: 'color', color: 'red' }, bet: 50 });
  return table.view;
}

describe('isRouletteView', () => {
  const real = realView();

  it('accepts the idle view and a view the table really produces, also after a JSON round trip', () => {
    expect(isRouletteView(IDLE_ROULETTE_VIEW)).toBe(true);
    expect(isRouletteView(real)).toBe(true);
    expect(isRouletteView(JSON.parse(JSON.stringify(real)))).toBe(true);
  });

  it('rejects malformed views', () => {
    expect(isRouletteView(undefined)).toBe(false);
    expect(isRouletteView(null)).toBe(false);
    expect(isRouletteView([])).toBe(false);
    expect(isRouletteView({ ...real, spin: -1 })).toBe(false);
    expect(isRouletteView({ ...real, spin: 1.5 })).toBe(false);
    expect(isRouletteView({ ...real, recent: 'none' })).toBe(false);
    expect(isRouletteView({ ...real, recent: Array.from({ length: MAX_RECENT + 1 }, () => POCKETS[0]) })).toBe(false);
    expect(isRouletteView({ ...real, last: { ...real.last, bet: -1 } })).toBe(false);
    expect(isRouletteView({ ...real, last: { ...real.last, selection: { kind: 'color', color: 'blue' } } })).toBe(false);
    expect(isRouletteView({ ...real, last: { ...real.last, selection: { kind: 'number', number: 37 } } })).toBe(false);
    expect(isRouletteView({ ...real, last: { ...real.last, selection: 'red' } })).toBe(false);
    expect(isRouletteView({ ...real, last: { ...real.last, selection: undefined } })).toBe(false);
    expect(isRouletteView({ ...real, last: { ...real.last, detail: 'x'.repeat(500) } })).toBe(false);
    expect(isRouletteView({ ...real, last: { ...real.last, pocket: { number: 17, color: 'red' } } })).toBe(false);
  });
});

describe('isPocket', () => {
  it('accepts all 37 pockets', () => {
    for (const pocket of POCKETS) expect(isPocket(pocket)).toBe(true);
  });

  it('rejects numbers off the wheel and colours that do not belong to the number', () => {
    expect(isPocket({ number: 37, color: 'black' })).toBe(false);
    expect(isPocket({ number: -1, color: 'green' })).toBe(false);
    expect(isPocket({ number: 1.5, color: 'red' })).toBe(false);
    expect(isPocket({ number: 17, color: 'red' })).toBe(false); // 17 is black
    expect(isPocket({ number: 0, color: 'red' })).toBe(false); // 0 is green
    expect(isPocket({ number: 32 })).toBe(false);
    expect(isPocket('32')).toBe(false);
  });
});

describe('parseRouletteAction', () => {
  const colorBet = (color: unknown) => ({ kind: 'color', color });
  const numberBet = (number: unknown) => ({ kind: 'number', number });

  it('accepts a spin on each of the three colours', () => {
    for (const color of ['red', 'black', 'green']) {
      expect(parseRouletteAction({ kind: 'spin', selection: colorBet(color), bet: 100 })).toEqual({
        kind: 'spin',
        selection: { kind: 'color', color },
        bet: 100,
      });
    }
  });

  it('accepts a spin on each of the 37 numbers', () => {
    for (let number = 0; number <= 36; number += 1) {
      expect(parseRouletteAction({ kind: 'spin', selection: numberBet(number), bet: 10 })).toEqual({
        kind: 'spin',
        selection: { kind: 'number', number },
        bet: 10,
      });
    }
  });

  it('rejects every other kind of bet, so only a colour or a number can ever reach the table', () => {
    for (const color of ['odd', 'even', 'low', 'high', 'dozen1', 'column3', '17', 17, 0, '', null, 'RED']) {
      expect(parseRouletteAction({ kind: 'spin', selection: colorBet(color), bet: 100 }), String(color)).toBeUndefined();
    }
    for (const number of [-1, 37, 99, 1.5, '17', null, undefined, Number.NaN, [17]]) {
      expect(parseRouletteAction({ kind: 'spin', selection: numberBet(number), bet: 100 }), String(number)).toBeUndefined();
    }
    for (const selection of [undefined, null, 'red', 17, {}, { kind: 'dozen', dozen: 1 }, { kind: 'odd' }, { kind: 'numbers', numbers: [1, 2] }]) {
      expect(parseRouletteAction({ kind: 'spin', selection, bet: 100 }), JSON.stringify(selection)).toBeUndefined();
    }
  });

  it('refuses the old colour-only shape: the selection is what names the bet', () => {
    expect(parseRouletteAction({ kind: 'spin', color: 'red', bet: 100 })).toBeUndefined();
    expect(parseRouletteAction({ kind: 'spin', number: 17, bet: 100 })).toBeUndefined();
  });

  it('refuses any other kind of action, a missing bet or a bet that is not a number', () => {
    expect(parseRouletteAction({ kind: 'payout', selection: colorBet('red'), bet: 100 })).toBeUndefined();
    expect(parseRouletteAction('spin')).toBeUndefined();
    expect(parseRouletteAction(null)).toBeUndefined();
    expect(parseRouletteAction({ kind: 'spin', selection: colorBet('red') })).toBeUndefined();
    expect(parseRouletteAction({ kind: 'spin', selection: colorBet('red'), bet: '100' })).toBeUndefined();
  });

  it('keeps only what it understands: nothing a webview adds can reach the table', () => {
    expect(
      parseRouletteAction({ kind: 'spin', selection: { kind: 'color', color: 'red', payout: 1e9 }, bet: 100, payout: 1e9, pocket: 17 }),
    ).toEqual({ kind: 'spin', selection: { kind: 'color', color: 'red' }, bet: 100 });
  });
});
