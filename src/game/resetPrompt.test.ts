import { describe, expect, it } from 'vitest';
import { RESET_SCOPES } from './resetScope';
import { resetPrompt } from './resetPrompt';

describe('the reset dialogs', () => {
  it('have a question, an explanation and a button for every kind of reset, all different', () => {
    const prompts = RESET_SCOPES.map(resetPrompt);
    for (const prompt of prompts) {
      expect(prompt.message.length).toBeGreaterThan(10);
      expect(prompt.detail.length).toBeGreaterThan(10);
      expect(prompt.confirmLabel.length).toBeGreaterThan(3);
      expect(prompt.confirmLabel).not.toMatch(/cancel/i);
    }
    expect(new Set(prompts.map((prompt) => prompt.message)).size).toBe(3);
    expect(new Set(prompts.map((prompt) => prompt.confirmLabel)).size).toBe(3);
  });

  it('say plainly what is lost and what is kept', () => {
    expect(resetPrompt('balance').message).toContain('1,000 chips');
    expect(resetPrompt('balance').detail).toMatch(/statistics and game history are kept/i);
    expect(resetPrompt('statistics').detail).toMatch(/balance is kept/i);
    expect(resetPrompt('statistics').detail).toMatch(/cannot be undone/i);
    expect(resetPrompt('all').detail).toMatch(/1,000 chips/);
    expect(resetPrompt('all').detail).toMatch(/cleared/i);
    expect(resetPrompt('all').detail).toMatch(/settings are kept/i);
    expect(resetPrompt('all').detail).toMatch(/cannot be undone/i);
  });
});
