import { describe, expect, it } from 'vitest';
import { rouletteView } from '../game/roulette/testViews';
import type { SpinView } from '../game/roulette/view';
import type { Pocket } from '../game/roulette/types';
import { pocketWords, spinOutcomeText, visibleRecent } from './rouletteText';

const last = (numbers: number[], color: 'red' | 'black' | 'green', bet: number): SpinView => {
  const view = rouletteView(numbers, [color, bet]);
  if (view.last === undefined) throw new Error('no spin');
  return view.last;
};

describe('spinOutcomeText', () => {
  it('announces a win with the chips won, and what was bet', () => {
    expect(spinOutcomeText(last([32], 'red', 100))).toEqual({
      kind: 'win',
      title: 'YOU WIN',
      amount: '+100',
      detail: 'Red 32. You bet red.',
    });
  });

  it('announces a loss with the chips lost, and what the ball landed on', () => {
    expect(spinOutcomeText(last([32], 'black', 50))).toEqual({
      kind: 'loss',
      title: 'YOU LOSE',
      amount: '-50',
      detail: 'Red 32. You bet black.',
    });
  });

  it('makes a hit on the green the special result, at 35 to 1', () => {
    expect(spinOutcomeText(last([0], 'green', 10))).toEqual({
      kind: 'special',
      title: 'GREEN! 35 TO 1',
      amount: '+350',
      detail: 'Green 0. You bet green.',
    });
  });

  it('treats a lost green bet like any other loss', () => {
    expect(spinOutcomeText(last([17], 'green', 10))).toMatchObject({ kind: 'loss', amount: '-10' });
  });

  it('groups large amounts', () => {
    expect(spinOutcomeText(last([0], 'green', 500)).amount).toBe('+17,500');
  });
});

describe('visibleRecent', () => {
  const recent: Pocket[] = [
    { number: 4, color: 'black' },
    { number: 2, color: 'black' },
    { number: 1, color: 'red' },
  ];

  it('shows everything once the wheel has stopped', () => {
    expect(visibleRecent(recent, false)).toEqual(recent);
  });

  it('leaves out the newest result while the wheel is still turning, so it is not given away', () => {
    expect(visibleRecent(recent, true)).toEqual(recent.slice(1));
    expect(visibleRecent([], true)).toEqual([]);
    expect(visibleRecent(recent.slice(0, 1), true)).toEqual([]);
  });
});

describe('pocketWords', () => {
  it('writes a pocket in capitals', () => {
    expect(pocketWords({ number: 17, color: 'black' })).toBe('BLACK 17');
    expect(pocketWords({ number: 0, color: 'green' })).toBe('GREEN 0');
  });
});
