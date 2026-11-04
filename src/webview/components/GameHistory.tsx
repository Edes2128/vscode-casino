import type { HistoryEntry } from '../../casino/types';
import { ICON_PALETTE, CARDS_ICON, WHEEL_ICON } from '../art/sprites';
import { cx } from '../cx';
import { formatChips, formatPayout, formatTimestamp, GAME_LABELS, OUTCOME_LABELS } from '../format';
import { PixelSprite } from './PixelSprite';

interface GameHistoryProps {
  /** Most recent first. */
  readonly entries: readonly HistoryEntry[];
  /** Show only this many entries. */
  readonly limit?: number;
}

/** Recent rounds: game, result, bet, net payout and time. */
export function GameHistory({ entries, limit }: GameHistoryProps) {
  const shown = limit === undefined ? entries : entries.slice(0, limit);

  if (shown.length === 0) {
    return (
      <p className="history__empty">
        NO GAMES YET.
        <br />
        TAKE A SEAT AT A TABLE!
      </p>
    );
  }

  return (
    <ul className="history">
      {shown.map((entry) => (
        <li key={entry.id} className={cx('history__row', `history__row--${entry.outcome}`)}>
          <div className="history__main">
            <PixelSprite
              rows={entry.game === 'blackjack' ? CARDS_ICON : WHEEL_ICON}
              palette={ICON_PALETTE}
              className="history__icon"
            />
            <span className="history__game">{GAME_LABELS[entry.game]}</span>
            <span className="history__outcome">{OUTCOME_LABELS[entry.outcome]}</span>
            <span className="history__payout">{formatPayout(entry.payout)}</span>
          </div>
          <div className="history__meta">
            <span className="history__detail">{entry.detail}</span>
            <span>BET {formatChips(entry.bet)}</span>
            <time dateTime={new Date(entry.timestamp).toISOString()}>{formatTimestamp(entry.timestamp)}</time>
          </div>
        </li>
      ))}
    </ul>
  );
}
