/**
 * Saves the latest state without ever running two saves at once. Changes that arrive while a save
 * is running are folded into one more save, so a burst of changes costs one write, and the last
 * write always carries the newest state.
 */
export class WriteQueue {
  readonly #write: () => PromiseLike<void>;
  readonly #onError: (error: unknown) => void;

  #dirty = false;
  #writing: Promise<void> | undefined;

  /** `write` must read the state when it is called, not when `schedule` was: it saves the latest. */
  constructor(write: () => PromiseLike<void>, onError: (error: unknown) => void) {
    this.#write = write;
    this.#onError = onError;
  }

  /** Asks for the current state to be saved soon. */
  schedule(): void {
    this.#dirty = true;
    this.#writing ??= this.#drain();
  }

  /** Resolves once everything scheduled so far has been written. Call before shutting down. */
  async flush(): Promise<void> {
    // A save in progress can be followed by another one, so wait until none is left. Bounded so a
    // bug can never turn shutdown into an endless loop.
    for (let pass = 0; pass < 100 && this.#writing !== undefined; pass += 1) await this.#writing;
  }

  async #drain(): Promise<void> {
    // Yield first. `#writing` is assigned from this method's return value, so the `finally` below
    // must never run before that assignment, which could happen if storage failed instantly
    // (for example by throwing instead of returning a rejected promise).
    await Promise.resolve();
    try {
      while (this.#dirty) {
        this.#dirty = false;
        try {
          await this.#write();
        } catch (error) {
          this.#onError(error);
        }
      }
    } finally {
      this.#writing = undefined;
    }
  }
}
