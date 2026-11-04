import { cx } from '../cx';

interface ToggleProps {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  /** Accessible name. The visible label sits next to the switch, so this repeats it for screen readers. */
  readonly label: string;
  readonly disabled?: boolean;
  /** No click sound of its own, because the screen answers the switch itself. */
  readonly silent?: boolean;
}

/** A pixel-art on/off switch. A real button with the `switch` role, so the keyboard and screen readers work. */
export function Toggle({ checked, onChange, label, disabled = false, silent = false }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      {...(silent ? { 'data-sound': 'none' } : {})}
      className={cx('px-toggle', checked && 'px-toggle--on')}
      onClick={() => onChange(!checked)}
    >
      <span className="px-toggle__knob" aria-hidden="true" />
      <span className="px-toggle__state" aria-hidden="true">
        {checked ? 'ON' : 'OFF'}
      </span>
    </button>
  );
}
