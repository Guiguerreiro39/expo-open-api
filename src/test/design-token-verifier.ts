import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const CANONICAL_PRESETS = ["warm-tactile", "editorial-slate", "neo-brutalist"] as const;

export const SEMANTIC_ALIAS_COLORS = [
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "border",
  "input",
  "ring",
] as const;

export const REQUIRED_FONT_FAMILIES = [
  "sans",
  "sans-medium",
  "sans-semibold",
  "sans-bold",
  "display",
  "mono",
  "mono-bold",
] as const;

export const TEXT_CONTRAST_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["foreground", "background"],
  ["on-surface", "surface"],
  ["on-surface-variant", "surface"],
  ["on-surface-variant", "card"],
  ["on-surface-variant", "surface-container-low"],
  ["on-surface-variant", "surface-container"],
  ["inverse-on-surface", "inverse-surface"],
  ["card-foreground", "card"],
  ["popover-foreground", "popover"],
  ["popover-foreground", "accent"],
  ["muted-foreground", "muted"],
  ["muted-foreground", "card"],
  ["accent-foreground", "accent"],
  ["primary-foreground", "primary"],
  ["on-primary-container", "primary-container"],
  ["secondary-foreground", "secondary"],
  ["on-secondary-container", "secondary-container"],
  ["tertiary-foreground", "tertiary"],
  ["on-tertiary-container", "tertiary-container"],
  ["destructive-foreground", "destructive"],
  ["on-destructive-container", "destructive-container"],
  ["success-foreground", "success"],
  ["on-success-container", "success-container"],
  ["warning-foreground", "warning"],
  ["on-warning-container", "warning-container"],
  ["info-foreground", "info"],
  ["on-info-container", "info-container"],
];

export const UI_BORDER_CONTRAST_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["outline", "background"],
  ["outline", "card"],
  ["outline", "surface-container-lowest"],
];

export const DARK_SURFACE_STEP_TOKENS = [
  "background",
  "surface-container-low",
  "card",
  "surface-container",
  "popover",
] as const;

export const HYGIENE_SCAN_DIRS = ["app", "src/app", "src/features", "src/shared/ui"] as const;

export interface HygieneRule {
  readonly name: string;
  readonly regex: RegExp;
}

export const FORBIDDEN_COLOR_PATTERNS: readonly HygieneRule[] = [
  {
    name: "arbitrary hex Tailwind class",
    regex: /\b(?:bg|text|border|ring|fill|stroke|outline|divide|from|via|to)-\[#[0-9a-fA-F]{3,8}\]/,
  },
  {
    name: "arbitrary rgb/hsl Tailwind class",
    regex: /\b(?:bg|text|border|ring|fill|stroke)-\[(?:rgb|rgba|hsl|hsla)\(/,
  },
  {
    name: "hardcoded hex color literal",
    regex: /["'`]#[0-9a-fA-F]{3,8}["'`]/,
  },
  {
    name: "hardcoded rgb/rgba color literal",
    regex: /["'`]rgba?\(\s*\d+/,
  },
  {
    name: "hardcoded hsl/hsla color literal",
    regex: /["'`]hsla?\(\s*\d+/,
  },
  {
    name: "raw Tailwind palette color class",
    regex:
      /\b(?:bg|text|border|ring|fill|stroke|outline|divide|from|via|to)-(?:white|black|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3})(?:\/\d{1,3})?\b/,
  },
];

const HSL_CHANNEL_REGEX = /^(\d{1,3})\s+(\d{1,3})%\s+(\d{1,3})%$/;

export interface ParsedDesignFrontmatter {
  readonly presets: string[];
  readonly colors: string[];
  readonly colorHexMap: Record<string, string>;
  readonly typography: string[];
  readonly rounded: string[];
}

export interface HslChannels {
  readonly h: number;
  readonly s: number;
  readonly l: number;
}

export interface PresetLike {
  readonly pressTranslate?: { readonly x?: unknown; readonly y?: unknown };
  readonly elevation?: {
    readonly light?: { readonly boxShadow?: unknown; readonly borderWidth?: unknown };
    readonly dark?: { readonly boxShadow?: unknown; readonly borderWidth?: unknown };
  };
  readonly light?: Record<string, string>;
  readonly dark?: Record<string, string>;
}

export interface PresetsHolderLike {
  readonly THEME_PRESETS: Record<string, PresetLike>;
}

export interface TokensModuleLike extends PresetsHolderLike {
  readonly getThemeTokenMap: (preset: string, scheme: "light" | "dark") => Record<string, string>;
  readonly resolveThemeColor: (preset: string, scheme: "light" | "dark", token: string) => string;
}

export interface VerificationSummary {
  readonly presetCount: number;
  readonly colorTokenCount: number;
  readonly typographyCount: number;
  readonly radiusCount: number;
  readonly scannedFileCount: number;
}

export function parseHslChannels(value: string | undefined): HslChannels | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(HSL_CHANNEL_REGEX);
  if (!match) return null;
  const h = Number(match[1]);
  const s = Number(match[2]);
  const l = Number(match[3]);
  if (h < 0 || h > 360 || s < 0 || s > 100 || l < 0 || l > 100) {
    return null;
  }
  return { h, s, l };
}

export function isValidHslChannels(value: string | undefined): boolean {
  return parseHslChannels(value) !== null;
}

export function hslToRgb(hslValue: string): readonly [number, number, number] {
  const parsed = parseHslChannels(hslValue);
  if (!parsed) {
    throw new Error(`Invalid HSL channel string: "${hslValue}"`);
  }
  const h = parsed.h % 360;
  const s = parsed.s / 100;
  const l = parsed.l / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  return [r + m, g + m, b + m];
}

export function hexToHsl(hex: string): HslChannels {
  const normalized = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    throw new Error(`Invalid 6-digit hex color: "${hex}"`);
  }
  const r = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const g = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const b = Number.parseInt(normalized.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) {
      h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    } else if (max === g) {
      h = ((b - r) / d + 2) * 60;
    } else {
      h = ((r - g) / d + 4) * 60;
    }
  }

  return {
    h: Math.round(h) % 360,
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function relativeLuminance(rgb: readonly [number, number, number]): number {
  const linearize = (channel: number) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  return 0.2126 * linearize(rgb[0]) + 0.7152 * linearize(rgb[1]) + 0.0722 * linearize(rgb[2]);
}

export function computeContrastRatio(hslA: string, hslB: string): number {
  const lumA = relativeLuminance(hslToRgb(hslA));
  const lumB = relativeLuminance(hslToRgb(hslB));
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

export function parseDesignFrontmatter(markdown: string): ParsedDesignFrontmatter {
  const match = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!match?.[1]) {
    throw new Error("DESIGN.md must contain YAML frontmatter");
  }

  const lines = match[1].split("\n");
  const presets: string[] = [];
  const colors: string[] = [];
  const colorHexMap: Record<string, string> = {};
  const typography: string[] = [];
  const rounded: string[] = [];

  let section: string | null = null;
  for (const line of lines) {
    if (/^[a-zA-Z0-9_-]+:/.test(line)) {
      section = line.split(":")[0]?.trim() ?? null;
      continue;
    }

    if (section === "presets") {
      const item = line.match(/^\s+-\s+([a-z0-9-]+)\s*$/);
      if (item?.[1]) presets.push(item[1]);
    } else if (section === "colors") {
      const entry = line.match(/^\s+([a-z0-9-]+):\s*'(#[0-9a-fA-F]{6})'\s*$/);
      if (entry?.[1] && entry[2]) {
        colors.push(entry[1]);
        colorHexMap[entry[1]] = entry[2];
      }
    } else if (section === "typography") {
      const entry = line.match(/^ {2}([a-z0-9-]+):\s*$/);
      if (entry?.[1]) typography.push(entry[1]);
    } else if (section === "rounded") {
      const entry = line.match(/^\s+([a-z0-9-]+):\s*\d+\s*$/);
      if (entry?.[1] && entry[1] !== "seed") rounded.push(entry[1]);
    }
  }

  return { presets, colors, colorHexMap, typography, rounded };
}

export function extractCssBlockTokens(blockBody: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const match of blockBody.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) {
    const tokenName = match[1];
    const tokenValue = match[2]?.trim();
    if (tokenName && tokenValue) {
      tokens[`--${tokenName}`] = tokenValue;
    }
  }
  return tokens;
}

export function walkProductionSourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "__tests__" || entry.name === "node_modules") {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkProductionSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\.(ts|tsx)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

export function findColorHygieneViolationsInContent(content: string, relPath: string): string[] {
  const violations: string[] = [];
  for (const { name, regex } of FORBIDDEN_COLOR_PATTERNS) {
    if (regex.test(content)) {
      violations.push(`${relPath} (${name})`);
    }
  }
  return violations;
}

export function verifyColorHygiene(rootDir: string): {
  readonly scannedFileCount: number;
  readonly violations: string[];
} {
  const violations: string[] = [];
  let scannedFileCount = 0;

  for (const relDir of HYGIENE_SCAN_DIRS) {
    const absDir = path.join(rootDir, relDir);
    for (const file of walkProductionSourceFiles(absDir)) {
      scannedFileCount += 1;
      const content = fs.readFileSync(file, "utf8");
      const relPath = path.relative(rootDir, file).split(path.sep).join("/");
      violations.push(...findColorHygieneViolationsInContent(content, relPath));
    }
  }

  return { scannedFileCount, violations };
}

export function verifyWcagContrastAndSurfaces(tokensModule: PresetsHolderLike): string[] {
  const failures: string[] = [];

  for (const presetId of CANONICAL_PRESETS) {
    const preset = tokensModule.THEME_PRESETS[presetId];
    if (!preset) {
      failures.push(`Missing preset in THEME_PRESETS: ${presetId}`);
      continue;
    }

    for (const scheme of ["light", "dark"] as const) {
      const palette = preset[scheme];
      if (!palette) {
        failures.push(`Missing ${scheme} palette in ${presetId}`);
        continue;
      }

      if (palette["--scrim"] !== "0 0% 0%") {
        failures.push(
          `${presetId}.${scheme}.--scrim must be mode-invariant "0 0% 0%", got "${palette["--scrim"] ?? "undefined"}"`,
        );
      }

      for (const [fg, bg] of TEXT_CONTRAST_PAIRS) {
        const fgVal = palette[`--${fg}`];
        const bgVal = palette[`--${bg}`];
        if (!fgVal || !bgVal) {
          failures.push(`${presetId}.${scheme}: missing token in pair ${fg} on ${bg}`);
          continue;
        }
        const ratio = computeContrastRatio(fgVal, bgVal);
        if (ratio < 4.5) {
          failures.push(
            `WCAG AA text contrast failed (< 4.5:1): ${presetId}.${scheme} --${fg} (${fgVal}) on --${bg} (${bgVal}) = ${ratio.toFixed(2)}:1`,
          );
        }
      }

      for (const [fg, bg] of UI_BORDER_CONTRAST_PAIRS) {
        const fgVal = palette[`--${fg}`];
        const bgVal = palette[`--${bg}`];
        if (!fgVal || !bgVal) {
          failures.push(`${presetId}.${scheme}: missing token in UI border pair ${fg} on ${bg}`);
          continue;
        }
        const ratio = computeContrastRatio(fgVal, bgVal);
        if (ratio < 3.0) {
          failures.push(
            `WCAG AA UI border contrast failed (< 3.0:1): ${presetId}.${scheme} --${fg} (${fgVal}) on --${bg} (${bgVal}) = ${ratio.toFixed(2)}:1`,
          );
        }
      }
    }

    const darkPalette = preset.dark;
    if (darkPalette) {
      const seenLightness = new Map<number, string>();
      for (const stepToken of DARK_SURFACE_STEP_TOKENS) {
        const raw = darkPalette[`--${stepToken}`];
        const parsed = parseHslChannels(raw);
        if (!parsed) {
          failures.push(`${presetId}.dark.--${stepToken} has invalid HSL channels: "${raw}"`);
          continue;
        }
        const existing = seenLightness.get(parsed.l);
        if (existing) {
          failures.push(
            `${presetId}.dark surface collapse: --${stepToken} (${raw}) shares lightness ${parsed.l}% with --${existing}`,
          );
        } else {
          seenLightness.set(parsed.l, stepToken);
        }
      }
    }
  }

  return failures;
}

export function verifyTokenParity(rootDir: string, tokensModule: PresetsHolderLike): string[] {
  const failures: string[] = [];

  const designMd = fs.readFileSync(path.join(rootDir, "DESIGN.md"), "utf8");
  const spec = parseDesignFrontmatter(designMd);
  const allColorTokens = [...new Set([...spec.colors, ...SEMANTIC_ALIAS_COLORS])];

  const globalCss = fs.readFileSync(path.join(rootDir, "global.css"), "utf8");
  const rootBlock = globalCss.match(/:root\s*\{([\s\S]*?)\}/)?.[1];
  const darkBlock = globalCss.match(/\.dark\s*\{([\s\S]*?)\}/)?.[1];

  if (!rootBlock || !darkBlock) {
    failures.push("global.css must define both :root and .dark blocks");
    return failures;
  }

  const rootTokens = extractCssBlockTokens(rootBlock);
  const darkTokens = extractCssBlockTokens(darkBlock);

  const warmTactile = tokensModule.THEME_PRESETS["warm-tactile"];
  if (!warmTactile?.light || !warmTactile.dark) {
    failures.push("warm-tactile preset missing light/dark palettes");
    return failures;
  }

  // Exact string parity between global.css and warmTactilePreset
  for (const token of allColorTokens) {
    const cssVar = `--${token}`;
    if (rootTokens[cssVar] !== warmTactile.light[cssVar]) {
      failures.push(
        `global.css :root ${cssVar} ("${rootTokens[cssVar] ?? "missing"}") does not match warmTactilePreset.light ("${warmTactile.light[cssVar] ?? "missing"}")`,
      );
    }
    if (darkTokens[cssVar] !== warmTactile.dark[cssVar]) {
      failures.push(
        `global.css .dark ${cssVar} ("${darkTokens[cssVar] ?? "missing"}") does not match warmTactilePreset.dark ("${warmTactile.dark[cssVar] ?? "missing"}")`,
      );
    }
  }

  // Hex <-> HSL parity between DESIGN.md frontmatter and warmTactilePreset.light
  for (const [token, hex] of Object.entries(spec.colorHexMap)) {
    const cssVar = `--${token}`;
    const presetVal = warmTactile.light[cssVar];
    const presetHsl = parseHslChannels(presetVal);
    if (!presetHsl) {
      failures.push(`warmTactilePreset.light missing valid HSL for ${cssVar}`);
      continue;
    }
    const designHsl = hexToHsl(hex);
    const hueDiff = Math.min(
      Math.abs(designHsl.h - presetHsl.h),
      360 - Math.abs(designHsl.h - presetHsl.h),
    );
    const satDiff = Math.abs(designHsl.s - presetHsl.s);
    const lightDiff = Math.abs(designHsl.l - presetHsl.l);
    const hueRelevant = designHsl.s > 3 && presetHsl.s > 3 && designHsl.l > 2 && designHsl.l < 98;

    if ((hueRelevant && hueDiff > 2) || satDiff > 2 || lightDiff > 2) {
      failures.push(
        `DESIGN.md frontmatter ${token} (${hex} -> ${designHsl.h} ${designHsl.s}% ${designHsl.l}%) drifted from warmTactilePreset.light (${presetVal})`,
      );
    }
  }

  return failures;
}

export async function verifyAllDesignTokens(rootDir: string): Promise<VerificationSummary> {
  const errors: string[] = [];

  const designMdPath = path.join(rootDir, "DESIGN.md");
  const designMd = fs.readFileSync(designMdPath, "utf8");
  const spec = parseDesignFrontmatter(designMd);

  if (JSON.stringify(spec.presets) !== JSON.stringify(CANONICAL_PRESETS)) {
    errors.push(
      `DESIGN.md presets must match ${JSON.stringify(CANONICAL_PRESETS)}, got ${JSON.stringify(spec.presets)}`,
    );
  }
  if (spec.colors.length < 46) {
    errors.push(`Expected >= 46 colors in DESIGN.md frontmatter, got ${spec.colors.length}`);
  }
  if (!spec.colors.includes("scrim")) {
    errors.push("DESIGN.md frontmatter colors must declare 'scrim' (Overlay Scrim)");
  }
  if (designMd.includes("Deep navy primary") || designMd.includes("Electric amber primary")) {
    errors.push(
      "DESIGN.md prose still contains stale palette descriptions (Deep navy / Electric amber); reconcile with canonical indigo & cobalt/chartreuse palettes",
    );
  }

  const allColorTokens = [...new Set([...spec.colors, ...SEMANTIC_ALIAS_COLORS])];

  // 1. Verify tailwind.config.ts
  const tailwindConfigPath = path.join(rootDir, "tailwind.config.ts");
  if (!fs.existsSync(tailwindConfigPath)) {
    errors.push("tailwind.config.ts must exist");
  } else {
    const tailwindConfig = fs.readFileSync(tailwindConfigPath, "utf8");
    for (const token of allColorTokens) {
      const expectedBinding = `hsl(var(--${token}) / <alpha-value>)`;
      if (!tailwindConfig.includes(expectedBinding)) {
        errors.push(`tailwind.config.ts missing color token binding: ${expectedBinding}`);
      }
    }
    for (const typeKey of spec.typography) {
      if (!tailwindConfig.includes(`"${typeKey}"`) && !tailwindConfig.includes(`'${typeKey}'`)) {
        errors.push(`tailwind.config.ts missing typography scale token: ${typeKey}`);
      }
    }
    for (const radiusKey of spec.rounded) {
      if (
        !tailwindConfig.includes(`${radiusKey}:`) &&
        !tailwindConfig.includes(`"${radiusKey}":`)
      ) {
        errors.push(`tailwind.config.ts missing borderRadius token: ${radiusKey}`);
      }
    }
    for (const fontKey of REQUIRED_FONT_FAMILIES) {
      if (!tailwindConfig.includes(`${fontKey}:`) && !tailwindConfig.includes(`"${fontKey}":`)) {
        errors.push(`tailwind.config.ts missing fontFamily weight token: ${fontKey}`);
      }
    }
  }

  // 2. Verify global.css
  const globalCssPath = path.join(rootDir, "global.css");
  if (!fs.existsSync(globalCssPath)) {
    errors.push("global.css must exist");
  } else {
    const globalCss = fs.readFileSync(globalCssPath, "utf8");
    for (const directive of ["@tailwind base;", "@tailwind components;", "@tailwind utilities;"]) {
      if (!globalCss.includes(directive)) {
        errors.push(`global.css missing ${directive}`);
      }
    }
    const rootBlock = globalCss.match(/:root\s*\{([\s\S]*?)\}/)?.[1];
    const darkBlock = globalCss.match(/\.dark\s*\{([\s\S]*?)\}/)?.[1];
    if (!rootBlock) errors.push("global.css missing :root block");
    if (!darkBlock) errors.push("global.css missing .dark block");
    for (const [blockName, blockBody] of [
      [":root", rootBlock ?? ""],
      [".dark", darkBlock ?? ""],
    ] as const) {
      for (const token of allColorTokens) {
        const match = blockBody.match(new RegExp(`--${token}:\\s*([^;]+);`));
        if (!match?.[1]) {
          errors.push(`global.css ${blockName} missing --${token}`);
        } else if (!isValidHslChannels(match[1])) {
          errors.push(`global.css ${blockName} --${token} invalid HSL channels: "${match[1]}"`);
        }
      }
    }
  }

  // 3. Verify tokens.ts & presets.ts
  const tokensPath = path.join(rootDir, "src/shared/lib/theme/tokens.ts");
  const presetsPath = path.join(rootDir, "src/shared/lib/theme/presets.ts");
  const tokensModule = (await import(pathToFileURL(tokensPath).href)) as TokensModuleLike;

  for (const presetId of spec.presets) {
    const preset = tokensModule.THEME_PRESETS[presetId];
    if (!preset) {
      errors.push(`THEME_PRESETS missing preset: ${presetId}`);
      continue;
    }
    if (
      typeof preset.pressTranslate?.x !== "number" ||
      typeof preset.pressTranslate?.y !== "number"
    ) {
      errors.push(`${presetId} missing numeric pressTranslate metadata`);
    }
    if (!preset.elevation?.light?.boxShadow || !preset.elevation?.dark?.boxShadow) {
      errors.push(`${presetId} missing elevation boxShadow metadata`);
    }
    for (const scheme of ["light", "dark"] as const) {
      const palette = preset[scheme];
      if (!palette) {
        errors.push(`${presetId} missing ${scheme} palette`);
        continue;
      }
      const tokenMap = tokensModule.getThemeTokenMap(presetId, scheme);
      for (const token of allColorTokens) {
        const cssVar = `--${token}`;
        const value = palette[cssVar];
        if (!isValidHslChannels(value)) {
          errors.push(`${presetId}.${scheme}.${cssVar} invalid HSL channels: "${value}"`);
          continue;
        }
        if (tokenMap[cssVar] !== value) {
          errors.push(`${presetId}.${scheme}.${cssVar} mismatch in getThemeTokenMap`);
        }
        if (tokensModule.resolveThemeColor(presetId, scheme, token) !== `hsl(${value})`) {
          errors.push(`${presetId}.${scheme}.${cssVar} mismatch in resolveThemeColor`);
        }
      }
    }
  }

  const presetsSource = fs.readFileSync(presetsPath, "utf8");
  if (!presetsSource.includes("export function getThemeVars")) {
    errors.push("src/shared/lib/theme/presets.ts must export getThemeVars");
  }

  // 4. Verify cn() typography & font-family merging
  const utilsPath = path.join(rootDir, "src/shared/lib/utils.ts");
  const { cn } = (await import(pathToFileURL(utilsPath).href)) as {
    cn: (...inputs: string[]) => string;
  };
  if (cn("text-body-md text-foreground") !== "text-body-md text-foreground") {
    errors.push("cn() stripped custom typography scale when merged with semantic text color");
  }
  if (cn("text-headline-md", "text-body-sm", "text-primary") !== "text-body-sm text-primary") {
    errors.push("cn() failed to deduplicate conflicting custom typography scale classes");
  }
  if (cn("font-sans", "font-sans-semibold") !== "font-sans-semibold") {
    errors.push("cn() failed to deduplicate custom weight fontFamily classes");
  }

  // 5. Parity checks
  errors.push(...verifyTokenParity(rootDir, tokensModule));

  // 6. WCAG AA contrast & dark-mode surface elevation steps
  errors.push(...verifyWcagContrastAndSurfaces(tokensModule));

  // 7. Full-repo color hygiene
  const hygiene = verifyColorHygiene(rootDir);
  for (const violation of hygiene.violations) {
    errors.push(`Design token hygiene violation: ${violation}`);
  }

  if (errors.length > 0) {
    throw new Error(
      `Design token verification failed (${errors.length} issue(s)):\n- ${errors.join("\n- ")}`,
    );
  }

  return {
    presetCount: spec.presets.length,
    colorTokenCount: allColorTokens.length,
    typographyCount: spec.typography.length,
    radiusCount: spec.rounded.length,
    scannedFileCount: hygiene.scannedFileCount,
  };
}
