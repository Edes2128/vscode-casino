import { useEffect, useState } from 'react';
import { MAX_VOLUME, MIN_VOLUME } from '../../casino/settings';
import { cssVars } from '../cssVars';
import { volumeText } from '../settingsText';

interface VolumeSliderProps {
  /** The saved volume, 0 to 100. */
  readonly volume: number;
  readonly onChange: (volume: number) => void;
  readonly disabled?: boolean;
}

export const VOLUME_STEP = 5;

/** How long a dragged value is kept on screen while waiting for the host to confirm it. */
const DRAFT_MS = 1_000;

/**
 * The volume slider. While it is being dragged it shows the value under the thumb, not the one the
 * host last confirmed, so it never jumps back; the host's value takes over once it catches up.
 */
export function VolumeSlider({ volume, onChange, disabled = false }: VolumeSliderProps) {
  const [draft, setDraft] = useState<number>();

  useEffect(() => {
    if (draft === undefined) return;
    if (draft === volume) {
      setDraft(undefined);
      return;
    }
    // Another view may have changed it meanwhile: do not hold on to a stale drag forever.
    const timer = window.setTimeout(() => setDraft(undefined), DRAFT_MS);
    return () => window.clearTimeout(timer);
  }, [draft, volume]);

  const shown = draft ?? volume;

  return (
    <div className="px-slider">
      <input
        type="range"
        className="px-slider__input"
        min={MIN_VOLUME}
        max={MAX_VOLUME}
        step={VOLUME_STEP}
        value={shown}
        disabled={disabled}
        aria-label="Volume"
        aria-valuetext={volumeText(shown)}
        style={cssVars({ '--fill': `${shown}%` })}
        onChange={(event) => {
          const next = Number(event.currentTarget.value);
          setDraft(next);
          onChange(next);
        }}
      />
      <output className="px-slider__value">{volumeText(shown)}</output>
    </div>
  );
}
