import { describe, expect, it } from 'vitest';
import { CasinoStore } from '../../casino/store';
import { MemoryStorage } from '../../casino/testing';
import { POCKETS } from './wheel';
import { RouletteTable } from './table';
import { IDLE_ROULETTE_VIEW, MAX_RECENT, isPocket, isRouletteView, parseRouletteAction, type RouletteView } from './view';

function realView(): RouletteView {
  const table = new RouletteTable(new CasinoStore(new MemoryStorage()), { rng: () => 0.5 });
  table.perform({ kind: 'spin', color: 'red', bet: 50 });
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
    expect(isRouletteView({ ...real, last: { ...real.last, color: 'blue' } })).toBe(false);
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
  it('accepts a spin on each of the three colours', () => {
    for (const color of ['red', 'black', 'green']) {
      expect(parseRouletteAction({ kind: 'spin', color, bet: 100 })).toEqual({ kind: 'spin', color, bet: 100 });
    }
  });

  it('rejects every other kind of bet, so only colours can ever reach the table', () => {
    for (const color of ['odd', 'even', 'low', 'high', 'dozen1', 'column3', '17', 17, 0, '', null, 'RED']) {
      expect(parseRouletteAction({ kind: 'spin', color, bet: 100 }), String(color)).toBeUndefined();
    }
    expect(parseRouletteAction({ kind: 'spin', number: 17, bet: 100 })).toBeUndefined();
    expect(parseRouletteAction({ kind: 'spin', numbers: [1, 2], color: 'red', bet: 10 })).toEqual({ kind: 'spin', color: 'red', bet: 10 });
  });

  it('rejects malformed actions and strips extra fields', () => {
    expect(parseRouletteAction(undefined)).toBeUndefined();
    expect(parseRouletteAction('spin')).toBeUndefined();
    expect(parseRouletteAction({ kind: 'spin', color: 'red' })).toBeUndefined();
    expect(parseRouletteAction({ kind: 'spin', color: 'red', bet: '100' })).toBeUndefined();
    expect(parseRouletteAction({ kind: 'cheat', color: 'red', bet: 100 })).toBeUndefined();
    expect(parseRouletteAction({ kind: 'spin', color: 'red', bet: 100, payout: 1e9 })).toEqual({ kind: 'spin', color: 'red', bet: 100 });
  });
});
