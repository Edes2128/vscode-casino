import { describe, expect, it } from 'vitest';
import {
  blackjackCues,
  outcomeCue,
  rouletteCues,
  type BlackjackFrame,
  type RouletteFrame,
} from './gameCues';

const table = (overrides: Partial<BlackjackFrame> = {}): BlackjackFrame => ({
  cards: 0,
  holeUp: false,
  result: undefined,
  ...overrides,
});

describe('outcomeCue', () => {
  it('gives each way a round can end its own jingle', () => {
    expect(outcomeCue('win')).toBe('win');
    expect(outcomeCue('special')).toBe('bigWin');
    expect(outcomeCue('loss')).toBe('lose');
    expect(outcomeCue('push')).toBe('push');
  });
});

describe('blackjack sounds', () => {
  it('makes nothing when nothing changed', () => {
    const frame = table({ cards: 4 });
    expect(blackjackCues(frame, frame)).toEqual([]);
    expect(blackjackCues(table(), table())).toEqual([]);
  });

  it('plays one swish per card of the deal', () => {
    expect(blackjackCues(table(), table({ cards: 4 }))).toEqual([{ cue: 'card', options: { count: 4 } }]);
  });

  it('plays a swish for a hit, a double down and a dealer draw', () => {
    expect(blackjackCues(table({ cards: 4 }), table({ cards: 5 }))).toEqual([{ cue: 'card', options: { count: 1 } }]);
  });

  it('is silent when cards leave the table for the next round', () => {
    expect(blackjackCues(table({ cards: 6, result: { round: 1, kind: 'win' } }), table())).toEqual([]);
  });

  it('plays the flip when the hole card is turned over, and no swish for it', () => {
    expect(blackjackCues(table({ cards: 4 }), table({ cards: 4, holeUp: true }))).toEqual([{ cue: 'flip' }]);
  });

  it('does not flip for a hole card that was never seen face down', () => {
    // A natural blackjack settles at once: the hole card is up in the very first frame of the round.
    const planned = blackjackCues(table(), table({ cards: 4, holeUp: true }));
    expect(planned.map((item) => item.cue)).toEqual(['card']);
  });

  it('plays the jingle once, when the result first shows, and not again for the same round', () => {
    const result = { round: 3, kind: 'win' as const };
    expect(blackjackCues(table({ cards: 5, holeUp: true }), table({ cards: 5, holeUp: true, result }))).toEqual([{ cue: 'win' }]);
    expect(blackjackCues(table({ cards: 5, holeUp: true, result }), table({ cards: 5, holeUp: true, result }))).toEqual([]);
  });

  it('plays the jingle again for the next round, even if it ends the same way', () => {
    const first = table({ cards: 5, holeUp: true, result: { round: 3, kind: 'loss' } });
    const second = table({ cards: 5, holeUp: true, result: { round: 4, kind: 'loss' } });
    expect(blackjackCues(first, second)).toEqual([{ cue: 'lose' }]);
  });

  it('picks the jingle by how the round ended', () => {
    const play = (kind: 'win' | 'loss' | 'push' | 'special') =>
      blackjackCues(table({ cards: 4, holeUp: true }), table({ cards: 4, holeUp: true, result: { round: 1, kind } }))[0]?.cue;
    expect(play('win')).toBe('win');
    expect(play('loss')).toBe('lose');
    expect(play('push')).toBe('push');
    expect(play('special')).toBe('bigWin');
  });

  it('lets the cards land first when the result arrives with them, as with animations off', () => {
    const planned = blackjackCues(
      table({ cards: 4 }),
      table({ cards: 6, holeUp: true, result: { round: 1, kind: 'win' } }),
    );
    expect(planned.map((item) => item.cue)).toEqual(['flip', 'card', 'win']);
    const jingle = planned.at(-1);
    expect(jingle?.options?.delayMs).toBeGreaterThanOrEqual(2 * 140);
  });

  it('plays an instant natural blackjack in a sensible order: the deal, then the jingle', () => {
    const planned = blackjackCues(table(), table({ cards: 4, holeUp: true, result: { round: 1, kind: 'special' } }));
    expect(planned.map((item) => item.cue)).toEqual(['card', 'bigWin']);
    expect(planned[1]?.options?.delayMs).toBeGreaterThanOrEqual(4 * 140);
  });
});

const wheel = (overrides: Partial<RouletteFrame> = {}): RouletteFrame => ({
  spin: 0,
  phase: 'idle',
  live: false,
  kind: undefined,
  ...overrides,
});

describe('roulette sounds', () => {
  it('rattles when the wheel starts to turn, for as long as it will turn', () => {
    expect(rouletteCues(wheel(), wheel({ spin: 1, phase: 'spinning', live: true }), 5_500)).toEqual([
      { cue: 'spin', options: { durationMs: 5_500 } },
    ]);
    expect(rouletteCues(wheel({ spin: 1, phase: 'result' }), wheel({ spin: 2, phase: 'spinning', live: true }), 900)).toEqual([
      { cue: 'spin', options: { durationMs: 900 } },
    ]);
  });

  it('keeps quiet while it turns', () => {
    const turning = wheel({ spin: 1, phase: 'spinning', live: true });
    expect(rouletteCues(turning, turning, 5_500)).toEqual([]);
  });

  it('plays the jingle when the ball stops, by how the spin ended', () => {
    const turning = wheel({ spin: 1, phase: 'spinning', live: true });
    const stopped = (kind: 'win' | 'loss' | 'special') => wheel({ spin: 1, phase: 'result', live: true, kind });
    expect(rouletteCues(turning, stopped('win'), 5_500)).toEqual([{ cue: 'win' }]);
    expect(rouletteCues(turning, stopped('loss'), 5_500)).toEqual([{ cue: 'lose' }]);
    expect(rouletteCues(turning, stopped('special'), 5_500)).toEqual([{ cue: 'bigWin' }]);
  });

  it('plays nothing for a result that was already there when the screen opened', () => {
    expect(rouletteCues(wheel(), wheel({ spin: 4, phase: 'result', live: false, kind: 'win' }), 5_500)).toEqual([]);
  });

  it('with animations off, plays only the jingle, for every spin including the second', () => {
    const first = wheel({ spin: 1, phase: 'result', live: true, kind: 'win' });
    expect(rouletteCues(wheel(), first, 5_500)).toEqual([{ cue: 'win' }]);
    const second = wheel({ spin: 2, phase: 'result', live: true, kind: 'loss' });
    expect(rouletteCues(first, second, 5_500)).toEqual([{ cue: 'lose' }]);
    expect(rouletteCues(second, second, 5_500)).toEqual([]);
  });

  it('is silent when the result is wiped by a reset', () => {
    expect(rouletteCues(wheel({ spin: 3, phase: 'result', live: true, kind: 'win' }), wheel({ spin: 3, phase: 'idle' }), 5_500)).toEqual([]);
  });
});
