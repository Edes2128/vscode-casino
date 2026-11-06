import type { BreakRoomSnapshot } from '../../state/types';
import { BalanceDisplay } from '../components/BalanceDisplay';
import { BlackjackArt } from '../components/BlackjackArt';
import { BreakRoomLogo } from '../components/BreakRoomLogo';
import { GameCard } from '../components/GameCard';
import { GameHistory } from '../components/GameHistory';
import { PixelCard } from '../components/PixelCard';
import { RouletteArt } from '../components/RouletteArt';
import { StatTile } from '../components/StatTile';
import type { Page } from '../navigation';

interface HomeProps {
  readonly snapshot: BreakRoomSnapshot;
  readonly onNavigate: (page: Page) => void;
}

/** Break Room Arcade lobby: logo, chips, the two games and the latest rounds. */
export function Home({ snapshot, onNavigate }: HomeProps) {
  const { overall } = snapshot.stats;

  return (
    <>
      <BreakRoomLogo />

      <PixelCard title="YOUR CHIPS" tone="gold">
        <BalanceDisplay balance={snapshot.balance} size="lg" />
        <dl className="stat-strip">
          <StatTile label="GAMES" value={overall.gamesPlayed} />
          <StatTile label="WINS" value={overall.wins} tone="win" />
          <StatTile label="LOSSES" value={overall.losses} tone="loss" />
        </dl>
      </PixelCard>

      <section className="lobby-games" aria-label="Games">
        <GameCard
          title="BLACKJACK"
          tagline="Beat the dealer to 21. Blackjack pays 3:2."
          tone="felt"
          art={<BlackjackArt />}
          onPlay={() => onNavigate('blackjack')}
        />
        <GameCard
          title="ROULETTE"
          tagline="Bet a color or a number. Numbers and green pay 35:1."
          tone="red"
          art={<RouletteArt />}
          onPlay={() => onNavigate('roulette')}
        />
      </section>

      <PixelCard title="RECENT GAMES">
        <GameHistory entries={snapshot.history} limit={5} />
      </PixelCard>
    </>
  );
}
