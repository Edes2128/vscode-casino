import { POCKET_COUNT, POCKETS, WHEEL_ORDER } from '../../game/roulette/wheel';
import type { RouletteColor } from '../../game/roulette/types';

/**
 * The roulette wheel for the game screen, drawn pixel by pixel from a rotation and a ball position.
 * Nothing here touches the DOM, so the maths (above all, where the wheel stops) can be tested.
 *
 * Angles are in radians, measured clockwise on screen from the east (the way `atan2` counts when y
 * points down). Pocket `i` of the wheel (see WHEEL_ORDER) is centred `i * POCKET_ANGLE` clockwise
 * from the wheel's own zero mark. The pointer is fixed at the top.
 */
export const WHEEL_PIXELS = 64;

const TAU = Math.PI * 2;
export const POCKET_ANGLE = TAU / POCKET_COUNT;
/** Where the pointer sits: straight up. */
export const POINTER_ANGLE = -Math.PI / 2;

const CENTRE = WHEEL_PIXELS / 2;

/** Radii, in pixels from the centre. */
const RIM_OUTER = 31.6; // a hair over 31.5, so the pixels on the edge rows (centres at 31.504) are part of the wheel
const RIM_INNER = 30.5;
const WOOD_INNER = 28.5;
export const TRACK_RADIUS = 27.4; // where the ball rides before it drops
const POCKET_OUTER = 26.5;
const POCKET_INNER = 20;
/** The middle of the pocket ring: where a ball rests. */
export const POCKET_RADIUS = (POCKET_OUTER + POCKET_INNER) / 2;
const CONE_INNER = 7;
const HUB = 5.5;

const mod = (value: number, modulus: number): number => ((value % modulus) + modulus) % modulus;

// ---------------------------------------------------------------- where the wheel stops

/** Which pocket (an index into WHEEL_ORDER) is under the pointer when the wheel is turned by `rotation`. */
export function pocketUnderPointer(rotation: number): number {
  return Math.round(mod(POINTER_ANGLE - rotation, TAU) / POCKET_ANGLE) % POCKET_COUNT;
}

/** The number under the pointer for a rotation. */
export const numberUnderPointer = (rotation: number): number => WHEEL_ORDER[pocketUnderPointer(rotation)] ?? 0;

/** The rotation (0 to 2 pi) that puts pocket `index` under the pointer. */
export function rotationForPocket(index: number): number {
  return mod(POINTER_ANGLE - index * POCKET_ANGLE, TAU);
}

export interface SpinPlan {
  readonly startRotation: number;
  /** Where the wheel stops: always with the chosen pocket exactly under the pointer. */
  readonly endRotation: number;
  /** How many turns (relative to the wheel) the ball makes before it settles. */
  readonly ballTurns: number;
  readonly durationMs: number;
}

export const SPIN_DURATION_MS = 5_500;

/**
 * Plans a spin that ends with pocket `pocketIndex` under the pointer. The wheel always turns the
 * same way and at least `wheelTurns` full turns, starting from wherever it last stopped.
 */
export function planSpin(startRotation: number, pocketIndex: number, wheelTurns = 4, ballTurns = 14): SpinPlan {
  const forward = mod(rotationForPocket(pocketIndex) - startRotation, TAU);
  return {
    startRotation,
    endRotation: startRotation + wheelTurns * TAU + forward,
    ballTurns,
    durationMs: SPIN_DURATION_MS,
  };
}

// ---------------------------------------------------------------- the animation

export interface WheelState {
  readonly rotation: number;
  readonly ball?: { readonly angle: number; readonly radius: number };
}

const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;
const easeOutQuad = (t: number): number => 1 - (1 - t) ** 2;
const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

/**
 * The wheel and ball `elapsedMs` into a spin. The wheel slows to a stop. The ball whirls the other
 * way round the rim, slows, drops into the pocket and rides with the wheel. At the end the ball
 * sits in the middle of the chosen pocket, which is under the pointer.
 */
export function spinState(plan: SpinPlan, pocketIndex: number, elapsedMs: number): WheelState {
  const t = clamp01(elapsedMs / plan.durationMs);
  const rotation = plan.startRotation + (plan.endRotation - plan.startRotation) * easeOutCubic(t);

  // The ball starts well ahead of its pocket (in the wheel's own frame) and closes in as time runs out.
  const ahead = plan.ballTurns * TAU * (1 - easeOutQuad(t));
  const drop = clamp01(ahead / (1.2 * TAU)); // 1 while it is still circling, 0 once it has dropped
  const radius = POCKET_RADIUS + (TRACK_RADIUS - POCKET_RADIUS) * (drop * drop * (3 - 2 * drop));

  return { rotation, ball: { angle: rotation + pocketIndex * POCKET_ANGLE + ahead, radius } };
}

/** The wheel at rest with the ball in pocket `pocketIndex`, under the pointer. */
export function restingState(pocketIndex: number | undefined): WheelState {
  if (pocketIndex === undefined) return { rotation: 0 };
  const rotation = rotationForPocket(pocketIndex);
  return { rotation, ball: { angle: rotation + pocketIndex * POCKET_ANGLE, radius: POCKET_RADIUS } };
}

// ---------------------------------------------------------------- drawing

export const WHEEL_COLOURS = {
  gold: [245, 196, 81],
  goldLight: [255, 224, 138],
  wood: [107, 68, 35],
  woodDark: [74, 46, 24],
  track: [25, 29, 37],
  cone: [34, 38, 48],
  red: [233, 75, 75],
  black: [44, 50, 64],
  green: [47, 191, 90],
  ball: [242, 240, 232],
  ballShade: [146, 153, 166],
} as const satisfies Record<string, readonly [number, number, number]>;

const POCKET_COLOUR: Readonly<Record<RouletteColor, readonly [number, number, number]>> = {
  red: WHEEL_COLOURS.red,
  black: WHEEL_COLOURS.black,
  green: WHEEL_COLOURS.green,
};

/** What never changes between frames: how far each pixel is from the centre, and in which direction. */
const RADIUS = new Float32Array(WHEEL_PIXELS * WHEEL_PIXELS);
const ANGLE = new Float32Array(WHEEL_PIXELS * WHEEL_PIXELS);
for (let y = 0; y < WHEEL_PIXELS; y += 1) {
  for (let x = 0; x < WHEEL_PIXELS; x += 1) {
    const dx = x + 0.5 - CENTRE;
    const dy = y + 0.5 - CENTRE;
    RADIUS[y * WHEEL_PIXELS + x] = Math.hypot(dx, dy);
    ANGLE[y * WHEEL_PIXELS + x] = Math.atan2(dy, dx);
  }
}

type Rgb = readonly [number, number, number];

/** The colour of one wheel pixel, or `undefined` outside the wheel. */
function wheelPixel(radius: number, angle: number, rotation: number): Rgb | undefined {
  if (radius > RIM_OUTER) return undefined;
  if (radius > RIM_INNER) return WHEEL_COLOURS.gold;
  if (radius > WOOD_INNER) return radius > 29.5 ? WHEEL_COLOURS.wood : WHEEL_COLOURS.woodDark;
  if (radius > POCKET_OUTER) return WHEEL_COLOURS.track;

  if (radius > POCKET_INNER) {
    // Which pocket is here? The wheel's own angle is the screen angle minus the rotation.
    const local = mod(angle - rotation + POCKET_ANGLE / 2, TAU);
    const index = Math.floor(local / POCKET_ANGLE) % POCKET_COUNT;
    const offset = local - Math.floor(local / POCKET_ANGLE) * POCKET_ANGLE;
    const distanceToDivider = Math.min(offset, POCKET_ANGLE - offset) * radius;
    if (distanceToDivider < 0.45) return WHEEL_COLOURS.gold;
    const pocket = POCKETS[index];
    return pocket === undefined ? WHEEL_COLOURS.track : POCKET_COLOUR[pocket.color];
  }

  if (radius > POCKET_INNER - 1) return WHEEL_COLOURS.gold;
  if (radius > CONE_INNER) {
    // Four spokes that turn with the wheel.
    const quarter = Math.PI / 2;
    const offset = mod(angle - rotation, quarter);
    const distanceToSpoke = Math.min(offset, quarter - offset) * radius;
    return distanceToSpoke < 0.7 && radius > 9 ? WHEEL_COLOURS.gold : WHEEL_COLOURS.cone;
  }
  if (radius > HUB) return WHEEL_COLOURS.woodDark;
  return angle < -0.4 && angle > -2.7 ? WHEEL_COLOURS.goldLight : WHEEL_COLOURS.gold;
}

/**
 * Fills `out` (WHEEL_PIXELS squared RGBA pixels) with the wheel in `state`. Pixels outside the wheel
 * are fully transparent, and nothing is anti-aliased: every pixel is exactly one palette colour.
 */
export function renderWheel(state: WheelState, out: Uint8ClampedArray): void {
  const ball = state.ball;
  const ballX = ball === undefined ? 0 : CENTRE + Math.cos(ball.angle) * ball.radius;
  const ballY = ball === undefined ? 0 : CENTRE + Math.sin(ball.angle) * ball.radius;

  for (let y = 0; y < WHEEL_PIXELS; y += 1) {
    for (let x = 0; x < WHEEL_PIXELS; x += 1) {
      const i = y * WHEEL_PIXELS + x;
      let colour = wheelPixel(RADIUS[i] ?? 0, ANGLE[i] ?? 0, state.rotation);

      if (colour !== undefined && ball !== undefined) {
        const distance = Math.hypot(x + 0.5 - ballX, y + 0.5 - ballY);
        if (distance < 1.35) colour = distance < 0.95 ? WHEEL_COLOURS.ball : WHEEL_COLOURS.ballShade;
      }

      const o = i * 4;
      out[o] = colour?.[0] ?? 0;
      out[o + 1] = colour?.[1] ?? 0;
      out[o + 2] = colour?.[2] ?? 0;
      out[o + 3] = colour === undefined ? 0 : 255;
    }
  }
}
