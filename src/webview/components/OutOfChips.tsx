import { PixelButton } from './PixelButton';

interface OutOfChipsProps {
  /** Takes the player to the settings screen, where the balance can be reset. */
  readonly onOpenSettings: () => void;
}

/** Shown in place of the bet controls when the balance is below the minimum bet. */
export function OutOfChips({ onOpenSettings }: OutOfChipsProps) {
  return (
    <>
      <p className="bj-broke">OUT OF CHIPS. YOU CAN RESET YOUR BALANCE IN SETTINGS.</p>
      <PixelButton variant="gold" size="lg" block onClick={onOpenSettings}>
        OPEN SETTINGS
      </PixelButton>
    </>
  );
}
