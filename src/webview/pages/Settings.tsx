import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Settings as LuckyBreakSettings, SettingsPatch, TextSize } from '../../state/settings';
import type { ResetOutcome, ResetScope } from '../../game/resetScope';
import { PixelButton } from '../components/PixelButton';
import { PixelCard } from '../components/PixelCard';
import { SegmentedControl } from '../components/SegmentedControl';
import { SupportButton } from '../components/SupportButton';
import { Toggle } from '../components/Toggle';
import { VolumeSlider } from '../components/VolumeSlider';
import type { MotionLevel } from '../motion';
import { resetResultText } from '../settingsText';
import { useSound } from '../sound/SoundProvider';

export interface ResetResult {
  readonly id: number;
  readonly scope: ResetScope;
  readonly outcome: ResetOutcome;
}

interface SettingsProps {
  readonly settings: LuckyBreakSettings;
  /** The extension version, from the host. */
  readonly version: string | undefined;
  /** What Lucky Break is actually doing, after the system's own motion preference is taken into account. */
  readonly motion: MotionLevel;
  /** The operating system asks for reduced motion. */
  readonly systemReducedMotion: boolean;
  readonly resetResult: ResetResult | undefined;
  readonly onChange: (patch: SettingsPatch) => void;
  /** Asks the host to reset. The host asks the player to confirm. */
  readonly onReset: (scope: ResetScope) => void;
  readonly onSupport: () => void;
  /** Opens the Customize screen: themes, cards, wheel animations, sound packs and colors. */
  readonly onOpenCustomize?: (() => void) | undefined;
}

const RESETS: ReadonlyArray<{ scope: ResetScope; label: string; hint: string; variant: 'primary' | 'danger' }> = [
  { scope: 'balance', label: 'RESET BALANCE', hint: 'Back to 1,000 chips. Statistics are kept.', variant: 'primary' },
  { scope: 'statistics', label: 'RESET STATS', hint: 'Clears the statistics and the history. Chips are kept.', variant: 'primary' },
  { scope: 'all', label: 'RESET ALL', hint: 'Balance, statistics and history. Settings are kept.', variant: 'danger' },
];

const NOTICE_MS = 6_000;

const TEXT_SIZE_OPTIONS = [
  { value: 'normal', label: 'NORMAL' },
  { value: 'large', label: 'LARGE' },
  { value: 'xlarge', label: 'EXTRA LARGE' },
] as const satisfies ReadonlyArray<{ value: TextSize; label: string }>;

export function Settings({
  settings,
  version,
  motion,
  systemReducedMotion,
  resetResult,
  onChange,
  onReset,
  onSupport,
  onOpenCustomize,
}: SettingsProps) {
  // Waiting for the player's answer in VS Code's dialog. The window is blocked while it is open.
  const [asking, setAsking] = useState<ResetScope>();
  const [notice, setNotice] = useState<string>();
  const play = useSound();
  const demo = useRef<number[]>([]);
  useEffect(() => () => demo.current.forEach((timer) => window.clearTimeout(timer)), []);

  useEffect(() => {
    if (resetResult === undefined) return;
    setAsking(undefined);
    setNotice(resetResultText(resetResult.scope, resetResult.outcome));
    const timer = window.setTimeout(() => setNotice(undefined), NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [resetResult]);

  /** A short sample of the effects, at the volume that is set now. */
  const testSound = (): void => {
    demo.current.forEach((timer) => window.clearTimeout(timer));
    play('chip');
    demo.current = [
      window.setTimeout(() => play('card', { count: 2 }), 300),
      window.setTimeout(() => play('win'), 800),
    ];
  };

  const reset = (scope: ResetScope): void => {
    setAsking(scope);
    setNotice(undefined);
    onReset(scope);
  };

  return (
    <>
      <h1 className="page-title">SETTINGS</h1>

      <PixelCard title="SOUND" tone="neon">
        <SettingRow label="SOUND EFFECTS" hint="Chips, cards, the wheel and results.">
          <Toggle
            label="Sound effects"
            checked={settings.sound}
            silent
            onChange={(sound) => {
              onChange({ sound });
              // Switching sound on answers with a click. It has to be forced: the setting is not saved yet.
              if (sound) play('click', { force: true });
            }}
          />
        </SettingRow>
        <SettingRow label="VOLUME" hint={settings.sound ? undefined : 'Sound is off.'}>
          <VolumeSlider
            volume={settings.volume}
            disabled={!settings.sound}
            onChange={(volume) => {
              onChange({ volume });
              // Hear the new loudness while sliding, before the host has even confirmed it.
              play('tick', { volume });
            }}
          />
        </SettingRow>
        <PixelButton size="sm" variant="ghost" block disabled={!settings.sound || settings.volume === 0} onClick={testSound}>
          TEST SOUND
        </PixelButton>
        <p className="setting-note">MORE SOUNDS: STYLE &gt; SOUNDS</p>
      </PixelCard>

      {onOpenCustomize !== undefined && (
        <PixelCard title="LOOK AND FEEL">
          <p className="setting-note">8 THEMES, 6 CARD DESIGNS, 5 WHEEL ANIMATIONS, 5 SOUND PACKS AND YOUR OWN COLORS. ALL FREE.</p>
          <PixelButton size="sm" block onClick={onOpenCustomize}>
            OPEN CUSTOMIZE
          </PixelButton>
        </PixelCard>
      )}

      <PixelCard title="TEXT SIZE">
        <SettingRow label="SIZE" hint="Makes every letter in Lucky Break bigger. Try it: the whole screen changes.">
          <SegmentedControl
            label="Text size"
            options={TEXT_SIZE_OPTIONS}
            value={settings.textSize}
            onChange={(textSize) => onChange({ textSize })}
          />
        </SettingRow>
      </PixelCard>

      <PixelCard title="MOTION" tone="gold">
        <SettingRow label="ANIMATIONS" hint="Dealing, the dealer's reveal and the wheel. Off shows every result at once.">
          <Toggle label="Animations" checked={settings.animations} onChange={(animations) => onChange({ animations })} />
        </SettingRow>
        <SettingRow
          label="REDUCED MOTION"
          hint="Nothing moves, flashes or floats. Results still come one step at a time."
        >
          <Toggle
            label="Reduced motion"
            checked={settings.reducedMotion || systemReducedMotion}
            disabled={systemReducedMotion}
            onChange={(reducedMotion) => onChange({ reducedMotion })}
          />
        </SettingRow>
        {systemReducedMotion && <p className="setting-note">YOUR SYSTEM ASKS FOR REDUCED MOTION, SO IT IS ON.</p>}
        <p className="setting-note" data-testid="motion-state">
          {motion === 'full' ? 'FULL ANIMATION.' : motion === 'calm' ? 'CALM: STEP BY STEP, NO MOVEMENT.' : 'ANIMATION OFF: RESULTS AT ONCE.'}
        </p>
      </PixelCard>

      <PixelCard title="YOUR DATA" tone="red">
        <p className="setting-note">EVERY RESET ASKS YOU TO CONFIRM FIRST.</p>
        {RESETS.map((item) => (
          <div key={item.scope} className="setting setting--stacked">
            <PixelButton
              variant={item.variant}
              size="sm"
              block
              disabled={asking !== undefined}
              onClick={() => reset(item.scope)}
            >
              {asking === item.scope ? 'WAITING FOR YOU' : item.label}
            </PixelButton>
            <span className="setting__hint">{item.hint}</span>
          </div>
        ))}
        {notice !== undefined && (
          <p className="setting-notice" role="status">
            {notice}
          </p>
        )}
      </PixelCard>

      <PixelCard title="ABOUT">
        <p className="about__name">LUCKY BREAK</p>
        <p className="about__version">VERSION {version ?? '?'}</p>
        <p className="setting-note">RETRO PIXEL-ART BLACKJACK AND ROULETTE. VIRTUAL CHIPS ONLY. NO REAL MONEY. EVER.</p>
        <SupportButton onClick={onSupport} />
      </PixelCard>
    </>
  );
}

function SettingRow({ label, hint, children }: { label: string; hint?: string | undefined; children: ReactNode }) {
  return (
    <div className="setting">
      <div className="setting__text">
        <span className="setting__label">{label}</span>
        {hint !== undefined && <span className="setting__hint">{hint}</span>}
      </div>
      <div className="setting__control">{children}</div>
    </div>
  );
}
