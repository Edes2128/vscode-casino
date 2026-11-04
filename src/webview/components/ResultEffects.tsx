import type { HandView, ResultView } from '../../game/blackjack/view';
import { resultAmount, resultKind, resultTitle } from '../blackjackText';
import { cx } from '../cx';
import { PixelBurst } from './PixelBurst';

/** How a round ended, for the banner and the effects. `special` is a blackjack, or a hit on the green. */
export type OutcomeKind = 'special' | 'win' | 'loss' | 'push';

interface OutcomeBannerProps {
  readonly kind: OutcomeKind;
  readonly title: string;
  readonly amount: string;
  readonly detail: string;
}

/**
 * The result in words, in the strip between the two halves of a table (where a real table prints
 * its rules), so it never covers a card or the wheel. Announced to screen readers.
 */
export function OutcomeBanner({ kind, title, amount, detail }: OutcomeBannerProps) {
  return (
    <div className={cx('result-banner', `result-banner--${kind}`)} role="status">
      <p className="result-banner__headline">
        <span className="result-banner__title">{title}</span>
        <span className="result-banner__amount">{amount}</span>
      </p>
      <p className="result-banner__detail">{detail}</p>
    </div>
  );
}

/**
 * The show laid over a whole table. A win throws confetti, a special result gets a bigger burst and a
 * flash, a loss is a quiet red flicker (the table also shakes, see `bj-table--shake`).
 */
export function OutcomeOverlay({ kind }: { readonly kind: OutcomeKind }) {
  return (
    <div className={cx('result-fx', `result-fx--${kind}`)} aria-hidden="true">
      {kind === 'special' && <div className="result-fx__flash" />}
      {(kind === 'win' || kind === 'special') && <PixelBurst count={kind === 'special' ? 56 : 28} />}
    </div>
  );
}

const outcomeKind = (result: ResultView): OutcomeKind => {
  const kind = resultKind(result);
  return kind === 'blackjack' ? 'special' : kind;
};

/** The blackjack result banner. */
export function ResultBanner({ result, hands }: { readonly result: ResultView; readonly hands: readonly HandView[] }) {
  const kind = resultKind(result);
  return (
    <OutcomeBanner
      kind={outcomeKind(result)}
      title={resultTitle(kind, hands)}
      amount={resultAmount(kind, result)}
      detail={result.detail}
    />
  );
}

/** The blackjack result effects. */
export function ResultOverlay({ result }: { readonly result: ResultView }) {
  return <OutcomeOverlay kind={outcomeKind(result)} />;
}
