---
status: accepted
date: 2026-11-24
amends: ADR-0006, ADR-0007
---

# Cross-Platform UI Hardening, Root Theme Mirroring, and Zero-Native-Dependency Interactive Primitives

`ADR-0007` originally planned for `react-native-keyboard-controller` and `sonner-native`, and `ADR-0006` scoped `ThemeProvider` CSS variables to a NativeWind root `<View>`. In practice, supporting iOS, Android, and Web as equal first-class targets surfaced cross-platform drift: Radix portals on Web mount into `document.body` outside the NativeWind `<View>`, React Navigation falls back to light `DefaultTheme` behind navigators, and introducing extra native binary dependencies complicates Expo Go and Web parity. We decided to keep `FormScrollView`, `ToastProvider`, and `Slider` as zero-native-dependency owned primitives in `src/shared/ui/`, mirror active theme tokens and color scheme at the Composition Root across NativeWind `vars()`, React Navigation's `<ThemeProvider>`, and Web's `document.documentElement`, standardize all overlay backdrops on a mode-invariant `Overlay Scrim` (`--scrim`) token, and enforce WCAG AA contrast and token parity automatically in CI.

## Considered Options

- **Adopt `react-native-keyboard-controller`, `sonner-native`, and `react-native-gesture-handler`**: Provides native keyboard frames and native gesture threads, but requires custom dev builds (breaking Expo Go parity), adds Web shimming/divergence, and increases Expo SDK upgrade coupling.
- **Native-only polish with degraded Web fallback**: Leaves Radix portals un-themed, modals off-screen on scrolled Web pages, and Web inputs/sliders/toggles broken for developers previewing via `expo start --web`.
- **Zero-Native-Dependency Owned Primitives with Tri-Layer Root Theme Mirroring (Chosen)**: Preserves full iOS, Android, Expo Go, and Web parity without extra native linking; fixes keyboard jumps via platform-correct `FormScrollView` (`padding` on iOS with dynamic `useHeaderHeight()`, native `adjustResize` on Android, zero resizing on Web) and reserved `FormMessage` space; anchors `ToastProvider` to a dedicated top safe-area portal (`insets.top + 12`); implements `Slider` with `PanResponder` + `measureInWindow` + Web pointer/keyboard support; and eliminates theme desync by mirroring tokens to NativeWind `vars()`, React Navigation `<ThemeProvider>`, and Web `document.documentElement`.

## Consequences

- `ADR-0007`'s references to `react-native-keyboard-controller` and `sonner-native` are superseded by owned pure-JS `FormScrollView` and top-anchored `ToastProvider` implementations.
- `ThemeProvider` (`src/shared/ui/theme-provider.tsx`) is the single synchronizer for NativeWind `vars()`, React Navigation `<ThemeProvider>`, Web `document.documentElement` CSS variables / `.dark` class / background color, `expo-system-ui`, and `expo-status-bar`.
- All modal, sheet, select, popover, and dropdown backdrops consume the mode-invariant `--scrim` (`Overlay Scrim`) token rather than `--foreground` alpha.
- All interactive form controls (`Input`, `Textarea`, `SelectTrigger`, `Checkbox`, `RadioGroupItem`, `Switch`) consume `border-outline` (`>= 3:1` contrast) and respect preset `radius` and `elevation.borderWidth`.
- Custom fonts (`Quicksand` Regular/Medium/SemiBold/Bold and `JetBrains Mono` Regular/Bold) are packaged via `@expo-google-fonts/*`, hydrated in `useAppBootstrap`, and mapped by explicit weight family name in `tailwind.config.ts`.
- A single shared token verification module backs both `pnpm verify:tokens` and `src/test/design-tokens.test.ts`, gating WCAG contrast (`>= 4.5:1` text, `>= 3.0:1` UI borders), `global.css` <-> `warmTactilePreset` <-> `DESIGN.md` parity, and full-repo color hygiene across `app/`, `src/app/`, `src/features/`, and `src/shared/ui/`.
