import { createContext, useContext } from 'react';

/**
 * Lets a screen hold the balance on display while it finishes showing something, such as the
 * dealer playing out a hand. The real balance is always up to date underneath.
 */
export interface Presentation {
  /** Show `balance` instead of the real one. `undefined` goes back to the real one. */
  holdBalance(balance: number | undefined): void;
}

export const PresentationContext = createContext<Presentation>({ holdBalance: () => undefined });

export const usePresentation = (): Presentation => useContext(PresentationContext);
