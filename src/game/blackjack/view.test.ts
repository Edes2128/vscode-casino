import { describe, expect, it } from 'vitest';
import { LuckyBreakStore } from '../../state/store';
import { MemoryStorage } from '../../state/testing';
import { BlackjackTable } from './table';
import { cards } from './testing';
import { IDLE_VIEW, isBlackjackView, parseBlackjackAction, type BlackjackView } from './view';

function viewsFrom(deckSpec: string, ...actions: Parameters<BlackjackTable['perform']>[0][]): BlackjackView[] {
  const store = new LuckyBreakStore(new MemoryStorage());
  const table = new BlackjackTable(store, { deck: () => cards(deckSpec) });
  const views: BlackjackView[] = [table.view];
  for (const action of actions) {
    table.perform(action);
    views.push(table.view);
  }
  return views;
}

describe('isBlackjackView', () => {
  const realViews = [
    ...viewsFrom('9S 6H 7D 10C 2S 3S', { kind: 'deal', bet: 100 }, { kind: 'hit' }, { kind: 'stand' }, { kind: 'newRound' }),
    ...viewsFrom('8S 6H 8D 10C 3S 2H 9C', { kind: 'deal', bet: 100 }, { kind: 'split' }, { kind: 'stand' }, { kind: 'stand' }),
    ...viewsFrom('AS 9H KD 7C', { kind: 'deal', bet: 100 }),
  ];

  it('accepts every view the table really produces', () => {
    expect(isBlackjackView(IDLE_VIEW)).toBe(true);
    for (const view of realViews) expect(isBlackjackView(view), JSON.stringify(view).slice(0, 80)).toBe(true);
  });

  it('survives a JSON round trip, like a real message', () => {
    for (const view of realViews) expect(isBlackjackView(JSON.parse(JSON.stringify(view)))).toBe(true);
  });

  const playerView = viewsFrom('9S 6H 7D 10C 2S', { kind: 'deal', bet: 100 })[1] as BlackjackView;
  const settledView = viewsFrom('AS 9H KD 7C', { kind: 'deal', bet: 100 })[1] as BlackjackView;
  const patch = (base: BlackjackView, changes: Record<string, unknown>): unknown => ({ ...base, ...changes });

  it('rejects malformed views', () => {
    expect(isBlackjackView(undefined)).toBe(false);
    expect(isBlackjackView(null)).toBe(false);
    expect(isBlackjackView([])).toBe(false);
    expect(isBlackjackView('view')).toBe(false);
    expect(isBlackjackView(patch(playerView, { round: -1 }))).toBe(false);
    expect(isBlackjackView(patch(playerView, { round: 1.5 }))).toBe(false);
    expect(isBlackjackView(patch(playerView, { phase: 'dealing' }))).toBe(false);
    expect(isBlackjackView(patch(playerView, { actions: { hit: true } }))).toBe(false);
    expect(isBlackjackView(patch(playerView, { actions: { hit: 1, stand: 1, double: 1, split: 1 } }))).toBe(false);
    expect(isBlackjackView(patch(playerView, { hands: 'none' }))).toBe(false);
    expect(isBlackjackView(patch(playerView, { dealer: { cards: 'x', total: null } }))).toBe(false);
    expect(isBlackjackView(patch(playerView, { dealer: { cards: [], total: -3 } }))).toBe(false);
  });

  it('rejects impossible cards and hands', () => {
    const hand = playerView.hands[0];
    expect(isBlackjackView(patch(playerView, { hands: [{ ...hand, cards: [{ rank: '1', suit: 'spades' }] }] }))).toBe(false);
    expect(isBlackjackView(patch(playerView, { hands: [{ ...hand, cards: [{ rank: 'A', suit: 'stars' }] }] }))).toBe(false);
    expect(isBlackjackView(patch(playerView, { hands: [{ ...hand, bet: -10 }] }))).toBe(false);
    expect(isBlackjackView(patch(playerView, { hands: [{ ...hand, total: '16' }] }))).toBe(false);
    expect(isBlackjackView(patch(playerView, { hands: [{ ...hand, outcome: 'jackpot' }] }))).toBe(false);
    expect(isBlackjackView(patch(playerView, { hands: Array.from({ length: 5 }, () => hand) }))).toBe(false);
    expect(isBlackjackView(patch(playerView, { dealer: { cards: Array.from({ length: 13 }, () => null), total: null } }))).toBe(false);
  });

  it('rejects a malformed result', () => {
    const { result } = settledView;
    expect(result).toBeDefined();
    expect(isBlackjackView(patch(settledView, { result: { ...result, outcome: 'draw' } }))).toBe(false);
    expect(isBlackjackView(patch(settledView, { result: { ...result, detail: 'x'.repeat(500) } }))).toBe(false);
    expect(isBlackjackView(patch(settledView, { result: { ...result, balanceBefore: -1 } }))).toBe(false);
    expect(isBlackjackView(patch(settledView, { result: { ...result, net: 1.5 } }))).toBe(false);
  });

  it('accepts a face-down dealer card', () => {
    expect(playerView.dealer.cards[1]).toBeNull();
    expect(isBlackjackView(playerView)).toBe(true);
  });
});

describe('parseBlackjackAction', () => {
  it('accepts every action the webview may send', () => {
    expect(parseBlackjackAction({ kind: 'deal', bet: 100 })).toEqual({ kind: 'deal', bet: 100 });
    for (const kind of ['hit', 'stand', 'double', 'split', 'newRound']) {
      expect(parseBlackjackAction({ kind })).toEqual({ kind });
    }
  });

  it('rejects anything else and strips extra fields', () => {
    expect(parseBlackjackAction(undefined)).toBeUndefined();
    expect(parseBlackjackAction('hit')).toBeUndefined();
    expect(parseBlackjackAction({})).toBeUndefined();
    expect(parseBlackjackAction({ kind: 'surrender' })).toBeUndefined();
    expect(parseBlackjackAction({ kind: 'deal' })).toBeUndefined();
    expect(parseBlackjackAction({ kind: 'deal', bet: '100' })).toBeUndefined();
    expect(parseBlackjackAction({ kind: 'setBalance', amount: 1_000_000 })).toBeUndefined();
    expect(parseBlackjackAction({ kind: 'hit', balance: 999 })).toEqual({ kind: 'hit' });
  });
});
