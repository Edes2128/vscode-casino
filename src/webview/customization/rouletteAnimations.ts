import { ROULETTE_ANIMATION_IDS, type RouletteAnimationId } from '../../state/appearance';

/**
 * The five ways the roulette wheel can spin. A style is only a row of numbers: how long the spin takes, how
 * many times the wheel and the ball go round, how hard they brake, how the ball settles and what is added on
 * top (a glowing trail, a burst of pixels). The wheel's own maths (`art/rouletteWheel.ts`) reads these numbers
 * and nothing else about a style.
 *
 * A style is cosmetic. Where the ball stops is worked out from the pocket Break Room Arcade drew, never from a style:
 * every style ends with that exact pocket under the pointer.
 */

/** What a style adds to the picture while the ball is moving or when it lands. */
export type WheelEffect =
  /** Nothing extra. */
  | 'none'
  /** A glow around the ball and a fading trail behind it, while it is going round. */
  | 'trail'
  /** A burst of pixels when the ball lands. */
  | 'burst';

/** How the ball comes to rest once it has dropped: it hops a little out of the pocket and rocks, less each time. */
export interface BallSettle {
  /** The last share of the spin (0 to 1) in which the ball is bouncing. */
  readonly fraction: number;
  /** How high a hop lifts the ball back out of its pocket, in wheel pixels. The wheel is 64 across. */
  readonly hop: number;
  /** How far the ball rocks to the side, in radians. A pocket is about 0.17 wide. */
  readonly rock: number;
  /** How many hops. */
  readonly bounces: number;
}

export interface RouletteAnimationStyle {
  readonly id: RouletteAnimationId;
  /** The name shown to the player, such as "Arcade Spin". Screens may write it in capitals. */
  readonly name: string;
  /** One line about how it looks. */
  readonly description: string;
  /** How long the wheel spins in full motion, in milliseconds. */
  readonly durationMs: number;
  /** Whole turns the wheel makes (and a part of one, to end on the right pocket). */
  readonly wheelTurns: number;
  /** Turns the ball makes round the rim, relative to the wheel, before it settles. */
  readonly ballTurns: number;
  /** How hard the wheel brakes: the exponent of its ease-out. Higher is a sharper start and a longer crawl at the end. */
  readonly wheelEase: number;
  /** The same for the ball. */
  readonly ballEase: number;
  /** The bounce at the end, or `undefined` for a ball that simply drops and rides. */
  readonly settle: BallSettle | undefined;
  readonly effect: WheelEffect;
  /** `trail`: the most dots in the trail. `burst`: how many pixels fly. Otherwise 0. */
  readonly effectSize: number;
}

const STYLES: Readonly<Record<RouletteAnimationId, RouletteAnimationStyle>> = {
  // Today's spin, exactly. Its numbers must not change: the wheel's tests compare it with the original formula.
  classic: {
    id: 'classic',
    name: 'Classic Spin',
    description: 'The wheel and the ball, turning as they always have.',
    durationMs: 5_500,
    wheelTurns: 4,
    ballTurns: 14,
    wheelEase: 3,
    ballEase: 2,
    settle: undefined,
    effect: 'none',
    effectSize: 0,
  },
  arcade: {
    id: 'arcade',
    name: 'Arcade Spin',
    description: 'Fast and snappy. The ball bounces in its pocket.',
    durationMs: 3_200,
    wheelTurns: 3,
    ballTurns: 10,
    wheelEase: 2.4,
    ballEase: 1.7,
    settle: { fraction: 0.22, hop: 2.6, rock: 0.11, bounces: 3 },
    effect: 'none',
    effectSize: 0,
  },
  neon: {
    id: 'neon',
    name: 'Neon Spin',
    description: 'The ball glows and leaves a bright trail.',
    durationMs: 5_000,
    wheelTurns: 4,
    ballTurns: 12,
    wheelEase: 3,
    ballEase: 2,
    settle: undefined,
    effect: 'trail',
    effectSize: 16,
  },
  explosion: {
    id: 'explosion',
    name: 'Pixel Explosion',
    description: 'A burst of pixels flies out when the ball lands.',
    durationMs: 4_800,
    wheelTurns: 4,
    ballTurns: 12,
    wheelEase: 3,
    ballEase: 2,
    settle: { fraction: 0.12, hop: 1.4, rock: 0.05, bounces: 2 },
    effect: 'burst',
    effectSize: 28,
  },
  slow: {
    id: 'slow',
    name: 'Slow Motion',
    description: 'Long and dramatic. You can watch the ball slow down.',
    durationMs: 9_000,
    wheelTurns: 3,
    ballTurns: 9,
    wheelEase: 3.4,
    ballEase: 3,
    settle: { fraction: 0.16, hop: 1.6, rock: 0.15, bounces: 3 },
    effect: 'none',
    effectSize: 0,
  },
};

/** The style used when nothing was chosen, and for an id this version does not know. */
export const DEFAULT_ROULETTE_ANIMATION: RouletteAnimationId = 'classic';

/** Every style, in the order of `ROULETTE_ANIMATION_IDS`. */
export const ROULETTE_ANIMATIONS: readonly RouletteAnimationStyle[] = ROULETTE_ANIMATION_IDS.map((id) => STYLES[id]);

/** The style with this id. An unknown id (a setting from some other version) gives the classic one. */
export const rouletteAnimation = (id: RouletteAnimationId): RouletteAnimationStyle =>
  (STYLES as Readonly<Partial<Record<string, RouletteAnimationStyle>>>)[id] ?? STYLES[DEFAULT_ROULETTE_ANIMATION];

/** The style a wheel uses: the one it was asked for, or else the one the player chose. */
export const wheelStyle = (asked: RouletteAnimationId | undefined, chosen: RouletteAnimationId): RouletteAnimationStyle =>
  rouletteAnimation(asked ?? chosen);

/** How long a burst of pixels stays on screen, in milliseconds. The stylesheet runs the same number. */
export const BURST_MS = 1_000;

/** How long the burst's elements are kept before they are taken away: the longest delay plus the burst itself. */
export const BURST_LIFETIME_MS = BURST_MS + 400;

/** How long, in seconds, a style's spin takes: "5.5". */
export const spinSeconds = (style: RouletteAnimationStyle): string => (style.durationMs / 1000).toFixed(1);
