import * as vscode from 'vscode';
import { SettingsStore } from '../state/settings';
import { BreakRoomStore } from '../state/store';
import { BlackjackTable } from '../game/blackjack/table';
import { resetPrompt } from '../game/resetPrompt';
import { ResetCoordinator, type ResetScope } from '../game/resets';
import { RouletteTable } from '../game/roulette/table';
import type { BreakRoomPage, ViewKind } from '../shared/messages';
import { BreakRoomPanel } from './BreakRoomPanel';
import { BreakRoomViewProvider } from './BreakRoomViewProvider';
import { Logger } from './logger';
import { WebviewHub, type WebviewDiagnostics } from './WebviewHub';

/** Only returned from `activate` in test mode, so integration tests can inspect Break Room Arcade. */
export interface BreakRoomTestApi {
  getDiagnostics(kind: ViewKind): WebviewDiagnostics | undefined;
  /** The real store the webviews are fed from. Tests drive it exactly as the games will. */
  readonly store: BreakRoomStore;
  /** The real blackjack table. */
  readonly table: BlackjackTable;
  /** The real roulette table. */
  readonly roulette: RouletteTable;
  /** The real settings. */
  readonly settings: SettingsStore;
  /**
   * Replaces the confirmation dialog of resets with `answer`, because a test cannot click a modal
   * dialog. Resets still go through the same coordinator, and still only happen on a yes.
   */
  answerResetsWith(answer: (scope: ResetScope) => boolean | PromiseLike<boolean>): void;
  /** Sends a raw message into the hub as if the latest webview of that kind had posted it. */
  sendFromWebview(kind: ViewKind, message: unknown): void;
  /** Switches the latest webview of that kind to another screen. */
  navigate(kind: ViewKind, page: BreakRoomPage): void;
}

/** Everything that saves itself and must be written out before VS Code closes. */
let activeStores: ReadonlyArray<{ flush(): Promise<void> }> = [];

export function activate(context: vscode.ExtensionContext): BreakRoomTestApi | undefined {
  const started = performance.now();
  const logger = new Logger();
  const version = readVersion(context);

  // The wallet, statistics and history live here, in the extension host, and are saved to
  // globalState. The webviews only ever see read-only snapshots of it.
  const store = new BreakRoomStore(context.globalState, {
    onError: (message, error) => logger.error(message, error),
  });
  const settings = new SettingsStore(context.globalState, {
    onError: (message, error) => logger.error(message, error),
  });
  activeStores = [store, settings];
  logStartup(logger, store);

  // The one blackjack table, shared by every view. It owns the deck and the dealer's hole card.
  const table = new BlackjackTable(store, {
    onError: (message, error) => logger.error(message, error),
  });

  // The one roulette table. It decides where the ball lands, before any wheel animation starts.
  const roulette = new RouletteTable(store, {
    onError: (message, error) => logger.error(message, error),
  });

  // A reset only ever happens after the player said yes in a dialog of VS Code's own, which a
  // webview can neither draw nor answer. Tests can swap the dialog for a canned answer.
  let confirmReset: (scope: ResetScope) => PromiseLike<boolean> = askInDialog;
  const resets = new ResetCoordinator({
    store,
    tables: [table, roulette],
    confirm: (scope) => confirmReset(scope),
    onError: (message, error) => logger.error(message, error),
  });

  const hub = new WebviewHub(logger, version, {
    snapshot: () => store.snapshot,
    blackjackView: () => table.view,
    blackjack: (action) => table.perform(action),
    rouletteView: () => roulette.view,
    roulette: (action) => roulette.perform(action),
    settings: () => settings.settings,
    updateSettings: (patch) => void settings.update(patch),
    reset: (scope) => resets.reset(scope),
  });
  const sidebar = new BreakRoomViewProvider(context, hub, logger);

  context.subscriptions.push(
    logger,
    // Every change reaches every open view, so the sidebar and the editor panel always agree.
    { dispose: store.onDidChange((snapshot) => hub.broadcast({ type: 'state', payload: snapshot })) },
    { dispose: table.onDidChange((view) => hub.broadcast({ type: 'blackjack', view })) },
    { dispose: roulette.onDidChange((view) => hub.broadcast({ type: 'roulette', view })) },
    { dispose: settings.onDidChange((payload) => hub.broadcast({ type: 'settings', payload })) },
    vscode.window.registerWebviewViewProvider(BreakRoomViewProvider.viewType, sidebar, {
      // Keep the page alive when the sidebar is hidden so an animation or a round in progress survives.
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.commands.registerCommand('breakRoom.showSidebar', () =>
      vscode.commands.executeCommand(`${BreakRoomViewProvider.viewType}.focus`),
    ),
    vscode.commands.registerCommand('breakRoom.openPanel', () =>
      BreakRoomPanel.createOrShow(context, hub, logger),
    ),
  );

  logger.info(`Break Room Arcade ${version} activated in ${Math.round(performance.now() - started)} ms`);

  return __DEV_TOOLS__ && exposesTestApi(context)
    ? {
        getDiagnostics: (kind) => hub.getDiagnostics(kind),
        store,
        table,
        roulette,
        settings,
        answerResetsWith: (answer) => {
          confirmReset = (scope) => Promise.resolve(answer(scope));
        },
        sendFromWebview: (kind, message) => hub.injectFromWebview(kind, message),
        navigate: (kind, page) => hub.sendTo(kind, { type: 'navigate', page }),
      }
    : undefined;
}

/**
 * The test API hands out the real store, so it must never exist for an installed extension. In the
 * packaged extension this code is not even compiled in (`__DEV_TOOLS__` is false there). In other
 * builds it is only available in test mode, or when running from source with BREAK_ROOM_EXPOSE_TEST_API=1
 * (used by the restart test, which cannot run in test mode: see test/restart/runRestart.ts).
 */
function exposesTestApi(context: vscode.ExtensionContext): boolean {
  switch (context.extensionMode) {
    case vscode.ExtensionMode.Test:
      return true;
    case vscode.ExtensionMode.Development:
      return process.env['BREAK_ROOM_EXPOSE_TEST_API'] === '1';
    default:
      return false;
  }
}

/** Writes any change that is still waiting to be saved. VS Code waits for this before closing. */
export async function deactivate(): Promise<void> {
  await Promise.all(activeStores.map((saver) => saver.flush()));
  activeStores = [];
}

/** The real confirmation: a modal dialog, which blocks the window until the player answers. */
async function askInDialog(scope: ResetScope): Promise<boolean> {
  const { message, detail, confirmLabel } = resetPrompt(scope);
  const answer = await vscode.window.showWarningMessage(message, { modal: true, detail }, confirmLabel);
  return answer === confirmLabel;
}

function logStartup(logger: Logger, store: BreakRoomStore): void {
  const { source, forfeitedRounds } = store.startup;
  logger.info(`Break Room Arcade data: ${source}, balance ${store.snapshot.balance} chips`);

  if (source === 'corrupt') {
    logger.warn('The saved data could not be read. A fresh game was started; the old data is kept under "breakRoom.state.backup".');
  }
  if (forfeitedRounds > 0) {
    logger.warn(`${forfeitedRounds} round(s) were still open when VS Code last closed and were recorded as lost.`);
  }
}

function readVersion(context: vscode.ExtensionContext): string {
  const { version } = context.extension.packageJSON as { version?: unknown };
  return typeof version === 'string' ? version : '0.0.0';
}
