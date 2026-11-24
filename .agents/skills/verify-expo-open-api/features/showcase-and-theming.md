# Verification Flow: Showcase & Theming (`showcase-and-theming`)

Validates the single-source OKLCH-to-HSL token bridge, runtime preset switching, tactile elevation physics, Reusables catalog overlays via `<PortalHost />`, owned `ToastProvider`, and Effect-validated `useAppForm` on `/(app)/showcase`.

---

## Automated Boundary Gate

```bash
pnpm verify:tokens
pnpm test src/test/design-tokens.test.ts src/shared/ui/__tests__/theme-switcher.test.tsx src/shared/ui/__tests__/form.test.tsx src/features/showcase/__tests__/showcase-screen.test.tsx
```

---

## Interactive Verification Steps

### 1. Token Parity & Zero Hardcoded Colors

1. Run `pnpm verify:tokens`.
2. **Assertion**: Every color, typography, radius, and preset declared in `DESIGN.md` matches `global.css`, `tailwind.config.ts`, and `src/shared/lib/theme/tokens.ts`, with zero hardcoded hex/rgb literals under `src/features/` or `src/shared/ui/`.

### 2. Runtime Preset & Color Scheme Switching

1. Open the **Showcase** tab (`/(app)/showcase`) and locate `ThemeSwitcher`.
2. Switch across all 3 canonical presets and toggle `light`, `dark`, and `system`:
   - **`warm-tactile` (default)**: Warm terracotta primary, parchment surfaces, 4px offset `boxShadow`, 2px diagonal press depression.
   - **`editorial-slate`**: Cool navy primary, monochrome slate surfaces, 2px subtle elevation, 1px crisp press depression.
   - **`neo-brutalist`**: High-contrast amber primary, stark borders, hard 4px solid offset shadow, 4px mechanical depression.
3. **Assertion**: NativeWind `vars()` updates immediately without restarting the app, `expo-status-bar` flips light/dark contrast, and the active preset persists in `KeyValueStorePort` (MMKV).

### 3. Tactile Pressable, Overlays & Toast Feedback

1. Navigate across the `Tokens`, `Primitives`, `Overlays`, and `Form Demo` tabs.
2. Press a `TactilePressable` button:
   - **Assertion**: Component springs diagonally on `onPressIn`, triggers light haptics on native devices, and springs back on `onPressOut`.
3. Open a `Dialog`, `AlertDialog`, and bottom `Sheet` in the `Overlays` tab:
   - **Assertion**: All overlays mount into the single root `<PortalHost />` above the tab bar and dismiss cleanly.
4. Trigger a toast via `useToast()`:
   - **Assertion**: The themed toast renders in the `ToastViewport` portal and dismisses manually or after timeout.

### 4. Effect-Validated Form & `FormScrollView`

1. In `Form Demo`, submit empty required fields:
   - **Assertion**: `useAppForm` (`Schema.standardSchemaV1(ShowcaseFeedbackSchema)`) displays accessible `FormMessage` alerts without throwing unhandled exceptions.
2. Fill valid inputs and submit:
   - **Assertion**: Double-submit lock prevents duplicate submissions and a success toast confirms completion.
