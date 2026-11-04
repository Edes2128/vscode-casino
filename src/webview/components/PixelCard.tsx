import { useId, type ReactNode } from 'react';
import { cx } from '../cx';

export type CardTone = 'neutral' | 'neon' | 'gold' | 'red' | 'felt';

interface PixelCardProps {
  readonly title?: string;
  readonly tone?: CardTone;
  readonly className?: string;
  readonly children: ReactNode;
}

/** A notched 8-bit panel with an optional title bar. */
export function PixelCard({ title, tone = 'neutral', className, children }: PixelCardProps) {
  const headingId = useId();

  return (
    <section
      className={cx('px-card', 'px-frame', `px-card--${tone}`, className)}
      {...(title === undefined ? {} : { 'aria-labelledby': headingId })}
    >
      {title !== undefined && (
        <h2 id={headingId} className="px-card__title">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}
