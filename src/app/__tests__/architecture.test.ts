import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../../..");
const SRC_DIR = path.join(ROOT, "src");

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "generated" || entry.name === "node_modules") {
        continue;
      }
      collectSourceFiles(fullPath, acc);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      acc.push(fullPath);
    }
  }
  return acc;
}

function extractImportSpecifiers(content: string): string[] {
  const specifiers: string[] = [];
  const staticImportRe = /(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g;
  const dynamicImportRe = /import\(\s*["']([^"']+)["']\s*\)/g;
  const requireRe = /require\(\s*["']([^"']+)["']\s*\)/g;

  for (const regex of [staticImportRe, dynamicImportRe, requireRe]) {
    for (const match of content.matchAll(regex)) {
      const specifier = match[1];
      if (specifier) {
        specifiers.push(specifier);
      }
    }
  }
  return specifiers;
}

function resolveImportTarget(filePath: string, specifier: string): string | null {
  if (specifier.startsWith("@/")) {
    return path.join(SRC_DIR, specifier.slice(2));
  }
  if (specifier.startsWith(".")) {
    return path.resolve(path.dirname(filePath), specifier);
  }
  return null;
}

describe("FSD architecture and zero-mock invariants", () => {
  it("prevents src/shared from importing from src/features or src/app", () => {
    const sharedDir = path.join(SRC_DIR, "shared");
    const files = collectSourceFiles(sharedDir);
    const violations: string[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf8");
      for (const specifier of extractImportSpecifiers(content)) {
        const resolved = resolveImportTarget(file, specifier);
        if (!resolved) continue;
        const rel = path.relative(SRC_DIR, resolved);
        if (rel.startsWith("features") || rel.startsWith("app")) {
          violations.push(`${path.relative(ROOT, file)} -> ${specifier}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("prevents src/features slices from importing from src/app or other feature slices", () => {
    const featuresDir = path.join(SRC_DIR, "features");
    const files = collectSourceFiles(featuresDir);
    const violations: string[] = [];

    for (const file of files) {
      const relFromFeatures = path.relative(featuresDir, file);
      const ownSlice = relFromFeatures.split(path.sep)[0];
      const content = fs.readFileSync(file, "utf8");

      for (const specifier of extractImportSpecifiers(content)) {
        const resolved = resolveImportTarget(file, specifier);
        if (!resolved) continue;
        const relFromSrc = path.relative(SRC_DIR, resolved);

        if (relFromSrc.startsWith("app")) {
          violations.push(`${path.relative(ROOT, file)} -> ${specifier} (imports app layer)`);
          continue;
        }

        if (relFromSrc.startsWith("features")) {
          const targetSlice = relFromSrc.split(path.sep)[1];
          if (targetSlice && targetSlice !== ownSlice) {
            violations.push(
              `${path.relative(ROOT, file)} -> ${specifier} (cross-feature import: ${ownSlice} -> ${targetSlice})`,
            );
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("forbids barrel index.ts files inside feature slices", () => {
    const featuresDir = path.join(SRC_DIR, "features");
    const files = collectSourceFiles(featuresDir);
    const barrels = files
      .filter((file) => /^index\.tsx?$/.test(path.basename(file)))
      .map((file) => path.relative(ROOT, file));

    expect(barrels).toEqual([]);
  });

  it("enforces zero Vitest or Jest module mocking calls across src/", () => {
    const files = collectSourceFiles(SRC_DIR);
    const mockCallPattern = new RegExp(`\\b(?:vi|jest)\\.${"mock"}\\s*\\(`);
    const violations: string[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf8");
      if (mockCallPattern.test(content)) {
        violations.push(path.relative(ROOT, file));
      }
    }

    expect(violations).toEqual([]);
  });
});
