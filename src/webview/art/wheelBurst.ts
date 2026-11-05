/**
 * The burst of pixels that Pixel Explosion throws out when the ball lands. It is only the layout of the dots:
 * where each one flies to, when it leaves, how big it is. Distances are in wheel pixels (the wheel is 64 across),
 * so the burst grows and shrinks with the wheel and its pixels line up with the wheel's own.
 *
 * Positions come from a formula, not from randomness, so a render is repeatable and a test can check it.
 */

/** Which theme colour a dot is painted with. */
export type BurstTint = 'rim' | 'light' | 'neon' | 'white';

export interface BurstDot {
  /** Where the dot ends up, from the ball, in wheel pixels (whole ones). */
  readonly dx: number;
  readonly dy: number;
  readonly delayMs: number;
  /** Side of the square, in wheel pixels. */
  readonly size: number;
  readonly tint: BurstTint;
}

const TINTS: readonly BurstTint[] = ['rim', 'light', 'neon', 'white'];
const GOLDEN_ANGLE = 2.399963229728653;

/** How near and how far, in wheel pixels, a dot can end up from the ball. */
export const BURST_MIN_DISTANCE = 6;
export const BURST_MAX_DISTANCE = 28;
/** The burst is wider than it is tall, and what flies up (out over the rim, where the ball lands) goes less far. */
export const BURST_SQUASH = 0.85;
export const BURST_UP = 0.55;
/** The longest delay before a dot leaves, in milliseconds. */
export const BURST_MAX_DELAY_MS = 120;

export function wheelBurstDots(count: number): readonly BurstDot[] {
  return Array.from({ length: Math.max(0, Math.floor(count)) }, (_, index) => {
    const angle = index * GOLDEN_ANGLE;
    const distance = BURST_MIN_DISTANCE + ((index * 37) % (BURST_MAX_DISTANCE - BURST_MIN_DISTANCE + 1));
    const dy = Math.sin(angle) * distance * BURST_SQUASH;
    return {
      dx: Math.round(Math.cos(angle) * distance),
      dy: Math.round(dy < 0 ? dy * BURST_UP : dy),
      delayMs: (index % 5) * (BURST_MAX_DELAY_MS / 4),
      size: index % 4 === 0 ? 3 : 2,
      tint: TINTS[index % TINTS.length] ?? 'rim',
    };
  });
}
