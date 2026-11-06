import { DIE } from '../art/sprites';
import { BalanceDisplay } from './BalanceDisplay';
import { PixelSprite } from './PixelSprite';

interface LuckyBreakHeaderProps {
  readonly balance: number | undefined;
}

/** Slim brand bar that stays on every screen, with the live balance. */
export function LuckyBreakHeader({ balance }: LuckyBreakHeaderProps) {
  return (
    <header className="lb-header">
      <div className="lb-header__brand">
        <PixelSprite rows={DIE.rows} palette={DIE.palette} className="lb-header__die" />
        <span className="lb-header__name">LUCKY BREAK</span>
      </div>
      <BalanceDisplay balance={balance} />
    </header>
  );
}
