import { createInitialSnapshot } from '../state/snapshot';
import type { PreviewLuckyBreak } from './dev/previewLuckyBreak';
import {
  parseHostMessage,
  type HostToWebviewMessage,
  type ViewKind,
  type WebviewToHostMessage,
} from '../shared/messages';

interface VsCodeApi {
  postMessage(message: WebviewToHostMessage): void;
}

/** Injected by VS Code into every webview. It may only be called once per page. */
declare function acquireVsCodeApi(): VsCodeApi;

export type HostListener = (message: HostToWebviewMessage) => void;

/** The webview's only line to the outside world. The extension host is authoritative. */
export interface HostConnection {
  readonly isVsCode: boolean;
  post(message: WebviewToHostMessage): void;
  /** Returns an unsubscribe function. */
  subscribe(listener: HostListener): () => void;
}

export function connectToHost(): HostConnection {
  return typeof acquireVsCodeApi === 'function' ? connectToVsCode() : createBrowserPreview();
}

function connectToVsCode(): HostConnection {
  const api = acquireVsCodeApi();
  const listeners = new Set<HostListener>();

  window.addEventListener('message', (event: MessageEvent<unknown>) => {
    const message = parseHostMessage(event.data);
    if (message === undefined) return;
    for (const listener of listeners) listener(message);
  });

  return {
    isVsCode: true,
    post: (message) => api.postMessage(message),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * Stand-in host for opening the page in a plain browser (`npm run dev:webview`) so the UI can be
 * developed and inspected without launching VS Code. Never used inside VS Code, where
 * `acquireVsCodeApi` always exists. Add `?view=panel` to preview the wide layout.
 *
 * With the dev server it runs the real game (see dev/previewLuckyBreak.ts) so games are playable. In
 * a production build, which has none of that, it only answers with a fresh, static game.
 */
function createBrowserPreview(): HostConnection {
  const listeners = new Set<HostListener>();
  const query = new URLSearchParams(window.location.search);
  const viewKind: ViewKind = query.get('view') === 'panel' ? 'panel' : 'sidebar';

  const emit = (message: HostToWebviewMessage): void => {
    for (const listener of listeners) listener(message);
  };

  let luckyBreak: Promise<PreviewLuckyBreak> | undefined;

  return {
    isVsCode: false,
    post: (message) => {
      if (import.meta.env.DEV) {
        luckyBreak ??= import('./dev/previewLuckyBreak').then(({ createPreviewLuckyBreak }) =>
          createPreviewLuckyBreak(emit, query, viewKind),
        );
        void luckyBreak.then((preview) => preview.handle(message));
        return;
      }

      if (message.type !== 'ready') return;
      window.setTimeout(() => {
        emit({ type: 'init', payload: { extensionVersion: 'browser-preview', viewKind, assetMode: 'prod' } });
        emit({ type: 'state', payload: createInitialSnapshot() });
      }, 0);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
