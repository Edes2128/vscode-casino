import { burstParticles } from '../blackjackText';
import { cssVars } from '../cssVars';

interface PixelBurstProps {
  readonly count: number;
}

/** A burst of square confetti from the middle of its container. Pure CSS; hidden for reduced motion. */
export function PixelBurst({ count }: PixelBurstProps) {
  return (
    <div className="fx-burst" aria-hidden="true">
      {burstParticles(count).map((particle, index) => (
        <span
          key={index}
          className="fx-burst__dot"
          style={cssVars({
            '--dx': `${particle.dx}px`,
            '--dy': `${particle.dy}px`,
            '--delay': `${particle.delayMs}ms`,
            '--size': `${particle.size}px`,
            '--colour': particle.colour,
          })}
        />
      ))}
    </div>
  );
}
