import { COFFEE_ICON, ICON_PALETTE } from '../art/sprites';
import { PixelButton } from './PixelButton';
import { PixelSprite } from './PixelSprite';

interface SupportButtonProps {
  readonly onClick: () => void;
}

/** What the invitation says. One place, so the screens that show it cannot drift apart. */
export const SUPPORT_TEXT = 'Enjoying Lucky Break? Buy me a coffee!';

/**
 * An optional tip for the developer on Buy Me a Coffee. It only asks the host to open the page in the browser
 * (the address is fixed on the host, in `src/shared/support.ts`), so nothing is loaded inside the webview. It is a
 * small, quiet button in the theme's own colors, shown on the calm screens (the lobby and the settings' About), never
 * beside the controls of a game, never as a pop-up. Nothing in Lucky Break depends on it: every option is free, and
 * it gives no chips.
 */
export function SupportButton({ onClick }: SupportButtonProps) {
  return (
    <div className="support">
      <p className="support__text">{SUPPORT_TEXT}</p>
      <PixelButton
        variant="support"
        size="sm"
        onClick={onClick}
        aria-label="Buy me a coffee: an optional tip for the developer. Opens in your browser. It gives no chips and unlocks nothing."
      >
        <PixelSprite rows={COFFEE_ICON} palette={ICON_PALETTE} className="support__cup" />
        BUY ME A COFFEE
      </PixelButton>
      <p className="support__note">OPTIONAL. EVERYTHING IN LUCKY BREAK IS FREE.</p>
    </div>
  );
}
