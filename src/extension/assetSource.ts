import * as vscode from 'vscode';
import type { AssetMode } from '../shared/messages';
import type { Logger } from './logger';

/** Environment variable that points the webview at a running Vite dev server (HMR). */
export const DEV_SERVER_ENV = 'BREAK_ROOM_DEV_SERVER_URL';

const PROBE_TIMEOUT_MS = 800;
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export type AssetSource =
  | { readonly kind: 'prod' }
  | { readonly kind: 'dev'; readonly serverUrl: URL };

export const assetMode = (source: AssetSource): AssetMode => source.kind;

/**
 * Decides where the webview bundle comes from.
 *
 * Production (an installed extension) always uses the bundled `dist/webview` files. The
 * Vite dev server is only considered when the extension runs from source (development or
 * test mode), `BREAK_ROOM_DEV_SERVER_URL` is set, it points at the loopback interface and the
 * server actually answers. Otherwise we fall back to the production bundle.
 */
export async function resolveAssetSource(
  context: vscode.ExtensionContext,
  logger: Logger,
): Promise<AssetSource> {
  // In the packaged extension `__DEV_TOOLS__` is the literal false, so the next line is deleted together
  // with everything it uses (the dev-server probing and its HTTP client): this function is just the last line.
  if (__DEV_TOOLS__) return resolveDevAssetSource(context, logger);
  return { kind: 'prod' };
}

async function resolveDevAssetSource(
  context: vscode.ExtensionContext,
  logger: Logger,
): Promise<AssetSource> {
  const configured = process.env[DEV_SERVER_ENV];
  if (context.extensionMode === vscode.ExtensionMode.Production || !configured) {
    return { kind: 'prod' };
  }

  let serverUrl: URL;
  try {
    serverUrl = new URL(configured);
  } catch {
    logger.warn(`${DEV_SERVER_ENV} is not a valid URL ("${configured}"); using the production bundle.`);
    return { kind: 'prod' };
  }

  if (serverUrl.protocol !== 'http:' || !LOOPBACK_HOSTS.has(serverUrl.hostname)) {
    logger.warn(`${DEV_SERVER_ENV} must be an http:// loopback URL; using the production bundle.`);
    return { kind: 'prod' };
  }

  if (!(await isReachable(serverUrl))) {
    logger.warn(`Vite dev server at ${serverUrl.origin} is not reachable; using the production bundle.`);
    return { kind: 'prod' };
  }

  logger.info(`Using the Vite dev server at ${serverUrl.origin} (HMR).`);
  return { kind: 'dev', serverUrl };
}

async function isReachable(url: URL): Promise<boolean> {
  const http = await import('node:http');
  return new Promise((resolve) => {
    const request = http.get(url.origin, { timeout: PROBE_TIMEOUT_MS }, (response) => {
      response.resume();
      resolve((response.statusCode ?? 500) < 500);
    });
    request.on('timeout', () => request.destroy());
    request.on('error', () => resolve(false));
  });
}
