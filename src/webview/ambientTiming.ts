/**
 * How often the ambient clock ticks, in milliseconds. Presenting a frame has a fixed price, measured at
 * about 2.4 points of one CPU core for every frame per second (the same whether the page holds a lot or
 * almost nothing), so fewer ticks is the whole of the saving. 5 a second is plenty for pixel animation.
 */
export const AMBIENT_TICK_MS = 200;

/** The decorations stand still after this long without the player touching Lucky Break. */
export const REST_AFTER_MS = 15_000;

/** The clock tells the host how it is doing this often (in ticks), so the host can see it is alive. */
export const REPORT_EVERY_TICKS = 15;

/** The ambient clock's reading in seconds, as of the last tick: what `--t` is set to. */
export const ambientSeconds = (elapsedMs: number): string => ((Math.floor(elapsedMs / AMBIENT_TICK_MS) * AMBIENT_TICK_MS) / 1000).toFixed(2);
