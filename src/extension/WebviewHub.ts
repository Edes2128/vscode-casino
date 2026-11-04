import * as vscode from 'vscode';
import type { Settings, SettingsPatch } from '../casino/settings';
import type { CasinoSnapshot } from '../casino/types';
import type { ResetOutcome, ResetScope } from '../game/resetScope';
import type { TableResult } from '../game/tableResult';
import type { BlackjackAction, BlackjackView, TablePhase } from '../game/blackjack/view';
import type { RouletteAction, RouletteView } from '../game/roulette/view';
import {
  parseWebviewMessage,
  type AssetMode,
  type HostToWebviewMessage,
  type ViewKind,
  type WebviewToHostMessage,
} from '../shared/messages';
import type { Logger } from './logger';

/** What the hub needs from the rest of the casino. Everything authoritative stays on the host side. */
export interface HubServices {
  snapshot(): CasinoSnapshot;
  blackjackView(): BlackjackView;
  blackjack(action: BlackjackAction): TableResult;
  rouletteView(): RouletteView;
  roulette(action: RouletteAction): TableResult;
  settings(): Settings;
  updateSettings(patch: SettingsPatch): void;
  /** Asks the player to confirm, then resets. Resolves with how it ended. */
  reset(scope: ResetScope): PromiseLike<ResetOutcome>;
  openSupport(): void;
}

/** What a webview has reported about itself. Surfaced to integration tests and the log. */
export interface WebviewDiagnostics {
  readonly kind: ViewKind;
  readonly assetMode: AssetMode;
  readyCount: number;
  rendered: boolean;
  fontsLoaded: boolean | undefined;
  /** The webview has the Web Audio API, so the sound effects can play. */
  audioAvailable: boolean | undefined;
  /** The casino state the webview most recently reported drawing. */
  lastShown: { readonly balance: number; readonly gamesPlayed: number } | undefined;
  /** The blackjack table the webview most recently reported drawing. */
  lastBlackjack:
    | { readonly round: number; readonly phase: TablePhase; readonly playerCards: number; readonly dealerCards: number }
    | undefined;
  /** The roulette screen's most recent report: the spin, whether the wheel is turning, and where it stopped. */
  lastRoulette:
    | { readonly spin: number; readonly phase: 'idle' | 'spinning' | 'result'; readonly landedOn: number | null }
    | undefined;
  /** The settings the webview most recently reported drawing. */
  lastSettings: Settings | undefined;
  /** The decorations' clock as the webview last reported it. */
  lastAmbient: { readonly running: boolean; readonly resting: boolean; readonly ticks: number } | undefined;
  readonly cspViolations: string[];
  readonly errors: string[];
}

interface Attachment {
  readonly kind: ViewKind;
  readonly webview: vscode.Webview;
  readonly assetMode: AssetMode;
  readonly diagnostics: WebviewDiagnostics;
}

/**
 * Central switchboard for every casino webview (sidebar and editor panel).
 *
 * The extension host owns all state. Webviews only send intents; the hub validates each
 * message, hands game actions to the table, answers and can broadcast host state to every
 * attached webview so the sidebar and the panel always show the same casino.
 */
export class WebviewHub {
  private readonly attachments = new Set<Attachment>();
  private readonly latestDiagnostics = new Map<ViewKind, WebviewDiagnostics>();
  private readonly latestAttachments = new Map<ViewKind, Attachment>();

  constructor(
    private readonly logger: Logger,
    private readonly extensionVersion: string,
    private readonly services: HubServices,
  ) {}

  /** Starts routing messages for `webview`. Dispose the result when the webview goes away. */
  attach(webview: vscode.Webview, kind: ViewKind, assetMode: AssetMode): vscode.Disposable {
    const diagnostics: WebviewDiagnostics = {
      kind,
      assetMode,
      readyCount: 0,
      rendered: false,
      fontsLoaded: undefined,
      audioAvailable: undefined,
      lastShown: undefined,
      lastBlackjack: undefined,
      lastRoulette: undefined,
      lastSettings: undefined,
      lastAmbient: undefined,
      cspViolations: [],
      errors: [],
    };
    const attachment: Attachment = { kind, webview, assetMode, diagnostics };
    this.attachments.add(attachment);
    this.latestDiagnostics.set(kind, diagnostics);
    this.latestAttachments.set(kind, attachment);

    const subscription = webview.onDidReceiveMessage((raw: unknown) => this.receive(attachment, raw));

    return new vscode.Disposable(() => {
      subscription.dispose();
      this.attachments.delete(attachment);
    });
  }

  /** Sends a message to every attached webview. */
  broadcast(message: HostToWebviewMessage): void {
    for (const attachment of this.attachments) {
      this.post(attachment, message);
    }
  }

  /** Sends a message to the most recent webview of one kind. */
  sendTo(kind: ViewKind, message: HostToWebviewMessage): void {
    const attachment = this.latestAttachments.get(kind);
    if (attachment === undefined) throw new Error(`No ${kind} webview is attached`);
    this.post(attachment, message);
  }

  getDiagnostics(kind: ViewKind): WebviewDiagnostics | undefined {
    return this.latestDiagnostics.get(kind);
  }

  /**
   * Feeds a raw message into the hub exactly as if the most recent webview of that kind had sent it.
   * For integration tests, which cannot click inside a webview: it goes through the same validation
   * and routing as the real thing.
   */
  injectFromWebview(kind: ViewKind, raw: unknown): void {
    const attachment = this.latestAttachments.get(kind);
    if (attachment === undefined) throw new Error(`No ${kind} webview is attached`);
    this.receive(attachment, raw);
  }

  private receive(attachment: Attachment, raw: unknown): void {
    const message = parseWebviewMessage(raw);
    if (message === undefined) {
      this.logger.warn(`[${attachment.kind}] ignored a malformed webview message`);
      return;
    }
    this.handle(attachment, message);
  }

  private handle(attachment: Attachment, message: WebviewToHostMessage): void {
    const { kind, diagnostics, assetMode } = attachment;
    switch (message.type) {
      case 'ready':
        diagnostics.readyCount += 1;
        this.post(attachment, {
          type: 'init',
          payload: { extensionVersion: this.extensionVersion, viewKind: kind, assetMode },
        });
        this.post(attachment, { type: 'state', payload: this.services.snapshot() });
        this.post(attachment, { type: 'blackjack', view: this.services.blackjackView() });
        this.post(attachment, { type: 'roulette', view: this.services.rouletteView() });
        this.post(attachment, { type: 'settings', payload: this.services.settings() });
        break;
      case 'openSupport':
        this.services.openSupport();
        break;
      case 'settings':
        // The change is saved and every view (this one included) is told through the store.
        this.services.updateSettings(message.patch);
        break;
      case 'reset': {
        const { scope } = message;
        this.logger.info(`[${kind}] asked to reset: ${scope}`);
        this.services.reset(scope).then(
          (outcome) => {
            this.logger.info(`[${kind}] reset ${scope}: ${outcome}`);
            this.post(attachment, { type: 'resetResult', scope, outcome });
          },
          (error: unknown) => {
            // Nothing was reset. Answer anyway, so the screen never waits for a reply that is not coming.
            this.logger.error(`[${kind}] reset ${scope} failed`, error);
            this.post(attachment, { type: 'resetResult', scope, outcome: 'cancelled' });
          },
        );
        break;
      }
      case 'settingsShown':
        diagnostics.lastSettings = message.settings;
        break;
      case 'ambientShown':
        diagnostics.lastAmbient = { running: message.running, resting: message.resting, ticks: message.ticks };
        break;
      case 'blackjack': {
        // The table changes first and tells every view; only a refusal is answered to this one.
        const result = this.services.blackjack(message.action);
        if (!result.ok) {
          this.logger.info(`[${kind}] blackjack ${message.action.kind} refused: ${result.error}`);
          this.post(attachment, { type: 'rejected', game: 'blackjack', error: result.error });
        }
        break;
      }
      case 'roulette': {
        const result = this.services.roulette(message.action);
        if (!result.ok) {
          this.logger.info(`[${kind}] roulette ${message.action.kind} refused: ${result.error}`);
          this.post(attachment, { type: 'rejected', game: 'roulette', error: result.error });
        }
        break;
      }
      case 'rouletteShown':
        diagnostics.lastRoulette = { spin: message.spin, phase: message.phase, landedOn: message.landedOn };
        break;
      case 'blackjackShown':
        diagnostics.lastBlackjack = {
          round: message.round,
          phase: message.phase,
          playerCards: message.playerCards,
          dealerCards: message.dealerCards,
        };
        break;
      case 'snapshotShown':
        diagnostics.lastShown = { balance: message.balance, gamesPlayed: message.gamesPlayed };
        break;
      case 'rendered':
        diagnostics.rendered = true;
        diagnostics.fontsLoaded = message.fontsLoaded;
        diagnostics.audioAvailable = message.audioAvailable;
        this.logger.info(
          `[${kind}] webview rendered (fonts loaded: ${message.fontsLoaded}, audio: ${message.audioAvailable}, assets: ${assetMode})`,
        );
        break;
      case 'cspViolation':
        diagnostics.cspViolations.push(`${message.directive}: ${message.blockedUri}`);
        this.logger.warn(`[${kind}] CSP violation: ${message.directive} blocked ${message.blockedUri}`);
        break;
      case 'error':
        diagnostics.errors.push(message.message);
        this.logger.error(`[${kind}] webview error: ${message.message}`);
        break;
    }
  }

  private post({ kind, webview }: Attachment, message: HostToWebviewMessage): void {
    webview.postMessage(message).then(undefined, (error: unknown) => {
      this.logger.error(`[${kind}] failed to post "${message.type}"`, error);
    });
  }
}
