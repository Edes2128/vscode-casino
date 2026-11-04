import { describe, expect, it } from 'vitest';
import { POCKET_COUNT, POCKETS, WHEEL_ORDER } from '../../game/roulette/wheel';
import {
  POCKET_ANGLE,
  POCKET_RADIUS,
  POINTER_ANGLE,
  SPIN_DURATION_MS,
  TRACK_RADIUS,
  WHEEL_COLOURS,
  WHEEL_PIXELS,
  numberUnderPointer,
  planSpin,
  pocketUnderPointer,
  renderWheel,
  restingState,
  rotationForPocket,
  spinState,
  type WheelState,
} from './rouletteWheel';

const TAU = Math.PI * 2;
const mod = (value: number, modulus: number): number => ((value % modulus) + modulus) % modulus;

function render(state: WheelState): Uint8ClampedArray {
  const out = new Uint8ClampedArray(WHEEL_PIXELS * WHEEL_PIXELS * 4);
  renderWheel(state, out);
  return out;
}

/** The colour at a pixel as r,g,b (or "clear"). */
function pixel(buffer: Uint8ClampedArray, x: number, y: number): string {
  const o = (y * WHEEL_PIXELS + x) * 4;
  return buffer[o + 3] === 0 ? 'clear' : `${buffer[o]},${buffer[o + 1]},${buffer[o + 2]}`;
}

const rgb = (colour: readonly number[]): string => colour.join(',');

describe('where the wheel stops', () => {
  it('puts the chosen pocket exactly under the pointer, for all 37 pockets', () => {
    for (let index = 0; index < POCKET_COUNT; index += 1) {
      expect(pocketUnderPointer(rotationForPocket(index)), `pocket ${index}`).toBe(index);
      expect(numberUnderPointer(rotationForPocket(index))).toBe(WHEEL_ORDER[index]);
    }
  });

  it('lands on the chosen pocket after a spin from any starting position, for every pocket', () => {
    for (const start of [0, 0.3, 1, 2.5, 4, 5.9, 12.34, -3.2, 100]) {
      for (let index = 0; index < POCKET_COUNT; index += 1) {
        const plan = planSpin(start, index);
        expect(pocketUnderPointer(plan.endRotation), `start ${start}, pocket ${index}`).toBe(index);
        expect(numberUnderPointer(plan.endRotation)).toBe(WHEEL_ORDER[index]);
      }
    }
  });

  it('always turns the wheel forwards by at least the planned number of full turns', () => {
    for (let index = 0; index < POCKET_COUNT; index += 1) {
      const plan = planSpin(1.7, index, 4);
      expect(plan.endRotation - plan.startRotation).toBeGreaterThanOrEqual(4 * TAU);
      expect(plan.endRotation - plan.startRotation).toBeLessThan(5 * TAU);
    }
  });

  it('puts the ball in the middle of the chosen pocket, under the pointer, when the spin ends', () => {
    for (let index = 0; index < POCKET_COUNT; index += 1) {
      const plan = planSpin(0.9, index);
      const end = spinState(plan, index, plan.durationMs);
      expect(end.rotation).toBeCloseTo(plan.endRotation, 9);
      expect(end.ball?.radius).toBeCloseTo(POCKET_RADIUS, 9);
      // The ball's angle is the pointer's, to within a hair, modulo whole turns.
      const off = mod((end.ball?.angle ?? 0) - POINTER_ANGLE + Math.PI, TAU) - Math.PI;
      expect(Math.abs(off), `pocket ${index}`).toBeLessThan(1e-9);
    }
  });

  it('starts a new spin from where the last one stopped, so the wheel never jumps', () => {
    const first = planSpin(0, 5);
    const second = planSpin(first.endRotation, 20);
    expect(second.startRotation).toBe(first.endRotation);
    expect(spinState(second, 20, 0).rotation).toBeCloseTo(first.endRotation, 9);
  });
});

describe('the spin animation', () => {
  const plan = planSpin(0, 12);

  it('begins at the start rotation with the ball out on the rim', () => {
    const start = spinState(plan, 12, 0);
    expect(start.rotation).toBeCloseTo(0, 9);
    expect(start.ball?.radius).toBeCloseTo(TRACK_RADIUS, 9);
  });

  it('slows the wheel down: it never turns backwards and covers less ground each moment', () => {
    let previous = spinState(plan, 12, 0).rotation;
    let previousStep = Number.POSITIVE_INFINITY;
    for (let ms = 250; ms <= SPIN_DURATION_MS; ms += 250) {
      const rotation = spinState(plan, 12, ms).rotation;
      const step = rotation - previous;
      expect(step).toBeGreaterThanOrEqual(0);
      expect(step).toBeLessThanOrEqual(previousStep + 1e-9);
      previous = rotation;
      previousStep = step;
    }
  });

  it('whirls the ball the opposite way round at first, as on a real wheel', () => {
    const a = spinState(plan, 12, 100);
    const b = spinState(plan, 12, 300);
    const wheelTurned = b.rotation - a.rotation;
    const ballTurned = (b.ball?.angle ?? 0) - (a.ball?.angle ?? 0);
    expect(wheelTurned).toBeGreaterThan(0);
    expect(ballTurned).toBeLessThan(0);
  });

  it('brings the ball in from the rim to its pocket and never lets it go back out', () => {
    let previousRadius = Number.POSITIVE_INFINITY;
    for (let ms = 0; ms <= SPIN_DURATION_MS; ms += 100) {
      const radius = spinState(plan, 12, ms).ball?.radius ?? 0;
      expect(radius).toBeLessThanOrEqual(previousRadius + 1e-9);
      expect(radius).toBeGreaterThanOrEqual(POCKET_RADIUS - 1e-9);
      expect(radius).toBeLessThanOrEqual(TRACK_RADIUS + 1e-9);
      previousRadius = radius;
    }
  });

  it('stays put once the spin is over, however long it is asked about', () => {
    const end = spinState(plan, 12, SPIN_DURATION_MS);
    const later = spinState(plan, 12, SPIN_DURATION_MS * 10);
    expect(later.rotation).toBeCloseTo(end.rotation, 9);
    expect(later.ball?.angle).toBeCloseTo(end.ball?.angle ?? 0, 9);
  });

  it('keeps the ball moving smoothly: no frame-to-frame jump anywhere in the spin', () => {
    let previous = spinState(plan, 12, 0).ball?.angle ?? 0;
    for (let ms = 16; ms <= SPIN_DURATION_MS; ms += 16) {
      const angle = spinState(plan, 12, ms).ball?.angle ?? 0;
      expect(Math.abs(angle - previous), `at ${ms}ms`).toBeLessThan(1.1); // under 63 degrees per frame
      previous = angle;
    }
  });
});

describe('drawing the wheel', () => {
  const rest = restingState(undefined);
  const buffer = render(rest);

  it('is transparent outside the wheel and opaque inside', () => {
    expect(pixel(buffer, 0, 0)).toBe('clear');
    expect(pixel(buffer, WHEEL_PIXELS - 1, WHEEL_PIXELS - 1)).toBe('clear');
    expect(pixel(buffer, 32, 32)).not.toBe('clear');
  });

  it('draws a gold rim, a wooden bowl and a gold hub', () => {
    expect(pixel(buffer, 32, 0)).toBe(rgb(WHEEL_COLOURS.gold)); // top of the rim
    const centre = pixel(buffer, 32, 32);
    expect([rgb(WHEEL_COLOURS.gold), rgb(WHEEL_COLOURS.goldLight)]).toContain(centre);
  });

  it('uses only palette colours: nothing is anti-aliased or blended', () => {
    const palette = new Set<string>([...Object.values(WHEEL_COLOURS).map(rgb), 'clear']);
    for (let y = 0; y < WHEEL_PIXELS; y += 1) {
      for (let x = 0; x < WHEEL_PIXELS; x += 1) expect(palette.has(pixel(buffer, x, y)), `${x},${y}`).toBe(true);
    }
  });

  it('shows all three pocket colours on the wheel', () => {
    const seen = new Set<string>();
    for (let y = 0; y < WHEEL_PIXELS; y += 1) for (let x = 0; x < WHEEL_PIXELS; x += 1) seen.add(pixel(buffer, x, y));
    for (const colour of [WHEEL_COLOURS.red, WHEEL_COLOURS.black, WHEEL_COLOURS.green]) expect(seen.has(rgb(colour))).toBe(true);
  });

  it('shows the colour of the pocket under the pointer, for all 37 pockets', () => {
    // The pointer is straight up. A pixel on the pocket ring just below the top of the wheel, in the
    // middle of the pocket, must be that pocket's colour, so what you see matches what was chosen.
    const x = 32;
    const y = Math.round(CENTRE_Y - POCKET_RADIUS);
    for (let index = 0; index < POCKET_COUNT; index += 1) {
      const state = restingState(index);
      const colour = pixel(render({ rotation: state.rotation }), x, y);
      const wanted = POCKETS[index]?.color ?? 'red';
      expect(colour, `pocket ${index} (${WHEEL_ORDER[index]})`).toBe(rgb(WHEEL_COLOURS[wanted]));
    }
  });

  it('draws the ball, and only when there is one', () => {
    const withBall = render(restingState(0));
    const countBall = (b: Uint8ClampedArray) => {
      let n = 0;
      for (let y = 0; y < WHEEL_PIXELS; y += 1) for (let x = 0; x < WHEEL_PIXELS; x += 1) if (pixel(b, x, y) === rgb(WHEEL_COLOURS.ball)) n += 1;
      return n;
    };
    expect(countBall(withBall)).toBeGreaterThanOrEqual(2);
    expect(countBall(withBall)).toBeLessThanOrEqual(6);
    expect(countBall(buffer)).toBe(0);
  });

  it('is deterministic, and turning the wheel changes the picture', () => {
    expect(Array.from(render({ rotation: 1 }))).toEqual(Array.from(render({ rotation: 1 })));
    expect(Array.from(render({ rotation: 1 }))).not.toEqual(Array.from(render({ rotation: 1 + POCKET_ANGLE * 3 })));
  });

  it('draws the very same picture after a whole turn', () => {
    expect(Array.from(render({ rotation: 0.4 }))).toEqual(Array.from(render({ rotation: 0.4 + TAU })));
  });
});

const CENTRE_Y = WHEEL_PIXELS / 2;
