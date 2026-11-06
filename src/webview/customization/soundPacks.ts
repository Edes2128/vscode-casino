import type { SoundCategory, SoundPackId } from '../../state/appearance';

/** What the player reads about a sound pack. The sounds themselves are in `sound/packs.ts`. */
export interface SoundPackInfo {
  readonly id: SoundPackId;
  readonly name: string;
  /** One line: what it sounds like. Shown in capitals. */
  readonly blurb: string;
}

/** The five packs, in the order the Customize screen lists them. Every one is free. */
export const SOUND_PACK_CATALOG: readonly SoundPackInfo[] = [
  { id: 'classic', name: 'Classic Lounge', blurb: "Lucky Break's own clicks, chips and jingles." },
  { id: 'arcade', name: 'Retro Arcade', blurb: 'Chiptune blips and quick arpeggios.' },
  { id: 'adventure', name: 'Pixel Adventure', blurb: 'Bright bells and a little fanfare.' },
  { id: 'cyber', name: 'Neon Cyber', blurb: 'Detuned synth zaps and long sweeps.' },
  { id: 'minimal', name: 'Minimal Sounds', blurb: 'Tiny, soft ticks. Nothing busy.' },
];

export function soundPackInfo(id: SoundPackId): SoundPackInfo {
  return SOUND_PACK_CATALOG.find((pack) => pack.id === id) ?? (SOUND_PACK_CATALOG[0] as SoundPackInfo);
}

/** What the player reads about one group of sounds that can be switched on or off. */
export interface SoundCategoryInfo {
  /** Shown in capitals. */
  readonly label: string;
  readonly hint: string;
}

export const SOUND_CATEGORY_INFO: Readonly<Record<SoundCategory, SoundCategoryInfo>> = {
  interface: { label: 'Interface', hint: 'Buttons, menus and page changes.' },
  chips: { label: 'Chips', hint: 'Picking a chip for a bet.' },
  cards: { label: 'Cards', hint: 'Dealing cards and turning them over.' },
  roulette: { label: 'Roulette', hint: 'The wheel and the rattle of the ball.' },
  results: { label: 'Results', hint: 'Wins, losses, pushes and big wins.' },
};
