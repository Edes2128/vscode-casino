/**
 * Proves Break Room Arcade survives a REAL VS Code restart, including what ends up on disk.
 *
 *   npm run test:restart
 *
 * Why this is not part of `test:integration`: VS Code deliberately keeps global state in memory
 * whenever it is launched with --extensionTestsPath, so nothing could ever reach disk there.
 * Here VS Code is launched normally (a throwaway profile under .vscode-test/) with Break Room Arcade and
 * a small helper extension (helper.ts) that does the work and then quits VS Code gracefully:
 *
 *   1. write  fresh profile: play rounds, leave one open, save, quit. The runner then checks the
 *             game state really is in VS Code's database on disk.
 *   2. read   a NEW VS Code process on the SAME profile: balance, statistics and history must be
 *             back, and the round left open must be recorded as lost.
 */
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const INSTALLED_VSCODE_MACOS = '/Applications/Visual Studio Code.app/Contents/MacOS/Code';
const LAUNCH_TIMEOUT_MS = 120_000;

interface Outcome {
  readonly ok: boolean;
  readonly detail: string;
}

async function main(): Promise<void> {
  const projectRoot = path.resolve(__dirname, '..', '..');
  const helperPath = path.join(projectRoot, 'out', 'restart-helper');
  const sandbox = path.join(projectRoot, '.vscode-test');
  // Short names: VS Code puts its IPC socket in the user-data dir and macOS limits socket paths to ~100 chars.
  const userData = path.join(sandbox, 'rs');
  const extensions = path.join(sandbox, 'rx');
  const workspace = path.join(sandbox, 'workspace');
  const resultPath = path.join(sandbox, 'restart-result.json');

  const executable = process.env['VSCODE_EXECUTABLE_PATH'] ?? INSTALLED_VSCODE_MACOS;
  if (!fs.existsSync(executable)) {
    throw new Error(`VS Code not found at ${executable}. Set VSCODE_EXECUTABLE_PATH to your VS Code binary.`);
  }
  if (!fs.existsSync(path.join(helperPath, 'index.js'))) {
    throw new Error('The restart helper is not built. Run `npm run test:restart`, not this file directly.');
  }

  fs.rmSync(userData, { recursive: true, force: true });
  fs.rmSync(extensions, { recursive: true, force: true });
  fs.mkdirSync(workspace, { recursive: true });

  const launch = async (phase: 'write' | 'read'): Promise<Outcome> => {
    fs.rmSync(resultPath, { force: true });
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      BREAK_ROOM_EXPOSE_TEST_API: '1',
      BREAK_ROOM_RESTART_PHASE: phase,
      BREAK_ROOM_RESTART_RESULT: resultPath,
    };
    // If this process was started from an Electron app, the flag would make VS Code behave like plain Node.
    delete env['ELECTRON_RUN_AS_NODE'];

    const child = spawn(
      executable,
      [
        workspace,
        `--extensionDevelopmentPath=${projectRoot}`,
        `--extensionDevelopmentPath=${helperPath}`,
        '--disable-extensions',
        `--user-data-dir=${userData}`,
        `--extensions-dir=${extensions}`,
        '--disable-workspace-trust',
        '--skip-welcome',
        '--skip-release-notes',
        '--disable-updates',
      ],
      { env, stdio: 'ignore' },
    );

    const exitCode = await new Promise<number | null>((resolve, reject) => {
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error(`VS Code did not quit within ${LAUNCH_TIMEOUT_MS / 1000}s (${phase} phase)`));
      }, LAUNCH_TIMEOUT_MS);
      child.once('error', reject);
      child.once('exit', (code) => {
        clearTimeout(timer);
        resolve(code);
      });
    });

    if (!fs.existsSync(resultPath)) {
      throw new Error(`The ${phase} phase left no result (VS Code exit code ${exitCode}). The helper never ran.`);
    }
    return JSON.parse(fs.readFileSync(resultPath, 'utf8')) as Outcome;
  };

  console.log('Launch 1 of 2 (write): play rounds, leave one open, quit VS Code');
  const written = await launch('write');
  console.log(`  ${written.ok ? '✔' : '✘'} ${written.detail}`);
  if (!written.ok) throw new Error('The write phase failed.');

  const onDisk = breakRoomStateIsOnDisk(userData);
  console.log(`  ${onDisk ? '✔' : '✘'} Break Room Arcade state is in VS Code's database on disk`);
  if (!onDisk) throw new Error("VS Code did not write Break Room Arcade state to its database. A restart would lose it.");

  console.log('Launch 2 of 2 (read): a new VS Code process on the same profile');
  const read = await launch('read');
  console.log(`  ${read.ok ? '✔' : '✘'} ${read.detail}`);
  if (!read.ok) throw new Error('The read phase failed.');

  console.log('\nRestart test passed: the balance, statistics, history and settings survived a real VS Code restart.');
}

/**
 * SQLite stores text plainly, so searching the raw bytes (database and write-ahead log) is enough.
 * The needles are the JSON Break Room Arcade saves, not just the key name: VS Code's own bookkeeping keys
 * (such as the state of our sidebar container) also contain "breakRoom.state", which would be a false positive.
 */
function breakRoomStateIsOnDisk(userData: string): boolean {
  const database = path.join(userData, 'User', 'globalStorage', 'state.vscdb');
  const needles = [
    '"breakRoom.state":{"version":1',
    '"balance":935',
    '"breakRoom.settings":{"version":2',
    '"volume":35',
    '"theme":"royal"',
    '"cardDesign":"medieval"',
    '"soundPack":"cyber"',
    '"table":"#224466"',
  ];
  return [database, `${database}-wal`]
    .filter((file) => fs.existsSync(file))
    .some((file) => {
      const bytes = fs.readFileSync(file);
      return needles.every((needle) => bytes.includes(needle));
    });
}

main().catch((error: unknown) => {
  console.error('Restart test failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
