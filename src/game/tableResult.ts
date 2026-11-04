import type { RoundError } from '../casino/store';

/** Why a game table refused an action. Nothing changed. */
export type TableError =
  | RoundError
  /** A round is still being played. */
  | 'round-active'
  /** The rules do not allow that right now. */
  | 'not-allowed';

export type TableResult = { readonly ok: true } | { readonly ok: false; readonly error: TableError };

export const OK: TableResult = { ok: true };

export const fail = (error: TableError): TableResult => ({ ok: false, error });
