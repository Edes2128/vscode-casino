import type { HostConnection } from './host';

/**
 * Forwards CSP violations and uncaught errors to the extension host's "Casino" output
 * channel. A blocked script or font would otherwise just leave a silent blank webview.
 */
export function installDiagnostics(host: HostConnection): void {
  document.addEventListener('securitypolicyviolation', (event) => {
    host.post({
      type: 'cspViolation',
      directive: event.effectiveDirective,
      blockedUri: event.blockedURI,
    });
  });

  window.addEventListener('error', (event) => {
    host.post({ type: 'error', message: event.message });
  });

  window.addEventListener('unhandledrejection', (event) => {
    host.post({ type: 'error', message: `Unhandled rejection: ${String(event.reason)}` });
  });
}
