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
});
