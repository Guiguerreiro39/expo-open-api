---
name: Warm Tactile Studio
defaultPreset: warm-tactile
presets:
  - warm-tactile
  - editorial-slate
  - neo-brutalist
colors:
  background: '#fef8f4'
  foreground: '#1d1b19'
  surface: '#fef8f4'
  surface-dim: '#ded9d5'
  surface-bright: '#fef8f4'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f8f2ef'
  surface-container: '#f3ede9'
  surface-container-high: '#ede7e3'
  surface-container-highest: '#e7e1de'
  on-surface: '#1d1b19'
  on-surface-variant: '#59413a'
  inverse-surface: '#32302e'
  inverse-on-surface: '#f5f0ec'
  outline: '#8d7168'
  outline-variant: '#e1bfb5'
  primary: '#a93201'
  primary-foreground: '#ffffff'
  primary-container: '#cb4a1b'
  on-primary-container: '#fffbff'
  primary-fixed: '#ffdbd0'
  primary-fixed-dim: '#ffb59e'
  secondary: '#3d6846'
  secondary-foreground: '#ffffff'
  secondary-container: '#bcebc0'
  on-secondary-container: '#416c4a'
  tertiary: '#715c00'
  tertiary-foreground: '#ffffff'
  tertiary-container: '#c7a938'
  on-tertiary-container: '#4d3e00'
  tertiary-fixed: '#ffe17a'
  destructive: '#ba1a1a'
  destructive-foreground: '#ffffff'
  destructive-container: '#ffdad6'
  on-destructive-container: '#93000a'
  success: '#3d6846'
  success-foreground: '#ffffff'
  success-container: '#bcebc0'
  on-success-container: '#416c4a'
  warning: '#715c00'
  warning-foreground: '#ffffff'
  warning-container: '#ffe17a'
  on-warning-container: '#4d3e00'
  info: '#1d669f'
  info-foreground: '#ffffff'
  info-container: '#d9ecff'
  on-info-container: '#0d3b61'
typography:
  display-lg:
    fontFamily: Quicksand-Bold
    fontSize: 48
    fontWeight: '700'
    lineHeight: 56
    letterSpacing: -0.96
  headline-xl:
    fontFamily: Quicksand-Bold
    fontSize: 40
    fontWeight: '700'
    lineHeight: 48
    letterSpacing: -0.8
  headline-lg:
    fontFamily: Quicksand-Bold
    fontSize: 32
    fontWeight: '700'
    lineHeight: 40
  headline-md:
    fontFamily: Quicksand-SemiBold
    fontSize: 24
    fontWeight: '600'
    lineHeight: 32
  headline-sm:
    fontFamily: Quicksand-SemiBold
    fontSize: 20
    fontWeight: '600'
    lineHeight: 28
  title-md:
    fontFamily: Quicksand-SemiBold
    fontSize: 20
    fontWeight: '600'
    lineHeight: 28
  body-lg:
    fontFamily: Quicksand-Medium
    fontSize: 18
    fontWeight: '500'
    lineHeight: 28
  body-md:
    fontFamily: Quicksand-Regular
    fontSize: 16
    fontWeight: '400'
    lineHeight: 24
  body-sm:
    fontFamily: Quicksand-Regular
    fontSize: 14
    fontWeight: '400'
    lineHeight: 20
  label-lg:
    fontFamily: Quicksand-Bold
    fontSize: 14
    fontWeight: '700'
    lineHeight: 16
    letterSpacing: 0.7
  label-md:
    fontFamily: Quicksand-SemiBold
    fontSize: 12
    fontWeight: '600'
    lineHeight: 16
  label-sm:
    fontFamily: Quicksand-Bold
    fontSize: 12
    fontWeight: '700'
    lineHeight: 16
    letterSpacing: 0.6
rounded:
  seed: 12
  xs: 4
  sm: 6
  md: 8
  lg: 12
  xl: 16
  2xl: 20
  3xl: 24
  4xl: 32
  full: 9999
spacing:
  base: 8
  xs: 4
  sm: 12
  md: 24
  lg: 48
  xl: 80
  gutter: 16
  margin-screen: 16
---

# Mobile Design System Contract (`DESIGN.md`)

## Single-Source Theme Architecture

`expo-open-api` enforces a strict **Single-Source Theme Architecture** (`ADR 0006`) adapted for React Native and Expo SDK 52+:

1. **Layer 1: Dual Token Specification & Presets**:
   - High-level design tokens are specified in this `DESIGN.md` contract with canonical OKLCH coordinates (for perceptual fidelity and parity with `tanstack-open-api`) alongside space-separated HSL channels (`H S% L%`).
   - Root defaults are defined in `global.css` and runtime preset objects are defined in `src/shared/lib/theme/presets.ts` (`warmTactilePreset`, `editorialSlatePreset`, `neoBrutalistPreset`).
2. **Layer 2: Tailwind Configuration (`tailwind.config.ts`)**:
   - NativeWind v4 (Tailwind v3.4.x) binds semantic tokens to utility classes using `hsl(var(--<token>) / <alpha-value>)`. This guarantees that Tailwind opacity modifiers (e.g., `bg-primary/80`, `border-outline-variant/40`, `text-on-surface-variant/70`) compile natively on iOS and Android without runtime color parsing defects.
3. **Layer 3: Zero Hardcoded Styles**:
   - Feature screens, route façades, and shared UI primitives MUST NEVER use arbitrary color classes (`bg-[#...]`, `text-[#...]`) or inline style color literals (`{ color: '#...' }`).
   - All styling must consume semantic design tokens (`bg-surface`, `bg-card`, `text-foreground`, `text-primary`, `border-outline-variant`). CI verifies token hygiene via Vitest.

---

## Brand, Aesthetic & Built-In Presets

The default mobile visual identity is **Warm Tactile Studio (`warm-tactile`)**: an editorial, high-craft mobile workspace combining warm parchment surfaces, organic rounded geometry (`--radius: 12px`), and physical tactile feedback (`shadow-tactile` offset elevation and spring-depressed `TactilePressable` buttons with subtle haptics).

Three built-in theme presets are provided out of the box, switchable at runtime without app restarts:

1. **`warm-tactile` (Default)**:
   - *Personality*: Warm, artisanal, grounded. Terracotta primary (`hsl(16 99% 33%)`), sage secondary (`hsl(133 26% 33%)`), warm parchment background (`hsl(24 75% 98%)`), and soft earth outlines.
   - *Geometry & Elevation*: Soft organic radii (`rounded-2xl` cards, `rounded-xl` buttons), warm 4px offset shadow (`shadow-tactile`), and 2px diagonal spring press translation.
2. **`editorial-slate`**:
   - *Personality*: Cool, technical, journalistic. Deep navy primary (`hsl(215 90% 28%)`), slate neutrals, crisp white surfaces, and subtle cool outlines.
   - *Geometry & Elevation*: Clean structured radii (`rounded-xl` cards, `rounded-lg` buttons), subtle 2px offset shadow, and 1px crisp press translation.
3. **`neo-brutalist`**:
   - *Personality*: High-energy, bold, graphic. Electric amber primary (`hsl(45 100% 50%)`), stark pure black outlines (`hsl(0 0% 0%)`, 2px solid borders), saturated accents, and stark high-contrast typography.
   - *Geometry & Elevation*: Hard angular corners (`rounded-none` or `rounded-sm`), prominent 4px hard black offset shadows (`boxShadow: 4px 4px 0px 0px #000`), and deep 4px mechanical button depression.

---

## Semantic Surface & Color Architecture

Color roles follow a strict hierarchical taxonomy:

- **Canvas & Surface Containers**:
  - `background`: Screen canvas backdrop behind scroll views and route layouts.
  - `surface`: Base surface layer for content areas and cards.
  - `surface-container-lowest`: Pure clean white/black containers for elevated cards and modals.
  - `surface-container-low` / `surface-container`: Subtle recessed sections, task lists, and neutral badges.
  - `surface-container-high` / `surface-container-highest`: Floating drawers, action sheets, and elevated overlays.
- **Content & Text (`on-*`)**:
  - `foreground` / `on-surface`: High-contrast body text adhering to WCAG AAA/AA standards (`>= 4.5:1`).
  - `on-surface-variant`: Secondary metadata, timestamps, subtitles, and placeholder hints.
  - `outline`: High-contrast structural dividers and form control borders (`>= 3:1` contrast).
  - `outline-variant`: Subtle card dividers, table borders, and disabled indicators.
- **Status & Feedback Pairs**:
  - Every status token defines an intentional pair: container + content (`success` + `success-foreground`, `success-container` + `on-success-container`, `destructive` + `destructive-foreground`, `warning`, `info`).

---

## Typography & Iconography

- **Font Families**:
  - `font-sans` & `font-display`: `Quicksand` (`Quicksand-Regular`, `Quicksand-Medium`, `Quicksand-SemiBold`, `Quicksand-Bold`).
  - `font-mono`: `JetBrains Mono` (`JetBrainsMono-Regular`, `JetBrainsMono-Bold`) for request IDs, trace IDs, SSE event logs, and file hashes.
- **Asynchronous Font Hydration**:
  - Font assets are loaded via `expo-font` inside `src/app/bootstrap.ts`.
  - `useAppBootstrap` gates native splash screen dismissal until font assets are fully loaded and cached, falling back to system fonts if asset resolution encounters an error.
- **Iconography**:
  - Standardized on **`lucide-react-native`**.
  - Styled with `cssInterop` so icons inherit Tailwind color (`text-primary`, `text-on-surface-variant`) and size classes (`size-4`, `size-5`, `size-6`).

---

## Elevation, Tactile Shadows & Physical Feedback

Mobile touch screens lack mouse hover states (`:hover`). Tactile realism is achieved through physical elevation and dynamic press physics:

- **Static Elevation (`shadow-tactile`)**:
  - Utilizes React Native 0.76 New Architecture `boxShadow`:
    `boxShadow: '4px 4px 0px 0px rgba(29, 27, 25, 0.1)'` (or `#000` in neo-brutalist).
  - Paired with `border border-outline-variant` to guarantee crisp visibility across diverse display gamuts and legacy Android runtimes.
- **Interactive Action Physics (`TactilePressable`)**:
  - Interactive buttons and cards wrap `TactilePressable` (`src/shared/ui/tactile-pressable.tsx`).
  - On press down:
    1. Triggers immediate `expo-haptics` feedback: `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)`.
    2. Depresses the component diagonally (`translateX: 2, translateY: 2` or `4, 4`) using `react-native-reanimated` spring physics (`withSpring({ damping: 12, stiffness: 300 })`).
  - On press release: Springs effortlessly back to rest position (`0, 0`).

---

## Runtime Theme Switching & Native Synchronization

- **`ThemeProvider` (`src/shared/ui/theme-provider.tsx`)**:
  - Mounted at the Composition Root (`createAppComposition`).
  - Exposes `useTheme()` with `preset`, `setPreset`, `colorScheme`, and `setColorScheme`.
  - Persists active preset in Query Cache Tier (MMKV) and reads initial theme synchronously before first screen render.
  - Injects active preset CSS variables into the root `<View style={[themeVars, { flex: 1 }]}>` using NativeWind's `vars()` utility.
- **System Chrome & Status Bar Sync**:
  - Automatically synchronizes `expo-status-bar` (`style="dark" | "light"`) with the active theme and color mode.
  - Updates the native root window background color to match `--background`, eliminating white background flashes during native stack navigation push/pop transitions.

---

## Core Component Specifications

- **`TactilePressable` (`src/shared/ui/tactile-pressable.tsx`)**: The mechanical press primitive combining Reanimated spring transforms and `expo-haptics`.
- **`Button` (`src/shared/ui/button.tsx`)**:
  - `default`: `bg-primary text-primary-foreground rounded-xl font-bold` wrapped in `TactilePressable`.
  - `secondary`: `bg-secondary-container text-on-secondary-container rounded-xl font-semibold`.
  - `outline`: `border border-outline-variant bg-surface-container-lowest text-foreground rounded-xl` wrapped in `TactilePressable`.
  - `destructive`: `bg-destructive text-destructive-foreground rounded-xl font-bold` wrapped in `TactilePressable`.
- **`Card` (`src/shared/ui/card.tsx`)**: `rounded-2xl border border-outline-variant bg-card text-card-foreground shadow-tactile`.
- **`Input` & Form Controls (`src/shared/ui/input.tsx`)**: `rounded-xl border border-outline-variant bg-surface-container-lowest text-foreground px-4 py-3 focus:border-primary`.
- **`LiveQueryBadge` (`src/shared/ui/live-query-badge.tsx`)**: Realtime connection status pill with semantic status containers (`bg-success-container text-on-success-container` when connected, `bg-warning-container text-on-warning-container` when connecting, `bg-destructive-container text-on-destructive-container` on error).
- **`BentoShowcaseGrid` (`src/features/showcase/ui/BentoShowcaseScreen.tsx`)**: Reference showcase screen demonstrating live preset switching, color swatches, typography scale, form primitives, and tactile button physics.

---

## Automated Token Drift & Hygiene Verification

Token integrity is governed by automated Vitest contract tests (`src/test/design-tokens.test.ts`):
1. **Schema Validation**: Asserts that all color tokens, typography scales, radii, and presets declared in `DESIGN.md` match `tailwind.config.ts` and `src/shared/lib/theme/presets.ts`.
2. **Hygiene Rule**: Ensures zero hardcoded color literals (`#...`, `rgb(...)`) exist in production component files under `src/features/` and `src/shared/ui/`.
