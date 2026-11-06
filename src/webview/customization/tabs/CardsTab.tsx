import type { CardDesignId } from '../../../state/appearance';
import type { Card } from '../../../game/blackjack/types';
import { PlayingCard } from '../../components/PlayingCard';
import { CARD_DESIGNS, cardDesignOf } from '../cardDesigns';
import { ChoiceCard, ChoiceGrid } from '../ChoiceCard';
import type { CustomizeTabProps } from './types';

/** What each choice shows: a small hand, face up and face down, so the paper, the inks and the back all show. */
const SAMPLE_HAND: readonly (Card | null)[] = [{ rank: 'A', suit: 'spades' }, { rank: 'K', suit: 'hearts' }, null];

/** The four suits, alternating black and red so both inks show. */
const SUIT_ROW: readonly Card[] = [
  { rank: 'A', suit: 'spades' },
  { rank: 'A', suit: 'hearts' },
  { rank: 'A', suit: 'clubs' },
  { rank: 'A', suit: 'diamonds' },
];

/** The ace, the three picture cards and the ten, which are the ranks hardest to tell apart, in both inks. */
const RANK_ROW: readonly Card[] = [
  { rank: 'A', suit: 'spades' },
  { rank: 'K', suit: 'hearts' },
  { rank: 'Q', suit: 'clubs' },
  { rank: 'J', suit: 'diamonds' },
  { rank: '10', suit: 'spades' },
];

/**
 * The six playing card designs, each shown as a small hand, and a larger sample of the one in use: all four
 * suits and the picture cards, with the back. The samples are the real cards, drawn the way the table draws them.
 * Only the look changes; no game rule reads this.
 */
export function CardsTab({ settings, onChange }: CustomizeTabProps) {
  const inUse = cardDesignOf(settings.cardDesign);
  return (
    <>
      <p className="customize__intro">PICK A DECK. EVERY CARD AT THE TABLE USES IT, SPLIT HANDS TOO. IT NEVER CHANGES THE ODDS.</p>

      <ChoiceGrid label="Playing card design">
        {CARD_DESIGNS.map((design) => (
          <ChoiceCard
            key={design.id}
            selected={settings.cardDesign === design.id}
            label={design.name.toUpperCase()}
            description={design.blurb.toUpperCase()}
            onSelect={() => onChange({ cardDesign: design.id })}
          >
            <span className="card-preview">
              {SAMPLE_HAND.map((card, index) => (
                <PlayingCard key={index} card={card} design={design.id} />
              ))}
            </span>
          </ChoiceCard>
        ))}
      </ChoiceGrid>

      <CardShowcase design={inUse.id} name={inUse.name} />
    </>
  );
}

/** Every suit, the ranks that are hardest to tell apart and the back, in one design. Not interactive: it is a picture of the cards. */
function CardShowcase({ design, name }: { readonly design: CardDesignId; readonly name: string }) {
  return (
    <section className="card-showcase" aria-label={`Preview of the ${name} cards`}>
      <h2 className="card-showcase__title">PREVIEW: {name.toUpperCase()}</h2>
      <div className="card-showcase__table px-frame">
        <p className="card-showcase__label">SUITS</p>
        <div className="card-showcase__row">
          {SUIT_ROW.map((card) => (
            <PlayingCard key={card.suit} card={card} design={design} />
          ))}
        </div>
        <p className="card-showcase__label">RANKS AND BACK</p>
        <div className="card-showcase__row">
          {RANK_ROW.map((card) => (
            <PlayingCard key={card.rank} card={card} design={design} />
          ))}
          <PlayingCard card={null} design={design} />
        </div>
      </div>
    </section>
  );
}
