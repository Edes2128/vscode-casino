import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { installDiagnostics } from './diagnostics';
import { connectToHost } from './host';
import './styles/global.css';
import './styles/pixel.css';
import './styles/animations.css';
import './styles/casino.css';
import './styles/blackjack.css';
import './styles/cards.css';
import './styles/roulette.css';
import './styles/settings.css';
import './styles/customize.css';
import './styles/themes.css';
import './styles/sounds.css';
import './styles/ambient.css';

const host = connectToHost();
installDiagnostics(host);

const container = document.getElementById('root');
if (container === null) {
  throw new Error('Casino webview: missing #root element');
}

const root = createRoot(container);

if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('gallery')) {
  // Style guide for design work. Dead-code-eliminated from production builds.
  void import('./dev/Gallery').then(({ Gallery }) =>
    root.render(
      <StrictMode>
        <Gallery />
      </StrictMode>,
    ),
  );
} else {
  root.render(
    <StrictMode>
      <App host={host} />
    </StrictMode>,
  );
}
