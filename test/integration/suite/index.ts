/**
 * Runs inside the VS Code extension host. Deliberately framework-free: a test is a named async
 * function and any thrown error fails the run.
 *
 * Persistence across a real VS Code restart cannot be tested here: VS Code deliberately keeps
 * global state in memory whenever it runs extension tests. See test/restart/ for that check.
 */
import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';
import type { Settings } from '../../../src/state/settings';
import type { GameType } from '../../../src/state/types';
import type { LuckyBreakStore } from '../../../src/state/store';
import type { LuckyBreakTestApi } from '../../../src/extension/extension';
import type { WebviewDiagnostics } from '../../../src/extension/WebviewHub';
import type { BlackjackView, TablePhase } from '../../../src/game/blackjack/view';
import type { RouletteColor } from '../../../src/game/roulette/types';
import type { ResetScope } from '../../../src/game/resetScope';
import type { ViewKind } from '../../../src/shared/messages';

const EXTENSION_ID = 'thesulce.lucky-break';
const expectedAssetMode = process.env['LUCKY_BREAK_EXPECT_ASSET_MODE'] ?? 'prod';

async function getApi(): Promise<LuckyBreakTestApi> {
  const extension = vscode.extensions.getExtension(EXTENSION_ID);
  assert.ok(extension, `extension ${EXTENSION_ID} is not installed in the test host`);
  const api = (await extension.activate()) as LuckyBreakTestApi | undefined;
  assert.ok(api, 'activate() must return the test API in test mode');
  return api;
}

async function waitFor<T>(description: string, probe: () => T | undefined, timeoutMs = 30_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = probe();
    if (value !== undefined) return value;
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${description}`);
    await sleep(100);
  }
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Waits until the webview says it rendered, lets late CSP/error reports arrive, then returns its report. */
async function waitForRenderedWebview(api: LuckyBreakTestApi, kind: ViewKind): Promise<WebviewDiagnostics> {
  await waitFor(`the ${kind} webview to render`, () => (api.getDiagnostics(kind)?.rendered ? true : undefined));
  await sleep(750);
  const diagnostics = api.getDiagnostics(kind);
  assert.ok(diagnostics);
  return diagnostics;
}

function assertHealthy(diagnostics: WebviewDiagnostics): void {
  const { kind } = diagnostics;
  assert.ok(diagnostics.readyCount >= 1, `${kind}: the webview never sent "ready"`);
  assert.equal(diagnostics.fontsLoaded, true, `${kind}: pixel fonts did not load`);
  assert.equal(diagnostics.audioAvailable, true, `${kind}: this webview has no Web Audio, so the sound effects could not play`);
  assert.deepEqual(diagnostics.cspViolations, [], `${kind}: CSP violations`);
  assert.deepEqual(diagnostics.errors, [], `${kind}: uncaught webview errors`);
  assert.equal(diagnostics.assetMode, expectedAssetMode, `${kind}: wrong asset source`);
}

function countLuckyBreakPanelTabs(): number {
  return vscode.window.tabGroups.all
    .flatMap((group) => group.tabs)
    .filter((tab) => tab.input instanceof vscode.TabInputWebview && tab.input.viewType.endsWith('luckyBreak.panel'))
    .length;
}

/** Makes sure both the sidebar and the editor panel are open and rendered. */
async function openBothViews(api: LuckyBreakTestApi): Promise<void> {
  await vscode.commands.executeCommand('workbench.view.extension.luckyBreak');
  await vscode.commands.executeCommand('luckyBreak.openPanel');
  await waitForRenderedWebview(api, 'sidebar');
  await waitForRenderedWebview(api, 'panel');
}

/** Plays one complete round through the real store, as the games will. Returns the net chips. */
function playRound(store: LuckyBreakStore, game: GameType, bet: number, payout: number, detail: string): number {
  const begun = store.beginRound(game, bet);
  assert.ok(begun.ok, `beginRound(${game}, ${bet}) was refused: ${begun.ok ? '' : begun.error}`);
  const settled = store.settleRound(begun.value.id, payout, detail);
  assert.ok(settled.ok, `settleRound was refused: ${settled.ok ? '' : settled.error}`);
  return payout - bet;
}

/** Waits until the sidebar AND the panel each report having drawn exactly this state. */
async function expectBothViewsShow(api: LuckyBreakTestApi, balance: number, gamesPlayed: number): Promise<void> {
  for (const kind of ['sidebar', 'panel'] as const) {
    await waitFor(`the ${kind} view to show balance ${balance} after ${gamesPlayed} games`, () => {
      const shown = api.getDiagnostics(kind)?.lastShown;
      return shown?.balance === balance && shown.gamesPlayed === gamesPlayed ? true : undefined;
    });
  }
}

interface DrawnTable {
  readonly round: number;
  readonly phase: TablePhase;
  readonly playerCards: number;
  readonly dealerCards: number;
}

/** Waits until the sidebar AND the panel each report having drawn exactly this blackjack table. */
async function expectBothTablesDrew(api: LuckyBreakTestApi, expected: DrawnTable): Promise<void> {
  for (const kind of ['sidebar', 'panel'] as const) {
    await waitFor(`the ${kind} table to show ${JSON.stringify(expected)}`, () => {
      const shown = api.getDiagnostics(kind)?.lastBlackjack;
      return shown !== undefined &&
        shown.round === expected.round &&
        shown.phase === expected.phase &&
        shown.playerCards === expected.playerCards &&
        shown.dealerCards === expected.dealerCards
        ? true
        : undefined;
    });
  }
}

/** Waits until the sidebar AND the panel each report their wheel in this state. */
async function expectBothWheels(
  api: LuckyBreakTestApi,
  expected: { readonly spin: number; readonly phase: 'idle' | 'spinning' | 'result'; readonly landedOn: number | null },
  timeoutMs = 45_000,
): Promise<void> {
  for (const kind of ['sidebar', 'panel'] as const) {
    await waitFor(
      `the ${kind} wheel to report ${JSON.stringify(expected)}`,
      () => {
        const shown = api.getDiagnostics(kind)?.lastRoulette;
        return shown?.spin === expected.spin && shown.phase === expected.phase && shown.landedOn === expected.landedOn
          ? true
          : undefined;
      },
      timeoutMs,
    );
  }
}

const spin = (color: string, bet: number) =>
  ({ type: 'roulette', action: { kind: 'spin', selection: { kind: 'color', color }, bet } }) as const;
const spinNumber = (number: unknown, bet: number) =>
  ({ type: 'roulette', action: { kind: 'spin', selection: { kind: 'number', number }, bet } }) as const;

const deal = (bet: number) => ({ type: 'blackjack', action: { kind: 'deal', bet } }) as const;
const move = (kind: 'hit' | 'stand' | 'double' | 'split' | 'newRound') => ({ type: 'blackjack', action: { kind } }) as const;

const playerCardCount = (view: BlackjackView): number => view.hands.reduce((sum, hand) => sum + hand.cards.length, 0);

/** A plain strategy: hit below 17, otherwise stand. Decided from what the host says is allowed. */
function nextMove(view: BlackjackView): 'hit' | 'stand' {
  const hand = view.hands.find((candidate) => candidate.active);
  return view.actions.hit && hand !== undefined && hand.total < 17 ? 'hit' : 'stand';
}

type Test = readonly [name: string, run: () => Promise<void>];

const blackjackTests: readonly Test[] = [
  [
    'the Blackjack screen opens in the sidebar and the panel and draws the empty table',
    async () => {
      const api = await getApi();
      await openBothViews(api);
      api.navigate('sidebar', 'blackjack');
      api.navigate('panel', 'blackjack');

      const { round } = api.table.view;
      await expectBothTablesDrew(api, { round, phase: 'betting', playerCards: 0, dealerCards: 0 });
      assertHealthy(api.getDiagnostics('sidebar') as WebviewDiagnostics);
      assertHealthy(api.getDiagnostics('panel') as WebviewDiagnostics);
    },
  ],
  [
    'a deal sent as a webview message takes the bet, and both views draw the cards',
    async () => {
      const api = await getApi();
      const before = api.store.snapshot.balance;

      api.sendFromWebview('sidebar', deal(50));

      const view = api.table.view;
      assert.ok(view.phase === 'player' || view.phase === 'settled', `unexpected phase ${view.phase}`);
      assert.equal(playerCardCount(view), 2);
      assert.equal(view.dealer.cards.length, 2);
      if (view.phase === 'player') {
        assert.equal(api.store.snapshot.balance, before - 50, 'the bet must leave the balance when the round begins');
        assert.equal(view.dealer.cards[1], null, 'the hole card must stay hidden from the webviews');
        assert.equal(view.dealer.total, null);
      }
      await expectBothTablesDrew(api, { round: view.round, phase: view.phase, playerCards: 2, dealerCards: 2 });
    },
  ],
  [
    'a whole round played through webview messages ends with the wallet, the history and both views in step',
    async () => {
      const api = await getApi();
      // The round from the previous test is either still open (its stake is out of the balance) or was over
      // at once (a natural blackjack, about one deal in eleven), in which case it is already paid.
      const open = api.table.view;
      const before =
        open.phase === 'player'
          ? api.store.snapshot.balance + open.hands.reduce((sum, hand) => sum + hand.bet, 0)
          : api.store.snapshot.balance - (open.result?.net ?? 0);
      for (let guard = 0; api.table.view.phase === 'player' && guard < 30; guard += 1) {
        api.sendFromWebview('panel', move(nextMove(api.table.view)));
      }

      const view = api.table.view;
      assert.equal(view.phase, 'settled');
      const { result } = view;
      assert.ok(result, 'a settled round must have a result');
      assert.equal(api.store.snapshot.balance, before + result.net, 'the balance must move by exactly the net result');
      assert.deepEqual(api.store.openRounds, [], 'a settled round must leave nothing open');

      const entry = api.store.snapshot.history[0];
      assert.equal(entry?.game, 'blackjack');
      assert.equal(entry?.bet, result.staked);
      assert.equal(entry?.payout, result.net);
      assert.equal(entry?.detail, result.detail);
      assert.equal(entry?.outcome, result.net > 0 ? 'win' : result.net < 0 ? 'loss' : 'push');

      // Both real webviews drew every card, including each one the dealer drew, and the real balance.
      await expectBothTablesDrew(api, {
        round: view.round,
        phase: 'settled',
        playerCards: playerCardCount(view),
        dealerCards: view.dealer.cards.length,
      });
      await expectBothViewsShow(api, api.store.snapshot.balance, api.store.snapshot.stats.overall.gamesPlayed);
    },
  ],
  [
    'NEW ROUND sends both views back to the betting table',
    async () => {
      const api = await getApi();
      api.sendFromWebview('sidebar', move('newRound'));
      const { round } = api.table.view;
      assert.equal(api.table.view.phase, 'betting');
      await expectBothTablesDrew(api, { round, phase: 'betting', playerCards: 0, dealerCards: 0 });
    },
  ],
  [
    'several more rounds keep the wallet exactly in step with every result',
    async () => {
      const api = await getApi();
      for (let round = 0; round < 6; round += 1) {
        const balance = api.store.snapshot.balance;
        if (balance < 10) break;
        const bet = Math.min(balance, 10 * (1 + (round % 5)));

        api.sendFromWebview('sidebar', deal(bet));
        for (let guard = 0; api.table.view.phase === 'player' && guard < 30; guard += 1) {
          api.sendFromWebview('sidebar', move(nextMove(api.table.view)));
        }
        const { result } = api.table.view;
        assert.ok(result);
        assert.equal(api.store.snapshot.balance, balance + result.net, `round ${round}: wallet out of step`);
        api.sendFromWebview('sidebar', move('newRound'));
      }
      assert.deepEqual(api.store.openRounds, []);
    },
  ],
  [
    'bad requests from a webview are refused, change nothing and never reach the wallet',
    async () => {
      const api = await getApi();
      const snapshot = api.store.snapshot;
      const table = api.table.view;
      const balance = snapshot.balance;

      for (const action of [deal(5), deal(balance + 1), deal(12.5), deal(-100), deal(0), move('hit'), move('double'), move('split')]) {
        api.sendFromWebview('sidebar', action);
      }
      // Malformed or invented messages are ignored outright.
      api.sendFromWebview('sidebar', { type: 'blackjack', action: { kind: 'surrender' } });
      api.sendFromWebview('sidebar', { type: 'blackjack', action: { kind: 'deal', bet: '100' } });
      api.sendFromWebview('sidebar', { type: 'setBalance', amount: 1_000_000 });
      api.sendFromWebview('sidebar', { type: 'blackjack', action: { kind: 'win', payout: 1_000_000 } });

      assert.equal(api.store.snapshot, snapshot, 'nothing about Lucky Break may change');
      assert.equal(api.table.view, table, 'nothing about the table may change');
      assert.equal(api.store.snapshot.balance, balance);
      assert.deepEqual(api.store.openRounds, []);
    },
  ],
];

const rouletteTests: readonly Test[] = [
  [
    'the Roulette screen opens in the sidebar and the panel and shows an idle wheel',
    async () => {
      const api = await getApi();
      if (api.store.snapshot.balance < 500) assert.ok(api.store.resetBalance().ok);
      await openBothViews(api);
      api.navigate('sidebar', 'roulette');
      api.navigate('panel', 'roulette');

      await expectBothWheels(api, { spin: api.roulette.view.spin, phase: api.roulette.view.spin === 0 ? 'idle' : 'result', landedOn: api.roulette.view.last?.pocket.number ?? null });
      assertHealthy(api.getDiagnostics('sidebar') as WebviewDiagnostics);
      assertHealthy(api.getDiagnostics('panel') as WebviewDiagnostics);
    },
  ],
  [
    'a spin sent as a webview message is decided by the host, and both real wheels stop on exactly that pocket',
    async () => {
      const api = await getApi();
      const before = api.store.snapshot.balance;

      api.sendFromWebview('sidebar', spin('red', 50));

      const view = api.roulette.view;
      const { last } = view;
      assert.ok(last, 'the host must have spun');
      assert.equal(last.bet, 50);
      assert.equal(api.store.snapshot.balance, before + last.net, 'the wallet must move by exactly the net result');
      assert.deepEqual(api.store.openRounds, []);

      // The ball landed before any animation ran. Each wheel now turns and must stop on that very number.
      await expectBothWheels(api, { spin: view.spin, phase: 'result', landedOn: last.pocket.number });
      await expectBothViewsShow(api, api.store.snapshot.balance, api.store.snapshot.stats.overall.gamesPlayed);
    },
  ],
  [
    'every colour can be bet on and settles correctly, and both wheels land on each host-chosen pocket',
    async () => {
      const api = await getApi();
      for (const color of ['black', 'green', 'red'] as const satisfies readonly RouletteColor[]) {
        const balance = api.store.snapshot.balance;
        api.sendFromWebview('panel', spin(color, 10));

        const { last, spin: spinNumber } = api.roulette.view;
        assert.ok(last);
        assert.deepEqual(last.selection, { kind: 'color', color });
        assert.equal(last.won, last.pocket.color === color);
        const expectedPayout = last.won ? 10 * (color === 'green' ? 36 : 2) : 0;
        assert.equal(last.payout, expectedPayout, `${color} bet on ${last.detail}`);
        assert.equal(api.store.snapshot.balance, balance - 10 + expectedPayout);

        await expectBothWheels(api, { spin: spinNumber, phase: 'result', landedOn: last.pocket.number });
      }
    },
  ],
  [
    'the history and the recent results record each spin as it landed',
    async () => {
      const api = await getApi();
      const { recent, last } = api.roulette.view;
      assert.ok(last);
      assert.equal(recent[0]?.number, last.pocket.number);

      const entry = api.store.snapshot.history[0];
      assert.equal(entry?.game, 'roulette');
      assert.equal(entry?.detail, last.detail);
      assert.equal(entry?.bet, last.bet);
      assert.equal(entry?.payout, last.net);

      // The newest roulette entries in the history are the recent results, one for one and in order.
      const fromHistory = api.store.snapshot.history.filter((item) => item.game === 'roulette').map((item) => item.detail);
      const fromTable = recent.map((pocket) => `${pocket.color[0]?.toUpperCase()}${pocket.color.slice(1)} ${pocket.number}`);
      assert.deepEqual(fromHistory.slice(0, fromTable.length), fromTable);
      assert.equal(recent.length, Math.min(api.roulette.view.spin, 12));
    },
  ],
  [
    'a number can be bet on too: it pays 35 to 1 on a hit, and both real wheels land on the host-chosen pocket',
    async () => {
      const api = await getApi();
      // Bet on the pocket the host will not necessarily pick; over several spins at least one number bet is settled each way.
      for (const chosen of [0, 7, 17, 36]) {
        const balance = api.store.snapshot.balance;
        api.sendFromWebview('sidebar', spinNumber(chosen, 10));

        const { last, spin: spinNumberNow } = api.roulette.view;
        assert.ok(last);
        assert.deepEqual(last.selection, { kind: 'number', number: chosen });
        assert.equal(last.won, last.pocket.number === chosen, `bet ${chosen}, landed ${last.pocket.number}`);
        const expectedPayout = last.won ? 10 * 36 : 0;
        assert.equal(last.payout, expectedPayout);
        assert.equal(api.store.snapshot.balance, balance - 10 + expectedPayout);

        await expectBothWheels(api, { spin: spinNumberNow, phase: 'result', landedOn: last.pocket.number });
      }
    },
  ],
  [
    'only a colour or a number can be bet on: other bets and bad amounts are refused, change nothing and never reach the wallet',
    async () => {
      const api = await getApi();
      const snapshot = api.store.snapshot;
      const table = api.roulette.view;
      const balance = snapshot.balance;

      for (const action of [spin('red', 5), spin('red', balance + 1), spin('green', 12.5), spin('black', -10), spin('red', 0), spinNumber(5, 5), spinNumber(5, balance + 1), spinNumber(5, 12.5)]) {
        api.sendFromWebview('sidebar', action);
      }
      // Anything that is not one of the three colours never gets as far as the table.
      for (const color of ['odd', 'even', 'high', 'low', 'dozen1', 'column2', '17', 17, '']) {
        api.sendFromWebview('sidebar', spin(color as string, 100));
      }
      // Nor does a number that is not on the wheel.
      for (const number of [-1, 37, 99, 1.5, '17', null, Number.NaN]) api.sendFromWebview('sidebar', spinNumber(number, 100));

      api.sendFromWebview('sidebar', { type: 'roulette', action: { kind: 'spin', numbers: [17], bet: 100 } });
      api.sendFromWebview('sidebar', { type: 'roulette', action: { kind: 'spin', selection: { kind: 'dozen', dozen: 1 }, bet: 100 } });
      api.sendFromWebview('sidebar', { type: 'roulette', action: { kind: 'spin', color: 'red', bet: 100 } });
      api.sendFromWebview('sidebar', { type: 'roulette', action: { kind: 'spin', selection: { kind: 'color', color: 'red' } } });
      api.sendFromWebview('sidebar', { type: 'roulette', action: { kind: 'payout', amount: 1_000_000 } });

      assert.equal(api.store.snapshot, snapshot, 'nothing about Lucky Break may change');
      assert.equal(api.roulette.view, table, 'nothing about the table may change');
      assert.equal(api.store.snapshot.balance, balance);
      assert.deepEqual(api.store.openRounds, []);
    },
  ],
];


/** Waits until the sidebar AND the panel each report having applied exactly these settings. */
async function expectBothViewsApply(api: LuckyBreakTestApi, expected: Settings): Promise<void> {
  for (const kind of ['sidebar', 'panel'] as const) {
    await waitFor(`the ${kind} view to apply ${JSON.stringify(expected)}`, () => {
      const shown = api.getDiagnostics(kind)?.lastSettings;
      return shown !== undefined && JSON.stringify(shown) === JSON.stringify(expected) ? true : undefined;
    });
  }
}

const changeSettings = (patch: unknown) => ({ type: 'settings', patch }) as const;
const resetRequest = (scope: string) => ({ type: 'reset', scope }) as const;

/** Answers every reset dialog with `answer`, remembering what was asked. */
function recordResets(api: LuckyBreakTestApi, answer: boolean | (() => Promise<boolean>)): ResetScope[] {
  const asked: ResetScope[] = [];
  api.answerResetsWith((scope) => {
    asked.push(scope);
    return typeof answer === 'boolean' ? answer : answer();
  });
  return asked;
}

/** Deals until a hand is still being played (a natural blackjack settles at once, so it is dealt again). */
function startOpenHand(api: LuckyBreakTestApi): void {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    api.sendFromWebview('sidebar', deal(50));
    if (api.table.view.phase === 'player') return;
    api.sendFromWebview('sidebar', move('newRound'));
  }
  throw new Error('could not deal a hand that stays open');
}

/** The sidebar and the panel each report their clock; wait for the one in `kind` to match, and return its ticks. */
async function expectAmbient(
  api: LuckyBreakTestApi,
  kind: ViewKind,
  expected: { readonly running: boolean; readonly resting?: boolean },
  timeoutMs = 20_000,
): Promise<number> {
  return waitFor(
    `the ${kind} decorations to be ${JSON.stringify(expected)}`,
    () => {
      const shown = api.getDiagnostics(kind)?.lastAmbient;
      return shown !== undefined && shown.running === expected.running && (expected.resting === undefined || shown.resting === expected.resting)
        ? shown.ticks
        : undefined;
    },
    timeoutMs,
  );
}

/** Going to another screen is the player doing something, so it wakes resting decorations. */
async function wakeDecorations(api: LuckyBreakTestApi): Promise<void> {
  for (const kind of ['sidebar', 'panel'] as const) {
    api.navigate(kind, 'settings');
    api.navigate(kind, 'home');
  }
  await sleep(300);
}

const settingsTests: readonly Test[] = [
  [
    'the decorations run only in full motion and only while the player is there: ticking, then resting, then woken, and still when calm or off',
    async () => {
      const api = await getApi();
      await openBothViews(api);
      api.settings.update({ animations: true, reducedMotion: false });
      await wakeDecorations(api);

      // Full motion and the player present: the clock ticks and keeps ticking, in both views.
      for (const kind of ['sidebar', 'panel'] as const) {
        const first = await expectAmbient(api, kind, { running: true });
        await waitFor(`the ${kind} clock to tick on`, () => {
          const shown = api.getDiagnostics(kind)?.lastAmbient;
          return shown?.running === true && shown.ticks > first ? true : undefined;
        });
      }

      // Nobody touches Lucky Break: after the rest time the clock stops by itself, and the page stops drawing frames.
      for (const kind of ['sidebar', 'panel'] as const) await expectAmbient(api, kind, { running: false, resting: true }, 40_000);

      // The player is back (a new screen counts): the decorations start again.
      await wakeDecorations(api);
      for (const kind of ['sidebar', 'panel'] as const) await expectAmbient(api, kind, { running: true, resting: false });

      // Reduced motion and animations off both stop it, in both views, and it is not "resting": it is not wanted.
      api.settings.update({ reducedMotion: true });
      for (const kind of ['sidebar', 'panel'] as const) await expectAmbient(api, kind, { running: false, resting: false });
      api.settings.update({ reducedMotion: false, animations: false });
      for (const kind of ['sidebar', 'panel'] as const) await expectAmbient(api, kind, { running: false, resting: false });

      // And back to full motion.
      api.settings.update({ animations: true });
      await wakeDecorations(api);
      for (const kind of ['sidebar', 'panel'] as const) await expectAmbient(api, kind, { running: true, resting: false });
      assertHealthy(api.getDiagnostics('sidebar') as WebviewDiagnostics);
      assertHealthy(api.getDiagnostics('panel') as WebviewDiagnostics);
    },
  ],
  [
    'the Settings screen opens in the sidebar and the panel under the CSP, showing the saved settings',
    async () => {
      const api = await getApi();
      await openBothViews(api);
      api.navigate('sidebar', 'settings');
      api.navigate('panel', 'settings');

      await expectBothViewsApply(api, api.settings.settings);
      assertHealthy(api.getDiagnostics('sidebar') as WebviewDiagnostics);
      assertHealthy(api.getDiagnostics('panel') as WebviewDiagnostics);
    },
  ],
  [
    'a settings change from either view is saved by the host and applied by both views',
    async () => {
      const api = await getApi();
      const defaults = api.settings.settings;

      api.sendFromWebview('sidebar', changeSettings({ volume: 80, reducedMotion: true }));
      const first: Settings = { ...defaults, volume: 80, reducedMotion: true };
      assert.deepEqual(api.settings.settings, first);
      await expectBothViewsApply(api, first);

      api.sendFromWebview('panel', changeSettings({ sound: false, animations: false }));
      const second: Settings = { ...first, sound: false, animations: false };
      assert.deepEqual(api.settings.settings, second);
      await expectBothViewsApply(api, second);

      // A change that changes nothing is not an event at all.
      const before = api.settings.settings;
      api.sendFromWebview('sidebar', changeSettings({ sound: false }));
      assert.equal(api.settings.settings, before);
    },
  ],
  [
    'the look, the cards, the wheel, the sound pack and the colors are saved by the host and applied by both views',
    async () => {
      const api = await getApi();
      const defaults = api.settings.settings;

      api.sendFromWebview('sidebar', changeSettings({ theme: 'neon', cardDesign: 'medieval' }));
      const first: Settings = { ...defaults, theme: 'neon', cardDesign: 'medieval' };
      assert.deepEqual(api.settings.settings, first);
      await expectBothViewsApply(api, first);

      api.sendFromWebview('panel', changeSettings({ rouletteAnimation: 'explosion', soundPack: 'adventure' }));
      api.sendFromWebview('panel', changeSettings({ soundCategories: { interface: true, chips: false, cards: true, roulette: true, results: true } }));
      api.sendFromWebview('panel', changeSettings({ colors: { table: '#224466', accent: '#ff8800' } }));
      const second: Settings = {
        ...first,
        rouletteAnimation: 'explosion',
        soundPack: 'adventure',
        soundCategories: { interface: true, chips: false, cards: true, roulette: true, results: true },
        colors: { table: '#224466', accent: '#ff8800' },
      };
      assert.deepEqual(api.settings.settings, second);
      await expectBothViewsApply(api, second);

      // Back to the theme's own colors, and the default look: every choice can be undone.
      api.sendFromWebview('sidebar', changeSettings({ colors: {}, theme: 'classic', cardDesign: 'classic', rouletteAnimation: 'classic', soundPack: 'classic' }));
      assert.deepEqual(api.settings.settings.colors, {});
      assert.equal(api.settings.settings.theme, 'classic');
      await expectBothViewsApply(api, api.settings.settings);
    },
  ],
  [
    'unknown looks, half a set of sound categories and bad colors are ignored: nothing changes',
    async () => {
      const api = await getApi();
      const before = api.settings.settings;

      for (const patch of [
        { theme: 'gold' },
        { theme: 7 },
        { cardDesign: 'fancy' },
        { rouletteAnimation: 'fast' },
        { soundPack: 'loud' },
        { soundCategories: { chips: false } },
        { soundCategories: { interface: true, chips: 'no', cards: true, roulette: true, results: true } },
        { colors: { table: 'green' } },
        { colors: { glow: '#ffffff' } },
        { colors: { table: '#FFFFFF' } },
        { theme: 'neon', soundPack: 'loud' },
      ]) {
        api.sendFromWebview('sidebar', changeSettings(patch));
      }

      assert.equal(api.settings.settings, before, 'invalid looks must change nothing');
      await sleep(300);
      await expectBothViewsApply(api, before);
    },
  ],
  [
    'bad settings messages are ignored: nothing changes and nothing is saved',
    async () => {
      const api = await getApi();
      const before = api.settings.settings;

      for (const patch of [
        { volume: 101 },
        { volume: -1 },
        { volume: 12.5 },
        { volume: '50' },
        { sound: 'yes' },
        { sound: true, extra: 1 },
        { balance: 1_000_000 },
        {},
        null,
        'loud',
      ]) {
        api.sendFromWebview('sidebar', changeSettings(patch));
      }
      api.sendFromWebview('sidebar', { type: 'settings' });

      assert.equal(api.settings.settings, before, 'invalid settings must change nothing');
      await sleep(300);
      await expectBothViewsApply(api, before);
    },
  ],
  [
    'a reset asks first, and a "no" changes nothing at all',
    async () => {
      const api = await getApi();
      if (api.store.snapshot.stats.overall.gamesPlayed === 0) playRound(api.store, 'roulette', 50, 100, 'Red 17');
      const before = api.store.snapshot;
      const asked = recordResets(api, false);

      for (const scope of ['balance', 'statistics', 'all'] as const) {
        api.sendFromWebview('sidebar', resetRequest(scope));
        await waitFor(`the question about "${scope}"`, () => (asked.includes(scope) ? true : undefined));
      }
      await sleep(300);

      assert.deepEqual(asked, ['balance', 'statistics', 'all']);
      assert.equal(api.store.snapshot, before, 'a cancelled reset must not touch Lucky Break');
    },
  ],
  [
    'a reset a webview tries to confirm itself is not a reset: it can only ask',
    async () => {
      const api = await getApi();
      const before = api.store.snapshot;
      const asked = recordResets(api, false);

      api.sendFromWebview('panel', { type: 'reset', scope: 'all', confirmed: true, force: true, skipConfirmation: true });
      await waitFor('the question', () => (asked.length > 0 ? true : undefined));
      await sleep(300);
      assert.equal(api.store.snapshot, before);

      // Scopes that do not exist are ignored before anything is asked.
      for (const scope of ['settings', 'ALL', '', 'everything']) api.sendFromWebview('panel', resetRequest(scope));
      await sleep(300);
      assert.equal(asked.length, 1);
    },
  ],
  [
    'resetting the balance goes back to 1,000 chips and keeps the statistics and history; both views follow',
    async () => {
      const api = await getApi();
      assert.ok(api.store.snapshot.balance !== 1_000 || api.store.snapshot.stats.overall.gamesPlayed > 0);
      const { stats, history } = api.store.snapshot;
      const asked = recordResets(api, true);

      api.sendFromWebview('sidebar', resetRequest('balance'));
      await waitFor('the balance to reset', () => (api.store.snapshot.balance === 1_000 ? true : undefined));

      assert.deepEqual(asked, ['balance']);
      assert.deepEqual(api.store.snapshot.stats, stats);
      assert.deepEqual(api.store.snapshot.history, history);
      await expectBothViewsShow(api, 1_000, stats.overall.gamesPlayed);
    },
  ],
  [
    'resetting the statistics clears them, the history and the roulette results the table remembers, and keeps the chips',
    async () => {
      const api = await getApi();
      api.navigate('sidebar', 'roulette');
      api.navigate('panel', 'roulette');
      api.sendFromWebview('sidebar', spin('red', 20));
      const spinNumber = api.roulette.view.spin;
      assert.ok(api.roulette.view.last);
      await expectBothWheels(api, { spin: spinNumber, phase: 'result', landedOn: api.roulette.view.last.pocket.number });

      const balance = api.store.snapshot.balance;
      const asked = recordResets(api, true);
      api.sendFromWebview('panel', resetRequest('statistics'));
      await waitFor('the statistics to reset', () => (api.store.snapshot.stats.overall.gamesPlayed === 0 ? true : undefined));

      assert.deepEqual(asked, ['statistics']);
      assert.equal(api.store.snapshot.balance, balance);
      assert.deepEqual(api.store.snapshot.history, []);
      assert.deepEqual(api.roulette.view.recent, []);
      assert.equal(api.roulette.view.last, undefined);
      assert.equal(api.roulette.view.spin, spinNumber, 'the spin counter only ever counts spins');
      assert.equal(api.table.view.phase, 'betting');

      // Both real wheels went back to rest: nothing is left spinning or showing a wiped result.
      await expectBothWheels(api, { spin: spinNumber, phase: 'idle', landedOn: null });
      await expectBothViewsShow(api, balance, 0);

      // And the table still works afterwards.
      api.sendFromWebview('sidebar', spin('black', 10));
      const next = api.roulette.view;
      assert.equal(next.spin, spinNumber + 1);
      assert.ok(next.last);
      await expectBothWheels(api, { spin: next.spin, phase: 'result', landedOn: next.last.pocket.number });
    },
  ],
  [
    'resetting everything makes a brand-new game and leaves the settings alone',
    async () => {
      const api = await getApi();
      const settings = api.settings.settings;
      playRound(api.store, 'blackjack', 50, 125, 'Blackjack');
      const asked = recordResets(api, true);

      api.sendFromWebview('sidebar', resetRequest('all'));
      await waitFor('everything to reset', () =>
        api.store.snapshot.balance === 1_000 && api.store.snapshot.stats.overall.gamesPlayed === 0 ? true : undefined,
      );

      assert.deepEqual(asked, ['all']);
      assert.deepEqual(api.store.snapshot.history, []);
      assert.deepEqual(api.roulette.view.recent, []);
      assert.equal(api.table.view.phase, 'betting');
      assert.deepEqual(api.settings.settings, settings, 'a reset of Lucky Break must never touch the settings');
      await expectBothViewsShow(api, 1_000, 0);
      await expectBothViewsApply(api, settings);
    },
  ],
  [
    'a reset is refused in the middle of a hand, without even asking, and the hand carries on',
    async () => {
      const api = await getApi();
      startOpenHand(api);
      const before = api.store.snapshot;
      const hand = api.table.view;
      const asked = recordResets(api, true);

      for (const scope of ['balance', 'statistics', 'all'] as const) api.sendFromWebview('sidebar', resetRequest(scope));
      await sleep(500);

      assert.deepEqual(asked, [], 'the player must not be asked something that cannot be done');
      assert.equal(api.store.snapshot, before);
      assert.equal(api.table.view, hand);
      assert.equal(api.table.view.phase, 'player');

      // Play the hand out, and then the same reset works.
      for (let guard = 0; api.table.view.phase === 'player' && guard < 30; guard += 1) {
        api.sendFromWebview('sidebar', move(nextMove(api.table.view)));
      }
      assert.equal(api.table.view.phase, 'settled');
      api.sendFromWebview('sidebar', resetRequest('balance'));
      await waitFor('the balance to reset after the hand', () => (api.store.snapshot.balance === 1_000 ? true : undefined));
      assert.deepEqual(asked, ['balance']);
    },
  ],
  [
    'two reset requests at once ask one question and reset once',
    async () => {
      const api = await getApi();
      playRound(api.store, 'roulette', 100, 0, 'Black 8');
      const asked = recordResets(api, async () => {
        await sleep(400);
        return true;
      });

      api.sendFromWebview('sidebar', resetRequest('all'));
      api.sendFromWebview('panel', resetRequest('all'));
      api.sendFromWebview('sidebar', resetRequest('balance'));
      await waitFor('the reset', () => (api.store.snapshot.stats.overall.gamesPlayed === 0 ? true : undefined));
      await sleep(300);

      assert.deepEqual(asked, ['all'], 'only the first request may be asked');
      assert.equal(api.store.snapshot.balance, 1_000);
    },
  ],
  [
    'running out of chips is recoverable: the balance can be reset from 0',
    async () => {
      const api = await getApi();
      const broke = api.store.beginRound('roulette', api.store.snapshot.balance);
      assert.ok(broke.ok);
      assert.ok(api.store.settleRound(broke.value.id, 0, 'Black 8').ok);
      assert.equal(api.store.snapshot.balance, 0);
      await expectBothViewsShow(api, 0, api.store.snapshot.stats.overall.gamesPlayed);

      // Nothing can be bet with an empty wallet.
      api.sendFromWebview('sidebar', spin('red', 10));
      assert.equal(api.store.snapshot.balance, 0);

      recordResets(api, true);
      api.sendFromWebview('sidebar', resetRequest('balance'));
      await waitFor('the balance to come back', () => (api.store.snapshot.balance === 1_000 ? true : undefined));
      await expectBothViewsShow(api, 1_000, api.store.snapshot.stats.overall.gamesPlayed);

      api.sendFromWebview('sidebar', spin('red', 10));
      assert.ok(api.roulette.view.last, 'the table plays again after the reset');

      assertHealthy(api.getDiagnostics('sidebar') as WebviewDiagnostics);
      assertHealthy(api.getDiagnostics('panel') as WebviewDiagnostics);
    },
  ],
];

const tests: readonly Test[] = [
  [
    'extension activates and registers its commands',
    async () => {
      await getApi();
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes('luckyBreak.openPanel'), 'luckyBreak.openPanel is not registered');
      assert.ok(commands.includes('luckyBreak.showSidebar'), 'luckyBreak.showSidebar is not registered');
      assert.ok(commands.includes('luckyBreak.sidebar.focus'), 'the luckyBreak.sidebar view was not contributed');
    },
  ],
  [
    'Lucky Break activity-bar container opens and the sidebar webview renders under the CSP',
    async () => {
      const api = await getApi();
      await vscode.commands.executeCommand('workbench.view.extension.luckyBreak');
      assertHealthy(await waitForRenderedWebview(api, 'sidebar'));
    },
  ],
  [
    '"Lucky Break: Open Sidebar" command focuses the sidebar without error',
    async () => {
      await vscode.commands.executeCommand('luckyBreak.showSidebar');
    },
  ],
  [
    '"Lucky Break: Open in Editor" opens a rendered panel, and a second call reuses it',
    async () => {
      const api = await getApi();
      await vscode.commands.executeCommand('luckyBreak.openPanel');
      await vscode.commands.executeCommand('luckyBreak.openPanel');
      assertHealthy(await waitForRenderedWebview(api, 'panel'));
      assert.equal(countLuckyBreakPanelTabs(), 1, 'expected exactly one Lucky Break panel tab');
    },
  ],
  [
    'sidebar and panel are alive at the same time and both show the starting state',
    async () => {
      const api = await getApi();
      assert.equal(api.getDiagnostics('sidebar')?.rendered, true);
      assert.equal(api.getDiagnostics('panel')?.rendered, true);
      const { balance, stats } = api.store.snapshot;
      await expectBothViewsShow(api, balance, stats.overall.gamesPlayed);
    },
  ],
  [
    'a settled round reaches the sidebar and the panel live: balance, games and history',
    async () => {
      const api = await getApi();
      await openBothViews(api);
      const before = api.store.snapshot;

      const net = playRound(api.store, 'roulette', 50, 100, 'Red 17'); // even-money win
      assert.equal(net, 50);

      const after = api.store.snapshot;
      assert.equal(after.balance, before.balance + 50);
      assert.equal(after.stats.overall.gamesPlayed, before.stats.overall.gamesPlayed + 1);
      assert.equal(after.history[0]?.detail, 'Red 17');
      assert.equal(after.history[0]?.outcome, 'win');

      await expectBothViewsShow(api, after.balance, after.stats.overall.gamesPlayed);
    },
  ],
  [
    'a bet in progress is shown too: the stake leaves the balance when the round begins',
    async () => {
      const api = await getApi();
      const before = api.store.snapshot;
      const begun = api.store.beginRound('blackjack', 100);
      assert.ok(begun.ok);

      await expectBothViewsShow(api, before.balance - 100, before.stats.overall.gamesPlayed);

      assert.ok(api.store.settleRound(begun.value.id, 100, 'Push on 19').ok); // push: stake returned
      await expectBothViewsShow(api, before.balance, before.stats.overall.gamesPlayed + 1);
      assert.equal(api.store.snapshot.history[0]?.outcome, 'push');
    },
  ],
  [
    'the host refuses bad bets: nothing changes, and the views never see them',
    async () => {
      const api = await getApi();
      const before = api.store.snapshot;

      assert.deepEqual(api.store.beginRound('blackjack', 5), { ok: false, error: 'below-minimum' });
      assert.deepEqual(api.store.beginRound('blackjack', before.balance + 1), { ok: false, error: 'insufficient-funds' });
      assert.deepEqual(api.store.beginRound('roulette', 12.5), { ok: false, error: 'invalid-amount' });
      assert.equal(api.store.snapshot, before, 'a refused bet must not change Lucky Break state');

      await sleep(500);
      await expectBothViewsShow(api, before.balance, before.stats.overall.gamesPlayed);
    },
  ],
];

export async function run(): Promise<void> {
  const failures: string[] = [];
  const all = [...tests, ...blackjackTests, ...rouletteTests, ...settingsTests];

  for (const [name, test] of all) {
    try {
      await test();
      console.log(`  ✔ ${name}`);
    } catch (error) {
      failures.push(name);
      console.log(`  ✘ ${name}\n      ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(`\n${all.length - failures.length}/${all.length} integration tests passed (assets: ${expectedAssetMode})`);
  if (failures.length > 0) {
    throw new Error(`${failures.length} integration test(s) failed`);
  }
}
