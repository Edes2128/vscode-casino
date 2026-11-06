import { BreakRoomStore } from '../../state/store';
import { MemoryStorage } from '../../state/testing';
import { POCKET_COUNT, pocketIndexOfNumber } from './wheel';
import { RouletteTable } from './table';
import type { RouletteColor, RouletteSelection } from './types';
import type { RouletteView } from './view';

/**
 * The roulette view after spinning, one `[bet on, chips]` per spin, with the ball landing on each of `numbers`. A colour
 * name is a colour bet. For tests.
 */
export function rouletteView(numbers: readonly number[], ...bets: ReadonlyArray<readonly [RouletteColor | RouletteSelection, number]>): RouletteView {
  let next = 0;
  const rng = () => {
    const number = numbers[next];
    next += 1;
    if (number === undefined) throw new Error('Ran out of planned landings');
    return (pocketIndexOfNumber(number) + 0.5) / POCKET_COUNT;
  };
  const table = new RouletteTable(new BreakRoomStore(new MemoryStorage()), { rng });
  for (const [on, bet] of bets) table.perform({ kind: 'spin', selection: typeof on === 'string' ? { kind: 'color', color: on } : on, bet });
  return table.view;
}
