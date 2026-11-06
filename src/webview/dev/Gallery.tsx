/**
 * Living style guide: every design-system component in every state.
 * Dev server only (`npm run dev:webview`, then open `/?gallery`); never part of the production bundle.
 */
import { useState } from 'react';
import { CHIP_VALUES, type ChipValue } from '../../state/chips';
import { backCardRows, CARD_PALETTE, CARDS_ICON, COIN, DIE, DIE_SIX, faceCardRows, HOME_ICON, ICON_PALETTE, SPARKLE, WHEEL_ICON } from '../art/sprites';
import { BalanceDisplay } from '../components/BalanceDisplay';
import { BlackjackArt } from '../components/BlackjackArt';
import { GameCard } from '../components/GameCard';
import { GameHistory } from '../components/GameHistory';
import { PixelButton, type ButtonSize, type ButtonVariant } from '../components/PixelButton';
import { PixelCard, type CardTone } from '../components/PixelCard';
import { PixelChip } from '../components/PixelChip';
import { PixelSprite } from '../components/PixelSprite';
import { RouletteArt } from '../components/RouletteArt';
import { StatTile } from '../components/StatTile';
import { sampleHistory } from './sampleSnapshot';
import './gallery.css';

const VARIANTS: readonly ButtonVariant[] = ['primary', 'gold', 'danger', 'ghost'];
const SIZES: readonly ButtonSize[] = ['sm', 'md', 'lg'];
const TONES: readonly CardTone[] = ['neutral', 'neon', 'gold', 'red', 'felt'];
const PALETTE_SWATCHES: ReadonlyArray<readonly [name: string, token: string, dark: boolean]> = [
  ['bg', '--c-bg', false],
  ['bg-2', '--c-bg-2', false],
  ['felt', '--c-felt', false],
  ['neon', '--c-neon', true],
  ['gold', '--c-gold', true],
  ['red', '--c-red', true],
  ['white', '--c-white', true],
  ['muted', '--c-muted', true],
];

export function Gallery() {
  const [chip, setChip] = useState<ChipValue>(25);

  return (
    <main className="gallery">
      <h1 className="game-shell__title">DESIGN GALLERY</h1>
      <p className="gallery__note">Dev only. Every component, every state.</p>

      <PixelCard title="PALETTE">
        <div className="gallery__row">
          {PALETTE_SWATCHES.map(([name, token, dark]) => (
            <span
              key={name}
              className="gallery__swatch px-frame"
              style={{ background: `var(${token})`, color: dark ? 'var(--c-bg)' : 'var(--c-white)' }}
            >
              {name}
            </span>
          ))}
        </div>
      </PixelCard>

      <PixelCard title="BUTTONS">
        {VARIANTS.map((variant) => (
          <div key={variant} className="gallery__row">
            {SIZES.map((size) => (
              <PixelButton key={size} variant={variant} size={size}>
                {variant} {size}
              </PixelButton>
            ))}
            <PixelButton variant={variant} disabled>
              disabled
            </PixelButton>
          </div>
        ))}
        <PixelButton block variant="gold">
          block
        </PixelButton>
      </PixelCard>

      <PixelCard title="CHIPS">
        <div className="gallery__row">
          <span className="gallery__label">decoration: sm, md, lg</span>
          {CHIP_VALUES.map((value) => (
            <PixelChip key={value} value={value} size="sm" />
          ))}
        </div>
        <div className="gallery__row">
          {CHIP_VALUES.map((value) => (
            <PixelChip key={value} value={value} />
          ))}
        </div>
        <div className="gallery__row">
          {CHIP_VALUES.map((value) => (
            <PixelChip key={value} value={value} size="lg" />
          ))}
        </div>
        <div className="gallery__row">
          <span className="gallery__label">selectable (picked: {chip})</span>
          {CHIP_VALUES.map((value) => (
            <PixelChip key={value} value={value} size="lg" selected={value === chip} onSelect={setChip} />
          ))}
          <PixelChip value={10} size="lg" disabled onSelect={() => undefined} />
        </div>
      </PixelCard>

      <PixelCard title="BALANCE AND STATS" tone="gold">
        <div className="gallery__row">
          <BalanceDisplay balance={1725} />
          <BalanceDisplay balance={undefined} />
          <BalanceDisplay balance={1_234_567} size="lg" />
        </div>
        <dl className="stat-strip">
          <StatTile label="GAMES" value={12} />
          <StatTile label="WINS" value={6} tone="win" />
          <StatTile label="LOSSES" value={5} tone="loss" />
        </dl>
      </PixelCard>

      <div className="gallery__row">
        {TONES.map((tone) => (
          <PixelCard key={tone} title={tone.toUpperCase()} tone={tone}>
            <p>Card tone</p>
          </PixelCard>
        ))}
      </div>

      <PixelCard title="SPRITES">
        <div className="gallery__row">
          <PixelSprite rows={DIE.rows} palette={DIE.palette} />
          <PixelSprite rows={DIE_SIX.rows} palette={DIE_SIX.palette} />
          <PixelSprite rows={COIN.rows} palette={COIN.palette} />
          <PixelSprite rows={SPARKLE.rows} palette={SPARKLE.palette} />
          <PixelSprite rows={faceCardRows('spade')} palette={CARD_PALETTE} />
          <PixelSprite rows={faceCardRows('heart')} palette={CARD_PALETTE} />
          <PixelSprite rows={faceCardRows('diamond')} palette={CARD_PALETTE} />
          <PixelSprite rows={backCardRows()} palette={CARD_PALETTE} />
        </div>
        <div className="gallery__row">
          {[HOME_ICON, CARDS_ICON, WHEEL_ICON].map((icon, index) => (
            <PixelSprite key={index} rows={icon} palette={ICON_PALETTE} />
          ))}
        </div>
      </PixelCard>

      <div className="lobby-games">
        <GameCard title="BLACKJACK" tagline="Beat the dealer to 21. Blackjack pays 3:2." tone="felt" art={<BlackjackArt />} onPlay={() => undefined} />
        <GameCard title="ROULETTE" tagline="Bet red, black or green. Green pays 35:1." tone="red" art={<RouletteArt />} onPlay={() => undefined} />
      </div>

      <PixelCard title="HISTORY">
        <GameHistory entries={sampleHistory} />
      </PixelCard>
      <PixelCard title="HISTORY (EMPTY)">
        <GameHistory entries={[]} />
      </PixelCard>
    </main>
  );
}
