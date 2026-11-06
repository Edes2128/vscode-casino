import * as vscode from 'vscode';
import { assetMode, resolveAssetSource } from './assetSource';
import type { Logger } from './logger';
import type { WebviewHub } from './WebviewHub';
import { getWebviewOptions, renderWebviewHtml } from './webviewHtml';

/** Break Room Arcade in the activity-bar sidebar. */
export class BreakRoomViewProvider implements vscode.WebviewViewProvider {
  static readonly viewType = 'breakRoom.sidebar';

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly hub: WebviewHub,
    private readonly logger: Logger,
  ) {}

  async resolveWebviewView(view: vscode.WebviewView): Promise<void> {
    const { extensionUri } = this.context;
    view.webview.options = getWebviewOptions(extensionUri);

    const source = await resolveAssetSource(this.context, this.logger);

    // Attach before setting the HTML so the first `ready` message can never be missed.
    const attachment = this.hub.attach(view.webview, 'sidebar', assetMode(source));
    view.onDidDispose(() => attachment.dispose());

    view.webview.html = renderWebviewHtml(view.webview, extensionUri, source);
  }
}
