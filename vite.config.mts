import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const fromRoot = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

/** Must match BREAK_ROOM_DEV_SERVER_URL on the extension side (see .vscode/launch.json). */
const devServerOrigin = process.env['BREAK_ROOM_DEV_SERVER_URL'] ?? 'http://localhost:5173';

/**
 * The webview is built with fixed (unhashed) entry names so the extension host can
 * reference them without reading a manifest: see ENTRY_JS and ENTRY_CSS in src/extension/webviewHtml.ts.
 */
export default defineConfig({
  root: fromRoot('./src/webview'),
  base: './',
  publicDir: fromRoot('./public'),
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    cors: true,
    // The page is served from vscode-webview://, not from the dev server, so root-relative
    // asset URLs (fonts, images) in injected CSS would resolve against the wrong origin.
    origin: devServerOrigin,
  },
  build: {
    outDir: fromRoot('./dist/webview'),
    emptyOutDir: true,
    target: 'es2022',
    // Never inline assets as data: URIs; the CSP only allows files served from the extension.
    assetsInlineLimit: 0,
    cssCodeSplit: false,
    sourcemap: false,
    rolldownOptions: {
      input: { webview: fromRoot('./src/webview/main.tsx') },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        // With cssCodeSplit off there is exactly one stylesheet; pin its name for the host.
        assetFileNames: (asset) =>
          asset.names.some((name) => name.endsWith('.css'))
            ? 'assets/webview.css'
            : 'assets/[name]-[hash][extname]',
      },
    },
  },
});
