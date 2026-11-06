import * as vscode from 'vscode';
import { assetMode, resolveAssetSource } from './assetSource';
import type { Logger } from './logger';
import type { WebviewHub } from './WebviewHub';
import { getWebviewOptions, renderWebviewHtml } from './webviewHtml';

/** Break Room Arcade in a larger editor tab. Only one panel exists at a time. */
export class BreakRoomPanel {
  static readonly viewType = 'breakRoom.panel';

  private static current: BreakRoomPanel | undefined;

  static async createOrShow(
    context: vscode.ExtensionContext,
    hub: WebviewHub,
    logger: Logger,
  ): Promise<void> {
    if (BreakRoomPanel.current) {
      BreakRoomPanel.current.panel.reveal();
      return;
    }

    const { extensionUri } = context;
    const panel = vscode.window.createWebviewPanel(
      BreakRoomPanel.viewType,
      'Break Room Arcade',
      vscode.ViewColumn.Active,
      { ...getWebviewOptions(extensionUri), retainContextWhenHidden: true },
    );
    panel.iconPath = vscode.Uri.joinPath(extensionUri, 'media', 'break-room-arcade-tab.svg');

    const instance = new BreakRoomPanel(panel);
    BreakRoomPanel.current = instance;
    panel.onDidDispose(() => {
      instance.attachment?.dispose();
      BreakRoomPanel.current = undefined;
    });

    const source = await resolveAssetSource(context, logger);
    if (BreakRoomPanel.current !== instance) return; // closed while the dev server was being probed

    instance.attachment = hub.attach(panel.webview, 'panel', assetMode(source));
    panel.webview.html = renderWebviewHtml(panel.webview, extensionUri, source);
  }

  private attachment: vscode.Disposable | undefined;

  private constructor(private readonly panel: vscode.WebviewPanel) {}
}
