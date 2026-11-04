import type { ReactNode } from 'react';
import { PixelButton } from './PixelButton';

interface GameShellProps {
  readonly title: string;
  readonly onBack: () => void;
  readonly children: ReactNode;
}

/** Frame shared by every game screen: a back-to-lobby button and the game's title. */
export function GameShell({ title, onBack, children }: GameShellProps) {
  return (
    <>
      <div className="game-shell__bar">
        <PixelButton size="sm" variant="ghost" onClick={onBack} aria-label="Back to lobby">
          &lt; LOBBY
        </PixelButton>
        <h1 className="game-shell__title">{title}</h1>
      </div>
      {children}
    </>
  );
}
