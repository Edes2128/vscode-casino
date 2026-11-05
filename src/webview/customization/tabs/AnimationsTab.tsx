import { WheelPreview } from '../../components/WheelPreview';
import { WheelThumb } from '../../components/WheelThumb';
import { ChoiceCard, ChoiceGrid } from '../ChoiceCard';
import { ROULETTE_ANIMATIONS, spinSeconds } from '../rouletteAnimations';
import type { CustomizeTabProps } from './types';

/**
 * How the roulette wheel spins: five styles to choose from, and a wheel to try the chosen one on. The style is
 * only how the spin looks. The ball always stops on the number the casino drew, in every style.
 */
export function AnimationsTab({ settings, onChange }: CustomizeTabProps) {
  return (
    <>
      <p className="customize__intro">PICK HOW THE WHEEL SPINS. THE BALL ALWAYS STOPS ON THE NUMBER THE CASINO DREW.</p>

      <ChoiceGrid label="Roulette animation">
        {ROULETTE_ANIMATIONS.map((style) => (
          <ChoiceCard
            key={style.id}
            selected={settings.rouletteAnimation === style.id}
            label={style.name.toUpperCase()}
            description={`${style.description} About ${spinSeconds(style)} seconds.`}
            onSelect={() => onChange({ rouletteAnimation: style.id })}
          >
            <WheelThumb id={style.id} />
          </ChoiceCard>
        ))}
      </ChoiceGrid>

      <WheelPreview animation={settings.rouletteAnimation} />
    </>
  );
}
