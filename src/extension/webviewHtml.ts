import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as vscode from 'vscode';
import type { AssetSource } from './assetSource';

/** Built webview files. `vite.config.ts` emits these exact (unhashed) entry names. */
const WEBVIEW_DIST = ['dist', 'webview'] as const;
const ENTRY_JS = ['assets', 'webview.js'] as const;
const ENTRY_CSS = ['assets', 'webview.css'] as const;

/** Entry module served by the Vite dev server (its root is `src/webview`). */
const DEV_ENTRY = '/main.tsx';

export function getWebviewRoot(extensionUri: vscode.Uri): vscode.Uri {
  return vscode.Uri.joinPath(extensionUri, ...WEBVIEW_DIST);
}

/** Webviews may only load files from the built webview folder. */
export function getWebviewOptions(extensionUri: vscode.Uri): vscode.WebviewOptions {
  return {
    enableScripts: true,
    localResourceRoots: [getWebviewRoot(extensionUri)],
  };
}

/** Renders the HTML shell for a webview. All markup is generated here, never from webview input. */
export function renderWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  source: AssetSource,
): string {
  const nonce = crypto.randomBytes(16).toString('base64');

  // Compiled out of the packaged extension, with the relaxed security policy the dev server needs.
  if (__DEV_TOOLS__ && source.kind === 'dev') {
    return renderDevHtml(webview, source.serverUrl, nonce);
  }

  const root = getWebviewRoot(extensionUri);
  const js = vscode.Uri.joinPath(root, ...ENTRY_JS);
  const css = vscode.Uri.joinPath(root, ...ENTRY_CSS);
  if (!fs.existsSync(js.fsPath) || !fs.existsSync(css.fsPath)) {
    return renderMissingBundleHtml(nonce);
  }

  const csp = [
    `default-src 'none'`,
    `img-src ${webview.cspSource} data:`,
    `font-src ${webview.cspSource}`,
    `style-src ${webview.cspSource}`,
    `script-src 'nonce-${nonce}' ${webview.cspSource}`,
  ].join('; ');

  return page(csp, `<link rel="stylesheet" href="${webview.asWebviewUri(css)}">`, [
    `<script type="module" nonce="${nonce}" src="${webview.asWebviewUri(js)}"></script>`,
  ]);
}

/**
 * Development shell: modules, styles and the HMR socket come from the Vite dev server.
 * The CSP is relaxed only as far as Vite needs (inline styles for HMR, the dev origin,
 * its websocket). `eval` is never allowed.
 */
function renderDevHtml(webview: vscode.Webview, serverUrl: URL, nonce: string): string {
  const origin = serverUrl.origin;
  const socket = `ws://${serverUrl.host}`;

  const csp = [
    `default-src 'none'`,
    `img-src ${webview.cspSource} ${origin} data:`,
    `font-src ${webview.cspSource} ${origin}`,
    `style-src ${webview.cspSource} ${origin} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}' ${webview.cspSource} ${origin}`,
    `connect-src ${origin} ${socket}`,
  ].join('; ');

  // React Fast Refresh preamble, as documented for backend integrations of @vitejs/plugin-react.
  const refreshPreamble = `<script type="module" nonce="${nonce}">
      import RefreshRuntime from '${origin}/@react-refresh';
      RefreshRuntime.injectIntoGlobalHook(window);
      window.$RefreshReg$ = () => {};
      window.$RefreshSig$ = () => (type) => type;
      window.__vite_plugin_react_preamble_installed__ = true;
    </script>`;

  return page(csp, '', [
    refreshPreamble,
    `<script type="module" nonce="${nonce}" src="${origin}/@vite/client"></script>`,
    `<script type="module" nonce="${nonce}" src="${origin}${DEV_ENTRY}"></script>`,
  ]);
}

/** Shown instead of a blank webview when `npm run build` has not been run. */
function renderMissingBundleHtml(nonce: string): string {
  const csp = `default-src 'none'; style-src 'nonce-${nonce}'`;
  const style = `<style nonce="${nonce}">
      body { font-family: monospace; color: #F2F0E8; background: #101216; padding: 16px; }
      code { color: #F5C451; }
    </style>`;
  return page(
    csp,
    style,
    [],
    `<p>Lucky Break webview bundle is missing.</p><p>Run <code>npm run build</code> and reload the window.</p>`,
  );
}

function page(csp: string, head: string, scripts: readonly string[], body = '<div id="root"></div>'): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lucky Break</title>
    ${head}
  </head>
  <body>
    ${body}
    ${scripts.join('\n    ')}
  </body>
</html>`;
}
