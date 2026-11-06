import { DIE } from '../art/sprites';
import { BalanceDisplay } from './BalanceDisplay';
import { PixelSprite } from './PixelSprite';

interface BreakRoomHeaderProps {
  readonly balance: number | undefined;
}

/** Slim brand bar that stays on every screen, with the live balance. */
export function BreakRoomHeader({ balance }: BreakRoomHeaderProps) {
  return (
    <header className="br-header">
      <div className="br-header__brand">
        <PixelSprite rows={DIE.rows} palette={DIE.palette} className="br-header__die" />
        <span className="br-header__name">BREAK ROOM</span>
      </div>
      <BalanceDisplay balance={balance} />
    </header>
  );
}
