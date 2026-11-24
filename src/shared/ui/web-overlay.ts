import { useCallback, useEffect, useRef } from "react";
import { Platform, StyleSheet, type ViewStyle } from "react-native";

/**
 * Shared Web overlay helpers for `@rn-primitives` overlays (ADR-0014).
 *
 * - `getOverlayFillStyle()` pins backdrops to the viewport on Web (`position: fixed`) so scrolled
 *   pages never open overlays off-screen, and falls back to `StyleSheet.absoluteFill` on native.
 * - `getWebClickGuardProps()` stops Radix `onClick` toggles from racing the RNW `onPress` toggle that
 *   `@rn-primitives` triggers already wire, so one Web click opens (or closes) exactly once.
 */

const WEB_FIXED_OVERLAY_STYLE = {
  position: "fixed",
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
} as unknown as ViewStyle;

export function getOverlayFillStyle(): ViewStyle {
  return Platform.OS === "web" ? WEB_FIXED_OVERLAY_STYLE : StyleSheet.absoluteFill;
}

interface WebClickableEvent {
  preventDefault?: () => void;
}

type WebClickHandler = (event: WebClickableEvent) => void;

export function getWebClickGuardProps(props: object): { onClick: WebClickHandler } | undefined {
  if (Platform.OS !== "web") {
    return undefined;
  }
  const originalOnClick = (props as { onClick?: WebClickHandler }).onClick;
  return {
    onClick: (event) => {
      event?.preventDefault?.();
      originalOnClick?.(event);
    },
  };
}

/**
 * Deduplicates synchronous same-turn Web toggle emissions (e.g. RNW `onPress` + Radix
 * `onClick`/`onPointerUp` firing inside the same event) without time-based debouncing, so rapid
 * sequential clicks and epoch `Date.now() === 0` clicks are never dropped.
 */
export function useWebToggleDedup(
  onCheckedChange?: (checked: boolean) => void,
): (checked: boolean) => void {
  const lockedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      lockedRef.current = false;
    };
  }, []);

  return useCallback(
    (nextChecked: boolean) => {
      if (Platform.OS === "web") {
        if (lockedRef.current) {
          return;
        }
        lockedRef.current = true;
        timerRef.current = setTimeout(() => {
          lockedRef.current = false;
          timerRef.current = null;
        }, 0);
      }
      onCheckedChange?.(nextChecked);
    },
    [onCheckedChange],
  );
}
