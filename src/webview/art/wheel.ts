import type { Palette } from './pixelRuns';

/**
 * Pixel-art roulette wheel for the lobby. Every frame is sampled per pixel (no anti-aliasing),
 * so spinning it frame by frame looks like a real 16-bit sprite animation.
 *
 * This is a stylised 16-pocket wheel for illustration. The exact 37-pocket European wheel
 * belongs to the roulette game screen.
 */
export const WHEEL_SIZE = 32;
export const WHEEL_FRAMES = 32;
const WHEEL_SLOTS = 16;

export const WHEEL_PALETTE: Palette = {
  y: '#f5c451', // gold rim, dividers, spokes, hub
  h: '#ffe08a', // hub highlight
  w: '#6b4423', // wooden bowl
  c: '#191d25', // cone
  r: '#e94b4b', // red pocket
  k: '#2c3240', // black pocket
  g: '#2fbf5a', // green pocket
  b: '#f2f0e8', // ball
};

/** The part of a theme's colors the wheel uses (`resolved.tokens` has them all). */
export interface WheelPaletteTheme {
  /** The rim, the dividers, the spokes and the hub. */
  readonly rim: string;
  /** The hub's highlight. */
  readonly rimLight: string;
  /** The wooden bowl. */
  readonly bowl: string;
}

const isHex = (value: string): boolean => /^#[0-9a-f]{6}$/i.test(value);

/**
 * The palette for a theme: its rim (`y`), hub highlight (`h`) and bowl (`w`). The pockets (`r`, `k`, `g`), the cone
 * and the ball keep their colors, because the red, black and green mean something in the game. A color that is not
 * `#rrggbb` is ignored, and in the classic theme this is exactly `WHEEL_PALETTE`.
 */
export function wheelPaletteFor(theme: WheelPaletteTheme): Palette {
  return {
    ...WHEEL_PALETTE,
    ...(isHex(theme.rim) ? { y: theme.rim } : {}),
    ...(isHex(theme.rimLight) ? { h: theme.rimLight } : {}),
    ...(isHex(theme.bowl) ? { w: theme.bowl } : {}),
  };
}

const TAU = Math.PI * 2;
const mod = (value: number, modulus: number): number => ((value % modulus) + modulus) % modulus;

/** One frame as ASCII rows. Frame `n` is the wheel turned by n / WHEEL_FRAMES of a full turn. */
export function wheelFrameRows(frame: number): string[] {
  const turn = (frame / WHEEL_FRAMES) * TAU;
  const slotAngle = TAU / WHEEL_SLOTS;
  const centre = WHEEL_SIZE / 2;

  // The ball spins against the wheel, twice as fast, and still loops after one full turn.
  const ballAngle = -2 * turn + 1;
  const ballX = centre + Math.cos(ballAngle) * 11;
  const ballY = centre + Math.sin(ballAngle) * 11;

  const rows: string[] = [];
  for (let y = 0; y < WHEEL_SIZE; y += 1) {
    let row = '';
    for (let x = 0; x < WHEEL_SIZE; x += 1) {
      const px = x + 0.5;
      const py = y + 0.5;
      const dx = px - centre;
      const dy = py - centre;
      const r = Math.hypot(dx, dy);
      const angle = mod(Math.atan2(dy, dx) - turn, TAU);

      if (r > 16) {
        row += '.';
      } else if (r > 15) {
        row += 'y';
      } else if (r > 13.5) {
        row += 'w';
      } else if (r > 8.5) {
        if (r > 9.5 && r < 12.5 && Math.hypot(px - ballX, py - ballY) < 1.2) {
          row += 'b';
          continue;
        }
        const slot = Math.floor(angle / slotAngle);
        const offset = angle - slot * slotAngle;
        const distanceToDivider = Math.min(offset, slotAngle - offset) * r;
        if (distanceToDivider < 0.5) row += 'y';
        else if (slot === 0) row += 'g';
        else row += slot % 2 === 0 ? 'r' : 'k';
      } else if (r > 3.5) {
        // Cone with four spokes that turn with the wheel.
        const quarter = Math.PI / 2;
        const offset = mod(angle, quarter);
        const distanceToSpoke = Math.min(offset, quarter - offset) * r;
        row += distanceToSpoke < 0.6 && r > 4.5 ? 'y' : 'c';
      } else {
        row += dx < -0.3 && dy < -0.3 ? 'h' : 'y';
      }
    }
    rows.push(row);
  }
  return rows;
}
