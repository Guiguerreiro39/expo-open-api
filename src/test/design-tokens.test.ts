import path from "node:path";
import { describe, expect, it } from "vitest";
import * as tokensModule from "@/shared/lib/theme/tokens";
import {
  computeContrastRatio,
  findColorHygieneViolationsInContent,
  verifyAllDesignTokens,
  verifyColorHygiene,
  verifyTokenParity,
  verifyWcagContrastAndSurfaces,
} from "@/test/design-token-verifier";

const ROOT = path.resolve(__dirname, "../..");

describe("Design System Single-Source Token Contract (Shared Verifier)", () => {
  it("passes the full shared token, parity, WCAG contrast, surface step, and repo hygiene audit", async () => {
    const summary = await verifyAllDesignTokens(ROOT);

    expect(summary.presetCount).toBe(3);
    expect(summary.colorTokenCount).toBeGreaterThanOrEqual(59);
    expect(summary.typographyCount).toBeGreaterThanOrEqual(12);
    expect(summary.radiusCount).toBeGreaterThanOrEqual(9);
    expect(summary.scannedFileCount).toBeGreaterThan(20);
  });

  it("enforces exact parity between DESIGN.md frontmatter, global.css, and warmTactilePreset", () => {
    expect(verifyTokenParity(ROOT, tokensModule)).toEqual([]);
  });

  it("enforces WCAG AA contrast (>= 4.5:1 text, >= 3.0:1 outline) and distinct dark surface steps across all presets", () => {
    expect(verifyWcagContrastAndSurfaces(tokensModule)).toEqual([]);
  });

  it("computes accurate WCAG relative luminance contrast ratios", () => {
    expect(computeContrastRatio("0 0% 0%", "0 0% 100%")).toBeCloseTo(21, 1);
    expect(computeContrastRatio("0 0% 100%", "0 0% 100%")).toBeCloseTo(1, 2);
  });

  it("enforces zero hardcoded colors or raw Tailwind palette classes across routes, app, features, and shared UI", () => {
    const result = verifyColorHygiene(ROOT);
    expect(result.violations).toEqual([]);
  });

  it("detects hex, rgb/rgba, hsl/hsla, arbitrary Tailwind colors, and raw Tailwind palette utilities", () => {
    expect(
      findColorHygieneViolationsInContent('const x = "bg-[#ff0000]";', "sample.tsx").length,
    ).toBeGreaterThan(0);
    expect(
      findColorHygieneViolationsInContent('const x = "#123456";', "sample.tsx").length,
    ).toBeGreaterThan(0);
    expect(
      findColorHygieneViolationsInContent('const x = "rgba(0, 0, 0, 0.5)";', "sample.tsx").length,
    ).toBeGreaterThan(0);
    expect(
      findColorHygieneViolationsInContent('const x = "hsl(210 50% 40%)";', "sample.tsx").length,
    ).toBeGreaterThan(0);
    expect(
      findColorHygieneViolationsInContent(
        '<View className="bg-red-500 text-white" />',
        "sample.tsx",
      ).length,
    ).toBeGreaterThan(0);
    expect(
      findColorHygieneViolationsInContent(
        '<View className="bg-background text-foreground border-outline" />',
        "sample.tsx",
      ),
    ).toEqual([]);
  });

  it("detects embedded hex/RGB/HSL literals, directional Tailwind palette borders, and arbitrary outline/from colors", () => {
    expect(
      findColorHygieneViolationsInContent(
        'const style = { boxShadow: "4px 4px 0px #000000" };',
        "sample.tsx",
      ).length,
    ).toBeGreaterThan(0);
    expect(
      findColorHygieneViolationsInContent(
        'const style = { backgroundColor: "RGB(255, 0, 0)", borderColor: "HSL(120, 50%, 50%)" };',
        "sample.tsx",
      ).length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      findColorHygieneViolationsInContent(
        '<View className="border-t-red-500 border-b-white" />',
        "sample.tsx",
      ).length,
    ).toBeGreaterThan(0);
    expect(
      findColorHygieneViolationsInContent(
        '<View className="outline-[rgb(10,20,30)] from-[rgba(0,0,0,0.5)]" />',
        "sample.tsx",
      ).length,
    ).toBeGreaterThan(0);
  });

  it("fails WCAG verification when Switch unchecked thumb or Select/DropdownMenu active surface pairs lose contrast", () => {
    const brokenThumb = structuredClone(tokensModule.THEME_PRESETS);
    brokenThumb["warm-tactile"].light["--surface-container-high"] =
      brokenThumb["warm-tactile"].light["--on-surface-variant"];
    expect(verifyWcagContrastAndSurfaces({ THEME_PRESETS: brokenThumb }).length).toBeGreaterThan(0);

    const brokenMenuHover = structuredClone(tokensModule.THEME_PRESETS);
    brokenMenuHover["neo-brutalist"].dark["--surface-container-high"] =
      brokenMenuHover["neo-brutalist"].dark["--popover-foreground"];
    expect(
      verifyWcagContrastAndSurfaces({ THEME_PRESETS: brokenMenuHover }).length,
    ).toBeGreaterThan(0);
  });
});
