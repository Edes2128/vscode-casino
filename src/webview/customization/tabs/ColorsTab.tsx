import { useEffect, useRef, useState } from 'react';
import { COLOR_SLOTS, type ColorSlot, type CustomColors } from '../../../casino/appearance';
import { PixelButton } from '../../components/PixelButton';
import { cx } from '../../cx';
import { resolveAppearance } from '../appearance';
import { COLOR_PRESETS, COLOR_SLOT_INFO, normalizeHex } from '../colorPresets';
import { DebouncedCommit } from '../debouncedCommit';
import { ScenePreview } from '../ScenePreview';
import { themeOf } from '../themes';
import type { CustomizeTabProps } from './types';

/** A picked color is sent to the host this long after the last change, so dragging the picker does not flood it. */
const COMMIT_MS = 350;

const sameColors = (a: CustomColors, b: CustomColors): boolean => COLOR_SLOTS.every((slot) => a[slot] === b[slot]);

/**
 * The six colors the player may set, ready-made sets of them, a preview that follows every change as it is made,
 * and one button that hands every color back to the theme. Text is never allowed to become hard to read: a color
 * that would do that is nudged, and the screen says so.
 */
export function ColorsTab({ settings, onChange }: CustomizeTabProps) {
  const [draft, setDraft] = useState<CustomColors>(settings.colors);
  const send = useRef(onChange);
  send.current = onChange;
  const [commits] = useState(() => new DebouncedCommit<CustomColors>((colors) => send.current({ colors }), COMMIT_MS));

  // Follow the saved colors (a reset, or the other view) unless a change of ours is still on its way.
  useEffect(() => {
    if (!commits.isWaiting) setDraft(settings.colors);
  }, [settings.colors, commits]);

  // Leaving the tab sends what is waiting, so a color picked a moment ago is never lost.
  useEffect(() => () => commits.flush(), [commits]);

  const commit = (next: CustomColors, immediately = false): void => {
    setDraft(next);
    if (immediately) commits.now(next);
    else commits.schedule(next);
  };

  const setSlot = (slot: ColorSlot, color: string | undefined, immediately = false): void => {
    const next: { -readonly [K in ColorSlot]?: string } = { ...draft };
    if (color === undefined) delete next[slot];
    else next[slot] = color;
    commit(next, immediately);
  };

  const preview = resolveAppearance(settings.theme, draft);
  const base = resolveAppearance(settings.theme).tokens;
  const hasCustom = COLOR_SLOTS.some((slot) => draft[slot] !== undefined);
  const baseColor: Readonly<Record<ColorSlot, string>> = {
    table: base.felt,
    background: base.bg,
    accent: base.neon,
    button: base.button,
    text: base.white,
    chip: base.chip ?? '#f2f0e8',
  };

  return (
    <>
      <p className="customize__intro">
        MAKE IT YOURS. YOUR COLORS SIT ON TOP OF THE {themeOf(settings.theme).name.toUpperCase()} THEME. TEXT ALWAYS STAYS EASY TO READ.
      </p>

      <div className="colors-preview">
        <ScenePreview resolved={preview} title="Preview of your colors" />
      </div>

      <div className="presets" role="group" aria-label="Color presets">
        {COLOR_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={cx('preset', sameColors(draft, preset.colors) && 'preset--active')}
            aria-pressed={sameColors(draft, preset.colors)}
            onClick={() => commit({ ...preset.colors }, true)}
          >
            <span className="preset__swatches" aria-hidden="true">
              {COLOR_SLOTS.filter((slot) => preset.colors[slot] !== undefined).slice(0, 4).map((slot) => (
                <span key={slot} className="preset__swatch" style={{ backgroundColor: preset.colors[slot] }} />
              ))}
            </span>
            {preset.name.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="color-fields">
        {COLOR_SLOTS.map((slot) => (
          <ColorField
            key={slot}
            slot={slot}
            value={draft[slot]}
            shown={draft[slot] ?? baseColor[slot]}
            adjusted={preview.adjusted.includes(slot)}
            onPick={(color) => setSlot(slot, color)}
            onCommit={(color) => setSlot(slot, color, true)}
            onClear={() => setSlot(slot, undefined, true)}
          />
        ))}
      </div>

      <PixelButton size="sm" variant="ghost" block disabled={!hasCustom} onClick={() => commit({}, true)}>
        RESET TO THEME COLORS
      </PixelButton>
    </>
  );
}

interface ColorFieldProps {
  readonly slot: ColorSlot;
  /** The player's color, or `undefined` while the slot follows the theme. */
  readonly value: string | undefined;
  /** What is drawn now: the player's color, or the theme's. */
  readonly shown: string;
  readonly adjusted: boolean;
  /** A color was picked or typed; it is sent once the changes stop. */
  readonly onPick: (color: string) => void;
  /** Done typing: send it now. */
  readonly onCommit: (color: string) => void;
  readonly onClear: () => void;
}

function ColorField({ slot, value, shown, adjusted, onPick, onCommit, onClear }: ColorFieldProps) {
  const info = COLOR_SLOT_INFO[slot];
  const [text, setText] = useState(shown);
  useEffect(() => setText(shown), [shown]);
  const typed = normalizeHex(text);
  const invalid = text !== shown && typed === undefined;

  return (
    <div className="color-field">
      <div className="color-field__text">
        <span className="setting__label">{info.label}</span>
        <span className="setting__hint">{info.hint}</span>
        {adjusted && <span className="color-field__adjusted">ADJUSTED SO TEXT STAYS READABLE</span>}
      </div>
      <div className="color-field__controls">
        <input
          type="color"
          className="color-field__picker"
          aria-label={`${info.label} color`}
          value={shown}
          onChange={(event) => onPick(event.currentTarget.value)}
        />
        <input
          type="text"
          className="color-field__hex"
          aria-label={`${info.label} color as #rrggbb`}
          aria-invalid={invalid}
          maxLength={7}
          spellCheck={false}
          autoComplete="off"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            const color = normalizeHex(event.target.value);
            if (color !== undefined) onPick(color);
          }}
          onBlur={() => (typed === undefined ? setText(shown) : onCommit(typed))}
        />
        <button type="button" className="color-field__clear" disabled={value === undefined} aria-label={`${info.label}: back to the theme's color`} onClick={onClear}>
          {value === undefined ? 'THEME' : 'RESET'}
        </button>
      </div>
    </div>
  );
}
