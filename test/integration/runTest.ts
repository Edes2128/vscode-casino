/**
 * Launches the installed VS Code with this extension loaded and runs `suite/index.ts` inside it.
 *
 *   npm run test:integration          production bundle (dist/webview)
 *   npm run test:integration -- --dev Vite dev server with HMR
 *
 * Runs use a throwaway profile under .vscode-test/, so the user's own VS Code settings and
 * extensions are never touched. Set VSCODE_EXECUTABLE_PATH to use a different VS Code; without
 * an installed one @vscode/test-electron downloads a stable build.
 *
 * Note: VS Code keeps global state in memory whenever it runs extension tests, so persistence
 * across a real restart is checked separately by `npm run test:restart`.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { runTests } from '@vscode/test-electron';

const INSTALLED_VSCODE_MACOS = '/Applications/Visual Studio Code.app/Contents/MacOS/Code';
const DEV_SERVER_PORT = 5199; // distinct from the 5173 dev default so we never hit someone's own server

async function main(): Promise<void> {
  const useDevServer = process.argv.includes('--dev');
  const projectRoot = path.resolve(__dirname, '..', '..');
  const sandbox = path.join(projectRoot, '.vscode-test');
  const workspace = path.join(sandbox, 'workspace');

  // Short names: VS Code puts its IPC socket in the user-data dir and macOS limits socket paths to ~100 chars.
  fs.rmSync(path.join(sandbox, 'ud'), { recursive: true, force: true });
  fs.rmSync(path.join(sandbox, 'ext'), { recursive: true, force: true });
  fs.mkdirSync(workspace, { recursive: true });

  const vscodeExecutablePath =
    process.env['VSCODE_EXECUTABLE_PATH'] ??
    (fs.existsSync(INSTALLED_VSCODE_MACOS) ? INSTALLED_VSCODE_MACOS : undefined);

  // If this process was started from an Electron app, the flag would make VS Code behave like plain Node.
  delete process.env['ELECTRON_RUN_AS_NODE'];

  const extensionTestsEnv: Record<string, string> = { LUCKY_BREAK_EXPECT_ASSET_MODE: 'prod' };
  let viteServer: ChildProcess | undefined;

  try {
    if (useDevServer) {
      const serverUrl = `http://localhost:${DEV_SERVER_PORT}`;
      viteServer = spawn(
        process.execPath,
        [path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', String(DEV_SERVER_PORT), '--strictPort'],
        { cwd: projectRoot, stdio: 'ignore', env: { ...process.env, LUCKY_BREAK_DEV_SERVER_URL: serverUrl } },
      );
      await waitForServer(serverUrl, viteServer);
      extensionTestsEnv['LUCKY_BREAK_DEV_SERVER_URL'] = serverUrl;
      extensionTestsEnv['LUCKY_BREAK_EXPECT_ASSET_MODE'] = 'dev';
    }

    await runTests({
      ...(vscodeExecutablePath === undefined ? {} : { vscodeExecutablePath }),
      extensionDevelopmentPath: projectRoot,
      extensionTestsPath: path.join(__dirname, 'suite', 'index.js'),
      extensionTestsEnv,
      launchArgs: [
        workspace,
        '--disable-extensions',
        `--user-data-dir=${path.join(sandbox, 'ud')}`,
        `--extensions-dir=${path.join(sandbox, 'ext')}`,
        // The wheel animates with requestAnimationFrame, which a window that another window covers never
        // receives. Without these the suite would pass or fail depending on what else is on the screen.
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-background-timer-throttling',
        '--disable-workspace-trust',
        '--skip-welcome',
        '--skip-release-notes',
        '--disable-updates',
      ],
    });
  } finally {
    viteServer?.kill();
  }
}

async function waitForServer(url: string, server: ChildProcess): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error('The Vite dev server exited before it became ready.');
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`The Vite dev server did not answer at ${url} within 30s.`);
}

main().catch((error: unknown) => {
  console.error('Integration tests failed:', error);
  process.exit(1);
});
