import type { OutcomeKind } from '../components/ResultEffects';
import type { Cue } from './cues';
import type { PlayOptions } from './engine';

/** Which jingle a result gets. A blackjack or a hit on the green (`special`) is the big one. */
export function outcomeCue(kind: OutcomeKind): Cue {
  switch (kind) {
    case 'special':
      return 'bigWin';
    case 'win':
      return 'win';
    case 'push':
      return 'push';
    case 'loss':
      return 'lose';
  }
}

export interface PlannedCue {
  readonly cue: Cue;
  readonly options?: PlayOptions;
}

// ---------------------------------------------------------------- blackjack

/** What the blackjack table is showing, boiled down to what the sounds follow. */
export interface BlackjackFrame {
  /** Cards on the table, face down ones included. */
  readonly cards: number;
  /** The dealer's hole card has been turned over. */
  readonly holeUp: boolean;
  /** The result being shown, if any. */
  readonly result: { readonly round: number; readonly kind: OutcomeKind } | undefined;
}

/** The pause between the last card landing and the result jingle, in milliseconds. */
const CARD_GAP_MS = 140;

/** The sounds for what changed on the table between two frames. */
export function blackjackCues(before: BlackjackFrame, now: BlackjackFrame): PlannedCue[] {
  const planned: PlannedCue[] = [];

  // Turning the hole card over is the only thing that happens with no new card, so it is not a "deal".
  if (before.cards >= 2 && !before.holeUp && now.holeUp) planned.push({ cue: 'flip' });

  const landed = now.cards - before.cards;
  if (landed > 0) planned.push({ cue: 'card', options: { count: landed } });

  if (now.result !== undefined && before.result?.round !== now.result.round) {
    // If the result arrives together with cards (animations off), let the cards land first.
    const wait = landed > 0 ? landed * CARD_GAP_MS + 100 : 0;
    planned.push({ cue: outcomeCue(now.result.kind), ...(wait > 0 ? { options: { delayMs: wait } } : {}) });
  }
  return planned;
}

// ---------------------------------------------------------------- roulette

export interface RouletteFrame {
  /** The table's spin counter. */
  readonly spin: number;
  readonly phase: 'idle' | 'spinning' | 'result';
  /** The result arrived while this screen was open. */
  readonly live: boolean;
  /** How the latest spin ended, once it has. */
  readonly kind: OutcomeKind | undefined;
}

/** The sounds for what changed on the roulette screen between two frames. */
export function rouletteCues(before: RouletteFrame, now: RouletteFrame, spinMs: number): PlannedCue[] {
  const planned: PlannedCue[] = [];
  const newSpin = before.spin !== now.spin;

  if (now.phase === 'spinning' && (before.phase !== 'spinning' || newSpin)) {
    planned.push({ cue: 'spin', options: { durationMs: spinMs } });
  }
  if (now.phase === 'result' && now.live && now.kind !== undefined && (before.phase !== 'result' || newSpin)) {
    planned.push({ cue: outcomeCue(now.kind) });
  }
  return planned;
}
