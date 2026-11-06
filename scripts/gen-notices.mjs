// Writes THIRD_PARTY_NOTICES.md from the licence files of everything that ships inside the VSIX:
// the libraries bundled into the webview and the fonts copied next to it. Run after changing
// dependencies:  node scripts/gen-notices.mjs
import { readFileSync, writeFileSync } from 'node:fs';

/** Everything of someone else's that ends up in dist/. The extension host bundle has no dependencies. */
const SHIPPED = [
  ['react', 'bundled into dist/webview/assets/webview.js'],
  ['react-dom', 'bundled into dist/webview/assets/webview.js'],
  ['scheduler', 'bundled into dist/webview/assets/webview.js (used by React)'],
  ['@fontsource/press-start-2p', 'the "Press Start 2P" font, in dist/webview/assets/'],
  ['@fontsource/vt323', 'the "VT323" font, in dist/webview/assets/'],
];

const sections = SHIPPED.map(([name, where]) => {
  const dir = `node_modules/${name}`;
  const { version, license, homepage } = JSON.parse(readFileSync(`${dir}/package.json`, 'utf8'));
  const text = readFileSync(`${dir}/LICENSE`, 'utf8').trim();
  return [
    `## ${name} ${version}`,
    '',
    `Licence: ${license}${homepage ? ` · ${homepage}` : ''}`,
    `Where: ${where}`,
    '',
    '```text',
    text,
    '```',
  ].join('\n');
});

const header = [
  '# Third-party notices',
  '',
  'Lucky Break includes the following open-source components. Their licences are reproduced in full below.',
  'The extension has no other runtime dependencies: everything else in it is original.',
  '',
].join('\n');

writeFileSync('THIRD_PARTY_NOTICES.md', `${header}\n${sections.join('\n\n')}\n`);
console.log(`Wrote THIRD_PARTY_NOTICES.md (${SHIPPED.length} components)`);
