/**
 * Sends the latest value once changes stop for `delayMs`. Dragging a color picker produces dozens of changes a
 * second; the host should hear about the one the player stopped on. `now` sends at once (a preset, a reset), and
 * `flush` sends whatever is waiting, so nothing the player picked is lost when they leave the screen.
 */
export class DebouncedCommit<T> {
  readonly #send: (value: T) => void;
  readonly #delayMs: number;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #waiting: { readonly value: T } | undefined;

  constructor(send: (value: T) => void, delayMs: number) {
    this.#send = send;
    this.#delayMs = delayMs;
  }

  /** Whether a value is waiting to be sent. */
  get isWaiting(): boolean {
    return this.#waiting !== undefined;
  }

  schedule(value: T): void {
    clearTimeout(this.#timer);
    this.#waiting = { value };
    this.#timer = setTimeout(() => this.flush(), this.#delayMs);
  }

  /** Sends `value` now, replacing anything that was waiting. */
  now(value: T): void {
    this.#cancel();
    this.#send(value);
  }

  /** Sends the waiting value, if there is one. */
  flush(): void {
    const waiting = this.#waiting;
    this.#cancel();
    if (waiting !== undefined) this.#send(waiting.value);
  }

  #cancel(): void {
    clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#waiting = undefined;
  }
}
