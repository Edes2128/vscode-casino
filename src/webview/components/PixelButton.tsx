import type { ButtonHTMLAttributes } from 'react';
import { cx } from '../cx';

export type ButtonVariant = 'primary' | 'gold' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface PixelButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  /** Stretch to the full width of the container. */
  readonly block?: boolean;
}

/** Chunky arcade button with a bevel, notched corners and a press-down animation. */
export function PixelButton({
  variant = 'primary',
  size = 'md',
  block = false,
  className,
  type = 'button',
  ...rest
}: PixelButtonProps) {
  return (
    <button
      type={type}
      className={cx('px-button', `px-button--${variant}`, `px-button--${size}`, block && 'px-button--block', className)}
      {...rest}
    />
  );
}
