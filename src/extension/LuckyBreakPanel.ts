import * as vscode from 'vscode';
import { assetMode, resolveAssetSource } from './assetSource';
import type { Logger } from './logger';
import type { WebviewHub } from './WebviewHub';
import { getWebviewOptions, renderWebviewHtml } from './webviewHtml';

/** Lucky Break in a larger editor tab. Only one panel exists at a time. */
export class LuckyBreakPanel {
  static readonly viewType = 'luckyBreak.panel';

  private static current: LuckyBreakPanel | undefined;

  static async createOrShow(
    context: vscode.ExtensionContext,
    hub: WebviewHub,
    logger: Logger,
  ): Promise<void> {
    if (LuckyBreakPanel.current) {
      LuckyBreakPanel.current.panel.reveal();
      return;
    }

    const { extensionUri } = context;
    const panel = vscode.window.createWebviewPanel(
      LuckyBreakPanel.viewType,
      'Lucky Break',
      vscode.ViewColumn.Active,
      { ...getWebviewOptions(extensionUri), retainContextWhenHidden: true },
    );
    panel.iconPath = vscode.Uri.joinPath(extensionUri, 'media', 'lucky-break-tab.svg');

    const instance = new LuckyBreakPanel(panel);
    LuckyBreakPanel.current = instance;
    panel.onDidDispose(() => {
      instance.attachment?.dispose();
      LuckyBreakPanel.current = undefined;
    });

    const source = await resolveAssetSource(context, logger);
    if (LuckyBreakPanel.current !== instance) return; // closed while the dev server was being probed

    instance.attachment = hub.attach(panel.webview, 'panel', assetMode(source));
    panel.webview.html = renderWebviewHtml(panel.webview, extensionUri, source);
  }

  private attachment: vscode.Disposable | undefined;

  private constructor(private readonly panel: vscode.WebviewPanel) {}
}
