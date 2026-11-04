/**
 * Installs the packaged extension (the .vsix) into a throwaway VS Code profile, the way a user would,
 * and checks the INSTALLED copy: what is inside the package, that it activates and renders in VS Code,
 * and that it does not hand out the test API that exists only when running from source.
 *
 *   npm run test:vsix
 *
 * Your own VS Code is never touched: the extension goes into folders under .vscode-test/.
 */
import { execFileSync, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const VSCODE_APP = '/Applications/Visual Studio Code.app';
const LAUNCH_TIMEOUT_MS = 180_000;

/** What the package must contain, and what must never be in it. */
const REQUIRED = [
  'extension/package.json',
  'extension/dist/extension.js',
  'extension/dist/webview/assets/webview.js',
  'extension/dist/webview/assets/webview.css',
  'extension/media/icon.png',
  'extension/media/casino.svg',
  'extension/media/casino-tab.svg',
  'extension/readme.md',
  'extension/changelog.md',
  'extension/LICENSE.txt',
  'extension/THIRD_PARTY_NOTICES.md',
];
const FORBIDDEN: ReadonlyArray<[RegExp, string]> = [
  [/\.map$/, 'a source map'],
  [/^extension\/src\//, 'source code'],
  [/^extension\/test\//, 'tests'],
  [/^extension\/out\//, 'test build output'],
  [/^extension\/scripts\//, 'build scripts'],
  [/^extension\/node_modules\//, 'node_modules'],
  [/^extension\/\.claude\//, 'local assistant files'],
  [/^extension\/\.vscode/, 'editor settings or test profiles'],
  [/^extension\/\.git/, 'git data'],
  [/\.tsx?$/, 'TypeScript source'],
  [/package-lock\.json$/, 'the lock file'],
  [/\.vsix$/, 'another package'],
];

interface Outcome {
  readonly ok: boolean;
  readonly detail: string;
}

const projectRoot = path.resolve(__dirname, '..', '..');
const manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8')) as {
  name: string;
  publisher: string;
  version: string;
};
const vsixPath = path.join(projectRoot, `${manifest.name}-${manifest.version}.vsix`);

function checkPackage(): string[] {
  if (!fs.existsSync(vsixPath)) throw new Error(`${path.basename(vsixPath)} does not exist. Run \`npm run test:vsix\` (it packages first).`);
  const entries = execFileSync('unzip', ['-Z1', vsixPath], { encoding: 'utf8' }).split('\n').filter(Boolean);
  const lower = new Set(entries.map((entry) => entry.toLowerCase()));

  const missing = REQUIRED.filter((entry) => !lower.has(entry.toLowerCase()));
  if (missing.length > 0) throw new Error(`The package is missing: ${missing.join(', ')}`);

  const forbidden = entries.flatMap((entry) => FORBIDDEN.filter(([pattern]) => pattern.test(entry)).map(([, what]) => `${entry} (${what})`));
  if (forbidden.length > 0) throw new Error(`The package contains things that must not ship:\n  ${forbidden.join('\n  ')}`);

  const fonts = entries.filter((entry) => entry.endsWith('.woff2'));
  if (fonts.length !== 2) throw new Error(`Expected the two pixel fonts in the package, found ${fonts.length}`);
  return entries;
}

async function main(): Promise<void> {
  const entries = checkPackage();
  const sizeKb = Math.round(fs.statSync(vsixPath).size / 1024);
  console.log(`  ✔ package: ${path.basename(vsixPath)}, ${sizeKb} KB, ${entries.length} files, nothing that must not ship`);

  const executable = process.env['VSCODE_EXECUTABLE_PATH'] ?? path.join(VSCODE_APP, 'Contents', 'MacOS', 'Code');
  const cli = process.env['VSCODE_CLI_PATH'] ?? path.join(VSCODE_APP, 'Contents', 'Resources', 'app', 'bin', 'code');
  for (const file of [executable, cli]) if (!fs.existsSync(file)) throw new Error(`VS Code not found at ${file}. Set VSCODE_EXECUTABLE_PATH and VSCODE_CLI_PATH.`);

  const sandbox = path.join(projectRoot, '.vscode-test');
  // Short names: VS Code puts its IPC socket in the user-data dir and macOS limits socket paths to ~100 chars.
  const userData = path.join(sandbox, 'vu');
  const extensions = path.join(sandbox, 'vx');
  const workspace = path.join(sandbox, 'workspace');
  const resultPath = path.join(sandbox, 'vsix-result.json');
  const helperPath = path.join(projectRoot, 'out', 'restart-helper');
  for (const target of [userData, extensions, resultPath]) fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(workspace, { recursive: true });

  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env['ELECTRON_RUN_AS_NODE'];
  delete env['CASINO_EXPOSE_TEST_API']; // an installed casino must behave as it does for everyone

  const installOutput = execFileSync(cli, ['--install-extension', vsixPath, `--user-data-dir=${userData}`, `--extensions-dir=${extensions}`], { env, encoding: 'utf8' });
  if (!/successfully installed/i.test(installOutput)) throw new Error(`VS Code did not report a successful install:\n${installOutput}`);

  const installedDir = path.join(extensions, `${manifest.publisher}.${manifest.name}-${manifest.version}`);
  if (!fs.existsSync(path.join(installedDir, 'dist', 'extension.js'))) throw new Error(`The extension is not where VS Code installs it: ${installedDir}`);
  console.log(`  ✔ install: VS Code installed ${manifest.publisher}.${manifest.name}@${manifest.version} into an isolated extensions folder`);

  const child = spawn(
    executable,
    [
      workspace,
      `--user-data-dir=${userData}`,
      `--extensions-dir=${extensions}`,
      `--extensionDevelopmentPath=${helperPath}`,
      '--disable-workspace-trust',
      '--skip-welcome',
      '--skip-release-notes',
      '--disable-updates',
    ],
    { env: { ...env, CASINO_RESTART_PHASE: 'vsix', CASINO_RESTART_RESULT: resultPath, CASINO_VSIX_EXTENSIONS_DIR: extensions }, stdio: 'ignore' },
  );

  const exitCode = await new Promise<number | null>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`VS Code did not finish within ${LAUNCH_TIMEOUT_MS / 1000}s`));
    }, LAUNCH_TIMEOUT_MS);
    child.once('error', reject);
    child.once('exit', (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
  if (!fs.existsSync(resultPath)) throw new Error(`The check left no result (VS Code exit code ${exitCode}). The helper never ran.`);
  const outcome = JSON.parse(fs.readFileSync(resultPath, 'utf8')) as Outcome;
  console.log(`  ${outcome.ok ? '✔' : '✘'} installed copy: ${outcome.detail}`);
  if (!outcome.ok) throw new Error('The installed copy failed its checks.');

  console.log('\nVSIX test passed: the package is clean, installs, activates and renders in VS Code.');
}

main().catch((error: unknown) => {
  console.error('VSIX test failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
