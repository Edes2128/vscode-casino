import { join } from 'node:path';
import { build } from 'esbuild';
import { describe, expect, it } from 'vitest';

/**
 * Builds the extension the way the package does (see scripts/build-extension.mjs) and looks at what is in it.
 * The packaged extension must not contain developer tooling: an HTTP client that probes a dev server, switches
 * read from environment variables, a test API that hands out the wallet, or the relaxed security policy of the
 * dev-server page. They are compiled out with `__DEV_TOOLS__`, and this test is what keeps them out.
 */
async function bundle(devTools: boolean): Promise<string> {
  const result = await build({
    entryPoints: [join(__dirname, 'extension.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    minify: true,
    write: false,
    logLevel: 'silent',
    external: ['vscode'],
    define: { __DEV_TOOLS__: String(devTools) },
  });
  return result.outputFiles[0]?.text ?? '';
}

/** Things that only developer tooling needs. */
const DEV_ONLY = [
  'node:http',
  'process.env',
  'CASINO_',
  'localhost',
  '127.0.0.1',
  'unsafe-inline',
  'ws://',
  'react-refresh',
  '@vite',
  'sendFromWebview',
  'answerResetsWith',
];

describe('the packaged extension', () => {
  it('contains none of the developer tooling', async () => {
    const code = await bundle(false);
    const found = DEV_ONLY.filter((needle) => code.includes(needle));
    expect(found, `dev-only code in the production bundle: ${found.join(', ')}`).toEqual([]);
  });

  it('uses only the Node modules it needs: crypto for the page nonce, fs to find its own files', async () => {
    const code = await bundle(false);
    const required = [...new Set([...code.matchAll(/require\("([^"]+)"\)/g)].map((match) => match[1]))].sort();
    expect(required).toEqual(['node:crypto', 'node:fs', 'vscode']);
  });

  it('knows no website but the optional support page', async () => {
    const code = await bundle(false);
    const urls = [...new Set([...code.matchAll(/https?:\/\/[A-Za-z0-9./_#?=&%-]+/g)].map((match) => match[0]))];
    expect(urls).toEqual(['https://buymeacoffee.com/5x2bfo6t5c']);
  });

  it('really does contain that tooling when it is switched on, so the checks above are not empty', async () => {
    const code = await bundle(true);
    for (const needle of ['node:http', 'process.env', 'CASINO_DEV_SERVER_URL', 'unsafe-inline', 'sendFromWebview']) {
      expect(code, needle).toContain(needle);
    }
  });
});
