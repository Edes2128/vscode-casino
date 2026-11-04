import type { CSSProperties } from 'react';

type CssVars = Readonly<Record<`--${string}`, string | number>>;

/**
 * Typed way to pass CSS custom properties through `style`. React applies them with
 * `style.setProperty`, which the webview's CSP allows (unlike inline `style=""` markup).
 */
export function cssVars(vars: CssVars): CSSProperties {
  return vars as CSSProperties;
}
