/**
 * The vocabulary of a reset, shared by the host and the webview. Kept apart from the code that
 * performs resets (`resets.ts`) so the webview bundle never contains any of that.
 */

/** What a reset wipes. Settings are never part of it. */
export type ResetScope = 'balance' | 'statistics' | 'all';

export const RESET_SCOPES: readonly ResetScope[] = ['balance', 'statistics', 'all'];

export const isResetScope = (value: unknown): value is ResetScope => RESET_SCOPES.includes(value as ResetScope);

/**
 * `done`: the reset happened. `cancelled`: the player said no. `round-in-progress`: a hand is still
 * being played, nothing changed. `busy`: another reset is already waiting for an answer.
 */
export type ResetOutcome = 'done' | 'cancelled' | 'round-in-progress' | 'busy';

export const RESET_OUTCOMES: readonly ResetOutcome[] = ['done', 'cancelled', 'round-in-progress', 'busy'];

export const isResetOutcome = (value: unknown): value is ResetOutcome => RESET_OUTCOMES.includes(value as ResetOutcome);
