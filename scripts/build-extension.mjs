// Bundles the extension host with esbuild.
//   --watch        rebuild on change
//   --production   minify, no sourcemaps
//   --tests        build the VS Code integration-test launcher and suite instead
import { mkdirSync, writeFileSync } from 'node:fs';
import { build, context } from 'esbuild';

const flags = new Set(process.argv.slice(2));
const watch = flags.has('--watch');
const production = flags.has('--production');
const withTests = flags.has('--tests');

/** Markers matched by the background problem matcher in .vscode/tasks.json. */
const watchMarkers = {
  name: 'watch-markers',
  setup(b) {
    b.onStart(() => console.log('[watch] build started'));
    b.onEnd((result) => {
      for (const { text, location } of result.errors) {
        console.error(`✘ [ERROR] ${text}`);
        if (location) console.error(`    ${location.file}:${location.line}:${location.column}`);
      }
      console.log('[watch] build finished');
    });
  },
};

/** @type {import('esbuild').BuildOptions} */
const shared = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  sourcemap: !production,
  minify: production,
  logLevel: 'info',
  plugins: watch ? [watchMarkers] : [],
};

/** @type {import('esbuild').BuildOptions} */
const options = withTests
  ? {
      ...shared,
      entryPoints: {
        'test/runTest': 'test/integration/runTest.ts',
        'test/suite/index': 'test/integration/suite/index.ts',
        'test/runRestart': 'test/restart/runRestart.ts',
        'test/measureIdle': 'test/perf/measureIdle.ts',
        'test/runVsix': 'test/vsix/runVsix.ts',
        'restart-helper/index': 'test/restart/helper.ts',
      },
      outdir: 'out',
      external: ['vscode', '@vscode/test-electron'],
    }
  : {
      ...shared,
      entryPoints: ['src/extension/extension.ts'],
      outfile: 'dist/extension.js',
      external: ['vscode'],
    };

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
} else {
  await build(options);
}

if (withTests) {
  // VS Code loads an extension from a folder with a package.json, so give the restart helper one.
  mkdirSync('out/restart-helper', { recursive: true });
  writeFileSync(
    'out/restart-helper/package.json',
    JSON.stringify(
      {
        name: 'casino-restart-helper',
        displayName: 'Casino restart-test helper',
        version: '0.0.0',
        publisher: 'vscode-casino-dev',
        private: true,
        engines: { vscode: '^1.90.0' },
        main: './index.js',
        activationEvents: ['onStartupFinished'],
      },
      null,
      2,
    ),
  );
}
