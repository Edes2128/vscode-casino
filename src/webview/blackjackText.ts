import type { HandOutcome } from '../game/blackjack/types';
import type { HandView, ResultView } from '../game/blackjack/view';
import { formatChips, formatPayout } from './format';

/** The number shown next to a hand: its total, SOFT when an ace counts as 11, or BUST. */
export function handTotalText(hand: HandView, showOutcome: boolean): string {
  if (hand.total > 21) return 'BUST';
  if (showOutcome && hand.outcome === 'blackjack') return 'BLACKJACK';
  return `${hand.soft ? 'SOFT ' : ''}${hand.total}`;
}

const TAGS: Readonly<Record<HandOutcome, string>> = {
  blackjack: 'BLACKJACK',
  win: 'WIN',
  push: 'PUSH',
  loss: 'LOSE',
  bust: 'BUST',
};

/** A hand's result with its own net chips, such as "WIN +100". Nothing until the result may be shown. */
export function handTag(hand: HandView, showOutcome: boolean): string | undefined {
  if (!showOutcome || hand.outcome === undefined || hand.payout === undefined) return undefined;
  const net = hand.payout - hand.bet;
  return net === 0 ? TAGS[hand.outcome] : `${TAGS[hand.outcome]} ${formatPayout(net)}`;
}

export type ResultKind = 'blackjack' | 'win' | 'loss' | 'push';

export const resultKind = (result: ResultView): ResultKind => (result.blackjack ? 'blackjack' : result.outcome);

/** The big words on the result banner. */
export function resultTitle(kind: ResultKind, hands: readonly HandView[]): string {
  switch (kind) {
    case 'blackjack':
      return 'BLACKJACK!';
    case 'win':
      return 'YOU WIN';
    case 'push':
      return 'PUSH';
    case 'loss':
      return hands.length > 0 && hands.every((hand) => hand.outcome === 'bust') ? 'BUST' : 'YOU LOSE';
  }
}

/** The chips line under the title. */
export function resultAmount(kind: ResultKind, result: ResultView): string {
  if (kind === 'push') return 'BET RETURNED';
  return kind === 'loss' ? `-${formatChips(Math.abs(result.net))}` : `+${formatChips(result.net)}`;
}

export interface Particle {
  /** Where it flies to, relative to the middle, in pixels (a multiple of 4 so it stays on the pixel grid). */
  readonly dx: number;
  readonly dy: number;
  readonly delayMs: number;
  readonly size: number;
  readonly colour: string;
}

const COLOURS = ['#f5c451', '#65e572', '#e94b4b', '#f2f0e8'] as const;
const GOLDEN_ANGLE = 2.399963229728653;
const snap = (value: number): number => Math.round(value / 4) * 4;

/** A repeatable burst of confetti. Positions come from a formula, not randomness, so renders are stable. */
export function burstParticles(count: number): readonly Particle[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = index * GOLDEN_ANGLE;
    const distance = 36 + ((index * 53) % 96);
    return {
      dx: snap(Math.cos(angle) * distance),
      dy: snap(Math.sin(angle) * distance * 0.75),
      delayMs: (index % 6) * 40,
      size: index % 3 === 0 ? 8 : 4,
      colour: COLOURS[index % COLOURS.length] ?? '#f2f0e8',
    };
  });
}
