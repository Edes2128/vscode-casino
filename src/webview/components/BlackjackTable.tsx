import type { ReactNode, Ref } from 'react';
import type { Card } from '../../game/blackjack/types';
import type { HandView } from '../../game/blackjack/view';
import { ARROW_DOWN, ICON_PALETTE } from '../art/sprites';
import { handTag, handTotalText } from '../blackjackText';
import { cx } from '../cx';
import { formatChips } from '../format';
import { CardFan } from './CardFan';
import { PixelSprite } from './PixelSprite';

interface BlackjackTableProps {
  readonly tableRef?: Ref<HTMLDivElement>;
  readonly dealerCards: readonly (Card | null)[];
  /** `null` while the hole card is face down. */
  readonly dealerTotal: number | null;
  readonly hands: readonly HandView[];
  /** Hand results (WIN, LOSE, ...) may be shown. */
  readonly showOutcomes: boolean;
  /** Shake the table: the round was lost. */
  readonly shake: boolean;
  /** The result in words. Replaces the printed rules in the strip between dealer and player. */
  readonly banner?: ReactNode;
  /** The confetti and flashes laid over the whole table. */
  readonly overlay?: ReactNode;
}

function PlayerHand({ hand, showOutcome }: { readonly hand: HandView; readonly showOutcome: boolean }) {
  const tag = handTag(hand, showOutcome);
  return (
    <div
      className={cx(
        'hand',
        hand.active && 'hand--active',
        hand.total > 21 && 'hand--over',
        showOutcome && hand.outcome !== undefined && `hand--${hand.outcome}`,
      )}
    >
      <PixelSprite rows={ARROW_DOWN} palette={ICON_PALETTE} className="hand__arrow" />
      <CardFan cards={hand.cards} owner="player" />
      <p className="hand__caption">
        <span className="hand__total">{handTotalText(hand, showOutcome)}</span>
        <span className="hand__bet">BET {formatChips(hand.bet)}</span>
        {tag !== undefined && <span className="hand__tag">{tag}</span>}
      </p>
    </div>
  );
}

/** The green felt: the dealer on top, the player's hand or hands below. */
export function BlackjackTable({
  tableRef,
  dealerCards,
  dealerTotal,
  hands,
  showOutcomes,
  shake,
  banner,
  overlay,
}: BlackjackTableProps) {
  const dealt = hands.length > 0;

  return (
    <div ref={tableRef} className={cx('bj-table', 'px-frame', shake && 'bj-table--shake')}>
      <section className="bj-table__dealer" aria-label="Dealer">
        <h2 className="bj-table__label">
          DEALER
          {dealt && <span className="bj-table__total">{dealerTotal ?? '?'}</span>}
        </h2>
        {dealerCards.length > 0 && <CardFan cards={dealerCards} owner="dealer" />}
      </section>

      <div className="bj-table__centre">
        {banner ?? <p className="bj-table__rules">BLACKJACK PAYS 3 TO 2. DEALER STANDS ON ALL 17.</p>}
      </div>

      <section className="bj-table__player" aria-label="Your hands">
        <h2 className="bj-table__label">{hands.length > 1 ? 'YOUR HANDS' : 'YOU'}</h2>
        {dealt ? (
          <div className="bj-table__hands">
            {hands.map((hand, index) => (
              <PlayerHand key={index} hand={hand} showOutcome={showOutcomes} />
            ))}
          </div>
        ) : (
          <p className="bj-table__empty">PLACE YOUR BET</p>
        )}
      </section>

      {overlay}
    </div>
  );
}
