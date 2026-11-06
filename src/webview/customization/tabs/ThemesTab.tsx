import { THEMES } from '../themes';
import { useAppearance } from '../AppearanceContext';
import { ChoiceCard, ChoiceGrid } from '../ChoiceCard';
import { resolveAppearance } from '../appearance';
import { ScenePreview } from '../ScenePreview';
import type { CustomizeTabProps } from './types';

/** The eight themes, each shown as a small table in its own colors. */
export function ThemesTab({ settings, onChange }: CustomizeTabProps) {
  const { resolved } = useAppearance();
  return (
    <>
      <p className="customize__intro">PICK A LOOK. IT CHANGES THE WHOLE GAME AT ONCE: HOME, BLACKJACK, ROULETTE, BUTTONS, CARDS AND CHIPS.</p>
      <ChoiceGrid label="Theme">
        {THEMES.map((theme) => (
          <ChoiceCard
            key={theme.id}
            selected={settings.theme === theme.id}
            label={theme.name.toUpperCase()}
            description={theme.blurb.toUpperCase()}
            onSelect={() => onChange({ theme: theme.id })}
          >
            <ScenePreview resolved={resolveAppearance(theme.id)} />
          </ChoiceCard>
        ))}
      </ChoiceGrid>
      {resolved.adjusted.length > 0 && <p className="setting-note">YOUR OWN COLORS STAY ON TOP OF A THEME. CHANGE THEM UNDER CUSTOM COLORS.</p>}
    </>
  );
}
