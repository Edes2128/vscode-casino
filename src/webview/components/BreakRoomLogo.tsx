import { DIE, DIE_SIX } from '../art/sprites';
import { PixelSprite } from './PixelSprite';

/** The sign reads "BREAK ROOM / ARCADE": the small line above, then the big neon word. */
const WORDS = ['ARCADE'] as const;

/** The one tube that flickers, as on every proper neon sign: the third letter of the first word. */
const FLAKY = { word: 0, letter: 2 } as const;

/** The big lobby logo: two bouncing dice, a neon sign and chasing marquee lights. */
export function BreakRoomLogo() {
  return (
    <header className="logo px-frame">
      <div className="marquee" aria-hidden="true" />
      <div className="logo__dice" aria-hidden="true">
        <PixelSprite rows={DIE.rows} palette={DIE.palette} className="logo__die" />
        <PixelSprite rows={DIE_SIX.rows} palette={DIE_SIX.palette} className="logo__die logo__die--second" />
      </div>
      <h1 className="logo__heading" aria-label="Break Room Arcade">
        <span className="logo__kicker" aria-hidden="true">
          BREAK ROOM
        </span>
        <span className="logo__title" aria-hidden="true">
          {WORDS.map((word, wordIndex) => (
            <span key={word} className="logo__word">
              {[...word].map((letter, index) => (
                <span key={index} className={wordIndex === FLAKY.word && index === FLAKY.letter ? 'logo__letter logo__letter--flaky' : 'logo__letter'}>
                  {letter}
                </span>
              ))}
            </span>
          ))}
        </span>
      </h1>
      <div className="marquee marquee--reverse" aria-hidden="true" />
    </header>
  );
}
