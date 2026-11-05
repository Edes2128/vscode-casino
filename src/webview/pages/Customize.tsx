import { useState } from 'react';
import type { Settings, SettingsPatch } from '../../casino/settings';
import { cx } from '../cx';
import { AnimationsTab } from '../customization/tabs/AnimationsTab';
import { CardsTab } from '../customization/tabs/CardsTab';
import { ColorsTab } from '../customization/tabs/ColorsTab';
import { SoundsTab } from '../customization/tabs/SoundsTab';
import { ThemesTab } from '../customization/tabs/ThemesTab';
import type { CustomizeTabProps } from '../customization/tabs/types';
import type { ComponentType } from 'react';

interface CustomizeProps {
  readonly settings: Settings;
  readonly onChange: (patch: SettingsPatch) => void;
}

export type CustomizeTabId = 'themes' | 'cards' | 'animations' | 'sounds' | 'colors';

interface TabDefinition {
  readonly id: CustomizeTabId;
  readonly label: string;
  readonly Panel: ComponentType<CustomizeTabProps>;
}

/** The five areas of the screen, in order. Every option in every one of them is free. */
export const CUSTOMIZE_TABS: readonly TabDefinition[] = [
  { id: 'themes', label: 'THEMES', Panel: ThemesTab },
  { id: 'cards', label: 'CARDS', Panel: CardsTab },
  { id: 'animations', label: 'WHEEL', Panel: AnimationsTab },
  { id: 'sounds', label: 'SOUNDS', Panel: SoundsTab },
  { id: 'colors', label: 'COLORS', Panel: ColorsTab },
];

/** The tab the player was on, kept while they go and play and come back. */
let lastTab: CustomizeTabId = 'themes';

/**
 * The Customize screen: casino themes, playing cards, roulette animations, sound packs and custom colors. A choice
 * is saved and applied at once, with no restart, and every option is free.
 */
export function Customize({ settings, onChange }: CustomizeProps) {
  const [tab, setTab] = useState<CustomizeTabId>(lastTab);
  const current = CUSTOMIZE_TABS.find((entry) => entry.id === tab) ?? (CUSTOMIZE_TABS[0] as TabDefinition);
  const choose = (next: CustomizeTabId): void => {
    lastTab = next;
    setTab(next);
  };

  return (
    <>
      <h1 className="page-title">CUSTOMIZE</h1>

      <div className="customize-tabs" role="tablist" aria-label="What to customize">
        {CUSTOMIZE_TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            id={`customize-tab-${entry.id}`}
            aria-selected={entry.id === current.id}
            aria-controls="customize-panel"
            className={cx('customize-tab', entry.id === current.id && 'customize-tab--active')}
            onClick={() => choose(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <section id="customize-panel" role="tabpanel" aria-labelledby={`customize-tab-${current.id}`} className="customize__panel">
        <current.Panel settings={settings} onChange={onChange} />
      </section>

      <p className="setting-note">EVERYTHING HERE IS FREE. NOTHING IS LOCKED, EVER.</p>
    </>
  );
}
