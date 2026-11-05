import { useEffect, useRef, useState } from 'react';
import { MIN_BET } from '../../casino/chips';
import type { RouletteAction, RouletteView } from '../../game/roulette/view';
import { IDLE_ROULETTE_VIEW } from '../../game/roulette/view';
import type { RouletteSelection } from '../../game/roulette/types';
import { pocketIndexOfNumber } from '../../game/roulette/wheel';
import { rejectionText } from '../betting';
import { GameShell } from '../components/GameShell';
import { PocketBadge } from '../components/PocketBadge';
import { OutcomeBanner, OutcomeOverlay } from '../components/ResultEffects';
import { RouletteControls, type BetKind } from '../components/RouletteControls';
import { RouletteWheel } from '../components/RouletteWheel';
import { useAppearance } from '../customization/AppearanceContext';
import { rouletteAnimation } from '../customization/rouletteAnimations';
import { cx } from '../cx';
import { formatChips } from '../format';
import { spinAction, useRouletteSpin, type SpinPhase } from '../hooks/useRouletteSpin';
import { useMotion } from '../motion';
import { usePresentation } from '../presentation';
import { wheelMotion } from '../art/rouletteWheel';
import { pocketWords, spinOutcomeText, visibleRecent } from '../rouletteText';
import { rouletteCues, type RouletteFrame } from '../sound/gameCues';
import { useSound } from '../sound/SoundProvider';
import { useOwnPlay } from '../sound/useOwnPlay';
import type { Rejection } from './Blackjack';

/** What the screen has drawn, reported to the host so it can check the wheel landed where it chose. */
export interface RouletteShown {
  readonly spin: number;
  readonly phase: SpinPhase;
  readonly landedOn: number | null;
}

interface RouletteProps {
  /** `undefined` until the host has sent the table. */
  readonly view: RouletteView | undefined;
  /** The balance to show (the real one, or the old one while the wheel is still turning). */
  readonly balance: number | undefined;
  readonly rejection: Rejection | undefined;
  readonly onAction: (action: RouletteAction) => void;
  readonly onBack: () => void;
  readonly onOpenSettings: () => void;
  readonly onShown: (shown: RouletteShown) => void;
}

const DEFAULT_BET = 25;

const NOTICE_MS = 3_500;

export function Roulette({ view, balance, rejection, onAction, onBack, onOpenSettings, onShown }: RouletteProps) {
  const motion = useMotion();
  const animation = rouletteAnimation(useAppearance().rouletteAnimation);
  const presentation = usePresentation();
  const play = useSound();
  const ownPlay = useOwnPlay();
  const table = view ?? IDLE_ROULETTE_VIEW;
  const spin = useRouletteSpin(table, motion !== 'off');

  const [bet, setBet] = useState(DEFAULT_BET);
  const [selection, setSelection] = useState<RouletteSelection>();
  const [betKind, setBetKind] = useState<BetKind>('color');
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string>();

  const chips = balance ?? 0;
  const spinning = spin.phase === 'spinning';
  const { last } = table;

  // While the wheel turns, keep the old balance on screen. The host has already paid.
  const balanceBefore = last?.balanceBefore;
  useEffect(() => {
    if (!spinning || balanceBefore === undefined) return;
    presentation.holdBalance(balanceBefore);
    return () => presentation.holdBalance(undefined);
  }, [spinning, balanceBefore, presentation]);

  // The host answered (or refused), so the next spin may be sent.
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
    if (!spinning && chips >= MIN_BET && bet > chips) setBet(chips);
  }, [spinning, chips, bet]);

  // Tell the host what has really been drawn, including where the wheel stopped.
  useEffect(() => {
    onShown({ spin: table.spin, phase: spin.phase, landedOn: spin.phase === 'result' ? spin.landedOn : null });
  }, [table.spin, spin.phase, spin.landedOn, onShown]);

  const outcome = spin.phase === 'result' && spin.live && last !== undefined ? spinOutcomeText(last) : undefined;
  // The rattle of the ball and the result jingle. Only in the view the player is playing in.
  const outcomeKind = outcome?.kind;
  const lastFrame = useRef<RouletteFrame>({ spin: table.spin, phase: spin.phase, live: spin.live, kind: outcomeKind });
  useEffect(() => {
    const before = lastFrame.current;
    const now: RouletteFrame = { spin: table.spin, phase: spin.phase, live: spin.live, kind: outcomeKind };
    lastFrame.current = now;
    if (!ownPlay.isMine()) return;
    // The rattle lasts as long as the wheel does: the chosen style's spin, or the calm pause.
    const turnMs = wheelMotion(motion, animation).durationMs;
    for (const { cue, options } of rouletteCues(before, now, turnMs)) play(cue, options);
  }, [table.spin, spin.phase, spin.live, outcomeKind, motion, animation, ownPlay, play]);

  const shownRecent = visibleRecent(table.recent, spinning);
  const latest = shownRecent[0];
  // One question for the button and for the click: no spin while the wheel turns, whatever is clicked.
  const request = spinAction({ selection, bet, chips, spinning, pending });
  const canSpin = request !== undefined;

  const doSpin = (): void => {
    if (request === undefined) return;
    ownPlay.mark();
    setPending(true);
    onAction(request);
  };

  return (
    <GameShell title="ROULETTE" onBack={onBack}>
      {view === undefined ? (
        <p className="connecting">CONNECTING</p>
      ) : (
        <>
          <div className={cx('rl-stage', 'px-frame', outcome?.kind === 'loss' && 'rl-stage--shake')}>
            <p className="rl-stage__last">
              {latest === undefined ? (
                'NO SPINS YET'
              ) : (
                <>
                  LAST <PocketBadge pocket={latest} /> {pocketWords(latest)}
                </>
              )}
            </p>

            <RouletteWheel
              spin={last === undefined ? undefined : { id: table.spin, pocketIndex: pocketIndexOfNumber(last.pocket.number) }}
              motion={motion}
              onStopped={spin.onStopped}
            />

            <div className="rl-stage__centre">
              {outcome === undefined ? (
                <p className="rl-stage__rules">RED OR BLACK PAYS 1 TO 1. GREEN OR A NUMBER PAYS 35 TO 1.</p>
              ) : (
                <OutcomeBanner {...outcome} />
              )}
            </div>

            <div className="rl-recent" aria-label="Recent results">
              {shownRecent.length === 0 ? (
                <span className="rl-recent__empty">RECENT RESULTS APPEAR HERE</span>
              ) : (
                shownRecent.map((pocket, index) => <PocketBadge key={`${index}-${pocket.number}`} pocket={pocket} />)
              )}
            </div>

            {outcome !== undefined && <OutcomeOverlay kind={outcome.kind} />}
          </div>

          <p className="bj-info">
            <span>
              BET <b>{formatChips(bet)}</b>
            </span>
            <span>
              CHIPS <b>{formatChips(chips)}</b>
            </span>
          </p>

          <RouletteControls
            chips={chips}
            bet={bet}
            onBetChange={setBet}
            selection={selection}
            onSelectionChange={setSelection}
            betKind={betKind}
            onBetKindChange={setBetKind}
            spinning={spinning}
            pending={pending}
            canSpin={canSpin}
            onSpin={doSpin}
            notice={notice}
            lastNumber={latest?.number}
            onOpenSettings={onOpenSettings}
          />

          {notice !== undefined && chips < MIN_BET && !spinning && (
            <p className="bj-notice" role="alert">
              {notice}
            </p>
          )}
        </>
      )}
    </GameShell>
  );
}
