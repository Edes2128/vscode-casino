import { describe, expect, it } from 'vitest';
import { contrastOfHex, contrastRatio, ensureContrast, luminance, parseHex, readableOn, toHex } from './color';

describe('parseHex and toHex', () => {
  it('reads six and three digit colours, with or without the hash, in any case', () => {
    expect(parseHex('#f5c451')).toEqual([245, 196, 81]);
    expect(parseHex('F5C451')).toEqual([245, 196, 81]);
    expect(parseHex('#fc0')).toEqual([255, 204, 0]);
    expect(parseHex('  #000000 ')).toEqual([0, 0, 0]);
  });

  it('refuses anything else instead of guessing', () => {
    for (const bad of ['', '#', '#12', '#12345', '#1234567', '#ggg', 'red', 'rgb(1,2,3)', '#12 345', '##123456']) {
      expect(parseHex(bad), JSON.stringify(bad)).toBeUndefined();
    }
  });

  it('writes a colour back as lower-case #rrggbb, clamped and rounded', () => {
    expect(toHex([245, 196, 81])).toBe('#f5c451');
    expect(toHex([300, -5, 12.6])).toBe('#ff000d');
  });
});

describe('contrast', () => {
  it('is 21 for black on white and 1 for a colour on itself', () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
    expect(contrastRatio([123, 45, 67], [123, 45, 67])).toBeCloseTo(1, 9);
  });

  it('does not depend on which colour is the text', () => {
    expect(contrastOfHex('#f5c451', '#101216')).toBeCloseTo(contrastOfHex('#101216', '#f5c451'), 9);
  });

  it('matches known WCAG values', () => {
    expect(luminance([255, 255, 255])).toBeCloseTo(1, 9);
    expect(luminance([0, 0, 0])).toBe(0);
    expect(contrastOfHex('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
    expect(contrastOfHex('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
  });

  it('is 1 when a colour cannot be read, never NaN', () => {
    expect(contrastOfHex('nope', '#000000')).toBe(1);
  });
});

describe('readableOn', () => {
  it('picks dark text on light colours and light text on dark ones', () => {
    expect(readableOn([245, 196, 81])).toEqual([0x10, 0x12, 0x16]); // gold
    expect(readableOn([101, 229, 114])).toEqual([0x10, 0x12, 0x16]); // neon green
    expect(readableOn([23, 77, 54])).toEqual([0xf8, 0xf6, 0xee]); // felt
    expect(readableOn([30, 30, 120])).toEqual([0xf8, 0xf6, 0xee]);
  });

  it('falls back to pure black or white on the mid-brightness colours where the soft ones cannot reach AA', () => {
    const label = readableOn([0, 105, 255]); // a strong blue
    expect([...label]).toSatisfy((rgb: number[]) => rgb.every((channel) => channel === 0) || rgb.every((channel) => channel === 255));
    expect(contrastRatio(label, [0, 105, 255])).toBeGreaterThanOrEqual(4.5);
  });

  it('always reaches AA on any background, over a sweep of the whole colour cube', () => {
    for (let red = 0; red <= 255; red += 15) {
      for (let green = 0; green <= 255; green += 15) {
        for (let blue = 0; blue <= 255; blue += 15) {
          const label = readableOn([red, green, blue]);
          expect(contrastRatio(label, [red, green, blue]), `${red},${green},${blue}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });
});

describe('ensureContrast keeps to its own side', () => {
  const sum = (rgb: readonly number[]): number => rgb.reduce((a, b) => a + b, 0);

  it('makes lighter text lighter and darker text darker', () => {
    const lighter = ensureContrast([120, 120, 120], [60, 60, 60]);
    expect(sum(lighter)).toBeGreaterThan(sum([120, 120, 120]));
    expect(contrastRatio(lighter, [60, 60, 60])).toBeGreaterThanOrEqual(4.5);

    const darker = ensureContrast([150, 150, 150], [230, 230, 230]);
    expect(sum(darker)).toBeLessThan(sum([150, 150, 150]));
    expect(contrastRatio(darker, [230, 230, 230])).toBeGreaterThanOrEqual(4.5);
  });

  it('crosses to the other side only when its own side cannot get there', () => {
    // Pale text on a white page: lighter cannot help, so it goes dark.
    const crossed = ensureContrast([250, 250, 250], [255, 255, 255]);
    expect(sum(crossed)).toBeLessThan(sum([250, 250, 250]));
    expect(contrastRatio(crossed, [255, 255, 255])).toBeGreaterThanOrEqual(4.5);
  });

  it('is not fooled by a mid-tone that is nearly as far from both ends', () => {
    // Text of luminance 0.18 against light grey: it must move away from the grey, whichever end scores higher.
    const text: [number, number, number] = [166, 100, 100];
    const grey: [number, number, number] = [236, 236, 236];
    const fixed = ensureContrast(grey, text); // the grey is the one that moves, away from the text
    expect(contrastRatio(fixed, text)).toBeGreaterThanOrEqual(4.5);
    expect(sum(fixed)).toBeGreaterThan(sum(grey)); // lighter, not darker
  });
});

describe('ensureContrast', () => {
  it('leaves a readable colour alone, exactly', () => {
    const readable: [number, number, number] = [242, 240, 232];
    expect(ensureContrast(readable, [16, 18, 22])).toBe(readable);
  });

  it('lightens text that is too dark on a dark background, until it is readable and no further', () => {
    const fixed = ensureContrast([60, 60, 70], [16, 18, 22]);
    expect(contrastRatio(fixed, [16, 18, 22])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(fixed, [16, 18, 22])).toBeLessThan(5.5); // the first readable step, not white
    expect(fixed[0]).toBeGreaterThan(60);
  });

  it('darkens text that is too light on a light background', () => {
    const fixed = ensureContrast([230, 230, 200], [250, 250, 240]);
    expect(contrastRatio(fixed, [250, 250, 240])).toBeGreaterThanOrEqual(4.5);
    expect(fixed[0]).toBeLessThan(230);
  });

  it('keeps the hue as far as it can: a red stays reddish', () => {
    const fixed = ensureContrast([120, 20, 20], [16, 18, 22]);
    expect(contrastRatio(fixed, [16, 18, 22])).toBeGreaterThanOrEqual(4.5);
    expect(fixed[0]).toBeGreaterThan(fixed[1]);
  });

  it('makes any colour readable on any background, over a sweep', () => {
    for (let a = 0; a <= 255; a += 51) {
      for (let b = 0; b <= 255; b += 51) {
        for (let c = 0; c <= 255; c += 51) {
          for (const background of [[16, 18, 22], [250, 250, 245], [128, 128, 128], [23, 77, 54]] as const) {
            const fixed = ensureContrast([a, b, c], background);
            expect(contrastRatio(fixed, background), `${a},${b},${c} on ${background.join(',')}`).toBeGreaterThanOrEqual(4.5);
          }
        }
      }
    }
  });

  it('can be asked for a stricter minimum', () => {
    const fixed = ensureContrast([150, 150, 150], [16, 18, 22], 7);
    expect(contrastRatio(fixed, [16, 18, 22])).toBeGreaterThanOrEqual(7);
  });
});
