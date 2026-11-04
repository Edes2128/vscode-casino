import { ICON_PALETTE } from '../art/sprites';
import { NAV_ITEMS, type Page } from '../navigation';
import { PixelSprite } from './PixelSprite';

interface NavBarProps {
  readonly current: Page;
  readonly onNavigate: (page: Page) => void;
}

/** Icon tabs. Labels collapse to tooltips when the sidebar is very narrow (see casino.css). */
export function NavBar({ current, onNavigate }: NavBarProps) {
  return (
    <nav className="nav-bar" aria-label="Casino">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.page}
          type="button"
          className="nav-bar__item"
          title={item.label}
          {...(item.page === current ? { 'aria-current': 'page' as const } : {})}
          onClick={() => onNavigate(item.page)}
        >
          <PixelSprite rows={item.icon} palette={ICON_PALETTE} className="nav-bar__icon" />
          <span className="nav-bar__label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
