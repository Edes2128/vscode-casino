import { useEffect } from 'react';
import type { CasinoPage } from '../../shared/messages';
import type { HostConnection } from '../host';

/** Lets the host switch this webview to another screen. */
export function useHostNavigation(host: HostConnection, navigate: (page: CasinoPage) => void): void {
  useEffect(
    () =>
      host.subscribe((message) => {
        if (message.type === 'navigate') navigate(message.page);
      }),
    [host, navigate],
  );
}
