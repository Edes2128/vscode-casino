import { cssVars } from '../cssVars';

const TONES = ['gold', 'neon', 'red'] as const;

/** Fixed, deterministic positions so React renders the same markup every time. */
const PARTICLES = Array.from({ length: 14 }, (_, index) => ({
  left: (index * 37 + 11) % 97,
  delay: -((index * 13) % 17),
  duration: 14 + ((index * 5) % 9),
  tone: TONES[index % TONES.length],
}));

/** Pixel embers drifting up behind Break Room Arcade. Pure CSS; hidden for reduced motion. */
export function PixelParticles() {
  return (
    <div className="particles" aria-hidden="true">
      {PARTICLES.map((particle, index) => (
        <span
          key={index}
          className={`particles__dot particles__dot--${particle.tone}`}
          style={cssVars({
            '--left': `${particle.left}%`,
            '--delay': `${particle.delay}s`,
            '--duration': `${particle.duration}s`,
          })}
        />
      ))}
    </div>
  );
}
