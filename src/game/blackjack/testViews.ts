import { LuckyBreakStore } from '../../state/store';
import { MemoryStorage } from '../../state/testing';
import { BlackjackTable } from './table';
import { cards } from './testing';
import type { BlackjackAction, BlackjackView } from './view';

/** The table view after playing `actions` on a stacked deck, with the real store and table. For tests. */
export function tableView(deckSpec: string, ...actions: BlackjackAction[]): BlackjackView {
  const store = new LuckyBreakStore(new MemoryStorage());
  const table = new BlackjackTable(store, { deck: () => cards(deckSpec) });
  for (const action of actions) table.perform(action);
  return table.view;
}

export const deal = (bet: number): BlackjackAction => ({ kind: 'deal', bet });
export const HIT: BlackjackAction = { kind: 'hit' };
export const STAND: BlackjackAction = { kind: 'stand' };
export const SPLIT: BlackjackAction = { kind: 'split' };
