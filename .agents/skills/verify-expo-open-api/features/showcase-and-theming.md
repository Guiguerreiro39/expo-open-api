# Verification Flow: Showcase & Theming (`showcase-and-theming`)

Validates the single-source OKLCH-to-HSL token bridge, WCAG AA contrast & `--scrim` verification, tri-layer runtime theme mirroring, bundled `Quicksand`/`JetBrains Mono` typography, shadow-compressing tactile elevation, rebuilt `Slider`, cross-platform `<PortalHost />` overlays, top-anchored `ToastProvider`, and zero-jump `useAppForm` on `/(app)/showcase` and `/(app)`.

---

## Automated Boundary Gate

```bash
pnpm verify:tokens
pnpm test \
  src/test/design-tokens.test.ts \
  src/app/__tests__/bootstrap.test.tsx \
  src/app/__tests__/root-layout.test.tsx \
  src/features/home/__tests__/home-screens.test.tsx \
  src/features/showcase/__tests__/showcase-screen.test.tsx \
  src/shared/ui/__tests__/theme-provider.test.tsx \
  src/shared/ui/__tests__/theme-switcher.test.tsx \
  src/shared/ui/__tests__/text.test.tsx \
  src/shared/ui/__tests__/tactile-pressable.test.tsx \
  src/shared/ui/__tests__/controls.test.tsx \
  src/shared/ui/__tests__/slider.test.tsx \
  src/shared/ui/__tests__/input.test.tsx \
  src/shared/ui/__tests__/form-scroll-view.test.tsx \
  src/shared/ui/__tests__/form.test.tsx \
  src/shared/ui/__tests__/overlays.test.tsx \
  src/shared/ui/__tests__/select.test.tsx \
  src/shared/ui/__tests__/sheet.test.tsx \
  src/shared/ui/__tests__/toast.test.tsx
```

---

## Interactive Verification Steps

### 1. Token Parity, WCAG AA Contrast & Zero Hardcoded Colors

1. Run `pnpm verify:tokens`.
2. **Assertion**:
   - Every semantic foreground/background pair passes WCAG AA (`>= 4.5:1`) and `outline`/interactive borders pass `>= 3.0:1` across all 3 presets × light/dark modes.
   - `DESIGN.md` frontmatter, `global.css`, `tailwind.config.ts`, and `src/shared/lib/theme/tokens.ts` (including mode-invariant `--scrim`) maintain exact parity.
   - Zero hardcoded hex, `rgb`/`rgba`, `hsl`/`hsla`, or raw Tailwind palette utilities appear across `app/`, `src/app/`, `src/features/`, and `src/shared/ui/`.

### 2. Tri-Layer Preset & Color Scheme Mirroring + Bundled Fonts

1. Open the **Home** (`/(app)`) or **Showcase** (`/(app)/showcase`) tab and locate `ThemeSwitcher`.
2. Switch across all 3 canonical presets and toggle `Light`, `Dark`, and `System`:
   - **`warm-tactile` (default)**: Warm terracotta primary, parchment surfaces, 4px offset `boxShadow`, 2px diagonal press depression.
   - **`editorial-slate`**: Indigo primary (`hsl(226 80% 44%)`), crisp slate surfaces, 2px subtle elevation, 1px crisp press depression.
   - **`neo-brutalist`**: Cobalt primary (`hsl(223 100% 46%)`) with chartreuse accent (`hsl(65 75% 47%)`), sharp corners, constant 2px borders, hard 4px solid offset shadow, 4px mechanical depression.
3. **Assertion**:
   - NativeWind `vars()`, React Navigation headers/tab bars/stack scenes/`+not-found`, `expo-system-ui`, and `expo-status-bar` update simultaneously with zero light-gray/white flashes in dark mode.
   - On Web, `document.documentElement` mirrors active CSS custom properties, `.dark` class (including `"system"` resolving via `matchMedia`), and root background color so Radix portals match the active preset and mode.
   - `Quicksand` and `JetBrains Mono` hydrate via `useAppBootstrap` and `Text` preserves `muted`/`caption`/`label` contrast inside `Card`, `Popover`, and `Alert`.
   - `HomeScreen` displays `Expo SDK 58 · Expo Router · Feature-Sliced Design` and wraps card headers/footers cleanly on 320–375px widths.

### 3. Single-Header Chrome, Tactile Physics, Controls & Rebuilt `Slider`

1. On `/(app)/showcase`, confirm the `<Tabs>` header is the sole top header (`SafeAreaView` uses `edges={["left", "right"]}` only) and all 4 tabs (`Tokens`, `Primitives`, `Overlays`, `Form Demo`) stay single-line and horizontally scrollable on 320–375px screens.
2. In `Tokens`: verify color swatches adapt cleanly on 360px widths and press the contrast-safe `TactilePressable` demo button:
   - **Assertion**: The surface depresses diagonally *into* its offset shadow as the shadow compresses smoothly toward zero (no outward overflow), triggers light haptics on native, and increments the counter.
3. In `Primitives`:
   - Tap button variant demos (`Primary`, `Secondary`, `Outline`, `Destructive`, `Ghost`, `Link`): visible status text and a top-anchored toast confirm interaction.
   - Toggle `Switch`, `Checkbox`, and `RadioGroup`: single click flips once on Web (zero double-fire), touch targets are `>= 44×44pt`, and `Switch`+`Checkbox` / `DropdownMenu` rows wrap cleanly on narrow screens.
   - Confirm `Skeleton` previews animate cleanly and `Select` displays human-readable option labels (`Admin`/`Member`/`Viewer`) in both trigger and scrollable option menu.
   - Drag, tap (including on the filled range), and keyboard-navigate (`Arrow*`, `PageUp/Down`, `Home`, `End`, `Space`/`Enter`) the `Slider`: thumb stays clamped within `[0, 100]` with zero edge clipping and zero `NaN` values.

### 4. Cross-Platform Overlays & Top-Anchored `ToastViewport`

1. In `Overlays`, verify `Open Popover` and `Show Tooltip` split horizontally without vertical flex distortion.
2. Open `Dialog`, `AlertDialog`, `Sheet`, `Popover`, and `Tooltip`:
   - **Assertion**: Backdrops use dark `--scrim` (no milky-white haze in dark mode), Web `Dialog`/`AlertDialog`/`Sheet` stay viewport-fixed on scrolled pages without collapsing horizontally, `Sheet` slides smoothly with bottom safe-area clearance and swipe-down handle dismissal, and Web `Tooltip` renders steadily without hover-flicker or blocking clicks.
3. Trigger `Success`, `Error`, and `Info` toasts:
   - **Assertion**: `ToastViewport` renders in its dedicated top safe-area portal (`TOAST_PORTAL_HOST`, `top: insets.top + 12`) above modals without obstructing the tab bar or keyboard, passes through outside taps (`pointerEvents="box-none"`), and cleans up evicted timers.

### 5. Zero-Jump Feedback Form, `FormControl` Error Clearing & Reset

1. In `Form Demo`, tap into `Feedback Title` and `Description`:
   - **Assertion**: Zero vertical text/caret jump on focus, no Web browser outline clash, and reserved `min-h-5` `FormMessage` slots prevent layout jumps on `onBlur` validation.
   - Pressing keyboard `Next` on `Feedback Title` moves focus directly to `Description`.
2. Submit empty required fields:
   - **Assertion**: `useAppForm` displays accessible `FormMessage` alerts (`Title is required`, `Description must be at least 10 characters`, `You must agree to the feedback policy`).
   - Tapping the checkbox **Label** (`"I agree to share this feedback for design QA"`) toggles the checkbox and immediately clears the submit error; selecting options in `Select` or `RadioGroup` clears their submit errors immediately; long labels wrap cleanly inside the card.
3. Fill valid inputs and submit, then tap **Reset**:
   - **Assertion**: Double-submit lock prevents duplicate submissions, a top success toast + summary payload appear, and **Reset** restores defaults while clearing the summary and errors.
