import { vars } from "nativewind";
import { getThemeTokenMap, type ResolvedColorScheme, type ThemePreset } from "./tokens";

export {
  DEFAULT_THEME_PRESET,
  editorialSlatePreset,
  getThemeElevation,
  getThemeTokenMap,
  isThemeMode,
  isThemePreset,
  neoBrutalistPreset,
  type ResolvedColorScheme,
  resolveThemeColor,
  THEME_COLOR_TOKENS,
  THEME_PRESET_IDS,
  THEME_PRESETS,
  type ThemeColorToken,
  type ThemeCssVarName,
  type ThemeMode,
  type ThemePreset,
  type ThemePresetDefinition,
  type ThemePresetElevation,
  type ThemeTokenMap,
  warmTactilePreset,
} from "./tokens";

export function getThemeVars(preset: ThemePreset, scheme: ResolvedColorScheme) {
  return vars(getThemeTokenMap(preset, scheme));
}
