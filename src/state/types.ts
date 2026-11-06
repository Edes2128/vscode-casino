/**
 * Domain types shared by the extension host (authoritative) and the webview (read-only view).
 * Pure TypeScript: no `vscode`, no DOM, no React.
 */

export type GameType = 'blackjack' | 'roulette';

export type GameOutcome = 'win' | 'loss' | 'push';

export interface HistoryEntry {
  readonly id: string;
  readonly game: GameType;
  /** Chips staked on the round (for split or doubled hands, the total staked). */
  readonly bet: number;
  readonly outcome: GameOutcome;
  /** Net chips for the round: positive when won, negative when lost, 0 for a push. */
  readonly payout: number;
  /** Short description of how the round ended, e.g. "Red 17" or "Blackjack". */
  readonly detail: string;
  /** Epoch milliseconds. */
  readonly timestamp: number;
}

export interface GameStats {
  readonly gamesPlayed: number;
  readonly wins: number;
  readonly losses: number;
  readonly pushes: number;
  /** Largest net win in a single round, in chips (never negative). */
  readonly biggestWin: number;
  /** Largest net loss in a single round, as a positive number of chips. */
  readonly biggestLoss: number;
  readonly totalWagered: number;
}

/** A round that has taken its bet from the balance but has not been settled yet. */
export interface OpenRound {
  readonly id: string;
  readonly game: GameType;
  /** Chips taken from the balance so far: the bet plus any double-down or split stakes. */
  readonly staked: number;
  /** Epoch milliseconds. */
  readonly startedAt: number;
}

export interface BreakRoomStats {
  readonly overall: GameStats;
  readonly blackjack: GameStats;
  readonly roulette: GameStats;
}

/** Everything the webview needs to draw Break Room Arcade. The host owns it; the webview never edits it. */
export interface BreakRoomSnapshot {
  readonly balance: number;
  readonly stats: BreakRoomStats;
  /** Most recent round first. */
  readonly history: readonly HistoryEntry[];
}
