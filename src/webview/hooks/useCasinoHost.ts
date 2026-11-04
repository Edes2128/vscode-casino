import { useEffect, useRef, useState } from 'react';
import type { Settings } from '../../casino/settings';
import type { CasinoSnapshot } from '../../casino/types';
import type { BlackjackView } from '../../game/blackjack/view';
import type { RouletteView } from '../../game/roulette/view';
import type { InitPayload } from '../../shared/messages';
import type { HostConnection } from '../host';
import type { Rejection } from '../pages/Blackjack';
import type { ResetResult } from '../pages/Settings';

export interface CasinoHostState {
  /** Facts about this webview; `undefined` until the host answers. */
  readonly init: InitPayload | undefined;
  /** The latest casino state from the host; `undefined` until the host answers. */
  readonly snapshot: CasinoSnapshot | undefined;
  /** The blackjack table as the host last sent it. */
  readonly blackjack: BlackjackView | undefined;
  /** The roulette table as the host last sent it. */
  readonly roulette: RouletteView | undefined;
  /** The host's most recent refusal of an action. */
  readonly rejection: Rejection | undefined;
  /** The player's settings; `undefined` until the host sends them. */
  readonly settings: Settings | undefined;
  /** How the most recent reset request ended. */
  readonly resetResult: ResetResult | undefined;
}

/** Announces `ready` to the host and tracks everything it sends back. */
export function useCasinoHost(host: HostConnection): CasinoHostState {
  const [init, setInit] = useState<InitPayload>();
  const [snapshot, setSnapshot] = useState<CasinoSnapshot>();
  const [blackjack, setBlackjack] = useState<BlackjackView>();
  const [roulette, setRoulette] = useState<RouletteView>();
  const [rejection, setRejection] = useState<Rejection>();
  const [settings, setSettings] = useState<Settings>();
  const [resetResult, setResetResult] = useState<ResetResult>();
  const rejections = useRef(0);
  const resets = useRef(0);

  useEffect(() => {
    const unsubscribe = host.subscribe((message) => {
      switch (message.type) {
        case 'init':
          setInit(message.payload);
          break;
        case 'state':
          setSnapshot(message.payload);
          break;
        case 'blackjack':
          setBlackjack(message.view);
          break;
        case 'roulette':
          setRoulette(message.view);
          break;
        case 'settings':
          setSettings(message.payload);
          break;
        case 'resetResult':
          resets.current += 1;
          setResetResult({ id: resets.current, scope: message.scope, outcome: message.outcome });
          break;
        case 'rejected':
          rejections.current += 1;
          setRejection({ id: rejections.current, error: message.error });
          break;
      }
    });
    host.post({ type: 'ready' });
    return unsubscribe;
  }, [host]);

  return { init, snapshot, blackjack, roulette, rejection, settings, resetResult };
}
