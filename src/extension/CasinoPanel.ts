import * as vscode from 'vscode';
import { assetMode, resolveAssetSource } from './assetSource';
import type { Logger } from './logger';
import type { WebviewHub } from './WebviewHub';
import { getWebviewOptions, renderWebviewHtml } from './webviewHtml';

/** The casino in a larger editor tab. Only one panel exists at a time. */
export class CasinoPanel {
  static readonly viewType = 'casino.panel';

  private static current: CasinoPanel | undefined;

  static async createOrShow(
    context: vscode.ExtensionContext,
    hub: WebviewHub,
    logger: Logger,
  ): Promise<void> {
    if (CasinoPanel.current) {
      CasinoPanel.current.panel.reveal();
      return;
    }

    const { extensionUri } = context;
    const panel = vscode.window.createWebviewPanel(
      CasinoPanel.viewType,
      'Casino',
      vscode.ViewColumn.Active,
      { ...getWebviewOptions(extensionUri), retainContextWhenHidden: true },
    );
    panel.iconPath = vscode.Uri.joinPath(extensionUri, 'media', 'casino-tab.svg');

    const instance = new CasinoPanel(panel);
    CasinoPanel.current = instance;
    panel.onDidDispose(() => {
      instance.attachment?.dispose();
      CasinoPanel.current = undefined;
    });

    const source = await resolveAssetSource(context, logger);
    if (CasinoPanel.current !== instance) return; // closed while the dev server was being probed

    instance.attachment = hub.attach(panel.webview, 'panel', assetMode(source));
    panel.webview.html = renderWebviewHtml(panel.webview, extensionUri, source);
  }

  private attachment: vscode.Disposable | undefined;

  private constructor(private readonly panel: vscode.WebviewPanel) {}
}
