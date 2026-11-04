import { useEffect, useRef } from 'react';
import type { HostConnection } from '../host';

/** Fonts every screen relies on; the report tells the host whether they actually loaded. */
const REQUIRED_FONTS = ['12px "Press Start 2P"', '20px "VT323"'] as const;

/** Whether this webview can make sound. Only asks; nothing is created, so nothing can play. */
export const hasWebAudio = (): boolean =>
  typeof (window.AudioContext ?? window.webkitAudioContext) === 'function';

/** Tells the host once that the app rendered, whether the pixel fonts resolved under the CSP, and whether sound is possible. */
export function useRenderReport(host: HostConnection, rendered: boolean): void {
  const reported = useRef(false);

  useEffect(() => {
    if (!rendered || reported.current) return;
    reported.current = true;

    Promise.all(REQUIRED_FONTS.map((font) => document.fonts.load(font)))
      .then((results) => results.every((faces) => faces.length > 0))
      .catch(() => false)
      .then((fontsLoaded) => host.post({ type: 'rendered', fontsLoaded, audioAvailable: hasWebAudio() }));
  }, [host, rendered]);
}
