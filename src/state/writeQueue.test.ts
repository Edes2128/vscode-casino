import { describe, expect, it } from 'vitest';
import { WriteQueue } from './writeQueue';

const tick = async (): Promise<void> => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
};

/** Writes that finish when the test says so. `inFlight` is how many have started and not finished. */
function slowWrites() {
  const log: number[] = [];
  const running: Array<() => void> = [];
  let value = 0;
  const queue = new WriteQueue(
    () => {
      const saved = value;
      return new Promise<void>((resolve) => {
        running.push(() => {
          log.push(saved);
          resolve();
        });
      });
    },
    () => undefined,
  );
  return {
    queue,
    log,
    set: (next: number) => {
      value = next;
      queue.schedule();
    },
    finishOne: async () => {
      running.shift()?.();
      await tick();
    },
    inFlight: () => running.length,
  };
}

describe('WriteQueue', () => {
  it('folds a burst of changes into a single write of the latest state', async () => {
    const writes: number[] = [];
    let value = 0;
    const queue = new WriteQueue(
      async () => {
        writes.push(value);
      },
      () => undefined,
    );
    for (const next of [1, 2, 3, 4, 5]) {
      value = next;
      queue.schedule();
    }
    await queue.flush();
    expect(writes).toEqual([5]);
  });

  it('never runs two writes at once and follows a slow one with exactly one more', async () => {
    const t = slowWrites();
    t.set(1);
    await tick();
    expect(t.inFlight()).toBe(1);

    t.set(2);
    t.set(3);
    await tick();
    expect(t.inFlight()).toBe(1); // still only the first one

    await t.finishOne();
    expect(t.inFlight()).toBe(1); // the follow-up, carrying the latest value
    await t.finishOne();
    await t.queue.flush();
    expect(t.log).toEqual([1, 3]);
    expect(t.inFlight()).toBe(0);
  });

  it('flush waits for the write in progress and for the one that follows it', async () => {
    const t = slowWrites();
    t.set(1);
    await tick();
    t.set(2);

    let flushed = false;
    const flushing = t.queue.flush().then(() => {
      flushed = true;
    });
    await t.finishOne();
    expect(flushed).toBe(false); // the second write is still to come
    await t.finishOne();
    await flushing;
    expect(flushed).toBe(true);
    expect(t.log).toEqual([1, 2]);
  });

  it('flush resolves at once when nothing is waiting', async () => {
    const queue = new WriteQueue(async () => undefined, () => undefined);
    await expect(queue.flush()).resolves.toBeUndefined();
  });

  it('reports a failed write, keeps going and saves the latest state next time', async () => {
    const errors: unknown[] = [];
    const saved: number[] = [];
    let value = 0;
    let failing = true;
    const queue = new WriteQueue(
      async () => {
        if (failing) throw new Error('disk full');
        saved.push(value);
      },
      (error) => errors.push(error),
    );

    value = 1;
    queue.schedule();
    await queue.flush();
    expect(errors).toHaveLength(1);

    failing = false;
    value = 2;
    queue.schedule();
    await queue.flush();
    expect(saved).toEqual([2]);
  });

  it('survives a write that throws instead of returning a rejected promise', async () => {
    const errors: unknown[] = [];
    let explode = true;
    let saved = 0;
    const queue = new WriteQueue(
      () => {
        if (explode) throw new Error('storage exploded');
        saved += 1;
        return Promise.resolve();
      },
      (error) => errors.push(error),
    );

    queue.schedule();
    await queue.flush();
    expect(errors).toHaveLength(1);

    explode = false;
    queue.schedule();
    await queue.flush();
    expect(saved).toBe(1);
  });
});
