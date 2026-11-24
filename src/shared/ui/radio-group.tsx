import * as RadioGroupPrimitive from "@rn-primitives/radio-group";
import { createContext, forwardRef, useCallback, useContext, useMemo, useRef } from "react";
import { Platform, View } from "react-native";
import { DEFAULT_THEME_PRESET, getThemeElevation } from "@/shared/lib/theme/presets";
import { cn } from "@/shared/lib/utils";
import { useOptionalTheme } from "@/shared/ui/theme-provider";

const RADIO_ITEM_HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 } as const;
const WEB_DOUBLE_FIRE_GUARD_MS = 80;

interface RadioGroupStateContextValue {
  readonly value: string | undefined;
  readonly invalid: boolean;
}

const RadioGroupStateContext = createContext<RadioGroupStateContextValue>({
  value: undefined,
  invalid: false,
});

export interface RadioGroupProps extends RadioGroupPrimitive.RootProps {
  className?: string;
  invalid?: boolean;
}

export const RadioGroup = forwardRef<RadioGroupPrimitive.RootRef, RadioGroupProps>(
  ({ className, value, invalid = false, onValueChange, ...props }, ref) => {
    const lastWebChangeRef = useRef<{ value: string; at: number }>({ value: "", at: 0 });

    const handleValueChange = useCallback(
      (nextValue: string) => {
        if (Platform.OS === "web") {
          const now = Date.now();
          if (
            lastWebChangeRef.current.value === nextValue &&
            now - lastWebChangeRef.current.at < WEB_DOUBLE_FIRE_GUARD_MS
          ) {
            return;
          }
          lastWebChangeRef.current = { value: nextValue, at: now };
        }
        onValueChange(nextValue);
      },
      [onValueChange],
    );

    const stateValue = useMemo<RadioGroupStateContextValue>(
      () => ({ value, invalid }),
      [value, invalid],
    );

    return (
      <RadioGroupStateContext.Provider value={stateValue}>
        <RadioGroupPrimitive.Root
          ref={ref}
          value={value}
          onValueChange={handleValueChange}
          className={cn("gap-2.5", className)}
          {...props}
        />
      </RadioGroupStateContext.Provider>
    );
  },
);

RadioGroup.displayName = "RadioGroup";

export interface RadioGroupItemProps extends RadioGroupPrimitive.ItemProps {
  className?: string;
  invalid?: boolean;
}

export const RadioGroupItem = forwardRef<RadioGroupPrimitive.ItemRef, RadioGroupItemProps>(
  ({ className, value, disabled, invalid, hitSlop, ...props }, ref) => {
    const theme = useOptionalTheme();
    const preset = theme?.preset ?? DEFAULT_THEME_PRESET;
    const resolvedScheme = theme?.resolvedColorScheme ?? "light";
    const elevation = getThemeElevation(preset, resolvedScheme);
    const borderClass = elevation.borderWidth >= 2 ? "border-2" : "border";

    const groupState = useContext(RadioGroupStateContext);
    const isSelected = groupState.value !== undefined && groupState.value === value;
    const isInvalid = Boolean(invalid ?? groupState.invalid);

    return (
      <RadioGroupPrimitive.Item
        ref={ref}
        value={value}
        disabled={disabled}
        hitSlop={hitSlop ?? RADIO_ITEM_HIT_SLOP}
        className={cn(
          "border-outline bg-surface-container-lowest h-6 w-6 shrink-0 items-center justify-center rounded-full",
          borderClass,
          isSelected && "border-primary",
          isInvalid && "border-destructive",
          disabled && "opacity-50",
          className,
        )}
        {...props}
      >
        <RadioGroupPrimitive.Indicator className="items-center justify-center">
          <View className="bg-primary h-3 w-3 rounded-full" />
        </RadioGroupPrimitive.Indicator>
      </RadioGroupPrimitive.Item>
    );
  },
);

RadioGroupItem.displayName = "RadioGroupItem";
