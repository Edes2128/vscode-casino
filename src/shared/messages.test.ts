import { describe, expect, it } from 'vitest';
import { createInitialSnapshot } from '../casino/snapshot';
import { IDLE_VIEW } from '../game/blackjack/view';
import { IDLE_ROULETTE_VIEW } from '../game/roulette/view';
import { parseHostMessage, parseWebviewMessage } from './messages';

describe('parseWebviewMessage', () => {
  it('accepts every valid message shape', () => {
    expect(parseWebviewMessage({ type: 'ready' })).toEqual({ type: 'ready' });
    expect(parseWebviewMessage({ type: 'rendered', fontsLoaded: true, audioAvailable: false })).toEqual({
      type: 'rendered',
      fontsLoaded: true,
      audioAvailable: false,
    });
    expect(
      parseWebviewMessage({ type: 'cspViolation', directive: 'script-src', blockedUri: 'eval' }),
    ).toEqual({ type: 'cspViolation', directive: 'script-src', blockedUri: 'eval' });
    expect(parseWebviewMessage({ type: 'error', message: 'boom' })).toEqual({
      type: 'error',
      message: 'boom',
    });
    expect(parseWebviewMessage({ type: 'snapshotShown', balance: 950, gamesPlayed: 3 })).toEqual({
      type: 'snapshotShown',
      balance: 950,
      gamesPlayed: 3,
    });
  });

  it('rejects a snapshotShown report with impossible numbers', () => {
    expect(parseWebviewMessage({ type: 'snapshotShown', balance: -1, gamesPlayed: 0 })).toBeUndefined();
    expect(parseWebviewMessage({ type: 'snapshotShown', balance: 1.5, gamesPlayed: 0 })).toBeUndefined();
    expect(parseWebviewMessage({ type: 'snapshotShown', balance: 100, gamesPlayed: '3' })).toBeUndefined();
    expect(parseWebviewMessage({ type: 'snapshotShown', balance: 100 })).toBeUndefined();
  });

  it('rejects non-objects, unknown types and wrongly typed fields', () => {
    expect(parseWebviewMessage(undefined)).toBeUndefined();
    expect(parseWebviewMessage(null)).toBeUndefined();
    expect(parseWebviewMessage('ready')).toBeUndefined();
    expect(parseWebviewMessage([{ type: 'ready' }])).toBeUndefined();
    expect(parseWebviewMessage({ type: 'setBalance', amount: 1_000_000 })).toBeUndefined();
    expect(parseWebviewMessage({ type: 'rendered', fontsLoaded: 'yes', audioAvailable: true })).toBeUndefined();
    expect(parseWebviewMessage({ type: 'rendered', fontsLoaded: true, audioAvailable: 'yes' })).toBeUndefined();
    expect(parseWebviewMessage({ type: 'rendered', fontsLoaded: true })).toBeUndefined();
    expect(parseWebviewMessage({ type: 'cspViolation', directive: 1, blockedUri: 'x' })).toBeUndefined();
    expect(parseWebviewMessage({ type: 'error' })).toBeUndefined();
  });

  it('truncates oversized free-form text before it reaches the logs', () => {
    const parsed = parseWebviewMessage({ type: 'error', message: 'x'.repeat(10_000) });
    expect(parsed?.type === 'error' && parsed.message.length).toBe(300);
  });

  it('strips unexpected extra fields', () => {
    expect(parseWebviewMessage({ type: 'ready', balance: 999 })).toEqual({ type: 'ready' });
  });
});

describe('support and navigation messages', () => {
  it('accepts a request to open the support page, and carries no address with it', () => {
    expect(parseWebviewMessage({ type: 'openSupport' })).toEqual({ type: 'openSupport' });
    // A webview can ask, but never choose where: any URL it adds is dropped.
    expect(parseWebviewMessage({ type: 'openSupport', url: 'https://evil.example' })).toEqual({ type: 'openSupport' });
  });

  it('accepts navigation to a known screen only', () => {
    for (const page of ['home', 'blackjack', 'roulette', 'statistics', 'settings']) {
      expect(parseHostMessage({ type: 'navigate', page })).toEqual({ type: 'navigate', page });
    }
    expect(parseHostMessage({ type: 'navigate', page: 'admin' })).toBeUndefined();
    expect(parseHostMessage({ type: 'navigate' })).toBeUndefined();
  });
});

describe('blackjack messages from the webview', () => {
  it('accepts every blackjack action, wrapped in a message', () => {
    expect(parseWebviewMessage({ type: 'blackjack', action: { kind: 'deal', bet: 100 } })).toEqual({
      type: 'blackjack',
      action: { kind: 'deal', bet: 100 },
    });
    for (const kind of ['hit', 'stand', 'double', 'split', 'newRound']) {
      expect(parseWebviewMessage({ type: 'blackjack', action: { kind } })).toEqual({ type: 'blackjack', action: { kind } });
    }
  });

  it('rejects unknown or malformed actions, so nothing reaches the table', () => {
    expect(parseWebviewMessage({ type: 'blackjack' })).toBeUndefined();
    expect(parseWebviewMessage({ type: 'blackjack', action: 'hit' })).toBeUndefined();
    expect(parseWebviewMessage({ type: 'blackjack', action: { kind: 'surrender' } })).toBeUndefined();
    expect(parseWebviewMessage({ type: 'blackjack', action: { kind: 'deal', bet: '100' } })).toBeUndefined();
    expect(parseWebviewMessage({ type: 'blackjack', action: { kind: 'win', payout: 1_000_000 } })).toBeUndefined();
  });

  it('accepts a blackjackShown report and rejects impossible ones', () => {
    const shown = { type: 'blackjackShown', round: 3, phase: 'player', playerCards: 2, dealerCards: 2 };
    expect(parseWebviewMessage(shown)).toEqual(shown);
    expect(parseWebviewMessage({ ...shown, phase: 'dealing' })).toBeUndefined();
    expect(parseWebviewMessage({ ...shown, round: -1 })).toBeUndefined();
    expect(parseWebviewMessage({ ...shown, playerCards: 1.5 })).toBeUndefined();
    expect(parseWebviewMessage({ ...shown, dealerCards: undefined })).toBeUndefined();
  });
});

describe('roulette messages from the webview', () => {
  it('accepts a spin on each colour, wrapped in a message', () => {
    for (const color of ['red', 'black', 'green']) {
      expect(parseWebviewMessage({ type: 'roulette', action: { kind: 'spin', color, bet: 100 } })).toEqual({
        type: 'roulette',
        action: { kind: 'spin', color, bet: 100 },
      });
    }
  });

  it('rejects any other kind of bet before it can reach the table', () => {
    for (const color of ['odd', 'even', 'high', 'dozen1', '17', 17]) {
      expect(parseWebviewMessage({ type: 'roulette', action: { kind: 'spin', color, bet: 100 } }), String(color)).toBeUndefined();
    }
    expect(parseWebviewMessage({ type: 'roulette' })).toBeUndefined();
    expect(parseWebviewMessage({ type: 'roulette', action: { kind: 'spin', color: 'red', bet: '100' } })).toBeUndefined();
    expect(parseWebviewMessage({ type: 'roulette', action: { kind: 'payout', amount: 1e9 } })).toBeUndefined();
  });

  it('accepts a rouletteShown report and rejects impossible ones', () => {
    const shown = { type: 'rouletteShown', spin: 2, phase: 'result', landedOn: 17 };
    expect(parseWebviewMessage(shown)).toEqual(shown);
    expect(parseWebviewMessage({ type: 'rouletteShown', spin: 0, phase: 'idle', landedOn: null })).toEqual({
      type: 'rouletteShown',
      spin: 0,
      phase: 'idle',
      landedOn: null,
    });
    expect(parseWebviewMessage({ ...shown, landedOn: 37 })).toBeUndefined();
    expect(parseWebviewMessage({ ...shown, landedOn: -1 })).toBeUndefined();
    expect(parseWebviewMessage({ ...shown, landedOn: 1.5 })).toBeUndefined();
    expect(parseWebviewMessage({ ...shown, phase: 'rolling' })).toBeUndefined();
    expect(parseWebviewMessage({ ...shown, spin: -1 })).toBeUndefined();
    expect(parseWebviewMessage({ ...shown, landedOn: undefined })).toBeUndefined();
  });
});

describe('roulette messages from the host', () => {
  it('accepts a table view and rejects a corrupt one', () => {
    expect(parseHostMessage({ type: 'roulette', view: IDLE_ROULETTE_VIEW })).toEqual({ type: 'roulette', view: IDLE_ROULETTE_VIEW });
    expect(parseHostMessage({ type: 'roulette', view: { spin: -1, recent: [] } })).toBeUndefined();
    expect(parseHostMessage({ type: 'roulette', view: { spin: 0, recent: [{ number: 17, color: 'red' }] } })).toBeUndefined();
    expect(parseHostMessage({ type: 'roulette' })).toBeUndefined();
  });

  it('accepts a refusal for either game', () => {
    expect(parseHostMessage({ type: 'rejected', game: 'roulette', error: 'insufficient-funds' })).toEqual({
      type: 'rejected',
      game: 'roulette',
      error: 'insufficient-funds',
    });
    expect(parseHostMessage({ type: 'rejected', game: 'blackjack', error: 'not-allowed' })).toEqual({
      type: 'rejected',
      game: 'blackjack',
      error: 'not-allowed',
    });
  });
});

describe('blackjack messages from the host', () => {
  it('accepts a table view and rejects a corrupt one', () => {
    expect(parseHostMessage({ type: 'blackjack', view: IDLE_VIEW })).toEqual({ type: 'blackjack', view: IDLE_VIEW });
    expect(parseHostMessage({ type: 'blackjack', view: { ...IDLE_VIEW, phase: 'dealing' } })).toBeUndefined();
    expect(parseHostMessage({ type: 'blackjack' })).toBeUndefined();
  });

  it('accepts a rejection with a known reason only', () => {
    for (const error of ['invalid-amount', 'below-minimum', 'insufficient-funds', 'round-active', 'not-allowed']) {
      expect(parseHostMessage({ type: 'rejected', game: 'blackjack', error })).toEqual({ type: 'rejected', game: 'blackjack', error });
    }
    expect(parseHostMessage({ type: 'rejected', game: 'blackjack', error: 'because' })).toBeUndefined();
    expect(parseHostMessage({ type: 'rejected', game: 'poker', error: 'not-allowed' })).toBeUndefined();
  });
});

describe('parseHostMessage', () => {
  const payload = { extensionVersion: '0.1.0', viewKind: 'sidebar', assetMode: 'prod' };

  it('accepts a state message and rejects a corrupt snapshot', () => {
    const snapshot = createInitialSnapshot();
    expect(parseHostMessage({ type: 'state', payload: snapshot })).toEqual({ type: 'state', payload: snapshot });
    expect(parseHostMessage({ type: 'state', payload: { ...snapshot, balance: -5 } })).toBeUndefined();
    expect(parseHostMessage({ type: 'state' })).toBeUndefined();
  });

  it('accepts a valid init message', () => {
    expect(parseHostMessage({ type: 'init', payload })).toEqual({ type: 'init', payload });
  });

  it('rejects malformed init messages', () => {
    expect(parseHostMessage({ type: 'init' })).toBeUndefined();
    expect(parseHostMessage({ type: 'init', payload: { ...payload, viewKind: 'sideways' } })).toBeUndefined();
    expect(parseHostMessage({ type: 'init', payload: { ...payload, assetMode: 'cdn' } })).toBeUndefined();
    expect(parseHostMessage({ type: 'init', payload: { ...payload, extensionVersion: 1 } })).toBeUndefined();
    expect(parseHostMessage({ type: 'nope', payload })).toBeUndefined();
    expect(parseHostMessage('init')).toBeUndefined();
  });
});

describe('settings messages from the webview', () => {
  it('accepts a change of one or several settings, wrapped in a message', () => {
    expect(parseWebviewMessage({ type: 'settings', patch: { sound: false } })).toEqual({
      type: 'settings',
      patch: { sound: false },
    });
    expect(parseWebviewMessage({ type: 'settings', patch: { volume: 70, animations: false } })).toEqual({
      type: 'settings',
      patch: { volume: 70, animations: false },
    });
  });

  it('rejects a change with anything wrong in it, so nothing reaches the store', () => {
    for (const patch of [undefined, {}, { volume: 101 }, { volume: 1.5 }, { sound: 'on' }, { balance: 5 }, { sound: true, extra: 1 }]) {
      expect(parseWebviewMessage({ type: 'settings', patch }), JSON.stringify(patch)).toBeUndefined();
    }
    expect(parseWebviewMessage({ type: 'settings' })).toBeUndefined();
    expect(parseWebviewMessage({ type: 'settings', sound: false })).toBeUndefined();
  });

  it('accepts a settingsShown report and rejects an incomplete one', () => {
    const settings = { sound: true, volume: 40, animations: true, reducedMotion: false };
    expect(parseWebviewMessage({ type: 'settingsShown', settings })).toEqual({ type: 'settingsShown', settings });
    expect(parseWebviewMessage({ type: 'settingsShown', settings: { sound: true } })).toBeUndefined();
    expect(parseWebviewMessage({ type: 'settingsShown', settings: { ...settings, volume: 500 } })).toBeUndefined();
  });
});

describe('reset messages', () => {
  it('accepts a request to reset each of the three things, and only those', () => {
    for (const scope of ['balance', 'statistics', 'all']) {
      expect(parseWebviewMessage({ type: 'reset', scope })).toEqual({ type: 'reset', scope });
    }
    for (const scope of ['settings', 'history', 'ALL', '', 7, null, undefined]) {
      expect(parseWebviewMessage({ type: 'reset', scope }), String(scope)).toBeUndefined();
    }
    expect(parseWebviewMessage({ type: 'reset' })).toBeUndefined();
  });

  it('carries no way to skip the confirmation: a "confirmed" flag from the webview is dropped', () => {
    expect(parseWebviewMessage({ type: 'reset', scope: 'all', confirmed: true, force: true })).toEqual({
      type: 'reset',
      scope: 'all',
    });
  });

  it('accepts a result from the host for a known scope and outcome only', () => {
    expect(parseHostMessage({ type: 'resetResult', scope: 'all', outcome: 'done' })).toEqual({
      type: 'resetResult',
      scope: 'all',
      outcome: 'done',
    });
    for (const outcome of ['cancelled', 'round-in-progress', 'busy']) {
      expect(parseHostMessage({ type: 'resetResult', scope: 'balance', outcome })).toMatchObject({ outcome });
    }
    expect(parseHostMessage({ type: 'resetResult', scope: 'nothing', outcome: 'done' })).toBeUndefined();
    expect(parseHostMessage({ type: 'resetResult', scope: 'all', outcome: 'maybe' })).toBeUndefined();
    expect(parseHostMessage({ type: 'resetResult', scope: 'all' })).toBeUndefined();
  });
});

describe('settings messages from the host', () => {
  it('accepts valid settings and rejects invalid ones', () => {
    const payload = { sound: false, volume: 0, animations: true, reducedMotion: true };
    expect(parseHostMessage({ type: 'settings', payload })).toEqual({ type: 'settings', payload });
    expect(parseHostMessage({ type: 'settings', payload: { ...payload, volume: -1 } })).toBeUndefined();
    expect(parseHostMessage({ type: 'settings', payload: { sound: true } })).toBeUndefined();
    expect(parseHostMessage({ type: 'settings' })).toBeUndefined();
  });
});

describe('the ambient clock report', () => {
  it('accepts a ticking, resting or stopped clock with a tick count', () => {
    expect(parseWebviewMessage({ type: 'ambientShown', running: true, resting: false, ticks: 30 })).toEqual({
      type: 'ambientShown',
      running: true,
      resting: false,
      ticks: 30,
    });
    expect(parseWebviewMessage({ type: 'ambientShown', running: false, resting: true, ticks: 90 })).toEqual({
      type: 'ambientShown',
      running: false,
      resting: true,
      ticks: 90,
    });
    expect(parseWebviewMessage({ type: 'ambientShown', running: false, resting: false, ticks: 0 })).toMatchObject({ running: false });
  });

  it('rejects anything else', () => {
    for (const message of [
      { type: 'ambientShown' },
      { type: 'ambientShown', running: 'yes', resting: false, ticks: 1 },
      { type: 'ambientShown', running: true, ticks: 1 },
      { type: 'ambientShown', running: true, resting: 'no', ticks: 1 },
      { type: 'ambientShown', running: true, resting: false, ticks: -1 },
      { type: 'ambientShown', running: true, resting: false, ticks: 1.5 },
      { type: 'ambientShown', running: true, resting: false, ticks: '3' },
      { type: 'ambientShown', resting: false, ticks: 3 },
    ]) {
      expect(parseWebviewMessage(message), JSON.stringify(message)).toBeUndefined();
    }
  });
});
