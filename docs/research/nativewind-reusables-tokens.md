# Research: NativeWind v4, React Native Reusables, OKLCH Semantic Tokens & Tactile Elevation Physics

> **Context Pointer**: Part of Epic [#1](https://github.com/Guiguerreiro39/expo-open-api/issues/1) (Wayfinder)  
> **Origin Ticket**: [#4](https://github.com/Guiguerreiro39/expo-open-api/issues/4)  
> **Status**: Completed  
> **Author**: Research Subagent  
> **Target Package**: `expo-open-api` (Expo SDK 52+, Expo Router v4, React Native 0.76+)  
> **Upstream Cross-Reference**: `tanstack-open-api/DESIGN.md` & `tanstack-open-api/src/styles/theme.css`

---

## Executive Summary

Replicating the single-source design token architecture, theme presets (`warm-tactile`, `editorial-slate`, `neo-brutalist`), and physical tactile button feedback from `tanstack-open-api` in a native mobile Expo environment requires navigating key platform boundaries between the web DOM and native mobile rendering engines (iOS UIKit / CoreGraphics and Android Skia / RenderNode / Yoga).

Key technical findings and architectural conclusions:

1. **NativeWind v4 vs Tailwind v4 Version Alignment**:
   - `tanstack-open-api` leverages **Tailwind CSS v4** (`@theme inline`, `@utility`).
   - In the React Native / Expo ecosystem, the production-ready stable standard for Expo SDK 52 is **NativeWind v4**, which is architected atop **Tailwind CSS v3.4.x** (using `tailwind.config.js` and `nativewind/preset`). NativeWind v5 (which will target Tailwind v4 CSS-first `@theme` syntax) is currently pre-release/preview.
   - Therefore, `expo-open-api` must configure NativeWind v4 using `tailwind.config.ts` paired with `global.css` for root CSS custom property declarations, bridging token variables cleanly without depending on experimental tooling.

2. **The OKLCH Dilemma on Mobile Native Engines**:
   - React Native's internal native color processor (`processColor`) and native view backends **do not support `oklch()` color notation**. Passing `oklch(...)` to native `View` or `Text` components results in runtime parsing failures or silent transparent fallbacks.
   - React Native natively supports Hex (`#rrggbb`, `#rrggbbaa`), RGB/RGBA, and HSL/HSLA.
   - **React Native Reusables (RNR)** standardizes on **space-separated HSL channels** (`H S% L%`) mapped via `hsl(var(--<token>))` in Tailwind. This is essential for Tailwind's opacity modifier syntax (e.g., `bg-primary/80`, `border-outline-variant/40`).
   - **Resolution**: Maintain `DESIGN.md` as the high-level specification listing canonical OKLCH coordinates (for perceptual gamut fidelity and design documentation), but generate and implement exact **space-separated HSL values** in `global.css` and `tailwind.config.ts`.

3. **Runtime Theme Presets via NativeWind `vars()`**:
   - Web uses `[data-theme="<preset>"]` on `<html>`. On native mobile, there is no HTML root or dataset attributes.
   - NativeWind provides the `vars()` utility and `VariableContextProvider`. By defining theme presets (`warm-tactile`, `editorial-slate`, `neo-brutalist`) as typed `vars()` objects and passing them to a root `<View style={[activeThemeVars, { flex: 1 }]}>` via a lightweight `ThemeProvider`, token values cascade down the React Native component tree dynamically.
   - Light and dark mode switching operates seamlessly via NativeWind's `useColorScheme()` / `colorScheme.set(...)`.

4. **React Native Reusables (RNR) & Radix UI Primitives**:
   - RNR is the mobile counterpart to `shadcn/ui`, built on top of `@rn-primitives` (the React Native port of Radix UI).
   - `@rn-primitives` provides unstyled, accessible foundational components (`Dialog`, `DropdownMenu`, `Popover`, `Checkbox`, `Select`, `Tooltip`, `Slot`, etc.) with built-in accessibility roles (`accessibilityRole`, `accessibilityState`), focus traps, and modal portals.
   - Iconography is standardized on `lucide-react-native`, styled using `cssInterop` so icons inherit `currentColor` and Tailwind sizing (`size-4`, `size-5`).

5. **Tactile Elevation & Physical Button Feedback**:
   - **Static Cards (`shadow-tactile`)**: React Native 0.76 (Expo SDK 52 default New Architecture) introduces native cross-platform support for the `boxShadow` style property across both iOS and Android. This allows zero-blur hard offset shadows (`boxShadow: '4px 4px 0px 0px rgba(29, 27, 25, 0.1)'`). For backward compatibility with older Android engines, a dual-layer approach or iOS `shadowOffset` + Android border simulation is detailed.
   - **Interactive Press Physics (`interactive-tactile`)**: Touch devices lack `:hover`. Replicating the physical mechanical feel of `interactive-tactile` requires:
     - Spring translation on press down (`translateX: 2, translateY: 2` or `4, 4` for neo-brutalist) using `react-native-reanimated` (`withSpring({ damping: 12, stiffness: 300 })`).
     - Collapsing the shadow offset to `(0, 0)` upon press in and bouncing back on release.
     - Physical haptic feedback using `expo-haptics` (`Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)`).

---

## 1. NativeWind v4 Configuration & Metro Setup

### 1.1 Architecture & Version Matrix

| Layer | Web (`tanstack-open-api`) | Mobile Native (`expo-open-api`) | Notes |
| :--- | :--- | :--- | :--- |
| **Framework** | TanStack Start (React 19) | Expo SDK 52+ (React Native 0.76+) | New Architecture enabled by default |
| **Styling Engine** | Tailwind CSS v4 | NativeWind v4 (Tailwind CSS v3.4.x) | NativeWind v4 wraps Tailwind v3.4 |
| **Bundler** | Vite / Nitro | Metro (with `withNativeWind`) | Transforms CSS to RN StyleSheet calls |
| **Component Kit** | `shadcn/ui` (Radix UI) | React Native Reusables (`@rn-primitives`) | Direct 1:1 behavioral equivalence |
| **Icons** | `lucide-react` | `lucide-react-native` + `cssInterop` | Styled via Tailwind classes |

### 1.2 Metro Configuration (`metro.config.js`)

In Expo SDK 52, wrap the Metro configuration with `withNativeWind` pointing to `./global.css`:

```javascript
// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, {
  input: "./global.css",
  inlineStyles: false,
});
```

### 1.3 Babel Configuration (`babel.config.js`)

Configure Babel to use NativeWind's JSX pragma and plugin:

```javascript
// babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      // Reanimated plugin must always be listed last
      "react-native-reanimated/plugin",
    ],
  };
};
```

### 1.4 TypeScript Types Declaration (`nativewind-env.d.ts`)

Enable TypeScript to recognize `className` on all React Native primitives:

```typescript
/// <reference types="nativewind/types" />
```

### 1.5 Global CSS Entry (`global.css`)

```css
/* global.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Base HSL tokens for default theme (Warm Tactile) */
    --background: 24 86% 98%;
    --foreground: 30 9% 11%;

    --surface: 24 86% 98%;
    --surface-dim: 27 10% 85%;
    --surface-bright: 24 86% 98%;
    --surface-container-lowest: 0 0% 100%;
    --surface-container-low: 20 33% 95%;
    --surface-container: 24 25% 93%;
    --surface-container-high: 24 20% 91%;
    --surface-container-highest: 23 17% 89%;
    --on-surface: 30 9% 11%;
    --on-surface-variant: 13 21% 29%;
    --inverse-surface: 30 4% 19%;
    --inverse-on-surface: 27 27% 95%;

    --card: 0 0% 100%;
    --card-foreground: 30 9% 11%;
    --popover: 0 0% 100%;
    --popover-foreground: 30 9% 11%;

    --primary: 18 99% 33%;
    --primary-foreground: 0 0% 100%;
    --primary-container: 16 76% 45%;
    --on-primary-container: 0 0% 100%;
    --primary-fixed: 14 100% 91%;
    --primary-fixed-dim: 14 100% 81%;

    --secondary: 134 26% 33%;
    --secondary-foreground: 0 0% 100%;
    --secondary-container: 125 52% 83%;
    --on-secondary-container: 133 25% 34%;

    --tertiary: 49 100% 22%;
    --tertiary-foreground: 0 0% 100%;
    --tertiary-container: 47 56% 50%;
    --on-tertiary-container: 48 100% 15%;
    --tertiary-fixed: 46 100% 74%;

    --muted: 24 25% 93%;
    --muted-foreground: 13 21% 29%;
    --accent: 125 52% 83%;
    --accent-foreground: 133 25% 34%;

    --destructive: 0 75% 42%;
    --destructive-foreground: 0 0% 100%;
    --destructive-container: 6 100% 92%;
    --on-destructive-container: 356 100% 29%;

    --success: 134 26% 33%;
    --success-foreground: 0 0% 100%;
    --success-container: 125 52% 83%;
    --on-success-container: 133 25% 34%;

    --warning: 49 100% 22%;
    --warning-foreground: 0 0% 100%;
    --warning-container: 46 100% 74%;
    --on-warning-container: 48 100% 15%;

    --info: 206 69% 37%;
    --info-foreground: 0 0% 100%;
    --info-container: 211 100% 93%;
    --on-info-container: 207 76% 22%;

    --outline: 15 15% 48%;
    --outline-variant: 14 44% 80%;
    --border: 14 44% 80%;
    --input: 14 44% 80%;
    --ring: 18 99% 33%;

    --radius: 0.75rem;
  }

  .dark {
    --background: 28 8% 10%;
    --foreground: 27 27% 95%;

    --surface: 28 8% 10%;
    --surface-dim: 28 8% 8%;
    --surface-bright: 28 8% 16%;
    --surface-container-lowest: 28 8% 7%;
    --surface-container-low: 28 8% 12%;
    --surface-container: 28 8% 14%;
    --surface-container-high: 28 8% 17%;
    --surface-container-highest: 28 8% 20%;
    --on-surface: 27 27% 95%;
    --on-surface-variant: 14 25% 75%;
    --inverse-surface: 24 20% 91%;
    --inverse-on-surface: 30 9% 11%;

    --card: 28 8% 12%;
    --card-foreground: 27 27% 95%;
    --popover: 28 8% 14%;
    --popover-foreground: 27 27% 95%;

    --primary: 14 88% 60%;
    --primary-foreground: 15 80% 12%;
    --primary-container: 18 99% 33%;
    --on-primary-container: 14 100% 95%;

    --secondary: 134 40% 65%;
    --secondary-foreground: 134 50% 12%;
    --secondary-container: 134 30% 25%;
    --on-secondary-container: 125 52% 83%;

    --tertiary: 46 80% 70%;
    --tertiary-foreground: 48 80% 14%;
    --tertiary-container: 49 50% 25%;
    --on-tertiary-container: 46 100% 74%;

    --muted: 28 8% 14%;
    --muted-foreground: 14 25% 75%;
    --accent: 28 8% 17%;
    --accent-foreground: 27 27% 95%;

    --destructive: 0 75% 65%;
    --destructive-foreground: 0 80% 12%;
    --destructive-container: 0 50% 25%;
    --on-destructive-container: 6 100% 92%;

    --outline: 15 15% 48%;
    --outline-variant: 14 20% 25%;
    --border: 14 20% 25%;
    --input: 14 20% 25%;
    --ring: 14 88% 60%;
  }
}
```

---

## 2. Theme Token Architecture & Preset Definitions

### 2.1 The OKLCH vs HSL/RGB Native Engine Reality

In `tanstack-open-api`, modern web browsers directly compute CSS Color Module Level 4 `oklch(...)`. 

On React Native:
- **Android**: `Color.parseColor` / Skia rendering engine parses `#RRGGBB`, `#AARRGGBB`, or direct integer colors (`0xAARRGGBB`).
- **iOS**: `UIColor` / CoreGraphics parses RGBA, HSBA, or Hex components.
- **`processColor` in React Native Core**: When a style prop containing `oklch(0.491 0.17 34.3)` is passed to a native component, `processColor` fails because it only recognizes Hex, `rgb()`, `rgba()`, `hsl()`, `hsla()`, and `hwb()`.

**The Solution**:
To maintain exact visual parity between `tanstack-open-api` and `expo-open-api`:
1. Use `DESIGN.md` as the unified source of truth, documenting both the canonical OKLCH coordinates (perceptual lightness & chroma) and the corresponding standard sRGB/HSL channels.
2. In React Native Reusables and NativeWind, all CSS custom properties are stored in space-separated HSL channels:
   ```css
   --primary: 18 99% 33%; /* #a93201 */
   ```
3. In `tailwind.config.ts`, map these to Tailwind utility classes using `hsl(var(--<token>) / <alpha-value>)`:
   ```typescript
   primary: {
     DEFAULT: "hsl(var(--primary) / <alpha-value>)",
     foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
   }
   ```
   This guarantees that both full-opacity classes (`bg-primary`) and opacity-modified classes (`bg-primary/50`, `border-outline-variant/40`) compile to valid, native-parseable `hsla(18, 99%, 33%, 0.5)` strings!

### 2.2 Tailwind Configuration (`tailwind.config.ts`)

```typescript
// tailwind.config.ts
import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",

        surface: {
          DEFAULT: "hsl(var(--surface) / <alpha-value>)",
          dim: "hsl(var(--surface-dim) / <alpha-value>)",
          bright: "hsl(var(--surface-bright) / <alpha-value>)",
          "container-lowest": "hsl(var(--surface-container-lowest) / <alpha-value>)",
          "container-low": "hsl(var(--surface-container-low) / <alpha-value>)",
          container: "hsl(var(--surface-container) / <alpha-value>)",
          "container-high": "hsl(var(--surface-container-high) / <alpha-value>)",
          "container-highest": "hsl(var(--surface-container-highest) / <alpha-value>)",
        },
        "on-surface": "hsl(var(--on-surface) / <alpha-value>)",
        "on-surface-variant": "hsl(var(--on-surface-variant) / <alpha-value>)",
        "inverse-surface": "hsl(var(--inverse-surface) / <alpha-value>)",
        "inverse-on-surface": "hsl(var(--inverse-on-surface) / <alpha-value>)",

        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },

        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
          container: "hsl(var(--primary-container) / <alpha-value>)",
          "fixed": "hsl(var(--primary-fixed) / <alpha-value>)",
          "fixed-dim": "hsl(var(--primary-fixed-dim) / <alpha-value>)",
        },
        "on-primary-container": "hsl(var(--on-primary-container) / <alpha-value>)",

        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
          container: "hsl(var(--secondary-container) / <alpha-value>)",
        },
        "on-secondary-container": "hsl(var(--on-secondary-container) / <alpha-value>)",

        tertiary: {
          DEFAULT: "hsl(var(--tertiary) / <alpha-value>)",
          foreground: "hsl(var(--tertiary-foreground) / <alpha-value>)",
          container: "hsl(var(--tertiary-container) / <alpha-value>)",
          "fixed": "hsl(var(--tertiary-fixed) / <alpha-value>)",
        },
        "on-tertiary-container": "hsl(var(--on-tertiary-container) / <alpha-value>)",

        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
        },

        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
          container: "hsl(var(--destructive-container) / <alpha-value>)",
        },
        "on-destructive-container": "hsl(var(--on-destructive-container) / <alpha-value>)",

        success: {
          DEFAULT: "hsl(var(--success) / <alpha-value>)",
          foreground: "hsl(var(--success-foreground) / <alpha-value>)",
          container: "hsl(var(--success-container) / <alpha-value>)",
        },
        "on-success-container": "hsl(var(--on-success-container) / <alpha-value>)",

        warning: {
          DEFAULT: "hsl(var(--warning) / <alpha-value>)",
          foreground: "hsl(var(--warning-foreground) / <alpha-value>)",
          container: "hsl(var(--warning-container) / <alpha-value>)",
        },
        "on-warning-container": "hsl(var(--on-warning-container) / <alpha-value>)",

        info: {
          DEFAULT: "hsl(var(--info) / <alpha-value>)",
          foreground: "hsl(var(--info-foreground) / <alpha-value>)",
          container: "hsl(var(--info-container) / <alpha-value>)",
        },
        "on-info-container": "hsl(var(--on-info-container) / <alpha-value>)",

        outline: {
          DEFAULT: "hsl(var(--outline) / <alpha-value>)",
          variant: "hsl(var(--outline-variant) / <alpha-value>)",
        },
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
      },
      borderRadius: {
        xs: "calc(var(--radius) - 8px)",
        sm: "calc(var(--radius) - 6px)",
        md: "calc(var(--radius) - 4px)",
        lg: "var(--radius)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
        "3xl": "calc(var(--radius) + 12px)",
        "4xl": "calc(var(--radius) + 20px)",
      },
      boxShadow: {
        tactile: "4px 4px 0px 0px rgba(29, 27, 25, 0.1)",
        "tactile-hover": "6px 6px 0px 0px rgba(29, 27, 25, 0.15)",
        "tactile-active": "0px 0px 0px 0px rgba(29, 27, 25, 0.1)",
        "brutalist": "4px 4px 0px 0px #000000",
      },
    },
  },
  plugins: [],
} satisfies Config;
```

### 2.3 Runtime Preset Definitions (`src/shared/lib/theme/presets.ts`)

Using NativeWind's `vars()` utility, define the three built-in theme presets:

```typescript
// src/shared/lib/theme/presets.ts
import { vars } from "nativewind";

export type ThemePreset = "warm-tactile" | "editorial-slate" | "neo-brutalist";
export type ColorMode = "light" | "dark";

export const themePresets: Record<ThemePreset, Record<ColorMode, ReturnType<typeof vars>>> = {
  "warm-tactile": {
    light: vars({
      "--background": "24 86% 98%",
      "--foreground": "30 9% 11%",
      "--surface": "24 86% 98%",
      "--surface-container-lowest": "0 0% 100%",
      "--surface-container-low": "20 33% 95%",
      "--surface-container": "24 25% 93%",
      "--card": "0 0% 100%",
      "--card-foreground": "30 9% 11%",
      "--primary": "18 99% 33%",
      "--primary-foreground": "0 0% 100%",
      "--primary-container": "16 76% 45%",
      "--secondary": "134 26% 33%",
      "--secondary-foreground": "0 0% 100%",
      "--secondary-container": "125 52% 83%",
      "--tertiary": "49 100% 22%",
      "--destructive": "0 75% 42%",
      "--border": "14 44% 80%",
      "--outline": "15 15% 48%",
      "--outline-variant": "14 44% 80%",
      "--ring": "18 99% 33%",
      "--radius": "0.75rem",
    }),
    dark: vars({
      "--background": "28 8% 10%",
      "--foreground": "27 27% 95%",
      "--surface": "28 8% 10%",
      "--surface-container-lowest": "28 8% 7%",
      "--surface-container-low": "28 8% 12%",
      "--surface-container": "28 8% 14%",
      "--card": "28 8% 12%",
      "--card-foreground": "27 27% 95%",
      "--primary": "14 88% 60%",
      "--primary-foreground": "15 80% 12%",
      "--primary-container": "18 99% 33%",
      "--secondary": "134 40% 65%",
      "--secondary-foreground": "134 50% 12%",
      "--secondary-container": "134 30% 25%",
      "--tertiary": "46 80% 70%",
      "--destructive": "0 75% 65%",
      "--border": "14 20% 25%",
      "--outline": "15 15% 48%",
      "--outline-variant": "14 20% 25%",
      "--ring": "14 88% 60%",
      "--radius": "0.75rem",
    }),
  },
  "editorial-slate": {
    light: vars({
      "--background": "210 40% 98%",
      "--foreground": "222 47% 11%",
      "--surface": "210 40% 98%",
      "--surface-container-lowest": "0 0% 100%",
      "--surface-container-low": "210 30% 96%",
      "--surface-container": "210 25% 94%",
      "--card": "0 0% 100%",
      "--card-foreground": "222 47% 11%",
      "--primary": "217 91% 60%",
      "--primary-foreground": "0 0% 100%",
      "--primary-container": "217 80% 70%",
      "--secondary": "160 84% 39%",
      "--secondary-foreground": "0 0% 100%",
      "--secondary-container": "160 60% 88%",
      "--tertiary": "189 94% 43%",
      "--destructive": "0 75% 50%",
      "--border": "215 20% 85%",
      "--outline": "215 15% 60%",
      "--outline-variant": "215 20% 85%",
      "--ring": "217 91% 60%",
      "--radius": "0.5rem",
    }),
    dark: vars({
      "--background": "222 47% 8%",
      "--foreground": "210 40% 98%",
      "--surface": "222 47% 8%",
      "--surface-container-lowest": "222 47% 6%",
      "--surface-container-low": "222 47% 10%",
      "--surface-container": "222 47% 12%",
      "--card": "222 47% 10%",
      "--card-foreground": "210 40% 98%",
      "--primary": "217 91% 65%",
      "--primary-foreground": "222 47% 8%",
      "--primary-container": "217 91% 40%",
      "--secondary": "160 84% 45%",
      "--secondary-foreground": "222 47% 8%",
      "--secondary-container": "160 50% 20%",
      "--tertiary": "189 94% 50%",
      "--destructive": "0 75% 65%",
      "--border": "215 20% 20%",
      "--outline": "215 15% 45%",
      "--outline-variant": "215 20% 20%",
      "--ring": "217 91% 65%",
      "--radius": "0.5rem",
    }),
  },
  "neo-brutalist": {
    light: vars({
      "--background": "0 0% 100%",
      "--foreground": "0 0% 7%",
      "--surface": "0 0% 100%",
      "--surface-container-lowest": "0 0% 100%",
      "--surface-container-low": "0 0% 96%",
      "--surface-container": "0 0% 92%",
      "--card": "0 0% 100%",
      "--card-foreground": "0 0% 7%",
      "--primary": "221 83% 53%",
      "--primary-foreground": "0 0% 100%",
      "--primary-container": "221 75% 65%",
      "--secondary": "75 100% 50%",
      "--secondary-foreground": "0 0% 7%",
      "--secondary-container": "75 90% 70%",
      "--tertiary": "14 100% 57%",
      "--destructive": "0 85% 55%",
      "--border": "0 0% 0%",
      "--outline": "0 0% 0%",
      "--outline-variant": "0 0% 20%",
      "--ring": "221 83% 53%",
      "--radius": "0.25rem",
    }),
    dark: vars({
      "--background": "0 0% 5%",
      "--foreground": "0 0% 95%",
      "--surface": "0 0% 5%",
      "--surface-container-lowest": "0 0% 3%",
      "--surface-container-low": "0 0% 8%",
      "--surface-container": "0 0% 12%",
      "--card": "0 0% 8%",
      "--card-foreground": "0 0% 95%",
      "--primary": "221 83% 65%",
      "--primary-foreground": "0 0% 5%",
      "--primary-container": "221 83% 40%",
      "--secondary": "75 100% 50%",
      "--secondary-foreground": "0 0% 5%",
      "--secondary-container": "75 80% 25%",
      "--tertiary": "14 100% 65%",
      "--destructive": "0 85% 65%",
      "--border": "0 0% 90%",
      "--outline": "0 0% 90%",
      "--outline-variant": "0 0% 70%",
      "--ring": "221 83% 65%",
      "--radius": "0.25rem",
    }),
  },
};
```

### 2.4 Theme Provider & Switcher (`src/shared/lib/theme/provider.tsx`)

```tsx
// src/shared/lib/theme/provider.tsx
import React, { createContext, useContext, useState, useMemo } from "react";
import { View } from "react-native";
import { useColorScheme, colorScheme } from "nativewind";
import { themePresets, type ThemePreset, type ColorMode } from "./presets";

interface ThemeContextValue {
  preset: ThemePreset;
  setPreset: (preset: ThemePreset) => void;
  mode: ColorMode;
  setMode: (mode: ColorMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { colorScheme: activeScheme } = useColorScheme();
  const [preset, setPreset] = useState<ThemePreset>("warm-tactile");

  const mode: ColorMode = activeScheme === "dark" ? "dark" : "light";

  const setMode = (newMode: ColorMode) => {
    colorScheme.set(newMode);
  };

  const activeVars = useMemo(() => {
    return themePresets[preset][mode];
  }, [preset, mode]);

  return (
    <ThemeContext.Provider value={{ preset, setPreset, mode, setMode }}>
      <View style={[activeVars, { flex: 1 }]} className="bg-background">
        {children}
      </View>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
```

---

## 3. React Native Reusables (RNR) & Radix UI Primitives

### 3.1 Architecture of `@rn-primitives`

React Native Reusables ports the `shadcn/ui` experience to React Native by building directly on top of `@rn-primitives/*`.

| Web Primitive (`@radix-ui/*`) | Mobile Primitive (`@rn-primitives/*`) | Key Native Mobile Capabilities |
| :--- | :--- | :--- |
| `@radix-ui/react-dialog` | `@rn-primitives/dialog` | Back-handler dismissal, native modal portal, accessibility modal role |
| `@radix-ui/react-dropdown-menu` | `@rn-primitives/dropdown-menu` | Popover anchor measurement via `UIManager.measureInWindow` |
| `@radix-ui/react-checkbox` | `@rn-primitives/checkbox` | `accessibilityRole="checkbox"`, `accessibilityState={{ checked }}` |
| `@radix-ui/react-slot` | `@rn-primitives/slot` | Composition primitive (`asChild` pattern) preserving ref and event handlers |
| `@radix-ui/react-portal` | `@rn-primitives/portal` | Mounts modals and popovers to the root overlay tree above navigation stacks |

### 3.2 Accessibility Alignment

When using RNR components on native mobile:
- **Screen Reader Announcements**: Primitives automatically map ARIA properties to React Native's `accessibilityState` (`checked`, `disabled`, `expanded`, `selected`).
- **Focus Management**: Primitives trap focus within open dialogs and return focus upon dismissal.
- **Labels**: `@rn-primitives/label` ensures `Text` elements act as labels that screen readers associate with input controls.

### 3.3 Lucide Icons Integration (`lucide-react-native`)

To allow icons to inherit `currentColor` and accept Tailwind utility classes (e.g., `className="size-5 text-primary"`), configure `cssInterop`:

```typescript
// src/shared/ui/icon.ts
import { cssInterop } from "nativewind";
import * as LucideIcons from "lucide-react-native";

// Interop Lucide icons to accept NativeWind className
export function registerIconInterop() {
  Object.values(LucideIcons).forEach((IconComponent) => {
    if (typeof IconComponent === "function" || typeof IconComponent === "object") {
      cssInterop(IconComponent as any, {
        className: {
          target: "style",
          nativeStyleToProp: {
            color: true,
            opacity: true,
          },
        },
      });
    }
  });
}
```

---

## 4. Tactile Elevation Physics & Interactive Press Implementation

### 4.1 Cross-Platform Shadow Reality on Native Mobile

In `tanstack-open-api`, tactile elevation relies on zero-blur offset shadows:
```css
box-shadow: 4px 4px 0px 0px rgba(29, 27, 25, 0.1);
```

#### The Native Mobile Platforms:
1. **iOS (UIKit / CoreGraphics)**:
   - iOS has always natively supported arbitrary offsets and exact blur radius via CALayer:
     ```javascript
     {
       shadowColor: '#1d1b19',
       shadowOffset: { width: 4, height: 4 },
       shadowRadius: 0, // 0 blur produces a crisp, hard tactile edge!
       shadowOpacity: 0.1,
     }
     ```
2. **Android (Traditional Architecture)**:
   - Android's native `elevation` property maps to hardware elevation with ambient and spot lights. Blur radius cannot be set to 0, producing a blurry diffuse shadow.
3. **React Native 0.76+ (New Architecture / Expo SDK 52)**:
   - React Native 0.76 introduced native `boxShadow` support across both iOS and Android!
   - On Android in the New Architecture, `boxShadow` is drawn via `RenderNode` graphics pipeline, allowing exact CSS-compliant `boxShadow: '4px 4px 0px 0px rgba(0,0,0,0.1)'`!

### 4.2 Interactive Button Physics (`interactive-tactile`)

On web, `:hover` translates `(0px, -2px)` with shadow `6px 6px`, and `:active` translates `(2px, 2px)` with shadow `0px 0px`.

On native touchscreens:
- There is no hover. Touch is purely discrete: **Rest** $\leftrightarrow$ **Pressed**.
- Touch interaction must feel physical, satisfying, and responsive (zero perceptible latency).

#### The Two Production Patterns:

#### Pattern A: Reanimated Dynamic Offset Translation
This pattern animates the element's `transform` and `shadowOffset` via `react-native-reanimated` spring physics, paired with `expo-haptics`:

```tsx
// src/shared/ui/tactile-pressable.tsx
import React from "react";
import { Pressable, type PressableProps, Platform } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface TactilePressableProps extends PressableProps {
  children: React.ReactNode;
  className?: string;
  offset?: number; // Default 4px for warm-tactile, 6px for neo-brutalist
  haptics?: boolean;
}

export function TactilePressable({
  children,
  className = "",
  offset = 4,
  haptics = true,
  onPressIn,
  onPressOut,
  style,
  ...props
}: TactilePressableProps) {
  const pressedOffset = useSharedValue(0);

  const handlePressIn: PressableProps["onPressIn"] = (e) => {
    if (haptics) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    pressedOffset.value = withSpring(offset, {
      damping: 12,
      stiffness: 300,
      mass: 0.8,
    });
    onPressIn?.(e);
  };

  const handlePressOut: PressableProps["onPressOut"] = (e) => {
    pressedOffset.value = withSpring(0, {
      damping: 12,
      stiffness: 300,
      mass: 0.8,
    });
    onPressOut?.(e);
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: pressedOffset.value },
        { translateY: pressedOffset.value },
      ],
      // On iOS / RN 0.76 New Architecture, dynamically collapse shadow offset
      shadowOffset: {
        width: Math.max(0, offset - pressedOffset.value),
        height: Math.max(0, offset - pressedOffset.value),
      },
    };
  });

  return (
    <AnimatedPressable
      {...props}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle]}
      className={className}
    >
      {children}
    </AnimatedPressable>
  );
}
```

#### Pattern B: Dual-Layer Mechanical Keycap (The 100% Cross-Platform Neo-Brutalist Solution)
For neo-brutalist and high-contrast tactile buttons where shadows are solid black (`#000000`), a simulated mechanical keycap provides 100% visual consistency even on older Android runtimes without relying on OS shadow engines:

```tsx
// src/shared/ui/mechanical-button.tsx
import React from "react";
import { View, Pressable, Text } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function MechanicalTactileButton({
  label,
  onPress,
  offset = 4,
  className = "bg-primary border-2 border-outline",
}: {
  label: string;
  onPress?: () => void;
  offset?: number;
  className?: string;
}) {
  const trans = useSharedValue(0);

  const onPressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    trans.value = withSpring(offset, { damping: 12, stiffness: 350 });
  };

  const onPressOut = () => {
    trans.value = withSpring(0, { damping: 12, stiffness: 350 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: trans.value }, { translateY: trans.value }],
  }));

  return (
    <View style={{ position: "relative", margin: offset }}>
      {/* Underlying Solid Shadow Layer */}
      <View
        style={{
          position: "absolute",
          top: offset,
          left: offset,
          right: -offset,
          bottom: -offset,
          borderRadius: 12,
        }}
        className="bg-outline"
      />

      {/* Surface Button that translates to cover the shadow */}
      <AnimatedPressable
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={onPress}
        style={[animatedStyle]}
        className={`rounded-xl px-5 py-3 ${className}`}
      >
        <Text className="text-primary-foreground font-bold text-center">
          {label}
        </Text>
      </AnimatedPressable>
    </View>
  );
}
```

---

## 5. Concrete Recommendations for `DESIGN.md` in `expo-open-api`

When authoring `DESIGN.md` for `expo-open-api` (Ticket [#13](https://github.com/Guiguerreiro39/expo-open-api/issues/13)), adhere to the following specifications:

1. **Dual Token Table Specification**:
   Document design tokens with both their canonical OKLCH specification (for design parity) and their exact Space-Separated HSL channels (for NativeWind / React Native runtime compilation).
2. **Explicit Layer Boundaries**:
   - **Layer 1**: CSS custom properties in `global.css` (HSL values) and preset definitions in `src/shared/lib/theme/presets.ts`.
   - **Layer 2**: Tailwind v3 configuration in `tailwind.config.ts` mapping tokens to utility classes via `hsl(var(--<token>) / <alpha-value>)`.
   - **Layer 3**: Zero hardcoded hex/rgb styles in UI components. All components consume semantic tokens (`bg-surface`, `text-primary`, `border-outline-variant`).
3. **Tactile Physics Standard**:
   - Document `shadow-tactile` as the default card elevation.
   - Mandate `TactilePressable` with `expo-haptics` and Reanimated spring physics for all primary action buttons.
4. **Theme Preset Switcher**:
   - Document the runtime `ThemeProvider` exposing `preset` (`warm-tactile`, `editorial-slate`, `neo-brutalist`) and `mode` (`light`, `dark`).

---

## 6. Verification & Next Steps

This research fully resolves the questions in Ticket [#4](https://github.com/Guiguerreiro39/expo-open-api/issues/4) and unblocks:
- Ticket [#13](https://github.com/Guiguerreiro39/expo-open-api/issues/13): Decide single-source themeable design system, NativeWind v4 tokens, and DESIGN.md contract.
- Ticket [#14](https://github.com/Guiguerreiro39/expo-open-api/issues/14): Decide React Native Reusables component catalog, TanStack Form mobile field primitives, and reference showcase screens.
