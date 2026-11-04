import { COIN } from '../art/sprites';
import { cx } from '../cx';
import { formatChips } from '../format';
import { PixelSprite } from './PixelSprite';

interface BalanceDisplayProps {
  /** `undefined` while the host has not answered yet. */
  readonly balance: number | undefined;
  readonly size?: 'sm' | 'lg';
}

/** Coin icon and the chip balance. Announced politely to screen readers when it changes. */
export function BalanceDisplay({ balance, size = 'sm' }: BalanceDisplayProps) {
  const text = balance === undefined ? '---' : formatChips(balance);
  // Longer numbers step down in size so they always fit, even in a narrow sidebar.
  const length = text.length <= 5 ? 'short' : text.length <= 7 ? 'medium' : 'long';

  return (
    <div
      className={cx('balance', `balance--${size}`, `balance--${length}`)}
      role="status"
      aria-label={`Balance: ${text} chips`}
    >
      <PixelSprite rows={COIN.rows} palette={COIN.palette} className="balance__coin" />
      <span className="balance__amount" aria-hidden="true">
        {text}
      </span>
    </div>
  );
}
