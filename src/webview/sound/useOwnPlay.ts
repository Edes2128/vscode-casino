import { useMemo, useRef } from 'react';

/** How long after the player's own action the table's sounds still belong to this view. */
export const OWN_PLAY_MS = 20_000;

export interface OwnPlay {
  /** Call when this view sends an action to the host. */
  mark(): void;
  /** Whether this view's player did something recently, so the sounds that follow are theirs to hear. */
  isMine(): boolean;
}

/**
 * The sidebar and the editor panel show the same table. Sounds follow the view the player is
 * playing in, so a round started in one is not also heard from the other. Not focus-based on
 * purpose: switching to another window while the wheel turns must not silence the result.
 */
export function useOwnPlay(now: () => number = Date.now): OwnPlay {
  const last = useRef(Number.NEGATIVE_INFINITY);
  return useMemo(
    () => ({
      mark: () => {
        last.current = now();
      },
      isMine: () => now() - last.current < OWN_PLAY_MS,
    }),
    [now],
  );
}
