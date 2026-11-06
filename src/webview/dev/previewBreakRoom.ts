/**
 * A stand-in for the extension host, for the browser preview (`npm run dev:webview`). It runs the
 * REAL store and blackjack table, so hands played in the browser follow exactly the same rules and
 * money handling as in VS Code. Nothing is saved, and none of it is in the production bundle.
 *
 *   /?demo                    start with sample statistics and history
 *   /?deck=AS 9H KD 7C        stack the deck, so a given situation can be looked at on demand
 *                             (cards are dealt left to right: player, dealer, player, dealer, then draws)
 *   /?ball=17,0,32            make the roulette ball land on these numbers in turn, then repeat
 *
 * Settings and resets are real too. The confirmation that VS Code shows as a modal dialog is a
 * browser `confirm()` here.
 */
import { createFreshState, STATE_KEY, type PersistedState } from '../../state/persistence';
import { SettingsStore } from '../../state/settings';
import { BreakRoomStore } from '../../state/store';
import { MemoryStorage } from '../../state/testing';
import { BlackjackTable } from '../../game/blackjack/table';
import { cards } from '../../game/blackjack/testing';
import { resetPrompt } from '../../game/resetPrompt';
import { ResetCoordinator } from '../../game/resets';
import { RouletteTable } from '../../game/roulette/table';
import { POCKET_COUNT, pocketIndexOfNumber } from '../../game/roulette/wheel';
import type { HostToWebviewMessage, ViewKind, WebviewToHostMessage } from '../../shared/messages';
import { sampleSnapshot } from './sampleSnapshot';

export interface PreviewBreakRoom {
  handle(message: WebviewToHostMessage): void;
}

export function createPreviewBreakRoom(
  emit: (message: HostToWebviewMessage) => void,
  query: URLSearchParams,
  viewKind: ViewKind,
): PreviewBreakRoom {
  const storage = new MemoryStorage();
  if (query.has('demo')) {
    const demo: PersistedState = {
      ...createFreshState(),
      balance: sampleSnapshot.balance,
      stats: { blackjack: sampleSnapshot.stats.blackjack, roulette: sampleSnapshot.stats.roulette },
      history: sampleSnapshot.history,
    };
    storage.seed(STATE_KEY, demo);
  }

  const store = new BreakRoomStore(storage);
  const deck = query.get('deck');
  const table = new BlackjackTable(store, deck === null ? {} : { deck: () => cards(deck) });

  const ball = (query.get('ball') ?? '')
    .split(',')
    .map((text) => pocketIndexOfNumber(Number(text)))
    .filter((index) => index >= 0);
  let nextBall = 0;
  const roulette = new RouletteTable(
    store,
    ball.length === 0
      ? {}
      : {
          rng: () => {
            const index = ball[nextBall % ball.length] ?? 0;
            nextBall += 1;
            return (index + 0.5) / POCKET_COUNT;
          },
        },
  );

  const settings = new SettingsStore(storage);
  const resets = new ResetCoordinator({
    store,
    tables: [table, roulette],
    confirm: (scope) => {
      const { message, detail } = resetPrompt(scope);
      return Promise.resolve(window.confirm(`${message}\n\n${detail}`));
    },
  });

  settings.onDidChange((payload) => emit({ type: 'settings', payload }));
  store.onDidChange((snapshot) => emit({ type: 'state', payload: snapshot }));
  roulette.onDidChange((view) => emit({ type: 'roulette', view }));
  table.onDidChange((view) => emit({ type: 'blackjack', view }));

  return {
    handle(message) {
      switch (message.type) {
        case 'ready':
          emit({ type: 'init', payload: { extensionVersion: 'browser-preview', viewKind, assetMode: 'dev' } });
          emit({ type: 'state', payload: store.snapshot });
          emit({ type: 'blackjack', view: table.view });
          emit({ type: 'roulette', view: roulette.view });
          emit({ type: 'settings', payload: settings.settings });
          break;
        case 'settings':
          settings.update(message.patch);
          break;
        case 'reset': {
          const { scope } = message;
          void resets.reset(scope).then((outcome) => emit({ type: 'resetResult', scope, outcome }));
          break;
        }
        case 'roulette': {
          const result = roulette.perform(message.action);
          if (!result.ok) emit({ type: 'rejected', game: 'roulette', error: result.error });
          break;
        }
        case 'blackjack': {
          const result = table.perform(message.action);
          if (!result.ok) emit({ type: 'rejected', game: 'blackjack', error: result.error });
          break;
        }
        default:
          break; // diagnostics do nothing in a browser tab
      }
    },
  };
}
