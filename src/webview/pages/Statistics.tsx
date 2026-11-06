import { useState } from 'react';
import { winPercentage } from '../../state/statistics';
import type { LuckyBreakSnapshot, GameStats, GameType } from '../../state/types';
import { BalanceDisplay } from '../components/BalanceDisplay';
import { GameHistory } from '../components/GameHistory';
import { PixelCard } from '../components/PixelCard';
import { ResultBar } from '../components/ResultBar';
import { SegmentedControl } from '../components/SegmentedControl';
import { formatChips, formatPercent, formatPayout } from '../format';

type Scope = 'overall' | GameType;

const SCOPES = [
  { value: 'overall', label: 'ALL' },
  { value: 'blackjack', label: 'BLACKJACK' },
  { value: 'roulette', label: 'ROULETTE' },
] as const satisfies ReadonlyArray<{ value: Scope; label: string }>;

const SCOPE_TITLES: Readonly<Record<Scope, string>> = {
  overall: 'WHOLE GAME',
  blackjack: 'BLACKJACK',
  roulette: 'ROULETTE',
};

interface StatisticsProps {
  readonly snapshot: LuckyBreakSnapshot;
}

interface Row {
  readonly label: string;
  readonly value: string;
  readonly tone?: 'win' | 'loss' | 'push';
}

function toRows(stats: GameStats): readonly Row[] {
  return [
    { label: 'GAMES PLAYED', value: formatChips(stats.gamesPlayed) },
    { label: 'WINS', value: formatChips(stats.wins), tone: 'win' },
    { label: 'LOSSES', value: formatChips(stats.losses), tone: 'loss' },
    { label: 'PUSHES', value: formatChips(stats.pushes), tone: 'push' },
    { label: 'WIN RATE', value: formatPercent(winPercentage(stats)) },
    { label: 'BIGGEST WIN', value: formatPayout(stats.biggestWin), tone: 'win' },
    { label: 'BIGGEST LOSS', value: formatPayout(-stats.biggestLoss), tone: 'loss' },
    { label: 'CHIPS WAGERED', value: formatChips(stats.totalWagered) },
  ];
}

/** Statistics for the whole game or for one game, with the matching round-by-round history. */
export function Statistics({ snapshot }: StatisticsProps) {
  const [scope, setScope] = useState<Scope>('overall');

  const stats = snapshot.stats[scope];
  const history = scope === 'overall' ? snapshot.history : snapshot.history.filter((entry) => entry.game === scope);

  return (
    <>
      <h1 className="page-title">STATISTICS</h1>
      <SegmentedControl label="Statistics for" options={SCOPES} value={scope} onChange={setScope} />

      <PixelCard title={SCOPE_TITLES[scope]} tone="gold">
        <div className="stats-balance">
          <span className="stats-balance__label">CURRENT BALANCE</span>
          <BalanceDisplay balance={snapshot.balance} size="lg" />
        </div>
        <ResultBar stats={stats} />
        <dl className="stats-list">
          {toRows(stats).map((row) => (
            <div key={row.label} className={`stats-list__row${row.tone ? ` stats-list__row--${row.tone}` : ''}`}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      </PixelCard>

      <PixelCard title="GAME HISTORY">
        <GameHistory entries={history} />
      </PixelCard>
    </>
  );
}
