/**
 * Typed message protocol between the extension host and the webview.
 *
 * This file is imported by both sides, so it must stay free of `vscode` and DOM
 * dependencies. Anything coming from the webview is untrusted: the host must run it
 * through `parseWebviewMessage` instead of casting.
 */

import { isCasinoSnapshot, isCount } from '../casino/snapshot';
import type { CasinoSnapshot, GameType } from '../casino/types';
import { isSettings, parseSettingsPatch, type Settings, type SettingsPatch } from '../casino/settings';
import { isResetOutcome, isResetScope, type ResetOutcome, type ResetScope } from '../game/resetScope';
import { isRouletteView, parseRouletteAction, type RouletteAction, type RouletteView } from '../game/roulette/view';
import type { TableError } from '../game/tableResult';
import {
  isBlackjackView,
  parseBlackjackAction,
  type BlackjackAction,
  type BlackjackView,
  type TablePhase,
} from '../game/blackjack/view';

/** Which VS Code surface a webview is rendered in. */
export type ViewKind = 'sidebar' | 'panel';

/** The screens of the casino. */
export type CasinoPage = 'home' | 'blackjack' | 'roulette' | 'statistics' | 'settings';

/** Where the webview bundle was loaded from. */
export type AssetMode = 'dev' | 'prod';

export interface InitPayload {
  readonly extensionVersion: string;
  readonly viewKind: ViewKind;
  readonly assetMode: AssetMode;
}

/** Upper bound for free-form strings accepted from the webview (they end up in logs). */
const MAX_TEXT_LENGTH = 300;

// ---------------------------------------------------------------- webview → host

export type WebviewToHostMessage =
  /** The React app mounted and is waiting for `init`. */
  | { readonly type: 'ready' }
  /**
   * The app rendered with the host's `init` data and its fonts resolved. `audioAvailable` says whether
   * this webview has the Web Audio API the sound effects are made with.
   */
  | { readonly type: 'rendered'; readonly fontsLoaded: boolean; readonly audioAvailable: boolean }
  /** The player pressed "Support me". The host opens the (fixed) support page in the browser. */
  | { readonly type: 'openSupport' }
  /** The player changed one or more settings. The host validates, saves and tells every view. */
  | { readonly type: 'settings'; readonly patch: SettingsPatch }
  /**
   * The player asked to reset something. This is only a request: the host asks the player to
   * confirm in a dialog of its own, and only an explicit yes changes anything.
   */
  | { readonly type: 'reset'; readonly scope: ResetScope }
  /**
   * The decorations' clock: whether it is running (ticking), whether it is resting (stopped because the
   * player has not touched the casino for a while), and how many times it has ticked. A running clock
   * that keeps ticking proves the animations are alive; a stopped one proves they are still. Sent when
   * it starts, stops or rests, and every few seconds while it runs, never more often.
   */
  | { readonly type: 'ambientShown'; readonly running: boolean; readonly resting: boolean; readonly ticks: number }
  /** The settings screen drew these settings. Lets the host (and tests) see that every view caught up. */
  | { readonly type: 'settingsShown'; readonly settings: Settings }
  /** The player did something at the blackjack table. The host decides whether it is allowed. */
  | { readonly type: 'blackjack'; readonly action: BlackjackAction }
  /** The player bet on a colour and spun. The host decides where the ball lands and pays the result. */
  | { readonly type: 'roulette'; readonly action: RouletteAction }
  /**
   * The roulette screen drew this: which spin, whether the wheel is still turning, and, once it has
   * stopped, the number under the pointer. Lets the host (and tests) check the wheel really landed
   * on the pocket the host chose.
   */
  | {
      readonly type: 'rouletteShown';
      readonly spin: number;
      readonly phase: 'idle' | 'spinning' | 'result';
      readonly landedOn: number | null;
    }
  /** The webview drew this blackjack table. Used the same way as `snapshotShown`. */
  | {
      readonly type: 'blackjackShown';
      readonly round: number;
      readonly phase: TablePhase;
      readonly playerCards: number;
      readonly dealerCards: number;
    }
  /**
   * The webview drew this casino state. Lets the host confirm that every open view has caught up
   * after a change, which is also how the integration tests check that the views stay in sync.
   */
  | { readonly type: 'snapshotShown'; readonly balance: number; readonly gamesPlayed: number }
  /** The browser blocked something because of the Content Security Policy. */
  | { readonly type: 'cspViolation'; readonly directive: string; readonly blockedUri: string }
  /** An uncaught error or unhandled promise rejection inside the webview. */
  | { readonly type: 'error'; readonly message: string };

// ---------------------------------------------------------------- host → webview

export type HostToWebviewMessage =
  /** Static facts about this webview, sent once in answer to `ready`. */
  | { readonly type: 'init'; readonly payload: InitPayload }
  /** The current casino state. Sent after `init` and again whenever the host's state changes. */
  | { readonly type: 'state'; readonly payload: CasinoSnapshot }
  /** The player's settings. Sent after `init` and again whenever they change. */
  | { readonly type: 'settings'; readonly payload: Settings }
  /** How a reset request ended. Sent only to the view that asked. */
  | { readonly type: 'resetResult'; readonly scope: ResetScope; readonly outcome: ResetOutcome }
  /** Switch this webview to another screen. */
  | { readonly type: 'navigate'; readonly page: CasinoPage }
  /** The roulette table as it is now. */
  | { readonly type: 'roulette'; readonly view: RouletteView }
  /** The blackjack table as it is now. Never contains the hole card or the deck. */
  | { readonly type: 'blackjack'; readonly view: BlackjackView }
  /** The host refused an action. The reason is for display; nothing changed. */
  | { readonly type: 'rejected'; readonly game: GameType; readonly error: TableError };

// ---------------------------------------------------------------- runtime guards

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown): string | undefined =>
  typeof value === 'string' ? value.slice(0, MAX_TEXT_LENGTH) : undefined;

const isViewKind = (value: unknown): value is ViewKind => value === 'sidebar' || value === 'panel';

const isAssetMode = (value: unknown): value is AssetMode => value === 'dev' || value === 'prod';

/** Validates a raw webview message. Returns `undefined` for anything malformed. */
export function parseWebviewMessage(raw: unknown): WebviewToHostMessage | undefined {
  if (!isRecord(raw)) return undefined;

  switch (raw['type']) {
    case 'ready':
      return { type: 'ready' };
    case 'rendered':
      return typeof raw['fontsLoaded'] === 'boolean' && typeof raw['audioAvailable'] === 'boolean'
        ? { type: 'rendered', fontsLoaded: raw['fontsLoaded'], audioAvailable: raw['audioAvailable'] }
        : undefined;
    case 'openSupport':
      return { type: 'openSupport' };
    case 'settings': {
      const patch = parseSettingsPatch(raw['patch']);
      return patch === undefined ? undefined : { type: 'settings', patch };
    }
    case 'reset':
      return isResetScope(raw['scope']) ? { type: 'reset', scope: raw['scope'] } : undefined;
    case 'ambientShown':
      return typeof raw['running'] === 'boolean' && typeof raw['resting'] === 'boolean' && isCount(raw['ticks'])
        ? { type: 'ambientShown', running: raw['running'], resting: raw['resting'], ticks: raw['ticks'] }
        : undefined;
    case 'settingsShown':
      return isSettings(raw['settings']) ? { type: 'settingsShown', settings: raw['settings'] } : undefined;
    case 'blackjack': {
      const action = parseBlackjackAction(raw['action']);
      return action === undefined ? undefined : { type: 'blackjack', action };
    }
    case 'roulette': {
      const action = parseRouletteAction(raw['action']);
      return action === undefined ? undefined : { type: 'roulette', action };
    }
    case 'rouletteShown': {
      const phase = raw['phase'];
      const landedOn = raw['landedOn'];
      return isCount(raw['spin']) &&
        (phase === 'idle' || phase === 'spinning' || phase === 'result') &&
        (landedOn === null || (isCount(landedOn) && landedOn <= 36))
        ? { type: 'rouletteShown', spin: raw['spin'], phase, landedOn }
        : undefined;
    }
    case 'blackjackShown': {
      const phase = raw['phase'];
      return isCount(raw['round']) &&
        (phase === 'betting' || phase === 'player' || phase === 'settled') &&
        isCount(raw['playerCards']) &&
        isCount(raw['dealerCards'])
        ? {
            type: 'blackjackShown',
            round: raw['round'],
            phase,
            playerCards: raw['playerCards'],
            dealerCards: raw['dealerCards'],
          }
        : undefined;
    }
    case 'snapshotShown':
      return isCount(raw['balance']) && isCount(raw['gamesPlayed'])
        ? { type: 'snapshotShown', balance: raw['balance'], gamesPlayed: raw['gamesPlayed'] }
        : undefined;
    case 'cspViolation': {
      const directive = text(raw['directive']);
      const blockedUri = text(raw['blockedUri']);
      return directive !== undefined && blockedUri !== undefined
        ? { type: 'cspViolation', directive, blockedUri }
        : undefined;
    }
    case 'error': {
      const message = text(raw['message']);
      return message !== undefined ? { type: 'error', message } : undefined;
    }
    default:
      return undefined;
  }
}

/** Validates a raw host message inside the webview. Returns `undefined` for anything malformed. */
export function parseHostMessage(raw: unknown): HostToWebviewMessage | undefined {
  if (!isRecord(raw)) return undefined;

  const payload = raw['payload'];
  switch (raw['type']) {
    case 'init':
      return parseInit(payload);
    case 'state':
      return isCasinoSnapshot(payload) ? { type: 'state', payload } : undefined;
    case 'blackjack': {
      const view = raw['view'];
      return isBlackjackView(view) ? { type: 'blackjack', view } : undefined;
    }
    case 'settings':
      return isSettings(payload) ? { type: 'settings', payload } : undefined;
    case 'resetResult':
      return isResetScope(raw['scope']) && isResetOutcome(raw['outcome'])
        ? { type: 'resetResult', scope: raw['scope'], outcome: raw['outcome'] }
        : undefined;
    case 'navigate':
      return CASINO_PAGES.includes(raw['page'] as CasinoPage)
        ? { type: 'navigate', page: raw['page'] as CasinoPage }
        : undefined;
    case 'roulette': {
      const view = raw['view'];
      return isRouletteView(view) ? { type: 'roulette', view } : undefined;
    }
    case 'rejected':
      return (raw['game'] === 'blackjack' || raw['game'] === 'roulette') && isTableError(raw['error'])
        ? { type: 'rejected', game: raw['game'], error: raw['error'] }
        : undefined;
    default:
      return undefined;
  }
}

const CASINO_PAGES: readonly CasinoPage[] = ['home', 'blackjack', 'roulette', 'statistics', 'settings'];

const TABLE_ERRORS: readonly unknown[] = [
  'invalid-amount',
  'below-minimum',
  'insufficient-funds',
  'round-in-progress',
  'unknown-round',
  'round-active',
  'not-allowed',
];

const isTableError = (value: unknown): value is TableError => TABLE_ERRORS.includes(value);

function parseInit(payload: unknown): HostToWebviewMessage | undefined {
  if (
    !isRecord(payload) ||
    typeof payload['extensionVersion'] !== 'string' ||
    !isViewKind(payload['viewKind']) ||
    !isAssetMode(payload['assetMode'])
  ) {
    return undefined;
  }

  return {
    type: 'init',
    payload: {
      extensionVersion: payload['extensionVersion'],
      viewKind: payload['viewKind'],
      assetMode: payload['assetMode'],
    },
  };
}
