import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DebouncedCommit } from './debouncedCommit';

describe('DebouncedCommit', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setup = () => {
    const sent: number[] = [];
    return { sent, commit: new DebouncedCommit<number>((value) => sent.push(value), 300) };
  };

  it('sends only the value the changes stopped on', () => {
    const { sent, commit } = setup();
    for (const value of [1, 2, 3, 4]) {
      commit.schedule(value);
      vi.advanceTimersByTime(100);
    }
    expect(sent).toEqual([]);
    vi.advanceTimersByTime(300);
    expect(sent).toEqual([4]);
    expect(commit.isWaiting).toBe(false);
  });

  it('knows when a value is waiting', () => {
    const { commit } = setup();
    expect(commit.isWaiting).toBe(false);
    commit.schedule(1);
    expect(commit.isWaiting).toBe(true);
  });

  it('sends at once on now, and drops what was waiting', () => {
    const { sent, commit } = setup();
    commit.schedule(1);
    commit.now(2);
    vi.advanceTimersByTime(1000);
    expect(sent).toEqual([2]);
    expect(commit.isWaiting).toBe(false);
  });

  it('flushes what is waiting, once, and nothing when nothing waits', () => {
    const { sent, commit } = setup();
    commit.flush();
    expect(sent).toEqual([]);
    commit.schedule(7);
    commit.flush();
    commit.flush();
    vi.advanceTimersByTime(1000);
    expect(sent).toEqual([7]);
  });
});
