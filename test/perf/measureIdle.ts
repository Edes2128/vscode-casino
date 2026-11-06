/**
 * Measures what Lucky Break costs VS Code while it just sits there.
 *
 *   npm run perf:idle
 *
 * A first version of this compared separate VS Code launches and gave nonsense: the very same
 * configuration measured 7%, 29% and 65%. Two things confound a CPU number: a fresh profile does a lot
 * of background work for a while, and macOS stops painting a window that is covered by another one. So:
 *
 *  - every number comes from ONE running window, switched between settings through a control file, so
 *    the phases being compared share the same window, the same profile and the same minute;
 *  - before and after every sample the window's own `requestAnimationFrame` rate is read through the
 *    Chrome DevTools Protocol. About 60 means the window really is being rendered; 0 means it is
 *    covered or hidden, and the CPU figure says nothing about rendering. Such samples are marked.
 *
 * Numbers are percent of one core, summed over every process VS Code started, over each slice.
 * It uses a throwaway profile; your own VS Code is never touched.
 */
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { AMBIENT_TICK_MS } from '../../src/webview/ambientTiming';

const INSTALLED_VSCODE_MACOS = '/Applications/Visual Studio Code.app/Contents/MacOS/Code';
const READY_TIMEOUT_MS = 120_000;
const STARTUP_SETTLE_SECONDS = Number(process.env['LUCKY_BREAK_IDLE_STARTUP'] ?? 30);
/** Each phase is measured in this many short slices, and the median is reported: VS Code does its own background work in bursts, and one long average would swallow a burst whole. */
const SLICE_SECONDS = Number(process.env['LUCKY_BREAK_IDLE_SLICE'] ?? 4);

/**
 * Awake samples must end before the decorations rest (15 s), counting the settling time before them and
 * the two frame-rate probes (about 2.5 s each) around the slices: 1 + 2.5 + 3 x 3 = 12.5 s.
 */
const AWAKE_SLICES = 3;
const AWAKE_SLICE_SECONDS = 3;
const AWAKE_SETTLE_SECONDS = 1;
const STILL_SLICES = 6;
const STILL_SETTLE_SECONDS = 4;
/** A resting game is measured once it has certainly rested. */
const RESTING_SLICES = 6;
const RESTING_SETTLE_SECONDS = 19;

const plan = (kind: Kind): { slices: number; sliceSeconds: number; settle: number } =>
  kind === 'awake'
    ? { slices: AWAKE_SLICES, sliceSeconds: AWAKE_SLICE_SECONDS, settle: AWAKE_SETTLE_SECONDS }
    : kind === 'resting'
      ? { slices: RESTING_SLICES, sliceSeconds: SLICE_SECONDS, settle: RESTING_SETTLE_SECONDS }
      : { slices: STILL_SLICES, sliceSeconds: SLICE_SECONDS, settle: STILL_SETTLE_SECONDS };
const DEBUG_PORT = 9341;

/**
 * `awake`: the player just did something, so the decorations tick, and the sample must be short enough to
 * finish before they rest. `resting`: wait for them to rest, then measure what an idle game costs.
 * `still`: decorations are switched off or Lucky Break is hidden.
 */
type Kind = 'awake' | 'resting' | 'still';

interface Phase {
  readonly name: string;
  readonly kind: Kind;
  readonly command?: {
    readonly settings?: Record<string, unknown>;
    readonly page?: string;
    readonly show?: 'luckyBreak' | 'explorer';
  };
}

const LUCKY_BREAK_PHASES: readonly Phase[] = [
  { name: 'Home, awake', kind: 'awake', command: { settings: { animations: true, reducedMotion: false }, page: 'home', show: 'luckyBreak' } },
  { name: 'Home, animations off', kind: 'still', command: { settings: { animations: false } } },
  { name: 'Home, awake (again)', kind: 'awake', command: { settings: { animations: true }, page: 'blackjack' } },
  { name: 'Home, reduced motion', kind: 'still', command: { settings: { reducedMotion: true }, page: 'home' } },
  { name: 'Blackjack, awake', kind: 'awake', command: { settings: { reducedMotion: false }, page: 'blackjack' } },
  { name: 'Settings page, awake', kind: 'awake', command: { page: 'settings' } },
  { name: 'Home, left alone (resting)', kind: 'resting', command: { page: 'home' } },
  { name: 'Home, hidden', kind: 'still', command: { show: 'explorer' } },
];

/** `LUCKY_BREAK_IDLE_PHASES=quick`: only what is needed to compare two builds of the decorations. */
const QUICK_PHASES: readonly Phase[] = [
  { name: 'Home, awake', kind: 'awake', command: { settings: { animations: true, reducedMotion: false }, page: 'home', show: 'luckyBreak' } },
  { name: 'Home, animations off', kind: 'still', command: { settings: { animations: false } } },
  { name: 'Home, awake (again)', kind: 'awake', command: { settings: { animations: true }, page: 'blackjack' } },
  { name: 'Home, left alone (resting)', kind: 'resting', command: { page: 'home' } },
];

interface Proc {
  readonly pid: number;
  readonly ppid: number;
  readonly cpuMs: number;
  readonly rssKb: number;
}

/** "1:02:03.45", "12:03.45" or "0:03.45" to milliseconds. */
function parseCpuTime(text: string): number {
  let seconds = 0;
  for (const part of text.split(':').map(Number)) seconds = seconds * 60 + part;
  return Math.round(seconds * 1000);
}

function processes(): Map<number, Proc> {
  const output = execFileSync('ps', ['-A', '-o', 'pid=,ppid=,cputime=,rss='], { encoding: 'utf8' });
  const table = new Map<number, Proc>();
  for (const line of output.split('\n')) {
    const [pid, ppid, cpu, rss] = line.trim().split(/\s+/);
    if (pid === undefined || ppid === undefined || cpu === undefined || rss === undefined) continue;
    table.set(Number(pid), { pid: Number(pid), ppid: Number(ppid), cpuMs: parseCpuTime(cpu), rssKb: Number(rss) });
  }
  return table;
}

function treeOf(root: number, table: ReadonlyMap<number, Proc>): Proc[] {
  const members = new Set<number>([root]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const proc of table.values()) {
      if (!members.has(proc.pid) && members.has(proc.ppid)) {
        members.add(proc.pid);
        grew = true;
      }
    }
  }
  return [...members].flatMap((pid) => table.get(pid) ?? []);
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

interface Frames {
  /** Animation frames per second the VS Code window produced while it was asked for them. 0: not rendering. */
  readonly fps: number;
  readonly focused: boolean;
}

/** Asks the window how fast it renders, through the DevTools Protocol. Never throws: `undefined` if unreachable. */
async function probeFrames(): Promise<Frames | undefined> {
  try {
    const targets = (await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json()) as Array<{
      type: string;
      url: string;
      webSocketDebuggerUrl?: string;
    }>;
    const workbench = targets.find((target) => target.type === 'page' && target.url.includes('workbench'));
    if (workbench?.webSocketDebuggerUrl === undefined) return undefined;

    const socket = new WebSocket(workbench.webSocketDebuggerUrl);
    await new Promise<void>((resolve, reject) => {
      socket.onopen = () => resolve();
      socket.onerror = () => reject(new Error('devtools socket failed'));
    });
    const expression = `new Promise((resolve) => {
      let frames = 0; const start = performance.now();
      const done = () => resolve({ fps: Math.round(frames / ((performance.now() - start) / 1000)), focused: document.hasFocus() });
      const tick = () => { frames += 1; if (performance.now() - start < 2000) requestAnimationFrame(tick); else done(); };
      requestAnimationFrame(tick);
      setTimeout(done, 2600);
    })`;
    const result = await new Promise<Frames | undefined>((resolve) => {
      socket.onmessage = (event) => {
        const message = JSON.parse(String(event.data)) as { id?: number; result?: { result?: { value?: Frames } } };
        if (message.id === 1) resolve(message.result?.result?.value);
      };
      socket.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
      setTimeout(() => resolve(undefined), 6000);
    });
    socket.close();
    return result;
  } catch {
    return undefined;
  }
}

interface Session {
  readonly root: number;
  readonly child: ChildProcess;
  readonly control: string;
  stop(): Promise<void>;
}

async function launch(projectRoot: string, executable: string, luckyBreak: boolean): Promise<Session> {
  const sandbox = path.join(projectRoot, '.vscode-test');
  const userData = path.join(sandbox, 'pf');
  const extensions = path.join(sandbox, 'px');
  const workspace = path.join(sandbox, 'workspace');
  const resultPath = path.join(sandbox, 'idle-result.json');
  const control = path.join(sandbox, 'idle-control.json');
  for (const target of [userData, extensions, resultPath, control, `${control}.ack`]) fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(workspace, { recursive: true });

  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env['ELECTRON_RUN_AS_NODE'];
  const args = [
    workspace,
    '--disable-extensions',
    `--user-data-dir=${userData}`,
    `--extensions-dir=${extensions}`,
    `--remote-debugging-port=${DEBUG_PORT}`,
    // A window another window covers is normally treated as hidden: it stops rendering and its timers slow
    // down, which makes a CPU number depend on what else is on the screen. These keep the test window
    // behaving as if it were in front, however it is covered. They only apply to this throwaway instance.
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling',
    '--disable-workspace-trust',
    '--skip-welcome',
    '--skip-release-notes',
    '--disable-updates',
  ];
  if (luckyBreak) {
    args.push(`--extensionDevelopmentPath=${projectRoot}`, `--extensionDevelopmentPath=${path.join(projectRoot, 'out', 'restart-helper')}`);
    Object.assign(env, {
      LUCKY_BREAK_EXPOSE_TEST_API: '1',
      LUCKY_BREAK_RESTART_PHASE: 'idle',
      LUCKY_BREAK_RESTART_RESULT: resultPath,
      LUCKY_BREAK_IDLE_PAGE: 'home',
      LUCKY_BREAK_IDLE_SETTINGS: '{}',
      LUCKY_BREAK_IDLE_CONTROL: control,
    });
  }

  const child = spawn(executable, args, { env, stdio: 'ignore' });
  const root = child.pid;
  if (root === undefined) throw new Error('VS Code did not start');

  if (luckyBreak) {
    const deadline = Date.now() + READY_TIMEOUT_MS;
    while (!fs.existsSync(resultPath)) {
      if (Date.now() > deadline) throw new Error('Lucky Break never got ready');
      await sleep(250);
    }
    const outcome = JSON.parse(fs.readFileSync(resultPath, 'utf8')) as { ok: boolean; detail: string };
    if (!outcome.ok) throw new Error(outcome.detail);
  }
  await sleep(STARTUP_SETTLE_SECONDS * 1000);

  return {
    root,
    child,
    control,
    async stop() {
      const members = treeOf(root, processes());
      child.kill('SIGTERM');
      await sleep(2_000);
      for (const proc of members) {
        try {
          process.kill(proc.pid, 'SIGKILL');
        } catch {
          // already gone
        }
      }
      await sleep(1_000);
    },
  };
}

async function command(session: Session, phase: Phase, id: string): Promise<void> {
  if (phase.command === undefined) return;
  fs.writeFileSync(session.control, JSON.stringify({ id, ...phase.command }));
  const deadline = Date.now() + 20_000;
  while (!fs.existsSync(`${session.control}.ack`) || fs.readFileSync(`${session.control}.ack`, 'utf8') !== id) {
    if (Date.now() > deadline) throw new Error(`Lucky Break did not acknowledge "${phase.name}"`);
    await sleep(200);
  }
}

interface Ambient {
  readonly running: boolean;
  readonly resting: boolean;
  readonly ticks: number;
}

interface Result {
  readonly name: string;
  /** The slowest and fastest slice, to show how steady the median is. */
  readonly cpuRange: readonly [number, number];
  /** Lucky Break's own report of its decorations' clock before and after the sample. Ticks moving proves they are alive. */
  readonly clock?: readonly [Ambient | undefined, Ambient | undefined] | undefined;
  readonly cpuPercent: number;
  readonly rssMb: number;
  readonly fpsBefore: number | undefined;
  readonly fpsAfter: number | undefined;
}

/** What Lucky Break's page last told the host about its clock, written by the helper extension. No debugger is attached. */
function readClock(session: Session): Ambient | undefined {
  try {
    const value = JSON.parse(fs.readFileSync(`${session.control}.status`, 'utf8')) as Ambient | null;
    return value ?? undefined;
  } catch {
    return undefined;
  }
}

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((x, y) => x - y);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? (sorted[middle] ?? 0) : (((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2);
};

async function sample(session: Session, name: string, slicesWanted: number, sliceSeconds: number, withClock = false): Promise<Result> {
  const clockBefore = withClock ? readClock(session) : undefined;
  const fpsBefore = (await probeFrames())?.fps;

  const slices: number[] = [];
  let rssMb = 0;
  for (let slice = 0; slice < slicesWanted; slice += 1) {
    const before = new Map(treeOf(session.root, processes()).map((proc) => [proc.pid, proc]));
    const startedAt = Date.now();
    await sleep(sliceSeconds * 1000);
    const after = treeOf(session.root, processes());
    const elapsedMs = Date.now() - startedAt;
    let usedMs = 0;
    for (const proc of after) usedMs += proc.cpuMs - (before.get(proc.pid)?.cpuMs ?? 0);
    slices.push((usedMs / elapsedMs) * 100);
    rssMb = after.reduce((sum, proc) => sum + proc.rssKb, 0) / 1024;
  }

  const fpsAfter = (await probeFrames())?.fps;
  const clockAfter = withClock ? readClock(session) : undefined;
  return {
    name,
    cpuRange: [Math.min(...slices), Math.max(...slices)],
    clock: withClock ? [clockBefore, clockAfter] : undefined,
    cpuPercent: median(slices),
    rssMb,
    fpsBefore,
    fpsAfter,
  };
}

const isRendering = (result: Result): boolean => (result.fpsBefore ?? 0) > 20 && (result.fpsAfter ?? 0) > 20;

/** Ticks the clock made during the sample, if it ran at both ends. The clock reports every 3 s, so this is accurate to about 30. */
function ticksDuring(result: Result): number | undefined {
  const [before, after] = result.clock ?? [];
  return before === undefined || after === undefined || !before.running || !after.running ? undefined : after.ticks - before.ticks;
}

/** A clock that runs the whole time ticks every AMBIENT_TICK_MS. Anything much less means the window was covered at some point. */
const minTicks = (slices: number, sliceSeconds: number): number => Math.floor(((slices * sliceSeconds * 1000) / AMBIENT_TICK_MS) * 0.7);

function isValid(result: Result, phase: Phase): boolean {
  if (!isRendering(result)) return false;
  const [before, after] = result.clock ?? [];
  switch (phase.kind) {
    case 'awake':
      return (ticksDuring(result) ?? 0) >= minTicks(AWAKE_SLICES, AWAKE_SLICE_SECONDS);
    case 'resting':
      // It must have been resting at both ends, with no tick in between.
      return before?.resting === true && after?.resting === true && after.ticks === before.ticks;
    case 'still':
      return true;
  }
}

/**
 * A window that is covered stops rendering, and its CPU number then says nothing about rendering.
 * Measure again until the window was rendering the whole time and, where the decorations should run,
 * the clock ticked through the whole sample.
 */
async function sampleRendering(session: Session, phase: Phase): Promise<Result> {
  const { slices, sliceSeconds } = plan(phase.kind);
  let result = await sample(session, phase.name, slices, sliceSeconds, true);
  for (let attempt = 1; attempt < 7 && !isValid(result, phase); attempt += 1) {
    console.log(`    (${phase.name}: not usable (${isRendering(result) ? 'the clock did not behave as this phase needs' : 'the window was not rendering'}); measuring again)`);
    // Wake Lucky Break again for an awake phase; a resting phase has to wait for the rest all over again.
    if (phase.kind !== 'still') await command(session, { ...phase, command: { page: phase.kind === 'awake' ? 'settings' : 'home' } }, `retry-${attempt}-a`);
    if (phase.kind !== 'still') await command(session, { ...phase, command: { page: 'home' } }, `retry-${attempt}-b`);
    await sleep(plan(phase.kind).settle * 1000);
    result = await sample(session, phase.name, slices, sliceSeconds, true);
  }
  return result;
}

function clockText(result: Result): string {
  if (result.clock === undefined) return '';
  const [, after] = result.clock;
  if (after?.resting === true) return '   decorations: resting (the clock stopped itself)';
  const ticks = ticksDuring(result);
  if (ticks === undefined) return '   decorations: still (no clock)';
  return ticks > 0 ? `   decorations: ticking (${ticks} ticks)` : '   decorations: still (clock paused)';
}

function show(result: Result): void {
  const fps = (value: number | undefined): string => (value === undefined ? ' ?' : String(value)).padStart(2);
  const rendering = isRendering(result);
  console.log(
    `  ${result.name.padEnd(32)} ${result.cpuPercent.toFixed(1).padStart(6)}%  (${result.cpuRange[0].toFixed(0)}-${result.cpuRange[1].toFixed(0)})  ${result.rssMb.toFixed(0).padStart(5)} MB   frames/s ${fps(result.fpsBefore)} -> ${fps(result.fpsAfter)}${clockText(result)}${rendering ? '' : '   NOT RENDERING: ignore this number'}`,
  );
}

async function main(): Promise<void> {
  const projectRoot = path.resolve(__dirname, '..', '..');
  const executable = process.env['VSCODE_EXECUTABLE_PATH'] ?? INSTALLED_VSCODE_MACOS;
  if (!fs.existsSync(executable)) throw new Error(`VS Code not found at ${executable}. Set VSCODE_EXECUTABLE_PATH.`);
  if (!fs.existsSync(path.join(projectRoot, 'out', 'restart-helper', 'index.js'))) {
    throw new Error('The helper is not built. Run `npm run perf:idle`, not this file directly.');
  }

  // LUCKY_BREAK_IDLE_DIAG=1: watch Lucky Break's clock over time, and through animations off and on again.
  if (process.env['LUCKY_BREAK_IDLE_DIAG'] === '1') {
    const session = await launch(projectRoot, executable, true);
    try {
      const seen: Array<{ at: number; ticks: number; running: boolean }> = [];
      const started = Date.now();
      let sentOff = false;
      let sentOn = false;
      while (Date.now() - started < 60_000) {
        const clock = readClock(session);
        if (clock !== undefined && (seen.length === 0 || seen.at(-1)?.ticks !== clock.ticks || seen.at(-1)?.running !== clock.running)) {
          seen.push({ at: Date.now() - started, ...clock });
        }
        const elapsed = Date.now() - started;
        if (!sentOff && elapsed > 15_000) {
          sentOff = true;
          await command(session, { name: 'off', kind: 'still', command: { settings: { animations: false } } }, 'diag-off');
          console.log(`  @${elapsed}ms: animations OFF`);
        }
        if (!sentOn && elapsed > 30_000) {
          sentOn = true;
          await command(session, { name: 'on', kind: 'awake', command: { settings: { animations: true } } }, 'diag-on');
          console.log(`  @${elapsed}ms: animations ON again`);
        }
        await sleep(250);
      }
      let previous: { at: number; ticks: number; running: boolean } | undefined;
      for (const entry of seen) {
        const rate = previous !== undefined && previous.running && entry.running && entry.ticks > previous.ticks ? `${(((entry.ticks - previous.ticks) / (entry.at - previous.at)) * 1000).toFixed(1)} ticks/s` : '';
        console.log(`  @${String(entry.at).padStart(5)}ms  ${entry.running ? 'running' : 'stopped'}  ticks ${String(entry.ticks).padStart(3)}  ${rate}`);
        previous = entry;
      }
    } finally {
      await session.stop();
    }
    return;
  }

  console.log(`CPU of the whole VS Code process tree, % of one core, median of ${SLICE_SECONDS}s slices per phase, with the slowest and fastest slice in brackets (throwaway profile)`);
  console.log('Each session is ONE running window; its phases are comparable with each other.\n');

  const baselines = process.env['LUCKY_BREAK_IDLE_BASELINES'] !== '0' && process.env['LUCKY_BREAK_IDLE_PHASES'] !== 'quick';

  if (baselines) {
    console.log('Session 1: VS Code alone');
    const alone = await launch(projectRoot, executable, false);
    try {
      show(await sampleRendering(alone, { name: 'VS Code alone', kind: 'still' }));
    } finally {
      await alone.stop();
    }
  }

  console.log('\nSession 2: Lucky Break, one window, switched between settings');
  const luckyBreak = await launch(projectRoot, executable, true);
  try {
    const phases = process.env['LUCKY_BREAK_IDLE_PHASES'] === 'quick' ? QUICK_PHASES : LUCKY_BREAK_PHASES;
    for (const [index, phase] of phases.entries()) {
      await command(luckyBreak, phase, `phase-${index}`);
      await sleep(plan(phase.kind).settle * 1000);
      show(await sampleRendering(luckyBreak, phase));
    }
  } finally {
    await luckyBreak.stop();
  }

  if (baselines) {
    console.log('\nSession 3: VS Code alone, again');
    const aloneAgain = await launch(projectRoot, executable, false);
    try {
      show(await sampleRendering(aloneAgain, { name: 'VS Code alone (again)', kind: 'still' }));
    } finally {
      await aloneAgain.stop();
    }
  }
}

main().catch((error: unknown) => {
  console.error('Idle measurement failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
