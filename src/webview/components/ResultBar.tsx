import type { GameStats } from '../../casino/types';
import { proportionBlocks } from '../../casino/statistics';
import { pluralise } from '../format';

/** Number of pixel blocks in the bar. */
export const RESULT_BAR_BLOCKS = 20;

type BlockKind = 'win' | 'loss' | 'push' | 'empty';

interface ResultBarProps {
  readonly stats: GameStats;
}

/** A retro progress bar split into wins, losses and pushes. Empty until a game has been played. */
export function ResultBar({ stats }: ResultBarProps) {
  const counts = proportionBlocks(stats, RESULT_BAR_BLOCKS);
  const played = counts.win + counts.loss + counts.push > 0;

  const blocks: BlockKind[] = played
    ? [
        ...Array<BlockKind>(counts.win).fill('win'),
        ...Array<BlockKind>(counts.loss).fill('loss'),
        ...Array<BlockKind>(counts.push).fill('push'),
      ]
    : Array<BlockKind>(RESULT_BAR_BLOCKS).fill('empty');

  const label = played
    ? `Results: ${pluralise(stats.wins, 'win')}, ${pluralise(stats.losses, 'loss', 'losses')}, ${pluralise(stats.pushes, 'push', 'pushes')}`
    : 'No games played yet';

  return (
    <div className="result-bar" role="img" aria-label={label}>
      {blocks.map((kind, index) => (
        <span key={index} className={`result-bar__block result-bar__block--${kind}`} />
      ))}
    </div>
  );
}
