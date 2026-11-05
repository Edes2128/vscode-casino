import type { RouletteAnimationId } from '../../casino/appearance';
import { POCKET_COUNT, POCKETS, WHEEL_ORDER } from '../../game/roulette/wheel';
import { parseHex } from '../color';
import { rouletteAnimation, type BallSettle, type RouletteAnimationStyle, type WheelEffect } from '../customization/rouletteAnimations';
import type { MotionLevel } from '../motion';

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
  /** The animation style the spin was planned with. It shapes the motion; it never decides where the wheel stops. */
  readonly style: RouletteAnimationStyle;
}

/** How long the classic spin takes. Every style has its own duration (see `rouletteAnimations.ts`). */
export const SPIN_DURATION_MS = rouletteAnimation('classic').durationMs;

/** In calm mode the wheel does not turn: it stays still this long, then shows where the ball landed. */
export const CALM_PAUSE_MS = 900;

/**
 * Plans a spin that ends with pocket `pocketIndex` under the pointer. The wheel always turns the same way
 * and at least the style's number of full turns, starting from wherever it last stopped. The style (an id or
 * a style) only sets how long it takes and how it looks on the way: the landing is worked out from the pocket.
 */
export function planSpin(
  startRotation: number,
  pocketIndex: number,
  style: RouletteAnimationId | RouletteAnimationStyle = 'classic',
): SpinPlan {
  const chosen = typeof style === 'string' ? rouletteAnimation(style) : style;
  const forward = mod(rotationForPocket(pocketIndex) - startRotation, TAU);
  return {
    startRotation,
    endRotation: startRotation + chosen.wheelTurns * TAU + forward,
    ballTurns: chosen.ballTurns,
    durationMs: chosen.durationMs,
    style: chosen,
  };
}

/** What the wheel does at a motion level. */
export type WheelMotion =
  /** The wheel turns for `durationMs`, with the style's effect. */
  | { readonly kind: 'turn'; readonly durationMs: number; readonly effect: WheelEffect }
  /** The wheel stays still for `durationMs` and then shows the result. No movement, no effect. */
  | { readonly kind: 'pause'; readonly durationMs: number; readonly effect: 'none' }
  /** The wheel shows the result at once. */
  | { readonly kind: 'jump'; readonly durationMs: 0; readonly effect: 'none' };

/**
 * Styles only add motion in full. Calm waits and then shows the result, and off shows it at once, whatever the
 * style: no turning, no glow, no burst.
 */
export function wheelMotion(motion: MotionLevel, style: RouletteAnimationStyle): WheelMotion {
  if (motion === 'full') return { kind: 'turn', durationMs: style.durationMs, effect: style.effect };
  if (motion === 'calm') return { kind: 'pause', durationMs: CALM_PAUSE_MS, effect: 'none' };
  return { kind: 'jump', durationMs: 0, effect: 'none' };
}

// ---------------------------------------------------------------- the animation

/** One dot of the glowing trail behind the ball. `level` 0 is the brightest, next to the ball. */
export interface TrailDot {
  readonly angle: number;
  readonly radius: number;
  readonly level: 0 | 1 | 2;
}

export interface WheelState {
  readonly rotation: number;
  readonly ball?: { readonly angle: number; readonly radius: number };
  /** A glow around the ball (Neon Spin), only while it is going round. */
  readonly glow?: boolean;
  /** The trail behind the ball (Neon Spin), brightest dot first. */
  readonly trail?: readonly TrailDot[];
}

const easeOut = (t: number, exponent: number): number => 1 - (1 - t) ** exponent;
const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

/**
 * How far the ball is lifted out of its pocket and pushed to the side by the bounce, at progress `t` of the
 * whole spin. Both are exactly 0 until the bounce starts and from the end of the spin on, so a bounce can never
 * move where the ball comes to rest.
 */
function settleOffsets(settle: BallSettle, t: number): { readonly hop: number; readonly rock: number } {
  const start = 1 - settle.fraction;
  if (t <= start || t >= 1) return { hop: 0, rock: 0 };
  const u = Math.min(1, (t - start) / settle.fraction);
  const fade = (1 - u) ** 2; // each hop is lower than the one before
  const wave = Math.sin(settle.bounces * Math.PI * u);
  return { hop: settle.hop * Math.abs(wave) * fade, rock: settle.rock * wave * fade };
}

/** The wheel and the ball at progress `t` (0 to 1) of a spin. */
function stateAt(plan: SpinPlan, pocketIndex: number, t: number): { rotation: number; angle: number; radius: number } {
  const { style } = plan;
  const rotation = plan.startRotation + (plan.endRotation - plan.startRotation) * easeOut(t, style.wheelEase);

  // The ball starts well ahead of its pocket (in the wheel's own frame) and closes in as time runs out.
  let ahead = plan.ballTurns * TAU * (1 - easeOut(t, style.ballEase));
  const drop = clamp01(ahead / (1.2 * TAU)); // 1 while it is still circling, 0 once it has dropped
  let radius = POCKET_RADIUS + (TRACK_RADIUS - POCKET_RADIUS) * (drop * drop * (3 - 2 * drop));

  if (style.settle !== undefined) {
    const { hop, rock } = settleOffsets(style.settle, t);
    ahead += rock;
    radius = Math.min(TRACK_RADIUS, radius + hop);
  }
  return { rotation, angle: rotation + pocketIndex * POCKET_ANGLE + ahead, radius };
}

/** How far back, in milliseconds, the ball's speed is measured for the trail. */
const TRAIL_PROBE_MS = 16;
/** The angle between two dots of the trail, in radians. */
const TRAIL_STEP = 0.075;
/** The trail is this many frames of the ball's movement long. */
const TRAIL_FRAMES = 4.5;

/** The dots behind the ball, as long as the ball is fast. They follow the ball round the rim. */
function trailOf(
  plan: SpinPlan,
  pocketIndex: number,
  elapsedMs: number,
  now: { readonly angle: number; readonly radius: number },
): TrailDot[] {
  const earlier = stateAt(plan, pocketIndex, clamp01((elapsedMs - TRAIL_PROBE_MS) / plan.durationMs));
  const moved = earlier.angle - now.angle; // positive: the ball is going towards smaller angles
  const count = Math.min(plan.style.effectSize, Math.round((Math.abs(moved) / TRAIL_STEP) * TRAIL_FRAMES));
  const behind = moved >= 0 ? 1 : -1;
  const dots: TrailDot[] = [];
  for (let k = 1; k <= count; k += 1) {
    dots.push({
      angle: now.angle + behind * k * TRAIL_STEP,
      radius: now.radius + (earlier.radius - now.radius) * (k / count),
      level: k <= count / 3 ? 0 : k <= (count * 2) / 3 ? 1 : 2,
    });
  }
  return dots;
}

/**
 * The wheel and ball `elapsedMs` into a spin. The wheel slows to a stop. The ball whirls the other
 * way round the rim, slows, drops into the pocket and rides with the wheel (in some styles it bounces a little
 * first). At the end the ball sits in the middle of the chosen pocket, which is under the pointer.
 */
export function spinState(plan: SpinPlan, pocketIndex: number, elapsedMs: number): WheelState {
  const t = clamp01(elapsedMs / plan.durationMs);
  const now = stateAt(plan, pocketIndex, t);
  const state: WheelState = { rotation: now.rotation, ball: { angle: now.angle, radius: now.radius } };
  // The glow lives only while the ball is going round: the first and the last picture have none.
  if (plan.style.effect !== 'trail' || t <= 0 || t >= 1) return state;
  return { ...state, glow: true, trail: trailOf(plan, pocketIndex, elapsedMs, now) };
}

/** The wheel at rest with the ball in pocket `pocketIndex`, under the pointer. */
export function restingState(pocketIndex: number | undefined): WheelState {
  if (pocketIndex === undefined) return { rotation: 0 };
  const rotation = rotationForPocket(pocketIndex);
  return { rotation, ball: { angle: rotation + pocketIndex * POCKET_ANGLE, radius: POCKET_RADIUS } };
}

/** The pocket the thumbnails of the styles show the ball over. */
const THUMBNAIL_POCKET = 12;

/**
 * A still picture of a style, for the choice card: the ball whirling round the rim (with the glowing trail, for the
 * style that has one), or, for the style whose effect is at the landing, the wheel at rest with the ball in place.
 */
export function thumbnailState(style: RouletteAnimationStyle): WheelState {
  if (style.effect === 'burst') return restingState(THUMBNAIL_POCKET);
  const plan = planSpin(0, THUMBNAIL_POCKET, style);
  return spinState(plan, THUMBNAIL_POCKET, plan.durationMs * 0.4);
}

// ---------------------------------------------------------------- drawing

type Rgb = readonly [number, number, number];

const mixRgb = (from: Rgb, to: Rgb, amount: number): Rgb => [
  Math.round(from[0] + (to[0] - from[0]) * amount),
  Math.round(from[1] + (to[1] - from[1]) * amount),
  Math.round(from[2] + (to[2] - from[2]) * amount),
];

/** The three shades of a glow: bright next to the ball, then the colour itself, then a faint one. */
const glowOf = (colour: Rgb): { readonly glow: Rgb; readonly glowMid: Rgb; readonly glowDim: Rgb } => ({
  glow: mixRgb(colour, [255, 255, 255], 0.45),
  glowMid: colour,
  glowDim: mixRgb(colour, [16, 18, 22], 0.6),
});

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
  // The glow of Neon Spin, in the classic theme's accent. Only drawn while that style's ball is going round.
  ...glowOf([101, 229, 114]),
} as const satisfies Record<string, Rgb>;

/** Every colour the wheel is drawn with. The pocket colours (red, black, green) are the game's meaning and never change. */
export type WheelColours = Readonly<Record<keyof typeof WHEEL_COLOURS, Rgb>>;

/** The part of a theme's colours that the wheel uses (`resolved.tokens` has them all). */
export interface WheelTheme {
  /** The rim, the dividers and the spokes. */
  readonly rim: string;
  /** The hub's highlight. */
  readonly rimLight: string;
  /** The bowl. */
  readonly bowl: string;
  /** The accent, for the glow of Neon Spin. */
  readonly neon: string;
}

const sameRgb = (a: Rgb, b: Rgb): boolean => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

/**
 * The wheel's colours for a theme: its rim, hub highlight and bowl, and its accent for the glow. The pockets
 * keep their colours. In the classic theme this is exactly `WHEEL_COLOURS`, so the wheel looks as it always did.
 */
export function wheelColoursFor(theme: WheelTheme): WheelColours {
  const rim = parseHex(theme.rim) ?? WHEEL_COLOURS.gold;
  const rimLight = parseHex(theme.rimLight) ?? WHEEL_COLOURS.goldLight;
  const bowl = parseHex(theme.bowl) ?? WHEEL_COLOURS.wood;
  const neon = parseHex(theme.neon);
  return {
    ...WHEEL_COLOURS,
    gold: rim,
    goldLight: rimLight,
    wood: bowl,
    // The thin dark ring inside the bowl: the classic bowl keeps its hand-picked shade, any other is darkened.
    woodDark: sameRgb(bowl, WHEEL_COLOURS.wood) ? WHEEL_COLOURS.woodDark : mixRgb(bowl, [0, 0, 0], 0.31),
    ...(neon === undefined ? {} : glowOf(neon)),
  };
}

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

/** The colour of one wheel pixel, or `undefined` outside the wheel. */
function wheelPixel(radius: number, angle: number, rotation: number, colours: WheelColours): Rgb | undefined {
  if (radius > RIM_OUTER) return undefined;
  if (radius > RIM_INNER) return colours.gold;
  if (radius > WOOD_INNER) return radius > 29.5 ? colours.wood : colours.woodDark;
  if (radius > POCKET_OUTER) return colours.track;

  if (radius > POCKET_INNER) {
    // Which pocket is here? The wheel's own angle is the screen angle minus the rotation.
    const local = mod(angle - rotation + POCKET_ANGLE / 2, TAU);
    const index = Math.floor(local / POCKET_ANGLE) % POCKET_COUNT;
    const offset = local - Math.floor(local / POCKET_ANGLE) * POCKET_ANGLE;
    const distanceToDivider = Math.min(offset, POCKET_ANGLE - offset) * radius;
    if (distanceToDivider < 0.45) return colours.gold;
    const pocket = POCKETS[index];
    return pocket === undefined ? colours.track : colours[pocket.color];
  }

  if (radius > POCKET_INNER - 1) return colours.gold;
  if (radius > CONE_INNER) {
    // Four spokes that turn with the wheel.
    const quarter = Math.PI / 2;
    const offset = mod(angle - rotation, quarter);
    const distanceToSpoke = Math.min(offset, quarter - offset) * radius;
    return distanceToSpoke < 0.7 && radius > 9 ? colours.gold : colours.cone;
  }
  if (radius > HUB) return colours.woodDark;
  return angle < -0.4 && angle > -2.7 ? colours.goldLight : colours.gold;
}

/** Writes `colour` into the pixel at (x, y), but only on the wheel itself: the corners stay transparent. */
function putOnWheel(out: Uint8ClampedArray, x: number, y: number, colour: Rgb): void {
  if (x < 0 || y < 0 || x >= WHEEL_PIXELS || y >= WHEEL_PIXELS) return;
  const o = (y * WHEEL_PIXELS + x) * 4;
  if (out[o + 3] === 0) return;
  out[o] = colour[0];
  out[o + 1] = colour[1];
  out[o + 2] = colour[2];
}

/** The glowing trail, drawn over the wheel: blocks of two pixels near the ball, single pixels further back. */
function drawTrail(trail: readonly TrailDot[], out: Uint8ClampedArray, colours: WheelColours): void {
  const shades = [colours.glow, colours.glowMid, colours.glowDim] as const;
  for (const dot of trail) {
    const x = CENTRE + Math.cos(dot.angle) * dot.radius;
    const y = CENTRE + Math.sin(dot.angle) * dot.radius;
    const colour = shades[dot.level];
    if (dot.level === 2) {
      putOnWheel(out, Math.floor(x), Math.floor(y), colour);
    } else {
      const left = Math.round(x) - 1;
      const top = Math.round(y) - 1;
      for (let dy = 0; dy < 2; dy += 1) for (let dx = 0; dx < 2; dx += 1) putOnWheel(out, left + dx, top + dy, colour);
    }
  }
}

/**
 * Fills `out` (WHEEL_PIXELS squared RGBA pixels) with the wheel in `state`. Pixels outside the wheel
 * are fully transparent, and nothing is anti-aliased: every pixel is exactly one palette colour.
 */
export function renderWheel(state: WheelState, out: Uint8ClampedArray, colours: WheelColours = WHEEL_COLOURS): void {
  const ball = state.ball;
  const ballX = ball === undefined ? 0 : CENTRE + Math.cos(ball.angle) * ball.radius;
  const ballY = ball === undefined ? 0 : CENTRE + Math.sin(ball.angle) * ball.radius;
  const glow = state.glow === true;

  for (let y = 0; y < WHEEL_PIXELS; y += 1) {
    for (let x = 0; x < WHEEL_PIXELS; x += 1) {
      const i = y * WHEEL_PIXELS + x;
      let colour = wheelPixel(RADIUS[i] ?? 0, ANGLE[i] ?? 0, state.rotation, colours);

      if (colour !== undefined && ball !== undefined) {
        const dx = x + 0.5 - ballX;
        const dy = y + 0.5 - ballY;
        // Only pixels next to the ball can be part of it (or of its glow): skip the square root everywhere else.
        if (dx < 3 && dx > -3 && dy < 3 && dy > -3) {
          const distance = Math.hypot(dx, dy);
          if (distance < 1.35) colour = distance < 0.95 ? colours.ball : colours.ballShade;
          else if (glow && distance < 2.7) colour = distance < 2 ? colours.glowMid : colours.glowDim;
        }
      }

      const o = i * 4;
      out[o] = colour?.[0] ?? 0;
      out[o + 1] = colour?.[1] ?? 0;
      out[o + 2] = colour?.[2] ?? 0;
      out[o + 3] = colour === undefined ? 0 : 255;
    }
  }

  if (state.trail !== undefined) drawTrail(state.trail, out, colours);
}
