/**
 * Helper extension for the restart test (see runRestart.ts). It is loaded next to Break Room Arcade in a
 * normally launched VS Code, plays or checks some rounds through Break Room Arcade's real store, writes
 * its verdict to a file and then quits VS Code the way a user would, which makes VS Code flush
 * its global state to disk. Without the environment variables set by the runner it does nothing.
 */
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { DEFAULT_SETTINGS } from '../../src/state/settings';
import type { BreakRoomStore } from '../../src/state/store';
import type { GameType } from '../../src/state/types';
import type { BreakRoomTestApi } from '../../src/extension/extension';

const BREAK_ROOM_ID = 'thesulce.break-room-arcade';

function playRound(store: BreakRoomStore, game: GameType, bet: number, payout: number, detail: string): number {
  const begun = store.beginRound(game, bet);
  assert.ok(begun.ok, `beginRound(${game}, ${bet}) was refused`);
  assert.ok(store.settleRound(begun.value.id, payout, detail).ok, 'settleRound was refused');
  return payout - bet;
}

/** Every kind of setting, changed from its default: the restart must bring all of them back. */
const CHOSEN_SETTINGS = {
  sound: false,
  volume: 35,
  animations: false,
  reducedMotion: true,
  textSize: 'large',
  theme: 'royal',
  cardDesign: 'medieval',
  rouletteAnimation: 'slow',
  soundPack: 'cyber',
  soundCategories: { interface: true, chips: false, cards: true, roulette: false, results: true },
  colors: { table: '#224466', chip: '#ffcc00' },
} as const;

async function writePhase({ store, settings }: BreakRoomTestApi): Promise<void> {
  assert.deepEqual(store.startup, { source: 'fresh', forfeitedRounds: 0 }, 'expected a brand-new profile');
  assert.equal(store.snapshot.balance, 1_000);

  assert.equal(playRound(store, 'roulette', 100, 0, 'Black 8'), -100); // 900
  assert.equal(playRound(store, 'blackjack', 50, 125, 'Blackjack'), 75); // 975, paid 3:2
  assert.ok(store.beginRound('roulette', 40).ok); // 935, never settled: VS Code is about to close

  assert.equal(store.snapshot.balance, 935);

  // Settings are saved on their own, and must survive too.
  settings.update(CHOSEN_SETTINGS);
  await Promise.all([store.flush(), settings.flush()]);
}

async function readPhase(api: BreakRoomTestApi): Promise<void> {
  const { store, settings } = api;

  assert.deepEqual(
    settings.settings,
    { ...DEFAULT_SETTINGS, ...CHOSEN_SETTINGS },
    'the settings, including the theme, card design, wheel animation, sound pack, sound categories and colors, must survive the restart',
  );
  assert.deepEqual(store.startup, { source: 'saved', forfeitedRounds: 1 }, 'the saved game was not loaded');
  assert.equal(store.snapshot.balance, 935, 'the balance must survive the restart');
  assert.deepEqual(store.openRounds, []);

  const { overall, blackjack, roulette } = store.snapshot.stats;
  assert.deepEqual(
    [overall.gamesPlayed, overall.wins, overall.losses, overall.pushes, overall.biggestWin, overall.biggestLoss, overall.totalWagered],
    [3, 1, 2, 0, 75, 100, 190],
  );
  assert.equal(blackjack.gamesPlayed, 1);
  assert.equal(roulette.gamesPlayed, 2);

  assert.deepEqual(
    store.snapshot.history.map((entry) => [entry.game, entry.bet, entry.outcome, entry.payout, entry.detail]),
    [
      ['roulette', 40, 'loss', -40, 'Round abandoned'],
      ['blackjack', 50, 'win', 75, 'Blackjack'],
      ['roulette', 100, 'loss', -100, 'Black 8'],
    ],
  );

  // And the views are fed the restored state.
  await vscode.commands.executeCommand('workbench.view.extension.breakRoom');
  const deadline = Date.now() + 30_000;
  for (;;) {
    const shown = api.getDiagnostics('sidebar')?.lastShown;
    if (shown?.balance === 935 && shown.gamesPlayed === 3) return;
    assert.ok(Date.now() < deadline, 'the sidebar never showed the restored balance');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/**
 * Opens Break Room Arcade the way a player leaves it, then stays open so `perf:idle` can sample how much CPU
 * VS Code uses. Never quits (the runner stops VS Code). While it stays open it also obeys commands the
 * runner writes to a control file, so one running window can be measured under several settings.
 */
async function idlePhase(api: BreakRoomTestApi): Promise<void> {
  const page = (process.env['BREAK_ROOM_IDLE_PAGE'] ?? 'home') as Parameters<BreakRoomTestApi['navigate']>[1];
  const settings = JSON.parse(process.env['BREAK_ROOM_IDLE_SETTINGS'] ?? '{}') as Parameters<BreakRoomTestApi['settings']['update']>[0];

  api.settings.update(settings);
  await vscode.commands.executeCommand('workbench.view.extension.breakRoom');
  const deadline = Date.now() + 60_000;
  while (api.getDiagnostics('sidebar')?.rendered !== true) {
    assert.ok(Date.now() < deadline, 'the sidebar never rendered');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  api.navigate('sidebar', page);
  await new Promise((resolve) => setTimeout(resolve, 1_000));

  const controlPath = process.env['BREAK_ROOM_IDLE_CONTROL'];
  if (controlPath === undefined) return;

  // What Break Room Arcade's own page says about its decorations, for the runner to read. This is how the
  // measurement knows they are alive without attaching a debugger to the webview, which changes the CPU.
  setInterval(() => {
    fs.writeFileSync(`${controlPath}.status`, JSON.stringify(api.getDiagnostics('sidebar')?.lastAmbient ?? null));
  }, 500);

  interface Command {
    readonly id: string;
    readonly settings?: Parameters<BreakRoomTestApi['settings']['update']>[0];
    readonly page?: Parameters<BreakRoomTestApi['navigate']>[1];
    /** `explorer` puts another view in front of Break Room Arcade (which stays alive); `breakRoom` brings it back. */
    readonly show?: 'breakRoom' | 'explorer';
  }
  let handled = '';
  setInterval(() => {
    let command: Command;
    try {
      command = JSON.parse(fs.readFileSync(controlPath, 'utf8')) as Command;
    } catch {
      return; // not written yet
    }
    if (command.id === handled) return;
    handled = command.id;
    void (async () => {
      if (command.settings !== undefined) api.settings.update(command.settings);
      if (command.page !== undefined) api.navigate('sidebar', command.page);
      if (command.show === 'explorer') await vscode.commands.executeCommand('workbench.view.explorer');
      if (command.show === 'breakRoom') await vscode.commands.executeCommand('workbench.view.extension.breakRoom');
      fs.writeFileSync(`${controlPath}.ack`, command.id);
    })();
  }, 250);
}

/** Break Room Arcade's own log files under `root`, read whole. Small trees only: this is a throwaway profile's logs. */
function readLogs(root: string): string {
  let text = '';
  const visit = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(full);
      // Judged by the path INSIDE the logs folder: the project folder itself is called break-room-arcade.
      else if (entry.name.endsWith('.log') && /break.?room/i.test(path.relative(root, full))) text += `${fs.readFileSync(full, 'utf8')}\n`;
    }
  };
  try {
    visit(root);
  } catch {
    // not created yet
  }
  return text;
}

/**
 * Checks Break Room Arcade as it was INSTALLED from a VSIX (the runner installs it into the profile this
 * VS Code uses), not as it runs from source: where it lives, that it does not hand out its test API,
 * that its commands exist, and, from Break Room Arcade's own log, that both webviews really rendered.
 */
async function vsixPhase(breakRoom: vscode.Extension<unknown>, logsRoot: string): Promise<string> {
  const installedIn = process.env['BREAK_ROOM_VSIX_EXTENSIONS_DIR'];
  assert.ok(installedIn !== undefined && breakRoom.extensionPath.startsWith(installedIn), `Break Room Arcade runs from ${breakRoom.extensionPath}, not from the installed copy`);

  const api = await breakRoom.activate();
  assert.equal(api, undefined, 'an installed copy must not hand out its test API');

  const commands = await vscode.commands.getCommands(true);
  for (const command of ['breakRoom.showSidebar', 'breakRoom.openPanel', 'breakRoom.sidebar.focus']) assert.ok(commands.includes(command), `${command} is not registered`);

  await vscode.commands.executeCommand('workbench.view.extension.breakRoom');
  await vscode.commands.executeCommand('breakRoom.openPanel');

  const wanted = [/\[sidebar\] webview rendered \(fonts loaded: true, audio: true, assets: prod\)/, /\[panel\] webview rendered \(fonts loaded: true, audio: true, assets: prod\)/];
  const deadline = Date.now() + 60_000;
  let logs = '';
  for (;;) {
    logs = readLogs(logsRoot);
    if (wanted.every((pattern) => pattern.test(logs))) break;
    assert.ok(Date.now() < deadline, `the installed copy's webviews never reported rendering. Log so far:\n${logs.slice(-1500)}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  await new Promise((resolve) => setTimeout(resolve, 1_500)); // let a late CSP or error report arrive

  logs = readLogs(logsRoot);
  assert.ok(!/CSP violation/.test(logs), `CSP violations in the installed copy:\n${logs.split('\n').filter((line) => /CSP violation/.test(line)).join('\n')}`);
  assert.ok(!/webview error/.test(logs), `webview errors in the installed copy:\n${logs.split('\n').filter((line) => /webview error/.test(line)).join('\n')}`);
  assert.ok(!/\[error\]/i.test(logs), `Break Room Arcade logged an error:\n${logs.split('\n').filter((line) => /\[error\]/i.test(line)).join('\n')}`);
  const activated = /Break Room Arcade (\S+) activated in (\d+) ms/.exec(logs);
  assert.ok(activated, 'Break Room Arcade never logged that it activated');
  return `installed version ${activated[1] ?? '?'}, activated in ${activated[2] ?? '?'} ms, both webviews rendered, no test API, no CSP violations`;
}

async function run(phase: string, resultPath: string, context: vscode.ExtensionContext): Promise<void> {
  let outcome: { readonly ok: boolean; readonly detail: string };
  try {
    const breakRoom = vscode.extensions.getExtension(BREAK_ROOM_ID);
    assert.ok(breakRoom, `extension ${BREAK_ROOM_ID} is not loaded`);
    if (phase === 'vsix') {
      // The extension host's log folder holds a folder per extension; this helper's is one of them.
      const detail = await vsixPhase(breakRoom, path.resolve(context.logUri.fsPath, '..', '..'));
      fs.writeFileSync(resultPath, JSON.stringify({ ok: true, detail }));
      await vscode.commands.executeCommand('workbench.action.quit');
      return;
    }
    const api = (await breakRoom.activate()) as BreakRoomTestApi | undefined;
    assert.ok(api, 'Break Room Arcade did not expose its test API (is BREAK_ROOM_EXPOSE_TEST_API=1 set?)');

    if (phase === 'idle') {
      await idlePhase(api);
      fs.writeFileSync(resultPath, JSON.stringify({ ok: true, detail: 'ready' }));
      return; // stay open: the runner measures, then stops VS Code
    }
    if (phase === 'write') await writePhase(api);
    else if (phase === 'read') await readPhase(api);
    else throw new Error(`unknown phase "${phase}"`);
    outcome = { ok: true, detail: `${phase} phase passed` };
  } catch (error) {
    outcome = { ok: false, detail: error instanceof Error ? error.message : String(error) };
  }

  fs.writeFileSync(resultPath, JSON.stringify(outcome));
  await vscode.commands.executeCommand('workbench.action.quit');
}

export function activate(context: vscode.ExtensionContext): void {
  const phase = process.env['BREAK_ROOM_RESTART_PHASE'];
  const resultPath = process.env['BREAK_ROOM_RESTART_RESULT'];
  if (phase === undefined || resultPath === undefined) return; // inert unless the runner drives it
  void run(phase, resultPath, context);
}
