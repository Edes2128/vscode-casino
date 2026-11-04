import { DIE, DIE_SIX } from '../art/sprites';
import { PixelSprite } from './PixelSprite';

const LETTERS = ['C', 'A', 'S', 'I', 'N', 'O'] as const;

/** The big lobby logo: two bouncing dice, a neon sign and chasing marquee lights. */
export function CasinoLogo() {
  return (
    <header className="logo px-frame">
      <div className="marquee" aria-hidden="true" />
      <div className="logo__dice" aria-hidden="true">
        <PixelSprite rows={DIE.rows} palette={DIE.palette} className="logo__die" />
        <PixelSprite rows={DIE_SIX.rows} palette={DIE_SIX.palette} className="logo__die logo__die--second" />
      </div>
      <h1 className="logo__heading" aria-label="VS Code Casino">
        <span className="logo__kicker" aria-hidden="true">
          VS CODE
        </span>
        <span className="logo__title" aria-hidden="true">
          {LETTERS.map((letter, index) => (
            <span key={index} className="logo__letter">
              {letter}
            </span>
          ))}
        </span>
      </h1>
      <div className="marquee marquee--reverse" aria-hidden="true" />
    </header>
  );
}
