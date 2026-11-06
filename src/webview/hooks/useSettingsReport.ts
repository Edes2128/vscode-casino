import { useEffect } from 'react';
import type { Settings } from '../../state/settings';
import type { HostConnection } from '../host';

/**
 * Tells the host which settings this webview has just applied, the same way `useSnapshotReport`
 * does for Break Room Arcade state: it lets the integration tests prove that the sidebar and the editor
 * panel always run with the same settings.
 */
export function useSettingsReport(host: HostConnection, settings: Settings | undefined): void {
  useEffect(() => {
    if (settings === undefined) return;
    host.post({ type: 'settingsShown', settings });
  }, [host, settings]);
}
