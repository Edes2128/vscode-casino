import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_SETTINGS, type SettingsPatch } from '../casino/settings';
import type { CasinoSnapshot } from '../casino/types';
import type { BlackjackAction } from '../game/blackjack/view';
import type { ResetScope } from '../game/resetScope';
import type { RouletteAction } from '../game/roulette/view';
import { CasinoHeader } from './components/CasinoHeader';
import { NavBar } from './components/NavBar';
import { PixelParticles } from './components/PixelParticles';
import { SupportButton } from './components/SupportButton';
import type { HostConnection } from './host';
import { useCasinoHost } from './hooks/useCasinoHost';
import { useAmbientClock, type AmbientState } from './hooks/useAmbientClock';
import { useHostNavigation } from './hooks/useHostNavigation';
import { useRenderReport } from './hooks/useRenderReport';
import { useSettingsReport } from './hooks/useSettingsReport';
import { useSnapshotReport } from './hooks/useSnapshotReport';
import { MotionContext, motionLevel, useSystemReducedMotion } from './motion';
import type { Page } from './navigation';
import { Blackjack, type BlackjackShown } from './pages/Blackjack';
import { Home } from './pages/Home';
import { Roulette, type RouletteShown } from './pages/Roulette';
import { Settings } from './pages/Settings';
import { Statistics } from './pages/Statistics';
import { PresentationContext } from './presentation';
import { ButtonSounds, SoundProvider } from './sound/SoundProvider';

interface AppProps {
  readonly host: HostConnection;
}

/** The balance is never held on screen for longer than this, whatever happens. */
const MAX_HOLD_MS = 20_000;

/** The support button belongs on the calm screens, never next to the controls of a game. */
const SHOWS_SUPPORT: readonly Page[] = ['home', 'statistics'];

export function App({ host }: AppProps) {
  const { init, snapshot, blackjack, roulette, rejection, settings, resetResult } = useCasinoHost(host);
  const [page, setPage] = useState<Page>('home');
  const [heldBalance, setHeldBalance] = useState<number>();

  useHostNavigation(host, setPage);
  useRenderReport(host, init !== undefined && snapshot !== undefined);
  useSnapshotReport(host, snapshot);
  useSettingsReport(host, settings);

  // Until the host sends the saved settings the defaults apply, which never make anything louder or
  // busier than the player's own choice would, because sound waits for the real settings (see below).
  const effectiveSettings = settings ?? DEFAULT_SETTINGS;
  const systemReducedMotion = useSystemReducedMotion();
  const motion = motionLevel(effectiveSettings, systemReducedMotion);
  const appRef = useRef<HTMLDivElement>(null);
  const reportAmbient = useCallback((state: AmbientState) => host.post({ type: 'ambientShown', ...state }), [host]);
  useAmbientClock(appRef, motion === 'full', reportAmbient, page);

  // Every screen starts at the top, like switching to a new level.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);

  // A game may hold the old balance on screen while it finishes showing a result. Never forever.
  useEffect(() => {
    if (heldBalance === undefined) return;
    const timer = window.setTimeout(() => setHeldBalance(undefined), MAX_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [heldBalance]);
  const presentation = useMemo(() => ({ holdBalance: setHeldBalance }), []);

  const sendBlackjack = useCallback((action: BlackjackAction) => host.post({ type: 'blackjack', action }), [host]);
  const reportBlackjack = useCallback((shown: BlackjackShown) => host.post({ type: 'blackjackShown', ...shown }), [host]);
  const sendRoulette = useCallback((action: RouletteAction) => host.post({ type: 'roulette', action }), [host]);
  const reportRoulette = useCallback((shown: RouletteShown) => host.post({ type: 'rouletteShown', ...shown }), [host]);
  const openSupport = useCallback(() => host.post({ type: 'openSupport' }), [host]);
  const changeSettings = useCallback((patch: SettingsPatch) => host.post({ type: 'settings', patch }), [host]);
  const requestReset = useCallback((scope: ResetScope) => host.post({ type: 'reset', scope }), [host]);
  const goHome = useCallback(() => setPage('home'), []);
  const openSettings = useCallback(() => setPage('settings'), []);

  const shownBalance = heldBalance ?? snapshot?.balance;

  const renderPage = (current: Page, state: CasinoSnapshot) => {
    switch (current) {
      case 'home':
        return <Home snapshot={state} onNavigate={setPage} />;
      case 'blackjack':
        return (
          <Blackjack
            view={blackjack}
            balance={shownBalance}
            rejection={rejection}
            onAction={sendBlackjack}
            onBack={goHome}
            onOpenSettings={openSettings}
            onShown={reportBlackjack}
          />
        );
      case 'roulette':
        return (
          <Roulette
            view={roulette}
            balance={shownBalance}
            rejection={rejection}
            onAction={sendRoulette}
            onBack={goHome}
            onOpenSettings={openSettings}
            onShown={reportRoulette}
          />
        );
      case 'statistics':
        return <Statistics snapshot={state} />;
      case 'settings':
        return (
          <Settings
            settings={effectiveSettings}
            version={init?.extensionVersion}
            motion={motion}
            systemReducedMotion={systemReducedMotion}
            resetResult={resetResult}
            onChange={changeSettings}
            onReset={requestReset}
            onSupport={openSupport}
          />
        );
    }
  };

  return (
    <PresentationContext.Provider value={presentation}>
      <MotionContext.Provider value={motion}>
      <SoundProvider settings={settings}>
      <ButtonSounds />
      <div ref={appRef} className="casino-app" data-view={init?.viewKind} data-motion={motion}>
        {motion === 'full' && <PixelParticles />}
        <div className="casino-top">
          <CasinoHeader balance={shownBalance} />
          <NavBar current={page} onNavigate={setPage} />
        </div>
        <main className="casino-main">
          <div className="page" key={page}>
            {snapshot === undefined ? <Connecting /> : renderPage(page, snapshot)}
          </div>
        </main>
        <footer className="casino-footer">
          {SHOWS_SUPPORT.includes(page) && <SupportButton onClick={openSupport} />}
          <p>VIRTUAL CHIPS ONLY. NO REAL MONEY. EVER.</p>
        </footer>
      </div>
      </SoundProvider>
      </MotionContext.Provider>
    </PresentationContext.Provider>
  );
}

function Connecting() {
  return <p className="connecting">CONNECTING</p>;
}
