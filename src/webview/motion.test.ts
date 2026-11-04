import { describe, expect, it } from 'vitest';
import { motionLevel } from './motion';

describe('motionLevel', () => {
  it('is full when animations are on and nothing asks for less', () => {
    expect(motionLevel({ animations: true, reducedMotion: false }, false)).toBe('full');
  });

  it('is calm when reduced motion is chosen, or the system asks for it', () => {
    expect(motionLevel({ animations: true, reducedMotion: true }, false)).toBe('calm');
    expect(motionLevel({ animations: true, reducedMotion: false }, true)).toBe('calm');
    expect(motionLevel({ animations: true, reducedMotion: true }, true)).toBe('calm');
  });

  it('is off whenever animations are off, whatever else is set', () => {
    for (const reducedMotion of [false, true]) {
      for (const system of [false, true]) {
        expect(motionLevel({ animations: false, reducedMotion }, system)).toBe('off');
      }
    }
  });
});
