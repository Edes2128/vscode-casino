import { CasinoStore } from '../../casino/store';
import { MemoryStorage } from '../../casino/testing';
import { POCKET_COUNT, pocketIndexOfNumber } from './wheel';
import { RouletteTable } from './table';
import type { RouletteColor } from './types';
import type { RouletteView } from './view';

/** The roulette view after spinning, one `[colour, bet]` per spin, with the ball landing on each of `numbers`. For tests. */
export function rouletteView(numbers: readonly number[], ...bets: ReadonlyArray<readonly [RouletteColor, number]>): RouletteView {
  let next = 0;
  const rng = () => {
    const number = numbers[next];
    next += 1;
    if (number === undefined) throw new Error('Ran out of planned landings');
    return (pocketIndexOfNumber(number) + 0.5) / POCKET_COUNT;
  };
  const table = new RouletteTable(new CasinoStore(new MemoryStorage()), { rng });
  for (const [color, bet] of bets) table.perform({ kind: 'spin', color, bet });
  return table.view;
}
