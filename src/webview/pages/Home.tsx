import type { CasinoSnapshot } from '../../casino/types';
import { BalanceDisplay } from '../components/BalanceDisplay';
import { BlackjackArt } from '../components/BlackjackArt';
import { CasinoLogo } from '../components/CasinoLogo';
import { GameCard } from '../components/GameCard';
import { GameHistory } from '../components/GameHistory';
import { PixelCard } from '../components/PixelCard';
import { RouletteArt } from '../components/RouletteArt';
import { StatTile } from '../components/StatTile';
import type { Page } from '../navigation';

interface HomeProps {
  readonly snapshot: CasinoSnapshot;
  readonly onNavigate: (page: Page) => void;
}

/** The casino lobby: logo, chips, the two games and the latest rounds. */
export function Home({ snapshot, onNavigate }: HomeProps) {
  const { overall } = snapshot.stats;

  return (
    <>
      <CasinoLogo />

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
