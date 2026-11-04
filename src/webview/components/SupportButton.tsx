import { COFFEE } from '../art/sprites';
import { PixelButton } from './PixelButton';
import { PixelSprite } from './PixelSprite';

interface SupportButtonProps {
  readonly onClick: () => void;
}

/**
 * "Support me": an optional tip for the developer on Buy Me a Coffee. It only asks the host to
 * open the page in the browser, so nothing is loaded inside the webview. The note keeps it clear
 * that this is not a way to get in-game chips: the casino is virtual chips only.
 */
export function SupportButton({ onClick }: SupportButtonProps) {
  return (
    <div className="support">
      <PixelButton
        variant="support"
        size="sm"
        onClick={onClick}
        aria-label="Support me: leave the developer an optional tip on Buy Me a Coffee. Opens in your browser. It gives no chips."
      >
        <PixelSprite rows={COFFEE.rows} palette={COFFEE.palette} className="support__cup" />
        SUPPORT ME
      </PixelButton>
      <p className="support__note">OPTIONAL TIP FOR THE DEVELOPER. IT GIVES NO CHIPS.</p>
    </div>
  );
}
