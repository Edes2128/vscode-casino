import type { KeyValueStorage } from './persistence';

/**
 * In-memory stand-in for VS Code's `globalState`, for tests. Like the real thing it stores
 * serialised values (so saved objects can never alias live ones), and writes are asynchronous.
 */
export class MemoryStorage implements KeyValueStorage {
  readonly #data = new Map<string, string>();
  #held: Array<() => void> | undefined;

  /** Every successful write, in order, as it was saved. */
  readonly writes: Array<{ readonly key: string; readonly value: unknown }> = [];

  /** While true, every write fails like a full disk (a rejected promise). */
  failWrites = false;

  /** While true, `update` throws instead of returning a promise, as a misbehaving backend might. */
  throwWrites = false;

  get(key: string): unknown {
    const raw = this.#data.get(key);
    return raw === undefined ? undefined : (JSON.parse(raw) as unknown);
  }

  update(key: string, value: unknown): Promise<void> {
    if (this.throwWrites) throw new Error('storage exploded');
    if (this.failWrites) return Promise.reject(new Error('disk full'));

    // Serialise now, so what is written is what the caller passed at this moment.
    const serialised = value === undefined ? undefined : JSON.stringify(value);
    const commit = (): void => {
      if (serialised === undefined) this.#data.delete(key);
      else this.#data.set(key, serialised);
      this.writes.push({ key, value: serialised === undefined ? undefined : (JSON.parse(serialised) as unknown) });
    };

    const held = this.#held;
    if (held === undefined) {
      commit();
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      held.push(() => {
        commit();
        resolve();
      });
    });
  }

  /** Puts something straight into storage, bypassing the store (to simulate old or damaged data). */
  seed(key: string, value: unknown): void {
    this.#data.set(key, JSON.stringify(value));
  }

  /** Queues writes instead of completing them, until `release()`. */
  hold(): void {
    this.#held = [];
  }

  release(): void {
    const pending = this.#held ?? [];
    this.#held = undefined;
    for (const complete of pending) complete();
  }
}
