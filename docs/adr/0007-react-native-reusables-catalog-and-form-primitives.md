---
status: accepted (amended by ADR-0014)
date: 2026-11-23
decision-ticket: https://github.com/Guiguerreiro39/expo-open-api/issues/14
---

# React Native Reusables Component Catalog, Mobile Form Primitives, and Showcase Architecture

Mobile applications require accessible, headless UI primitives, robust touch and keyboard handling, and type-safe form validation that seamlessly matches backend contracts without dragging in bloated or fragile third-party component frameworks. We decided to establish a comprehensive, owned UI component catalog in `src/shared/ui/` based on React Native Reusables (`@rn-primitives`) and NativeWind v4 semantic tokens, port TanStack Form (`useAppForm`) with double-submit locking and Effect `Schema.standardSchemaV1` validation to React Native compound primitives (`FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormDescription`, `FormMessage`), anchor all overlays (dialogs, alert dialogs, sheets, selects, popovers, tooltips) to a single `<PortalHost />` at the Composition Root, standardize bottom sheets on `@rn-primitives/dialog` bottom-slide variants, adopt `sonner-native` for toast notifications, manage virtual keyboard avoidance and smooth error scrolling via `react-native-keyboard-controller` in `FormScrollView`, and demonstrate the complete system through a tabbed showcase feature screen in `src/features/showcase/ui/ShowcaseScreen.tsx` mounted at `app/(app)/showcase.tsx`.

## Considered Options

- **Third-Party Component Libraries (Tamagui, Gluestack, Paper)**: Using monolithic libraries introduces proprietary compiler plugins, conflicts with NativeWind v4 utility classes and CSS variables, and complicates sharing identical tokens with `tanstack-open-api`.
- **Vanilla @tanstack/react-form without Mobile Primitives**: Forcing each screen to manage double-submit refs, manual error binding, and platform input adapters results in boilerplate duplication, inconsistent accessibility tags, and accidental concurrent submissions on touchscreens.
- **React Hook Form**: While popular in React Native, using React Hook Form on mobile while `tanstack-open-api` uses TanStack Form creates architectural divergence, prevents sharing form patterns, and requires extra resolver adapters.
- **@gorhom/bottom-sheet**: Heavy native library requiring dedicated gesture handler root setup and complex reanimated bridges; introduces version fragility during Expo SDK upgrades compared to headless `@rn-primitives/dialog`.
- **React Native Reusables + TanStack Form Compound Primitives (Chosen)**: Delivers 100% behavioral and structural alignment with `tanstack-open-api`, ensures full ownership over primitive styling and tactile elevation, leverages Effect's `Schema.standardSchemaV1` for end-to-end type safety, guarantees predictable overlay layering via `<PortalHost />`, and handles mobile keyboard interactions smoothly with `react-native-keyboard-controller`.

## Consequences

- All core UI components in `src/shared/ui/` (`button`, `input`, `textarea`, `checkbox`, `switch`, `radio-group`, `select`, `slider`, `progress`, `card`, `separator`, `avatar`, `badge`, `accordion`, `tabs`, `dialog`, `alert-dialog`, `sheet`, `popover`, `tooltip`, `alert`, `skeleton`, `toast`, `<Can />`) are owned copy-in files styled with NativeWind semantic utility classes.
- `<PortalHost />` from `@rn-primitives/portal` is mounted once at the Composition Root (`src/app/index.tsx`) inside `ThemeProvider` but outside Expo Router `<Stack />`, guaranteeing dialogs, sheets, and popovers render above all navigation bars and inherit active theme CSS variables.
- `useAppForm` in `src/shared/ui/form.tsx` provides identical ergonomics to `tanstack-open-api`, wrapping `@tanstack/react-form` with an `isSubmittingRef` concurrency lock, direct Effect `Schema.standardSchemaV1` validator support, and automatic defect reporting to `ObservabilityPort.recordDefect`.
- Mobile form primitives (`FormItem`, `FormLabel`, `FormControl`, `FormDescription`, `FormMessage`) automatically wire accessibility attributes (`accessibilityRole="text"`, `accessibilityState={{ invalid }}`), dynamic error border styling, and error message rendering from `field.state.meta.errors`.
- `applyServerValidationErrors(form, errors)` maps backend HTTP 422 validation records directly into TanStack Form field error maps, with automatic error clearing on `onChangeText`.
- `FormScrollView` (`src/shared/ui/form-scroll-view.tsx`) wraps `KeyboardAwareScrollView` from `react-native-keyboard-controller` with `keyboardShouldPersistTaps="handled"`, `keyboardDismissMode="on-drag"`, and auto-scrolling to the first invalid field upon submission failure.
- `src/features/showcase/` encapsulates the design system showcase as an FSD feature slice (`src/features/showcase/ui/ShowcaseScreen.tsx`), exposing tabbed sections (`Tokens`, `Primitives`, `Overlays`, `Form Demo`), an embedded runtime theme/mode switcher, and an interactive bug report form validated via `ShowcaseFeedbackSchema`.
