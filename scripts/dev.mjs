// `npm run dev`: rebuild the extension host on change and serve the webview with Vite HMR.
// Launch the "Run Extension (Vite HMR)" configuration (or set CASINO_DEV_SERVER_URL) to use it.
import { spawn } from 'node:child_process';

const children = [
  spawn(process.execPath, ['scripts/build-extension.mjs', '--watch'], { stdio: 'inherit' }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js'], { stdio: 'inherit' }),
];

let stopping = false;
const stop = (code) => {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exit(code);
};

for (const child of children) child.on('exit', (code) => stop(code ?? 0));
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
