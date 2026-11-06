import { useEffect, useRef, useState } from 'react';
import { MIN_BET } from '../../state/chips';
import { IDLE_VIEW, type BlackjackAction, type BlackjackView } from '../../game/blackjack/view';
import { betProblem, rejectionText } from '../betting';
import { resultKind } from '../blackjackText';
import { ActionBar, type PlayerMove } from '../components/ActionBar';
import { BetControls } from '../components/BetControls';
import { BlackjackTable } from '../components/BlackjackTable';
import { OutOfChips } from '../components/OutOfChips';
import { GameShell } from '../components/GameShell';
import { PixelButton } from '../components/PixelButton';
import { ResultBanner, ResultOverlay } from '../components/ResultEffects';
import { formatChips } from '../format';
import { useDealerReveal } from '../hooks/useDealerReveal';
import { useMotion } from '../motion';
import { usePresentation } from '../presentation';
import { blackjackCues, type BlackjackFrame } from '../sound/gameCues';
import { useSound } from '../sound/SoundProvider';
import { useOwnPlay } from '../sound/useOwnPlay';

/** What is on the screen, reported to the host so it can see that every view caught up. */
export interface BlackjackShown {
  readonly round: number;
  readonly phase: BlackjackView['phase'];
  readonly playerCards: number;
  readonly dealerCards: number;
}

export interface Rejection {
  readonly id: number;
  readonly error: string;
}

interface BlackjackProps {
  /** `undefined` until the host has sent the table. */
  readonly view: BlackjackView | undefined;
  /** The balance to show (the real one, or the old one while the dealer is still playing). */
  readonly balance: number | undefined;
  readonly rejection: Rejection | undefined;
  readonly onAction: (action: BlackjackAction) => void;
  readonly onBack: () => void;
  readonly onOpenSettings: () => void;
  readonly onShown: (shown: BlackjackShown) => void;
}

const DEFAULT_BET = 25;
const NOTICE_MS = 3_500;

/** The host's refusal, said where the player is looking. */
function Notice({ text }: { readonly text: string }) {
  return (
    <p className="bj-notice" role="alert">
      {text}
    </p>
  );
}

export function Blackjack({ view, balance, rejection, onAction, onBack, onOpenSettings, onShown }: BlackjackProps) {
  // Calm still paces the dealer's reveal step by step (nothing moves); only "off" shows it all at once.
  const animate = useMotion() !== 'off';
  const presentation = usePresentation();
  const play = useSound();
  const ownPlay = useOwnPlay();
  const table = view ?? IDLE_VIEW;
  const shown = useDealerReveal(table, animate);

  const tableRef = useRef<HTMLDivElement>(null);
  const [bet, setBet] = useState(DEFAULT_BET);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string>();

  const chips = balance ?? 0;
  const result = table.phase === 'settled' && shown.resultVisible ? table.result : undefined;
  const lost = result !== undefined && resultKind(result) === 'loss';

  // While the dealer plays out the hand, keep the old balance on screen. The host has already paid.
  const holding = table.phase === 'settled' && !shown.resultVisible;
  const balanceBefore = table.result?.balanceBefore;
  useEffect(() => {
    if (!holding || balanceBefore === undefined) return;
    presentation.holdBalance(balanceBefore);
    return () => presentation.holdBalance(undefined);
  }, [holding, balanceBefore, presentation]);

  // The host answered (or refused), so the next move may be sent.
  useEffect(() => {
    setPending(false);
  }, [view, rejection]);

  useEffect(() => {
    if (rejection === undefined) return;
    setNotice(rejectionText(rejection.error));
    const timer = window.setTimeout(() => setNotice(undefined), NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [rejection]);

  // After a loss the player may be left with less than the bet they had chosen.
  useEffect(() => {
    if (table.phase === 'betting' && chips >= MIN_BET && bet > chips) setBet(chips);
  }, [table.phase, chips, bet]);

  // Tell the host what has really been drawn.
  const dealerShown = shown.dealerCards.length;
  useEffect(() => {
    const element = tableRef.current;
    if (element === null) return;
    onShown({
      round: table.round,
      phase: table.phase,
      playerCards: element.querySelectorAll('.bj-table__player .playing-card').length,
      dealerCards: element.querySelectorAll('.bj-table__dealer .playing-card').length,
    });
  }, [table, dealerShown, onShown]);

  // The sounds of the table: cards landing, the hole card turning, the result. Only in the view the
  // player is playing in, so the sidebar and the editor panel never both make the same noise.
  const cards = table.hands.reduce((sum, hand) => sum + hand.cards.length, 0) + shown.dealerCards.length;
  const holeUp = shown.dealerCards.length > 1 && shown.dealerCards[1] !== null;
  const resultRound = result === undefined ? undefined : table.round;
  const resultOutcome = result === undefined ? undefined : resultKind(result);
  const lastFrame = useRef<BlackjackFrame>({ cards, holeUp, result: undefined });
  useEffect(() => {
    const before = lastFrame.current;
    const now: BlackjackFrame = {
      cards,
      holeUp,
      result:
        resultRound === undefined || resultOutcome === undefined
          ? undefined
          : { round: resultRound, kind: resultOutcome === 'blackjack' ? 'special' : resultOutcome },
    };
    lastFrame.current = now;
    if (!ownPlay.isMine()) return;
    for (const { cue, options } of blackjackCues(before, now)) play(cue, options);
  }, [cards, holeUp, resultRound, resultOutcome, ownPlay, play]);

  const send = (action: BlackjackAction): void => {
    ownPlay.mark();
    setPending(true);
    onAction(action);
  };
  const onMove = (move: PlayerMove): void => send({ kind: move });

  const staked = table.hands.reduce((sum, hand) => sum + hand.bet, 0);
  const canDeal = !pending && bet > 0 && betProblem(bet, chips) === undefined;

  return (
    <GameShell title="BLACKJACK" onBack={onBack}>
      {view === undefined ? (
        <p className="connecting">CONNECTING</p>
      ) : (
        <>
          <BlackjackTable
            tableRef={tableRef}
            dealerCards={shown.dealerCards}
            dealerTotal={shown.dealerTotal}
            hands={table.hands}
            showOutcomes={shown.resultVisible}
            shake={lost}
            banner={result !== undefined && <ResultBanner result={result} hands={table.hands} />}
            overlay={result !== undefined && <ResultOverlay result={result} />}
          />

          <p className="bj-info">
            <span>
              BET <b>{formatChips(table.phase === 'betting' ? bet : staked)}</b>
            </span>
            <span>
              CHIPS <b>{formatChips(chips)}</b>
            </span>
          </p>

          {table.phase === 'betting' &&
            (chips < MIN_BET ? (
              <OutOfChips onOpenSettings={onOpenSettings} />
            ) : (
              <>
                <BetControls balance={chips} bet={bet} onBetChange={setBet} disabled={pending} />
                <div className="action-dock">
                  {notice !== undefined && <Notice text={notice} />}
                  <PixelButton variant="gold" size="lg" block disabled={!canDeal} onClick={() => send({ kind: 'deal', bet })}>
                    DEAL
                  </PixelButton>
                </div>
              </>
            ))}

          {table.phase === 'player' && (
            <div className="action-dock">
              {notice !== undefined && <Notice text={notice} />}
              <ActionBar actions={table.actions} disabled={pending} onMove={onMove} />
            </div>
          )}

          {table.phase === 'settled' && (
            <div className="action-dock">
              {notice !== undefined && <Notice text={notice} />}
              <PixelButton
                variant="gold"
                size="lg"
                block
                disabled={pending || !shown.resultVisible}
                onClick={() => send({ kind: 'newRound' })}
              >
                NEW ROUND
              </PixelButton>
            </div>
          )}

          {notice !== undefined && table.phase === 'betting' && chips < MIN_BET && <Notice text={notice} />}
        </>
      )}
    </GameShell>
  );
}
