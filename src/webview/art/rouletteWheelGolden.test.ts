import { describe, expect, it } from 'vitest';
import { WHEEL_PIXELS, planSpin, renderWheel, restingState, spinState, wheelColoursFor, type WheelState } from './rouletteWheel';
import { resolveAppearance } from '../customization/appearance';

/**
 * The classic wheel, picture by picture, as it was drawn before there were animation styles and themed
 * colours: each number is a checksum (FNV-1a over the 64 by 64 RGBA bytes) taken from that earlier code. If one
 * of these changes, the wheel the player has always seen no longer looks the same.
 */
const GOLDEN = {
  resting: [
    1324556961, 2057919261, 1366732989, 841058817, 2891710342, 1293478815, 3011516581, 2339465053, 3879863226, 4134513335, 2823888030,
    1465072988, 3990474791, 3842897549, 1584672181, 4047702186, 889653376, 1454415915, 2068806897, 2689456742, 2952849703, 4114920061,
    423228902, 4034714728, 706159395, 1471227417, 3998135153, 3900337362, 3327962900, 2395962559, 1411016742, 3125106635, 4186449113,
    1020529997, 3056826934, 665376167, 1891490157, 3954608925,
  ],
  mid: [
    2066464465, 3667476471, 2159559435, 342799789, 2168145045, 2057919261, 3871545510, 2423481957, 312412054, 2067875027, 2115921456,
    3842897549, 87793919, 1058757390, 2642951907, 732854441, 4142077253, 1411016742, 4263561607, 3414519363, 1997041290, 438581589,
    1978146059, 3954608925,
  ],
  rot: [3257662680, 3845857083, 4264286075, 3657174638],
};

const checksum = (state: WheelState, colours?: Parameters<typeof renderWheel>[2]): number => {
  const out = new Uint8ClampedArray(WHEEL_PIXELS * WHEEL_PIXELS * 4);
  renderWheel(state, out, colours);
  let hash = 0x811c9dc5;
  for (const byte of out) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
};

const midSpins: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [0.37, 12],
  [2.5, 29],
  [100, 36],
];
const times = [0, 700, 1900, 3100, 4600, 5500];

describe('the classic wheel looks exactly as it did before styles and themes', () => {
  const classicColours = wheelColoursFor(resolveAppearance('classic').tokens);

  it('draws the same picture for the empty wheel and for the ball in each of the 37 pockets', () => {
    const states = [undefined, ...Array.from({ length: 37 }, (_, index) => index)].map((index) => restingState(index));
    expect(states.map((state) => checksum(state))).toEqual(GOLDEN.resting);
    // ... also when the colours come from the classic theme.
    expect(states.map((state) => checksum(state, classicColours))).toEqual(GOLDEN.resting);
  });

  it('draws the same pictures all the way through the classic spin', () => {
    const states = midSpins.flatMap(([start, pocket]) => {
      const plan = planSpin(start, pocket, 'classic');
      return times.map((ms) => spinState(plan, pocket, ms));
    });
    expect(states.map((state) => checksum(state))).toEqual(GOLDEN.mid);
    expect(states.map((state) => checksum(state, classicColours))).toEqual(GOLDEN.mid);
  });

  it('draws the same picture for a bare turned wheel', () => {
    expect([0.4, 1, 2.2, 5].map((rotation) => checksum({ rotation }))).toEqual(GOLDEN.rot);
  });
});
