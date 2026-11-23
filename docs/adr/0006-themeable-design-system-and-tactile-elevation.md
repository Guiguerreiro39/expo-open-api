---
status: accepted
date: 2026-11-23
decision-ticket: https://github.com/Guiguerreiro39/expo-open-api/issues/13
---

# Single-Source Themeable Design System, NativeWind Tokens, and Mobile Tactile Elevation

Mobile applications running on React Native and Expo cannot evaluate CSS `@theme inline` or `oklch()` color notation directly due to native engine (`processColor`) constraints and lack of a DOM root. We decided to establish a single-source themeable design token architecture for `expo-open-api` by standardizing on NativeWind v4 (Tailwind v3.4.x), adopting a Dual Token Specification in `DESIGN.md` (canonical OKLCH coordinates for perceptual design fidelity paired with space-separated HSL channels for native compilation), implementing runtime theme preset switching (`warm-tactile`, `editorial-slate`, `neo-brutalist`) and color scheme toggling via NativeWind's `vars()` utility wrapped in a `ThemeProvider` at the Composition Root (`src/shared/ui/theme-provider.tsx`), standardizing static card elevation on zero-blur offset shadows (`shadow-tactile` via React Native 0.76 New Architecture `boxShadow`), engineering physical button feedback via a reusable `TactilePressable` primitive powered by `react-native-reanimated` spring physics and `expo-haptics` (`ImpactFeedbackStyle.Light`), synchronizing `expo-status-bar` and the native window background color dynamically with the active theme, gating splash screen dismissal in `useAppBootstrap` until custom typography (`Quicksand`, `JetBrains Mono`) completes hydration, and enforcing token consistency via automated Vitest contract tests (`src/test/design-tokens.test.ts`).

## Considered Options

- **Direct OKLCH in Global CSS / Tailwind**: Attempting to pass `oklch(...)` strings to React Native views fails at runtime because iOS CoreGraphics and Android Skia native bridges lack OKLCH parsers, causing silent transparent fallbacks or crashes.
- **Static Hex Tokens with Predefined StyleSheet Themes**: Using static hex codes in JavaScript objects (`StyleSheet.create`) forfeits Tailwind's utility class ergonomics, breaks NativeWind's `/alpha` opacity modifier syntax (e.g. `bg-primary/80`), and complicates dynamic theming across third-party components.
- **NativeWind v5 / Tailwind v4 CSS-First Preview**: Adopting experimental NativeWind v5 preview for Expo SDK 52 introduces instability, undocumented breaking changes, and build breakages with React Native Reusables and Metro bundler.
- **NativeWind v4 with Dual Token Specification and vars() ThemeProvider (Chosen)**: Maintains design parity with `tanstack-open-api` via canonical OKLCH in `DESIGN.md`, compiles to space-separated HSL channels (`hsl(var(--<token>) / <alpha-value>)`) compatible with all native mobile engines, supports seamless runtime preset switching via `vars()` with MMKV persistence, reproduces tactile mechanical elevation via React Native 0.76 `boxShadow`, Reanimated spring transforms, and `expo-haptics`, and prevents token drift via automated AST Vitest contract testing.

## Consequences

- `DESIGN.md` at the project root is the authoritative single source of truth for all color palettes, semantic token mappings, typography scales, radius curves, and tactile elevation contracts.
- All colors in `global.css` and `src/shared/lib/theme/presets.ts` are declared as space-separated HSL channels (e.g., `--primary: 16 99% 33%`), enabling Tailwind v3.4 utilities to apply arbitrary opacity modifiers (`bg-primary/80`, `border-outline-variant/40`) without color parsing defects.
- Runtime theme presets (`warm-tactile`, `editorial-slate`, `neo-brutalist`) are toggled dynamically through `useTheme()` (`preset`, `setPreset`, `colorScheme`, `setColorScheme`) provided by `ThemeProvider`, with active selections persisted in the Query Cache Tier (`MMKV`).
- `ThemeProvider` automatically synchronizes the native root view background color and `expo-status-bar` (`style="dark" | "light"`), eliminating white background flashes and status-bar contrast mismatches during screen push/pop transitions.
- Static elevated surfaces consume `shadow-tactile` (`boxShadow: 4px 4px 0px 0px rgba(29, 27, 25, 0.1)`) backed by a structural 1px `border-outline-variant` to guarantee crisp visibility across all screen types and legacy runtimes.
- Interactive actions standardize on `TactilePressable` (`src/shared/ui/tactile-pressable.tsx`), which depresses the button diagonally (`translateX: 2, translateY: 2` or `4, 4` for neo-brutalist) using `withSpring` and emits a subtle haptic pulse (`Haptics.impactAsync(ImpactFeedbackStyle.Light)`) on press down.
- Custom typography (`Quicksand` for sans/display, `JetBrains Mono` for mono) is loaded via `expo-font` and gated inside `useAppBootstrap` before native splash screen dismissal, falling back gracefully to system fonts if asset loading fails.
- UI components in `src/features/` and `src/shared/ui/` must never use hardcoded hex/rgb color literals (`bg-[#...]`) or inline style colors; all visual attributes must be expressed via semantic tokens.
- An automated Vitest contract test (`src/test/design-tokens.test.ts`) validates that all tokens defined in `DESIGN.md` are present in `tailwind.config.ts` and `src/shared/lib/theme/presets.ts`.
