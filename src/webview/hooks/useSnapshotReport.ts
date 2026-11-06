import { useEffect } from 'react';
import type { BreakRoomSnapshot } from '../../state/types';
import type { HostConnection } from '../host';

/**
 * Tells the host which state this webview has just drawn. After a change the host can see when
 * every open view has caught up, and the integration tests use it to prove the sidebar and the
 * editor panel always show the same game.
 */
export function useSnapshotReport(host: HostConnection, snapshot: BreakRoomSnapshot | undefined): void {
  useEffect(() => {
    if (snapshot === undefined) return;
    host.post({
      type: 'snapshotShown',
      balance: snapshot.balance,
      gamesPlayed: snapshot.stats.overall.gamesPlayed,
    });
  }, [host, snapshot]);
}
