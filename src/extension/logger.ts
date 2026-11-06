import * as vscode from 'vscode';

/** Thin wrapper around the "Break Room Arcade" output channel. */
export class Logger implements vscode.Disposable {
  private readonly channel = vscode.window.createOutputChannel('Break Room Arcade', { log: true });

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
