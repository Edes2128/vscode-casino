import type { ColorSlot, CustomColors } from '../../casino/appearance';

export interface ColorPreset {
  readonly id: string;
  readonly name: string;
  readonly colors: CustomColors;
}

/** Ready-made sets of colors. A preset replaces the player's colors; the theme underneath stays. */
export const COLOR_PRESETS: readonly ColorPreset[] = [
  { id: 'green', name: 'Lucky Green', colors: { table: '#1d6b45', accent: '#7dff8a', button: '#7dff8a', chip: '#f5c451' } },
  { id: 'ocean', name: 'Ocean', colors: { table: '#14507a', background: '#06131f', accent: '#59d4ff', button: '#59d4ff', chip: '#e8f7ff' } },
  { id: 'sunset', name: 'Sunset', colors: { table: '#7a2e3a', background: '#1c0b12', accent: '#ff9a4d', button: '#ff9a4d', chip: '#ffd27a' } },
  { id: 'grape', name: 'Grape', colors: { table: '#4a2a7a', background: '#150b26', accent: '#c79bff', button: '#c79bff', chip: '#ffe58a' } },
  { id: 'ice', name: 'Ice', colors: { table: '#2a5f6b', background: '#0b1519', accent: '#a8f0ff', button: '#a8f0ff', text: '#ffffff', chip: '#a8f0ff' } },
  { id: 'mono', name: 'Mono', colors: { table: '#2f3338', background: '#0e0f10', accent: '#ffffff', button: '#d0d0d0', text: '#ffffff', chip: '#d0d0d0' } },
];

/** What each slot is for, in the words the screen uses. */
export const COLOR_SLOT_INFO: Readonly<Record<ColorSlot, { readonly label: string; readonly hint: string }>> = {
  table: { label: 'TABLE', hint: 'The felt of the tables.' },
  background: { label: 'BACKGROUND', hint: 'The page behind everything.' },
  accent: { label: 'ACCENT', hint: 'Titles and the active tab.' },
  button: { label: 'MAIN BUTTON', hint: 'DEAL, SPIN and the other main buttons.' },
  text: { label: 'TEXT', hint: 'The main text. It is kept readable on every surface.' },
  chip: { label: 'CHIPS', hint: 'The stripes and rings on every chip.' },
};

/** `#rrggbb` from what a person types: `#1A2B3C`, `1a2b3c` and `#abc` all work. `undefined` when it is not a color. */
export function normalizeHex(input: string): string | undefined {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(input.trim());
  if (match === null) return undefined;
  const digits = (match[1] ?? '').toLowerCase();
  return `#${digits.length === 3 ? [...digits].map((digit) => digit + digit).join('') : digits}`;
}
