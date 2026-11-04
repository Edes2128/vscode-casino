import { describe, expect, it } from 'vitest';
import { RESET_OUTCOMES, RESET_SCOPES } from '../game/resetScope';
import { resetResultText, volumeText } from './settingsText';

describe('resetResultText', () => {
  it('says something clear for every scope and outcome', () => {
    for (const scope of RESET_SCOPES) {
      for (const outcome of RESET_OUTCOMES) {
        const text = resetResultText(scope, outcome);
        expect(text.length).toBeGreaterThan(10);
        expect(text).toBe(text.toUpperCase());
      }
    }
  });

  it('confirms what was reset, and says nothing changed when it was cancelled', () => {
    expect(resetResultText('balance', 'done')).toBe('BALANCE RESET TO 1,000 CHIPS.');
    expect(resetResultText('statistics', 'done')).toContain('CLEARED');
    expect(resetResultText('all', 'done')).toContain('RESET');
    for (const scope of RESET_SCOPES) expect(resetResultText(scope, 'cancelled')).toContain('NOTHING WAS CHANGED');
  });

  it('explains a refusal in the middle of a hand', () => {
    expect(resetResultText('all', 'round-in-progress')).toContain('FINISH YOUR BLACKJACK HAND');
  });
});

describe('volumeText', () => {
  it('reads as a percentage', () => {
    expect(volumeText(0)).toBe('0%');
    expect(volumeText(40)).toBe('40%');
    expect(volumeText(100)).toBe('100%');
  });
});
