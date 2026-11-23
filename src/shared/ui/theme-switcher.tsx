import { Check, Monitor, Moon, Palette, Sun } from "lucide-react-native";
import { View } from "react-native";
import { THEME_PRESET_IDS, THEME_PRESETS, type ThemeMode } from "@/shared/lib/theme/presets";
import { cn } from "@/shared/lib/utils";
import { Icon } from "@/shared/ui/icon";
import { TactilePressable } from "@/shared/ui/tactile-pressable";
import { Text } from "@/shared/ui/text";
import { useTheme } from "@/shared/ui/theme-provider";

const COLOR_SCHEME_OPTIONS: ReadonlyArray<{
  mode: ThemeMode;
  label: string;
  icon: typeof Sun;
}> = [
  { mode: "light", label: "Light", icon: Sun },
  { mode: "dark", label: "Dark", icon: Moon },
  { mode: "system", label: "System", icon: Monitor },
];

export interface ThemeSwitcherProps {
  className?: string;
}

export function ThemeSwitcher({ className }: ThemeSwitcherProps) {
  const { preset, setPreset, colorScheme, resolvedColorScheme, setColorScheme } = useTheme();

  return (
    <View className={cn("gap-4", className)}>
      <View className="gap-2">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <Icon as={Palette} size={16} className="text-primary" />
            <Text variant="label">Theme Preset</Text>
          </View>
          <Text variant="caption" className="font-mono">
            {preset} · {resolvedColorScheme}
          </Text>
        </View>

        <View className="gap-2">
          {THEME_PRESET_IDS.map((presetId) => {
            const definition = THEME_PRESETS[presetId];
            const isSelected = preset === presetId;

            return (
              <TactilePressable
                key={presetId}
                accessibilityRole="button"
                accessibilityLabel={definition.label}
                accessibilityState={{ selected: isSelected }}
                elevated={isSelected}
                onPress={() => setPreset(presetId)}
                className={cn(
                  "flex-row items-center justify-between gap-3 rounded-xl border px-4 py-3",
                  isSelected
                    ? "border-primary bg-primary-fixed/40"
                    : "border-outline-variant bg-surface-container-lowest",
                )}
              >
                <View className="flex-1 gap-0.5">
                  <Text
                    variant="label"
                    className={isSelected ? "text-primary font-bold" : "text-foreground"}
                  >
                    {definition.label}
                  </Text>
                  <Text variant="caption" numberOfLines={2}>
                    {definition.description}
                  </Text>
                </View>
                {isSelected ? (
                  <View className="bg-primary h-6 w-6 items-center justify-center rounded-full">
                    <Icon as={Check} size={14} className="text-primary-foreground" />
                  </View>
                ) : null}
              </TactilePressable>
            );
          })}
        </View>
      </View>

      <View className="gap-2">
        <Text variant="label">Color Mode</Text>
        <View className="flex-row gap-2">
          {COLOR_SCHEME_OPTIONS.map((option) => {
            const isSelected = colorScheme === option.mode;

            return (
              <TactilePressable
                key={option.mode}
                accessibilityRole="button"
                accessibilityLabel={option.label}
                accessibilityState={{ selected: isSelected }}
                elevated={isSelected}
                onPress={() => setColorScheme(option.mode)}
                className={cn(
                  "min-h-11 flex-1 flex-row items-center justify-center gap-2 rounded-xl border px-3 py-2.5",
                  isSelected
                    ? "border-primary bg-primary"
                    : "border-outline-variant bg-surface-container-lowest",
                )}
              >
                <Icon
                  as={option.icon}
                  size={16}
                  className={isSelected ? "text-primary-foreground" : "text-on-surface-variant"}
                />
                <Text
                  variant="label"
                  className={
                    isSelected
                      ? "text-primary-foreground font-bold"
                      : "text-foreground font-semibold"
                  }
                >
                  {option.label}
                </Text>
              </TactilePressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}
