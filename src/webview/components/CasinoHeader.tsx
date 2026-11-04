import { DIE } from '../art/sprites';
import { BalanceDisplay } from './BalanceDisplay';
import { PixelSprite } from './PixelSprite';

interface CasinoHeaderProps {
  readonly balance: number | undefined;
}

/** Slim brand bar that stays on every screen, with the live balance. */
export function CasinoHeader({ balance }: CasinoHeaderProps) {
  return (
    <header className="casino-header">
      <div className="casino-header__brand">
        <PixelSprite rows={DIE.rows} palette={DIE.palette} className="casino-header__die" />
        <span className="casino-header__name">CASINO</span>
      </div>
      <BalanceDisplay balance={balance} />
    </header>
  );
}
