import type { CasinoPage } from '../shared/messages';
import { CARDS_ICON, CUSTOMIZE_ICON, HOME_ICON, SETTINGS_ICON, STATS_ICON, WHEEL_ICON } from './art/sprites';

export type Page = CasinoPage;

export interface NavItem {
  readonly page: Page;
  readonly label: string;
  readonly icon: readonly string[];
}

/** Every destination the navigation bar offers. Add a page here once its screen exists. */
export const NAV_ITEMS: readonly NavItem[] = [
  { page: 'home', label: 'HOME', icon: HOME_ICON },
  { page: 'blackjack', label: 'BLACKJACK', icon: CARDS_ICON },
  { page: 'roulette', label: 'ROULETTE', icon: WHEEL_ICON },
  { page: 'statistics', label: 'STATS', icon: STATS_ICON },
  { page: 'customize', label: 'STYLE', icon: CUSTOMIZE_ICON },
  { page: 'settings', label: 'SETTINGS', icon: SETTINGS_ICON },
];
