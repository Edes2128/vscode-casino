import * as vscode from 'vscode';

/** Thin wrapper around the "Casino" output channel. */
export class Logger implements vscode.Disposable {
  private readonly channel = vscode.window.createOutputChannel('Casino', { log: true });

  info(message: string): void {
    this.channel.info(message);
  }

  warn(message: string): void {
    this.channel.warn(message);
  }

  error(message: string, error?: unknown): void {
    this.channel.error(error === undefined ? message : `${message}: ${describeError(error)}`);
  }

  dispose(): void {
    this.channel.dispose();
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? (error.stack ?? error.message) : String(error);
}
