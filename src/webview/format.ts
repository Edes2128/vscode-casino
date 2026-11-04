import type { GameOutcome, GameType } from '../casino/types';

const chipFormat = new Intl.NumberFormat('en-US');

/** 1000 → "1,000". */
export const formatChips = (amount: number): string => chipFormat.format(amount);

/** Signed amount for results: +150, -50, 0. */
export const formatPayout = (amount: number): string =>
  amount > 0 ? `+${formatChips(amount)}` : formatChips(amount);

/** "1 win", "2 wins", "1 loss", "2 losses". */
export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** A percentage between 0 and 100 with one decimal: 33.333 becomes "33.3%". */
export const formatPercent = (percent: number): string => `${percent.toFixed(1)}%`;

const twoDigits =(value: number): string => String(value).padStart(2, '0');

/** Compact local date and time: "11/04 09:05". */
export function formatTimestamp(epochMs: number): string {
  const date = new Date(epochMs);
  return `${twoDigits(date.getMonth() + 1)}/${twoDigits(date.getDate())} ${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
}

export const GAME_LABELS: Readonly<Record<GameType, string>> = {
  blackjack: 'BLACKJACK',
  roulette: 'ROULETTE',
};

export const OUTCOME_LABELS: Readonly<Record<GameOutcome, string>> = {
  win: 'WIN',
  loss: 'LOSS',
  push: 'PUSH',
};
