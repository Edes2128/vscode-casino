import { useMemo } from 'react';
import { CHIP_PALETTES, CHIP_ROWS_SMALL, tintChip } from '../art/chip';
import {
  backCardRows,
  CARD_PALETTE,
  faceCardRows,
  SPARKLE,
  TABLE_COLS,
  TABLE_ROWS,
  tableRows,
} from '../art/sprites';
import { lighten, parseHex, toHex } from '../color';
import { useAppearance } from '../customization/AppearanceContext';
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
  const { tokens } = useAppearance().resolved;
  // The table and its rail wear the theme: the felt, the rail, the gold line. The cards stay as cards are.
  const table = useMemo(() => {
    const felt = parseHex(tokens.felt);
    return {
      w: tokens.bowl,
      y: tokens.rim,
      f: tokens.felt,
      g: felt === undefined ? tokens.felt : toHex(lighten(felt, 0.1)),
    };
  }, [tokens.bowl, tokens.rim, tokens.felt]);
  const chip = (value: 10 | 25 | 50 | 100 | 500) => tintChip(CHIP_PALETTES[value], tokens.chip);

  return (
    <PixelScene cols={TABLE_COLS} rows={TABLE_ROWS} className="bj-art">
      <SceneSprite x={0} y={0} rows={TABLE} palette={table} />

      {/* Dealer, top left. */}
      <SceneSprite x={6} y={0} rows={CARD_BACK} palette={CARD_PALETTE} className="bj-art__card bj-art__card--1" />
      <SceneSprite x={12} y={1} rows={SPADE} palette={CARD_PALETTE} className="bj-art__card bj-art__card--2" />

      {/* Player, bottom right. */}
      <SceneSprite x={21} y={15} rows={HEART} palette={CARD_PALETTE} className="bj-art__card bj-art__card--3" />
      <SceneSprite x={27} y={16} rows={DIAMOND} palette={CARD_PALETTE} className="bj-art__card bj-art__card--4" />

      {/* The bet, top right. */}
      <SceneSprite x={34} y={8} rows={CHIP_ROWS_SMALL} palette={chip(50)} />
      <SceneSprite x={34} y={5} rows={CHIP_ROWS_SMALL} palette={chip(25)} />

      {/* The player's stack, bottom left. */}
      <SceneSprite x={7} y={21} rows={CHIP_ROWS_SMALL} palette={chip(500)} />
      <SceneSprite x={7} y={18} rows={CHIP_ROWS_SMALL} palette={chip(100)} />
      <SceneSprite x={7} y={15} rows={CHIP_ROWS_SMALL} palette={chip(10)} />
      <SceneSprite x={13} y={14} rows={SPARKLE.rows} palette={SPARKLE.palette} className="bj-art__sparkle" />
    </PixelScene>
  );
}
