/// <reference types="node" />
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const WEBVIEW = join(__dirname, '..');
const ROOT = join(WEBVIEW, '..', '..');

/** Every file of the sound code and of the screens that choose and preview sounds (tests excluded). */
const SOURCES = [
  ...readdirSync(__dirname)
    .filter((name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name))
    .map((name) => join(__dirname, name)),
  join(WEBVIEW, 'customization', 'soundPacks.ts'),
  join(WEBVIEW, 'customization', 'tabs', 'SoundsTab.tsx'),
];

const strip = (code: string): string => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const read = (path: string): string => strip(readFileSync(path, 'utf8'));

/** Ways for a page to get a sound or any data from outside itself. */
const OUTSIDE: ReadonlyArray<readonly [string, RegExp]> = [
  ['fetch', /\bfetch\s*\(/],
  ['XMLHttpRequest', /XMLHttpRequest/],
  ['WebSocket', /\bWebSocket\b/],
  ['EventSource', /\bEventSource\b/],
  ['sendBeacon', /sendBeacon/],
  ['a worker', /\bnew\s+(?:Shared)?Worker\b|importScripts/],
  ['a dynamic import', /\bimport\s*\(/],
  ['an Audio element', /\bnew\s+Audio\s*\(|HTMLAudioElement|<audio\b|<video\b/],
  ['decoding an audio file', /decodeAudioData|createMediaElementSource|createMediaStreamSource|MediaRecorder/],
  ['a URL being loaded', /\bnew\s+URL\s*\(|createObjectURL|\bBlob\b/],
  ['an address', /https?:\/\/|\bwss?:\/\//],
  ['an audio file name', /\.(?:mp3|wav|ogg|oga|m4a|aac|flac|opus|webm|mp4)\b/i],
  ['an audio data URI', /data:(?:audio|video)/],
  ['a service worker', /serviceWorker/],
];

describe('the sounds stay local', () => {
  it('scans the sound code and both of the sound screens', () => {
    const names = SOURCES.map((path) => path.slice(WEBVIEW.length + 1));
    expect(names).toEqual(
      expect.arrayContaining(['sound/cues.ts', 'sound/engine.ts', 'sound/packs.ts', 'sound/SoundProvider.tsx', 'sound/gameCues.ts', 'sound/sample.ts', 'customization/soundPacks.ts', 'customization/tabs/SoundsTab.tsx']),
    );
    for (const path of SOURCES) expect(existsSync(path), path).toBe(true);
  });

  it.each(OUTSIDE)('never uses %s', (what, pattern) => {
    const offenders = SOURCES.filter((path) => pattern.test(read(path))).map((path) => path.slice(WEBVIEW.length + 1));
    expect(offenders, `${what} in: ${offenders.join(', ')}`).toEqual([]);
  });

  it('really would notice: the scan finds these in code that has them', () => {
    expect(OUTSIDE.find(([what]) => what === 'fetch')?.[1].test("await fetch('/x.mp3')")).toBe(true);
    expect(OUTSIDE.find(([what]) => what === 'an Audio element')?.[1].test("new Audio('x')")).toBe(true);
    expect(OUTSIDE.find(([what]) => what === 'an audio file name')?.[1].test("'click.wav'")).toBe(true);
    expect(OUTSIDE.find(([what]) => what === 'an address')?.[1].test('"https://example.com/a"')).toBe(true);
  });

  it('makes every sound with the Web Audio API itself: oscillators and one burst of random samples', () => {
    const engine = read(join(__dirname, 'engine.ts'));
    expect(engine).toContain('createOscillator');
    expect(engine).toContain('createBuffer(');
    expect(engine).toContain('Math.random()');
  });

  it('ships no audio file anywhere in the webview sources or the media folder', () => {
    const found: string[] = [];
    const walk = (directory: string): void => {
      if (!existsSync(directory)) return;
      for (const name of readdirSync(directory)) {
        const path = join(directory, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(?:mp3|wav|ogg|oga|m4a|aac|flac|opus|webm|mp4|mid|midi)$/i.test(name)) found.push(path.slice(ROOT.length + 1));
      }
    };
    walk(WEBVIEW);
    walk(join(ROOT, 'media'));
    walk(join(ROOT, 'public'));
    expect(found).toEqual([]);
  });

  it('adds no library: the runtime dependencies have nothing to do with audio', () => {
    const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { dependencies?: Record<string, string> };
    const names = Object.keys(manifest.dependencies ?? {});
    expect(names.filter((name) => /audio|howl|tone|sound|sfx|pizzicato|wave/i.test(name))).toEqual([]);
  });

  it('keeps the page\'s content security policy closed to media: it has no media-src at all, and `default-src` is none', () => {
    const html = readFileSync(join(ROOT, 'src', 'extension', 'webviewHtml.ts'), 'utf8');
    expect(html).not.toContain('media-src');
    expect(html).toContain("default-src 'none'");
  });
});
