import { CHIP_PALETTES, CHIP_ROWS_SMALL } from '../art/chip';
import {
  backCardRows,
  CARD_PALETTE,
  faceCardRows,
  SPARKLE,
  TABLE_COLS,
  TABLE_PALETTE,
  TABLE_ROWS,
  tableRows,
} from '../art/sprites';
import { PixelScene, SceneSprite } from './PixelScene';

const TABLE = tableRows();
const CARD_BACK = backCardRows();
const SPADE = faceCardRows('spade');
const HEART = faceCardRows('heart');
const DIAMOND = faceCardRows('diamond');

/**
 * Felt table seen from above. The two hands sit in opposite corners, the dealer's with one card
 * face down, so the felt stays visible between them.
 */
export function BlackjackArt() {
  return (
    <PixelScene cols={TABLE_COLS} rows={TABLE_ROWS} className="bj-art">
      <SceneSprite x={0} y={0} rows={TABLE} palette={TABLE_PALETTE} />

      {/* Dealer, top left. */}
      <SceneSprite x={6} y={0} rows={CARD_BACK} palette={CARD_PALETTE} className="bj-art__card bj-art__card--1" />
      <SceneSprite x={12} y={1} rows={SPADE} palette={CARD_PALETTE} className="bj-art__card bj-art__card--2" />

      {/* Player, bottom right. */}
      <SceneSprite x={21} y={15} rows={HEART} palette={CARD_PALETTE} className="bj-art__card bj-art__card--3" />
      <SceneSprite x={27} y={16} rows={DIAMOND} palette={CARD_PALETTE} className="bj-art__card bj-art__card--4" />

      {/* The bet, top right. */}
      <SceneSprite x={34} y={8} rows={CHIP_ROWS_SMALL} palette={CHIP_PALETTES[50]} />
      <SceneSprite x={34} y={5} rows={CHIP_ROWS_SMALL} palette={CHIP_PALETTES[25]} />

      {/* The player's stack, bottom left. */}
      <SceneSprite x={7} y={21} rows={CHIP_ROWS_SMALL} palette={CHIP_PALETTES[500]} />
      <SceneSprite x={7} y={18} rows={CHIP_ROWS_SMALL} palette={CHIP_PALETTES[100]} />
      <SceneSprite x={7} y={15} rows={CHIP_ROWS_SMALL} palette={CHIP_PALETTES[10]} />
      <SceneSprite x={13} y={14} rows={SPARKLE.rows} palette={SPARKLE.palette} className="bj-art__sparkle" />
    </PixelScene>
  );
}
