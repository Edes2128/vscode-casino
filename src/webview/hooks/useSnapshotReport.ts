import { useEffect } from 'react';
import type { CasinoSnapshot } from '../../casino/types';
import type { HostConnection } from '../host';

/**
 * Tells the host which state this webview has just drawn. After a change the host can see when
 * every open view has caught up, and the integration tests use it to prove the sidebar and the
 * editor panel always show the same casino.
 */
export function useSnapshotReport(host: HostConnection, snapshot: CasinoSnapshot | undefined): void {
  useEffect(() => {
    if (snapshot === undefined) return;
    host.post({
      type: 'snapshotShown',
      balance: snapshot.balance,
      gamesPlayed: snapshot.stats.overall.gamesPlayed,
    });
  }, [host, snapshot]);
}
