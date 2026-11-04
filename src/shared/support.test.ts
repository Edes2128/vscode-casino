import { describe, expect, it } from 'vitest';
import { SUPPORT_URL } from './support';

describe('SUPPORT_URL', () => {
  const url = new URL(SUPPORT_URL);

  it('is a secure link to Buy Me a Coffee and nowhere else', () => {
    expect(url.protocol).toBe('https:');
    expect(url.hostname).toBe('buymeacoffee.com');
  });

  it('carries no credentials, port, query or fragment', () => {
    expect(url.username).toBe('');
    expect(url.password).toBe('');
    expect(url.port).toBe('');
    expect(url.search).toBe('');
    expect(url.hash).toBe('');
  });

  it('points at the developer page, in its canonical lower-case form', () => {
    expect(url.pathname).toBe('/5x2bfo6t5c');
  });
});
