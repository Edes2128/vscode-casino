import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { SOUND_CATEGORIES, type SoundCategory, type SoundPackId } from '../../../state/appearance';
import { PixelButton } from '../../components/PixelButton';
import { PixelCard } from '../../components/PixelCard';
import { Toggle } from '../../components/Toggle';
import { VolumeSlider } from '../../components/VolumeSlider';
import { cx } from '../../cx';
import { useMotion, type MotionLevel } from '../../motion';
import { CATEGORY_SAMPLES, SAMPLE_STEPS, startSample } from '../../sound/sample';
import { useSound, type Play } from '../../sound/SoundProvider';
import { ChoiceCard, ChoiceGrid } from '../ChoiceCard';
import { SOUND_CATEGORY_INFO, SOUND_PACK_CATALOG, soundPackInfo } from '../soundPacks';
import type { CustomizeTabProps } from './types';

/**
 * The shape of each pack's waveform, drawn as a pixel line: pulses that fade for Lucky Break, a square wave for
 * the arcade, a triangle wave for the adventure, a saw for the cyber pack and a thin sine for the minimal one.
 * It is a picture of how the pack sounds, not of the exact sound. It never moves.
 */
const WAVES: Readonly<Record<SoundPackId, string>> = {
  classic: 'M0 14 H3 V2 H6 V14 H9 V6 H12 V14 H15 V9 H18 V14 H21 V11 H24 V14 H32',
  arcade: 'M0 14 H4 V3 H8 V14 H12 V3 H16 V14 H20 V3 H24 V14 H28 V3 H32',
  adventure: 'M0 14 L4 3 L8 14 L12 3 L16 14 L20 3 L24 14 L28 3 L32 14',
  cyber: 'M0 14 L8 3 V14 L16 3 V14 L24 3 V14 L32 3',
  minimal: 'M0 9 Q4 3 8 9 T16 9 T24 9 T32 9',
};

function SoundGlyph({ pack }: { readonly pack: SoundPackId }) {
  return (
    <svg className="sound-glyph" viewBox="0 0 32 16" aria-hidden="true" focusable="false">
      <path className="sound-glyph__line" d={WAVES[pack]} />
    </svg>
  );
}

/**
 * Plays a pack's sample one step at a time, so the screen can show which sound is playing: there is no other
 * sign of it for someone who cannot hear. It follows the player's switches, and stops if the pack changes or
 * the player leaves the tab.
 */
function useSample(play: Play, pack: SoundPackId) {
  const [step, setStep] = useState<number>();
  const stop = useRef<(() => void) | undefined>(undefined);

  const cancel = useCallback((): void => {
    stop.current?.();
    stop.current = undefined;
  }, []);

  useEffect(() => cancel, [cancel]);
  useEffect(() => {
    cancel();
    setStep(undefined);
  }, [pack, cancel]);

  const start = (): void => {
    cancel();
    stop.current = startSample(play, pack, setStep);
  };

  return { step, start };
}

interface SampleStepsProps {
  /** The step that is playing now, if any. */
  readonly current: number | undefined;
  readonly motion: MotionLevel;
}

/**
 * The sounds of the sample in order, the one that is playing marked. The mark is a change of color and a
 * `current` flag, not a movement; only with full animation does the mark also hop once as it arrives.
 */
export function SampleSteps({ current, motion }: SampleStepsProps) {
  return (
    <ol className={cx('sample-steps', motion === 'full' && 'sample-steps--lively')} aria-label="The sounds of the sample, in order">
      {SAMPLE_STEPS.map((step, index) => (
        <li
          key={step.label}
          className={cx('sample-step', index === current && 'sample-step--now')}
          {...(index === current ? { 'aria-current': 'step' as const } : {})}
        >
          {step.label}
        </li>
      ))}
    </ol>
  );
}

/**
 * The sound packs and what plays. Sound on or off and the volume are here too, so everything about sound is in
 * one place (the Settings screen keeps its own switch and volume, which are the same two settings).
 */
export function SoundsTab({ settings, onChange }: CustomizeTabProps) {
  const play = useSound();
  const motion = useMotion();
  const { step, start } = useSample(play, settings.soundPack);

  const pack = soundPackInfo(settings.soundPack);
  const anyCategoryOn = SOUND_CATEGORIES.some((category) => settings.soundCategories[category]);
  const sampleBlocked = !settings.sound
    ? 'SOUND IS OFF. SWITCH IT ON TO HEAR A SAMPLE.'
    : settings.volume === 0
      ? 'THE VOLUME IS AT 0. TURN IT UP TO HEAR A SAMPLE.'
      : !anyCategoryOn
        ? 'EVERY KIND OF SOUND IS OFF BELOW. SWITCH ONE ON TO HEAR A SAMPLE.'
        : undefined;

  const setCategory = (category: SoundCategory, on: boolean): void => {
    onChange({ soundCategories: { ...settings.soundCategories, [category]: on } });
    // Switching one on answers with it, so the player hears what they just got back. The switch is not saved yet.
    if (on) {
      const sample = CATEGORY_SAMPLES[category];
      play(sample.cue, { ...sample.options, pack: settings.soundPack, ignoreCategory: true });
    }
  };

  return (
    <>
      <p className="customize__intro">
        PICK HOW LUCKY BREAK SOUNDS. EVERY SOUND IS MADE RIGHT HERE, SO THERE IS NOTHING TO DOWNLOAD AND IT WORKS OFFLINE.
      </p>

      <PixelCard title="SOUND" tone="neon">
        <SettingRow label="SOUND EFFECTS" hint="Chips, cards, the wheel and results.">
          <Toggle
            label="Sound effects"
            checked={settings.sound}
            silent
            onChange={(sound) => {
              onChange({ sound });
              // Switching sound on answers with a click. It has to be forced: the setting is not saved yet.
              if (sound) play('click', { force: true, pack: settings.soundPack });
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
      </PixelCard>

      <div className="sound-packs" data-sound="none">
        <ChoiceGrid label="Sound pack">
          {SOUND_PACK_CATALOG.map((entry) => (
            <ChoiceCard
              key={entry.id}
              selected={settings.soundPack === entry.id}
              label={entry.name.toUpperCase()}
              description={entry.blurb.toUpperCase()}
              onSelect={() => {
                onChange({ soundPack: entry.id });
                // The wrapper above keeps the ordinary click quiet, so the pack just picked answers with its own.
                play('click', { pack: entry.id });
              }}
            >
              <SoundGlyph pack={entry.id} />
            </ChoiceCard>
          ))}
        </ChoiceGrid>
      </div>

      <div className="sound-sample">
        <div className="sound-sample__head">
          <span className="sound-sample__name">{pack.name.toUpperCase()}</span>
          <PixelButton
            size="sm"
            data-sound="none"
            disabled={sampleBlocked !== undefined}
            aria-describedby={sampleBlocked === undefined ? undefined : 'sound-sample-hint'}
            onClick={start}
          >
            PLAY SAMPLE
          </PixelButton>
        </div>
        <SampleSteps current={step} motion={motion} />
        {sampleBlocked !== undefined && (
          <p id="sound-sample-hint" className="setting-note">
            {sampleBlocked}
          </p>
        )}
      </div>

      <PixelCard title="WHAT PLAYS" tone="gold">
        {SOUND_CATEGORIES.map((category) => {
          const info = SOUND_CATEGORY_INFO[category];
          return (
            <SettingRow key={category} label={info.label.toUpperCase()} hint={info.hint}>
              <Toggle
                label={`${info.label} sounds`}
                checked={settings.soundCategories[category]}
                silent
                onChange={(on) => setCategory(category, on)}
              />
            </SettingRow>
          );
        })}
        {!settings.sound && <p className="setting-note">SOUND IS OFF, SO NOTHING PLAYS. THESE SWITCHES ARE KEPT FOR WHEN IT IS ON.</p>}
      </PixelCard>
    </>
  );
}

function SettingRow({ label, hint, children }: { readonly label: string; readonly hint?: string | undefined; readonly children: ReactNode }) {
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
