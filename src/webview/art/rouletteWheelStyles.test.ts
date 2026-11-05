import { describe, expect, it } from 'vitest';
import { ROULETTE_ANIMATION_IDS, type RouletteAnimationId } from '../../casino/appearance';
import { POCKET_COUNT, POCKETS, WHEEL_ORDER, pocketIndexOfNumber } from '../../game/roulette/wheel';
import { ROULETTE_ANIMATIONS, rouletteAnimation } from '../customization/rouletteAnimations';
import { resolveAppearance } from '../customization/appearance';
import { THEME_IDS } from '../../casino/appearance';
import {
  CALM_PAUSE_MS,
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
  thumbnailState,
  wheelColoursFor,
  wheelMotion,
  type WheelColours,
  type WheelState,
} from './rouletteWheel';

const TAU = Math.PI * 2;
const mod = (value: number, modulus: number): number => ((value % modulus) + modulus) % modulus;
const STARTS = [0, 0.3, 1, 2.5, 5.9, 12.34, -3.2, 100, 1234.5678];
/** The angle between the ball and the pointer, folded to -pi..pi. */
const offPointer = (angle: number): number => mod(angle - POINTER_ANGLE + Math.PI, TAU) - Math.PI;

function render(state: WheelState, colours: WheelColours = WHEEL_COLOURS): Uint8ClampedArray {
  const out = new Uint8ClampedArray(WHEEL_PIXELS * WHEEL_PIXELS * 4);
  renderWheel(state, out, colours);
  return out;
}

describe('every style lands on the pocket that was drawn', () => {
  it('puts the chosen pocket under the pointer: all 37 pockets, all 5 styles, from any starting position', () => {
    let checked = 0;
    for (const id of ROULETTE_ANIMATION_IDS) {
      for (const start of STARTS) {
        for (let index = 0; index < POCKET_COUNT; index += 1) {
          const plan = planSpin(start, index, id);
          expect(pocketUnderPointer(plan.endRotation), `${id}, start ${start}, pocket ${index}`).toBe(index);
          expect(numberUnderPointer(plan.endRotation), `${id}, pocket ${index}`).toBe(WHEEL_ORDER[index]);
          checked += 1;
        }
      }
    }
    expect(checked).toBe(5 * STARTS.length * 37);
  });

  it('reports the very number the host drew, for every number 0 to 36 in every style, spin after spin on the same wheel', () => {
    // What the wheel tells the host (`landedOn`) is the number under the pointer at the end of the plan it made
    // from the host's number. Spins follow one another on the same wheel, so the rotation keeps growing.
    let rotation = 0;
    let spins = 0;
    for (let round = 0; round < 3; round += 1) {
      for (const id of ROULETTE_ANIMATION_IDS) {
        for (let number = 0; number <= 36; number += 1) {
          const plan = planSpin(rotation, pocketIndexOfNumber(number), id);
          expect(numberUnderPointer(plan.endRotation), `${id}, number ${number}, spin ${spins}`).toBe(number);
          rotation = plan.endRotation;
          spins += 1;
        }
      }
    }
    expect(spins).toBe(3 * 5 * 37);
  });

  it('ends with the ball exactly in the middle of the chosen pocket, under the pointer, in every style', () => {
    for (const id of ROULETTE_ANIMATION_IDS) {
      for (let index = 0; index < POCKET_COUNT; index += 1) {
        const plan = planSpin(0.9, index, id);
        const end = spinState(plan, index, plan.durationMs);
        expect(end.rotation, `${id} ${index}`).toBe(plan.endRotation);
        expect(end.ball?.radius, `${id} ${index}`).toBe(POCKET_RADIUS);
        expect(Math.abs(offPointer(end.ball?.angle ?? 0)), `${id} pocket ${index}`).toBeLessThan(1e-9);
        // The picture's own answer to "which pocket is under the pointer" is the chosen one.
        expect(pocketUnderPointer(end.rotation), `${id} ${index}`).toBe(index);
        expect(end.glow, id).toBeUndefined();
        expect(end.trail, id).toBeUndefined();
      }
    }
  });

  it('stays exactly there however long it is asked about afterwards', () => {
    for (const id of ROULETTE_ANIMATION_IDS) {
      const plan = planSpin(2, 29, id);
      const end = spinState(plan, 29, plan.durationMs);
      for (const later of [plan.durationMs + 1, plan.durationMs * 3, 1e9]) {
        expect(spinState(plan, 29, later), `${id} at ${later}`).toEqual(end);
      }
    }
  });

  it('draws the colour of the chosen pocket under the pointer at the end, in every style, for all 37 pockets', () => {
    const y = Math.round(WHEEL_PIXELS / 2 - POCKET_RADIUS) - 3; // on the pocket ring just beside the ball, straight up
    for (const id of ROULETTE_ANIMATION_IDS) {
      for (let index = 0; index < POCKET_COUNT; index += 1) {
        const plan = planSpin(0, index, id);
        const picture = render(spinState(plan, index, plan.durationMs));
        const o = (y * WHEEL_PIXELS + 32) * 4;
        const wanted = WHEEL_COLOURS[POCKETS[index]?.color ?? 'red'];
        expect([picture[o], picture[o + 1], picture[o + 2]], `${id} pocket ${index} (${WHEEL_ORDER[index]})`).toEqual([...wanted]);
      }
    }
  });

  it('never lets the style decide where the wheel stops: every style turns to the same pocket from the same start', () => {
    for (const start of STARTS) {
      for (let index = 0; index < POCKET_COUNT; index += 1) {
        const stops = ROULETTE_ANIMATION_IDS.map((id) => mod(planSpin(start, index, id).endRotation - start, TAU));
        for (const stop of stops) expect(stop).toBeCloseTo(stops[0] ?? 0, 9);
      }
    }
  });

  it('always turns the wheel forwards by at least the style\'s own number of full turns', () => {
    for (const style of ROULETTE_ANIMATIONS) {
      for (let index = 0; index < POCKET_COUNT; index += 1) {
        const plan = planSpin(1.7, index, style.id);
        expect(plan.endRotation - plan.startRotation, style.id).toBeGreaterThanOrEqual(style.wheelTurns * TAU);
        expect(plan.endRotation - plan.startRotation, style.id).toBeLessThan((style.wheelTurns + 1) * TAU);
      }
    }
  });

  it('plans a spin with the style\'s duration and ball turns, from an id or from a style', () => {
    for (const style of ROULETTE_ANIMATIONS) {
      const byId = planSpin(0, 5, style.id);
      expect(byId.durationMs).toBe(style.durationMs);
      expect(byId.ballTurns).toBe(style.ballTurns);
      expect(byId.style).toBe(style);
      expect(planSpin(0, 5, style)).toEqual(byId);
    }
    expect(planSpin(0, 5)).toEqual(planSpin(0, 5, 'classic'));
    expect(SPIN_DURATION_MS).toBe(rouletteAnimation('classic').durationMs);
  });

  it('carries on from where the last spin stopped, in every style, so the wheel never jumps', () => {
    for (const id of ROULETTE_ANIMATION_IDS) {
      const first = planSpin(0, 5, id);
      const second = planSpin(first.endRotation, 20, id);
      expect(second.startRotation).toBe(first.endRotation);
      expect(spinState(second, 20, 0).rotation).toBeCloseTo(first.endRotation, 9);
    }
  });
});

describe('along the way, in every style', () => {
  const pockets = [0, 1, 12, 18, 36];

  it('never turns the wheel backwards and never past where it stops', () => {
    for (const id of ROULETTE_ANIMATION_IDS) {
      for (const index of pockets) {
        const plan = planSpin(0.4, index, id);
        let previous = plan.startRotation;
        for (let ms = 0; ms <= plan.durationMs; ms += 20) {
          const { rotation } = spinState(plan, index, ms);
          expect(rotation, `${id} at ${ms}`).toBeGreaterThanOrEqual(previous - 1e-12);
          expect(rotation, `${id} at ${ms}`).toBeLessThanOrEqual(plan.endRotation + 1e-9);
          previous = rotation;
        }
      }
    }
  });

  it('starts at the start rotation with the ball out on the rim', () => {
    for (const id of ROULETTE_ANIMATION_IDS) {
      const plan = planSpin(1.1, 7, id);
      const start = spinState(plan, 7, 0);
      expect(start.rotation, id).toBeCloseTo(1.1, 9);
      expect(start.ball?.radius, id).toBeCloseTo(TRACK_RADIUS, 9);
    }
  });

  it('whirls the ball the opposite way round from the wheel, as on a real wheel', () => {
    for (const id of ROULETTE_ANIMATION_IDS) {
      const plan = planSpin(0, 12, id);
      for (const fraction of [0.02, 0.1, 0.25, 0.4]) {
        const at = plan.durationMs * fraction;
        const a = spinState(plan, 12, at);
        const b = spinState(plan, 12, at + 40);
        expect(b.rotation - a.rotation, `${id} wheel at ${fraction}`).toBeGreaterThan(0);
        expect((b.ball?.angle ?? 0) - (a.ball?.angle ?? 0), `${id} ball at ${fraction}`).toBeLessThan(0);
      }
    }
  });

  it('slows the ball down: it covers less ground each moment as the spin goes on', () => {
    for (const id of ROULETTE_ANIMATION_IDS) {
      const plan = planSpin(0, 12, id);
      const speeds = [0.05, 0.2, 0.35, 0.5, 0.65].map((fraction) => {
        const at = plan.durationMs * fraction;
        const a = spinState(plan, 12, at);
        const b = spinState(plan, 12, at + 25);
        return Math.abs((b.ball?.angle ?? 0) - (a.ball?.angle ?? 0));
      });
      for (let i = 1; i < speeds.length; i += 1) expect(speeds[i] ?? 0, `${id} step ${i}`).toBeLessThan(speeds[i - 1] ?? 0);
    }
  });

  it('keeps the ball on the wheel: from the rim down to the pocket, never outside or below it', () => {
    for (const id of ROULETTE_ANIMATION_IDS) {
      for (const index of pockets) {
        const plan = planSpin(0, index, id);
        for (let ms = 0; ms <= plan.durationMs; ms += 10) {
          const radius = spinState(plan, index, ms).ball?.radius ?? 0;
          expect(radius, `${id} at ${ms}`).toBeGreaterThanOrEqual(POCKET_RADIUS - 1e-9);
          expect(radius, `${id} at ${ms}`).toBeLessThanOrEqual(TRACK_RADIUS + 1e-9);
        }
      }
    }
  });

  it('lets the ball drop and stay down in the styles without a bounce', () => {
    for (const style of ROULETTE_ANIMATIONS.filter((entry) => entry.settle === undefined)) {
      const plan = planSpin(0, 12, style.id);
      let previous = Number.POSITIVE_INFINITY;
      for (let ms = 0; ms <= plan.durationMs; ms += 10) {
        const radius = spinState(plan, 12, ms).ball?.radius ?? 0;
        expect(radius, `${style.id} at ${ms}`).toBeLessThanOrEqual(previous + 1e-9);
        previous = radius;
      }
    }
  });

  it('bounces only in the last part of the spin, and only in the styles that have a bounce', () => {
    for (const style of ROULETTE_ANIMATIONS) {
      const plan = planSpin(0, 12, style.id);
      let hopped = false;
      let rocked = false;
      let previous = Number.POSITIVE_INFINITY;
      for (let ms = 0; ms < plan.durationMs; ms += 5) {
        const radius = spinState(plan, 12, ms).ball?.radius ?? 0;
        if (radius > previous + 1e-9) {
          hopped = true;
          // A hop back out of the pocket can only happen once the bounce has begun.
          expect(ms / plan.durationMs, `${style.id} at ${ms}`).toBeGreaterThanOrEqual(1 - (style.settle?.fraction ?? 0) - 1e-9);
        }
        previous = radius;
      }
      for (let ms = 0; ms < plan.durationMs * (1 - (style.settle?.fraction ?? 0)); ms += 50) {
        const state = spinState(plan, 12, ms);
        const calm = planSpin(0, 12, { ...style, settle: undefined });
        const same = spinState(calm, 12, ms);
        if (Math.abs((state.ball?.angle ?? 0) - (same.ball?.angle ?? 0)) > 1e-12) rocked = true;
      }
      expect(hopped, `${style.id} hops`).toBe(style.settle !== undefined);
      expect(rocked, `${style.id} rocks before the bounce`).toBe(false);
    }
  });

  it('moves the ball smoothly: no jump from one frame to the next', () => {
    for (const id of ROULETTE_ANIMATION_IDS) {
      for (const index of pockets) {
        const plan = planSpin(0, index, id);
        let previous = spinState(plan, index, 0).ball?.angle ?? 0;
        for (let ms = 16; ms <= plan.durationMs; ms += 16) {
          const angle = spinState(plan, index, ms).ball?.angle ?? 0;
          expect(Math.abs(angle - previous), `${id} at ${ms}`).toBeLessThan(1.1); // under 63 degrees a frame
          previous = angle;
        }
      }
    }
  });

  it('has the ball settle into its pocket: within the last moments it is in, or next to, the chosen pocket', () => {
    for (const id of ROULETTE_ANIMATION_IDS) {
      for (const index of pockets) {
        const plan = planSpin(0, index, id);
        const near = spinState(plan, index, plan.durationMs - 120);
        const wheelFrame = mod((near.ball?.angle ?? 0) - near.rotation - index * POCKET_ANGLE + Math.PI, TAU) - Math.PI;
        // In the wheel's own frame the ball is within a pocket and a half of where it ends up.
        expect(Math.abs(wheelFrame), `${id} pocket ${index}`).toBeLessThan(POCKET_ANGLE * 1.5);
      }
    }
  });
});

describe('the styles differ from one another', () => {
  it('give each style its own duration or its own motion', () => {
    const picture = (id: RouletteAnimationId): string => {
      const plan = planSpin(0, 12, id);
      return [plan.durationMs, ...[0.3, 0.6, 0.9].map((fraction) => spinState(plan, 12, plan.durationMs * fraction).ball?.angle.toFixed(4))].join('/');
    };
    expect(new Set(ROULETTE_ANIMATION_IDS.map(picture)).size).toBe(5);
  });

  it('runs the quick style at about 3.2 seconds, the classic one at 5.5 and the slow one at about 9', () => {
    expect(planSpin(0, 3, 'arcade').durationMs).toBe(3_200);
    expect(planSpin(0, 3, 'classic').durationMs).toBe(5_500);
    expect(planSpin(0, 3, 'slow').durationMs).toBe(9_000);
  });

  it('lets the slow style crawl: the ball is going down into its pocket for much longer than the classic ball', () => {
    // From the moment the ball leaves the rim until the spin ends.
    const crawlMs = (id: RouletteAnimationId): number => {
      const plan = planSpin(0, 12, id);
      for (let ms = 0; ms <= plan.durationMs; ms += 10) {
        if ((spinState(plan, 12, ms).ball?.radius ?? 0) < TRACK_RADIUS - 1) return plan.durationMs - ms;
      }
      return 0;
    };
    expect(crawlMs('slow')).toBeGreaterThan(crawlMs('classic') * 2);
    expect(crawlMs('slow')).toBeGreaterThan(3_000);
  });

  it('runs the slow ball slower than the classic ball all the way: it is slow motion', () => {
    const peak = (id: RouletteAnimationId): number => {
      const plan = planSpin(0, 12, id);
      let fastest = 0;
      for (let ms = 0; ms + 20 <= plan.durationMs; ms += 20) {
        const a = spinState(plan, 12, ms).ball?.angle ?? 0;
        const b = spinState(plan, 12, ms + 20).ball?.angle ?? 0;
        fastest = Math.max(fastest, Math.abs(b - a) / 20);
      }
      return fastest;
    };
    expect(peak('slow')).toBeLessThan(peak('classic'));
    expect(peak('arcade')).toBeGreaterThan(peak('slow'));
  });
});

describe('the classic style is exactly what it was', () => {
  /** The plan and the animation as they were written before there were styles. */
  const oldPlan = (startRotation: number, pocketIndex: number) => ({
    startRotation,
    endRotation: startRotation + 4 * TAU + mod(rotationForPocket(pocketIndex) - startRotation, TAU),
    ballTurns: 14,
    durationMs: 5_500,
  });
  const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;
  const easeOutQuad = (t: number): number => 1 - (1 - t) ** 2;
  const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));
  const oldState = (plan: ReturnType<typeof oldPlan>, pocketIndex: number, elapsedMs: number) => {
    const t = clamp01(elapsedMs / plan.durationMs);
    const rotation = plan.startRotation + (plan.endRotation - plan.startRotation) * easeOutCubic(t);
    const ahead = plan.ballTurns * TAU * (1 - easeOutQuad(t));
    const drop = clamp01(ahead / (1.2 * TAU));
    const radius = POCKET_RADIUS + (TRACK_RADIUS - POCKET_RADIUS) * (drop * drop * (3 - 2 * drop));
    return { rotation, ball: { angle: rotation + pocketIndex * POCKET_ANGLE + ahead, radius } };
  };

  it('plans the very same spin for every pocket and every starting position', () => {
    for (const start of STARTS) {
      for (let index = 0; index < POCKET_COUNT; index += 1) {
        const now = planSpin(start, index, 'classic');
        const before = oldPlan(start, index);
        expect(now.startRotation).toBe(before.startRotation);
        expect(now.endRotation).toBe(before.endRotation);
        expect(now.ballTurns).toBe(before.ballTurns);
        expect(now.durationMs).toBe(before.durationMs);
      }
    }
  });

  it('draws the very same wheel and ball at every moment, to the last digit, for every pocket', () => {
    for (let index = 0; index < POCKET_COUNT; index += 1) {
      const plan = planSpin(0.37, index, 'classic');
      const before = oldPlan(0.37, index);
      for (let ms = 0; ms <= 5_700; ms += 137) {
        expect(spinState(plan, index, ms), `pocket ${index} at ${ms}`).toEqual(oldState(before, index, ms));
      }
    }
  });

  it('has no glow, no trail and no bounce', () => {
    const plan = planSpin(0, 9, 'classic');
    for (let ms = 0; ms <= plan.durationMs; ms += 100) {
      const state = spinState(plan, 9, ms);
      expect(state.glow).toBeUndefined();
      expect(state.trail).toBeUndefined();
    }
  });
});

describe('reduced motion', () => {
  it('turns the wheel only in full motion', () => {
    for (const style of ROULETTE_ANIMATIONS) {
      expect(wheelMotion('full', style)).toEqual({ kind: 'turn', durationMs: style.durationMs, effect: style.effect });
    }
  });

  it('waits and then shows the result in calm, whatever the style: no turning, no glow, no burst', () => {
    for (const style of ROULETTE_ANIMATIONS) {
      expect(wheelMotion('calm', style)).toEqual({ kind: 'pause', durationMs: CALM_PAUSE_MS, effect: 'none' });
    }
    expect(CALM_PAUSE_MS).toBe(900);
  });

  it('shows the result at once when animations are off, whatever the style', () => {
    for (const style of ROULETTE_ANIMATIONS) {
      expect(wheelMotion('off', style)).toEqual({ kind: 'jump', durationMs: 0, effect: 'none' });
    }
  });

  it('makes no motion plan at all for calm and off: the wheel still ends on the drawn pocket', () => {
    for (const motion of ['calm', 'off'] as const) {
      for (const style of ROULETTE_ANIMATIONS) {
        const how = wheelMotion(motion, style);
        expect(how.kind).not.toBe('turn');
        expect(how.effect).toBe('none');
        for (let index = 0; index < POCKET_COUNT; index += 1) {
          // The picture jumped to is the final one: the ball in the chosen pocket under the pointer, nothing extra.
          const plan = planSpin(0, index, style.id);
          const shown = spinState(plan, index, plan.durationMs);
          expect(shown.ball?.radius).toBe(POCKET_RADIUS);
          expect(pocketUnderPointer(shown.rotation)).toBe(index);
          expect(shown.glow).toBeUndefined();
          expect(shown.trail).toBeUndefined();
        }
      }
    }
  });
});

describe('Neon Spin: the glowing trail', () => {
  const plan = planSpin(0, 12, 'neon');
  const size = rouletteAnimation('neon').effectSize;

  it('glows and trails the ball while it is going round, brightest dot first', () => {
    let sawTrail = false;
    for (let ms = 100; ms < plan.durationMs; ms += 50) {
      const state = spinState(plan, 12, ms);
      expect(state.glow, `at ${ms}`).toBe(true);
      const trail = state.trail ?? [];
      expect(trail.length, `at ${ms}`).toBeLessThanOrEqual(size);
      if (trail.length > 0) sawTrail = true;
      for (let i = 1; i < trail.length; i += 1) expect(trail[i]?.level ?? 0).toBeGreaterThanOrEqual(trail[i - 1]?.level ?? 0);
      for (const dot of trail) {
        expect([0, 1, 2]).toContain(dot.level);
        expect(dot.radius).toBeGreaterThanOrEqual(POCKET_RADIUS - 1e-9);
        expect(dot.radius).toBeLessThanOrEqual(TRACK_RADIUS + 1e-9);
      }
    }
    expect(sawTrail).toBe(true);
  });

  it('makes the trail long while the ball is fast and short once it has slowed', () => {
    const length = (fraction: number): number => spinState(plan, 12, plan.durationMs * fraction).trail?.length ?? 0;
    expect(length(0.1)).toBeGreaterThanOrEqual(10);
    expect(length(0.1)).toBeLessThanOrEqual(size);
    expect(length(0.1)).toBeGreaterThan(length(0.8));
    expect(length(0.97)).toBeLessThanOrEqual(1);
  });

  it('puts the trail behind the ball, the way it came', () => {
    const state = spinState(plan, 12, 700);
    const ball = state.ball;
    const trail = state.trail ?? [];
    expect(trail.length).toBeGreaterThan(2);
    // The ball goes towards smaller angles (it runs against the wheel), so the trail lies at larger ones.
    for (const dot of trail) expect(mod(dot.angle - (ball?.angle ?? 0), TAU)).toBeLessThan(Math.PI);
  });

  it('is gone at the very start and at the very end: nothing is left once the ball has landed', () => {
    for (const ms of [0, plan.durationMs, plan.durationMs + 500]) {
      const state = spinState(plan, 12, ms);
      expect(state.glow, `at ${ms}`).toBeUndefined();
      expect(state.trail, `at ${ms}`).toBeUndefined();
    }
  });

  it('is only ever drawn in this style', () => {
    for (const id of ROULETTE_ANIMATION_IDS.filter((entry) => entry !== 'neon')) {
      const other = planSpin(0, 12, id);
      for (let ms = 0; ms <= other.durationMs; ms += 80) {
        const state = spinState(other, 12, ms);
        expect(state.glow, `${id} at ${ms}`).toBeUndefined();
        expect(state.trail, `${id} at ${ms}`).toBeUndefined();
      }
    }
  });

  it('draws glow pixels in the theme\'s colours, only on the wheel and only in palette colours', () => {
    const colours = wheelColoursFor(resolveAppearance('neon').tokens);
    const state = spinState(plan, 12, 600);
    const picture = render(state, colours);
    const palette = new Set<string>([...Object.values(colours).map((colour) => colour.join(',')), 'clear']);
    const seen = new Set<string>();
    for (let i = 0; i < WHEEL_PIXELS * WHEEL_PIXELS; i += 1) {
      const key = picture[i * 4 + 3] === 0 ? 'clear' : `${picture[i * 4]},${picture[i * 4 + 1]},${picture[i * 4 + 2]}`;
      expect(palette.has(key), `pixel ${i}`).toBe(true);
      seen.add(key);
    }
    expect(seen.has(colours.glow.join(','))).toBe(true);
    // The corners outside the wheel stay clear: the glow never leaks off the disc.
    expect(picture[3]).toBe(0);
    // Without the glow the same moment draws none of the glow colours.
    const plain = render(state.ball === undefined ? { rotation: state.rotation } : { rotation: state.rotation, ball: state.ball }, colours);
    const plainColours = new Set<string>();
    for (let i = 0; i < WHEEL_PIXELS * WHEEL_PIXELS; i += 1) plainColours.add(`${plain[i * 4]},${plain[i * 4 + 1]},${plain[i * 4 + 2]}`);
    for (const glow of [colours.glow, colours.glowMid, colours.glowDim]) expect(plainColours.has(glow.join(','))).toBe(false);
  });
});

describe('the wheel in a theme', () => {
  const classic = resolveAppearance('classic').tokens;

  it('is drawn exactly as it always was in the classic theme', () => {
    expect(wheelColoursFor(classic)).toEqual(WHEEL_COLOURS);
    for (const state of [restingState(undefined), restingState(17), spinState(planSpin(0, 5), 5, 2_000), { rotation: 1.3 }]) {
      expect(Array.from(render(state, wheelColoursFor(classic)))).toEqual(Array.from(render(state)));
    }
  });

  it('takes the rim, the hub highlight and the bowl from the theme', () => {
    for (const id of THEME_IDS) {
      const tokens = resolveAppearance(id).tokens;
      const colours = wheelColoursFor(tokens);
      const hex = (rgb: readonly number[]): string => `#${rgb.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
      expect(hex(colours.gold), id).toBe(tokens.rim);
      expect(hex(colours.goldLight), id).toBe(tokens.rimLight);
      expect(hex(colours.wood), id).toBe(tokens.bowl);
      // The top of the rim is the rim colour.
      const picture = render(restingState(undefined), colours);
      expect([picture[32 * 4], picture[32 * 4 + 1], picture[32 * 4 + 2]], id).toEqual([...colours.gold]);
    }
  });

  it('keeps the pocket colours red, black and green in every theme: they are the game\'s meaning', () => {
    for (const id of THEME_IDS) {
      const colours = wheelColoursFor(resolveAppearance(id).tokens);
      expect(colours.red, id).toEqual(WHEEL_COLOURS.red);
      expect(colours.black, id).toEqual(WHEEL_COLOURS.black);
      expect(colours.green, id).toEqual(WHEEL_COLOURS.green);
      expect(colours.ball, id).toEqual(WHEEL_COLOURS.ball);
    }
  });

  it('falls back to the classic colours for a colour it cannot read', () => {
    expect(wheelColoursFor({ rim: 'gold', rimLight: '', bowl: '#12', neon: 'x' })).toEqual(WHEEL_COLOURS);
  });

  it('still lands on the right colour in every theme', () => {
    const y = Math.round(WHEEL_PIXELS / 2 - POCKET_RADIUS) - 3; // on the pocket ring just beside the ball, straight up
    for (const id of THEME_IDS) {
      const colours = wheelColoursFor(resolveAppearance(id).tokens);
      for (let index = 0; index < POCKET_COUNT; index += 1) {
        const picture = render(restingState(index), colours);
        const at = (y * WHEEL_PIXELS + 32) * 4;
        expect([picture[at], picture[at + 1], picture[at + 2]], `${id} pocket ${index}`).toEqual([...WHEEL_COLOURS[POCKETS[index]?.color ?? 'red']]);
      }
    }
  });
});

describe('the thumbnails of the styles', () => {
  it('draw a wheel with a ball for every style, and a trail for the neon one', () => {
    for (const style of ROULETTE_ANIMATIONS) {
      const state = thumbnailState(style);
      expect(state.ball, style.id).toBeDefined();
      if (style.effect === 'trail') expect(state.trail?.length ?? 0, style.id).toBeGreaterThan(3);
      else expect(state.trail, style.id).toBeUndefined();
      expect(render(state).some((value) => value !== 0), style.id).toBe(true);
    }
  });

  it('show the style whose effect is at the landing at rest, with the ball in its pocket', () => {
    const state = thumbnailState(rouletteAnimation('explosion'));
    expect(state.ball?.radius).toBe(POCKET_RADIUS);
  });
});
