import { useEffect, useState } from 'react';
import type { Card } from '../../game/blackjack/types';
import type { BlackjackView, TablePhase } from '../../game/blackjack/view';
import {
  dealerCardsAt,
  dealerTotalAt,
  OPENING_STEP,
  revealPlan,
  startDelayFor,
  type PresentationStep,
} from '../blackjackPresentation';

export interface DealerPresentation {
  /** The dealer's cards as the table should draw them right now. `null` is face down. */
  readonly dealerCards: readonly (Card | null)[];
  readonly dealerTotal: number | null;
  /** The result banner, hand outcomes and the updated balance may be shown. */
  readonly resultVisible: boolean;
}

interface Tracked {
  readonly round: number;
  readonly phase: TablePhase;
  /** Where the end-of-round show is up to. `undefined` means no show: draw the table as the host sent it. */
  readonly step: PresentationStep | undefined;
  readonly previousPhase: TablePhase;
}

/**
 * Paces how a settled round is shown: the hole card flips, the dealer's cards arrive one by one and
 * then the result appears. The host has long since decided the outcome. This only controls what is
 * drawn when, and it is skipped (everything shown at once) when animations are off, or when the
 * screen opens on a round that was already settled.
 */
export function useDealerReveal(view: BlackjackView, animate: boolean): DealerPresentation {
  const [tracked, setTracked] = useState<Tracked>({
    round: view.round,
    phase: view.phase,
    step: undefined,
    previousPhase: view.phase,
  });

  // Decided while rendering, not in an effect, so the settled table never flashes up before the show starts.
  if (tracked.round !== view.round || tracked.phase !== view.phase) {
    const liveSettle = animate && view.phase === 'settled' && tracked.phase !== 'settled';
    setTracked({
      round: view.round,
      phase: view.phase,
      step: liveSettle ? OPENING_STEP : undefined,
      previousPhase: tracked.phase,
    });
  }

  const showing = tracked.step !== undefined && view.phase === 'settled';
  const dealerCount = view.dealer.cards.length;

  useEffect(() => {
    if (!showing) return;
    const round = view.round;
    const timers = revealPlan(dealerCount, startDelayFor(tracked.previousPhase)).map((step) =>
      window.setTimeout(() => setTracked((current) => (current.round === round ? { ...current, step } : current)), step.atMs),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
    // Once per settled round: the timers move `step` themselves.
  }, [showing, view.round]);

  const step = showing ? tracked.step : undefined;
  if (step === undefined) {
    return {
      dealerCards: view.dealer.cards,
      dealerTotal: view.dealer.total,
      resultVisible: view.phase === 'settled',
    };
  }
  return {
    dealerCards: dealerCardsAt(view.dealer.cards, step),
    dealerTotal: dealerTotalAt(view.dealer.cards, step),
    resultVisible: step.resultVisible,
  };
}
