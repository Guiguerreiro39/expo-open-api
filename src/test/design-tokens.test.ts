import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  getThemeTokenMap,
  resolveThemeColor,
  THEME_PRESETS,
  type ThemeColorToken,
  type ThemePreset,
} from "@/shared/lib/theme/tokens";
import { cn } from "@/shared/lib/utils";

const ROOT = path.resolve(__dirname, "../..");

const SEMANTIC_ALIAS_COLORS = [
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

const HSL_CHANNEL_REGEX = /^(\d{1,3})\s+(\d{1,3})%\s+(\d{1,3})%$/;

function isValidHslChannels(value: string | undefined): boolean {
  if (typeof value !== "string") return false;
  const match = value.trim().match(HSL_CHANNEL_REGEX);
  if (!match) return false;
  const h = Number(match[1]);
  const s = Number(match[2]);
  const l = Number(match[3]);
  return h >= 0 && h <= 360 && s >= 0 && s <= 100 && l >= 0 && l <= 100;
}

interface ParsedDesignFrontmatter {
  presets: string[];
  colors: string[];
  typography: string[];
  rounded: string[];
}

function parseDesignFrontmatter(markdown: string): ParsedDesignFrontmatter {
  const match = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!match?.[1]) {
    throw new Error("DESIGN.md must contain YAML frontmatter");
  }

  const lines = match[1].split("\n");
  const presets: string[] = [];
  const colors: string[] = [];
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
      if (entry?.[1]) colors.push(entry[1]);
    } else if (section === "typography") {
      const entry = line.match(/^ {2}([a-z0-9-]+):\s*$/);
      if (entry?.[1]) typography.push(entry[1]);
    } else if (section === "rounded") {
      const entry = line.match(/^\s+([a-z0-9-]+):\s*\d+\s*$/);
      if (entry?.[1] && entry[1] !== "seed") rounded.push(entry[1]);
    }
  }

  return { presets, colors, typography, rounded };
}

function walkSourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

describe("Design System Single-Source Token Contract", () => {
  const designMd = fs.readFileSync(path.join(ROOT, "DESIGN.md"), "utf8");
  const spec = parseDesignFrontmatter(designMd);
  const allColorTokens = [...new Set([...spec.colors, ...SEMANTIC_ALIAS_COLORS])];

  it("declares the 3 canonical theme presets and >= 45 semantic color tokens in DESIGN.md", () => {
    expect(spec.presets).toEqual(["warm-tactile", "editorial-slate", "neo-brutalist"]);
    expect(spec.colors.length).toBeGreaterThanOrEqual(45);
    expect(spec.typography.length).toBeGreaterThanOrEqual(10);
    expect(spec.rounded.length).toBeGreaterThanOrEqual(8);
  });

  it("binds every DESIGN.md color, typography, and radius token in tailwind.config.ts", () => {
    const tailwindConfig = fs.readFileSync(path.join(ROOT, "tailwind.config.ts"), "utf8");

    for (const token of allColorTokens) {
      expect(tailwindConfig).toContain(`hsl(var(--${token}) / <alpha-value>)`);
    }

    for (const typeKey of spec.typography) {
      expect(
        tailwindConfig.includes(`"${typeKey}"`) || tailwindConfig.includes(`'${typeKey}'`),
      ).toBe(true);
    }

    for (const radiusKey of spec.rounded) {
      expect(
        tailwindConfig.includes(`${radiusKey}:`) || tailwindConfig.includes(`"${radiusKey}":`),
      ).toBe(true);
    }
  });

  it("defines valid space-separated HSL channels for all tokens in global.css :root and .dark", () => {
    const globalCss = fs.readFileSync(path.join(ROOT, "global.css"), "utf8");

    expect(globalCss).toContain("@tailwind base;");
    expect(globalCss).toContain("@tailwind components;");
    expect(globalCss).toContain("@tailwind utilities;");

    const rootBlock = globalCss.match(/:root\s*\{([\s\S]*?)\}/)?.[1];
    const darkBlock = globalCss.match(/\.dark\s*\{([\s\S]*?)\}/)?.[1];
    expect(rootBlock).toBeDefined();
    expect(darkBlock).toBeDefined();

    for (const blockBody of [rootBlock ?? "", darkBlock ?? ""]) {
      for (const token of allColorTokens) {
        const match = blockBody.match(new RegExp(`--${token}:\\s*([^;]+);`));
        expect(match?.[1], `Missing --${token} in global.css`).toBeDefined();
        expect(
          isValidHslChannels(match?.[1]),
          `Invalid HSL channels for --${token}: ${match?.[1]}`,
        ).toBe(true);
      }
    }
  });

  it("defines all presets x schemes x tokens with elevation metadata in src/shared/lib/theme/tokens.ts", () => {
    for (const presetId of spec.presets as ThemePreset[]) {
      const preset = THEME_PRESETS[presetId];
      expect(preset).toBeDefined();
      expect(typeof preset.pressTranslate.x).toBe("number");
      expect(typeof preset.pressTranslate.y).toBe("number");
      expect(preset.elevation.light.boxShadow).toBeTruthy();
      expect(preset.elevation.dark.boxShadow).toBeTruthy();

      for (const scheme of ["light", "dark"] as const) {
        const palette = preset[scheme];
        const tokenMap = getThemeTokenMap(presetId, scheme);
        for (const token of allColorTokens as ThemeColorToken[]) {
          const cssVar = `--${token}` as const;
          const value = palette[cssVar];
          expect(isValidHslChannels(value), `${presetId}.${scheme}.${cssVar}`).toBe(true);
          expect(tokenMap[cssVar]).toBe(value);
          expect(resolveThemeColor(presetId, scheme, token)).toBe(`hsl(${value})`);
        }
      }
    }
  });

  it("preserves custom typography scale classes alongside semantic text colors in cn()", () => {
    expect(cn("text-body-md text-foreground")).toBe("text-body-md text-foreground");
    expect(cn("text-headline-md", "text-body-sm", "text-primary")).toBe(
      "text-body-sm text-primary",
    );
  });

  it("enforces zero hardcoded hex/rgb/hsl color classes or color literals in src/features and src/shared/ui", () => {
    const checkedDirs = [path.join(ROOT, "src/features"), path.join(ROOT, "src/shared/ui")];
    const forbiddenPatterns = [
      {
        name: "arbitrary hex Tailwind class",
        regex: /\b(?:bg|text|border|ring|fill|stroke)-\[#[0-9a-fA-F]{3,8}\]/,
      },
      {
        name: "arbitrary rgb/hsl Tailwind class",
        regex: /\b(?:bg|text|border|ring)-\[(?:rgb|rgba|hsl|hsla)\(/,
      },
      {
        name: "hardcoded hex color literal",
        regex: /["']#[0-9a-fA-F]{3,8}["']/,
      },
      {
        name: "hardcoded rgb/rgba color literal",
        regex: /["']rgba?\(\s*\d+/,
      },
    ];

    const violations: string[] = [];
    for (const dir of checkedDirs) {
      for (const file of walkSourceFiles(dir)) {
        const content = fs.readFileSync(file, "utf8");
        const rel = path.relative(ROOT, file);
        for (const { name, regex } of forbiddenPatterns) {
          if (regex.test(content)) {
            violations.push(`${rel} (${name})`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
