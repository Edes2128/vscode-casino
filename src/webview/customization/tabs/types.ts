import type { Settings, SettingsPatch } from '../../../casino/settings';

/** What every tab of the Customize screen is given. A tab changes settings only through `onChange`. */
export interface CustomizeTabProps {
  readonly settings: Settings;
  readonly onChange: (patch: SettingsPatch) => void;
}
