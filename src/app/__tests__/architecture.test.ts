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

function toPosix(value: string): string {
  return value.split(path.sep).join("/");
}

function resolveImportTarget(filePath: string, specifier: string): string | null {
  if (specifier.startsWith("@/")) {
    return path.join(SRC_DIR, specifier.slice(2));
  }
  if (specifier === "src" || specifier.startsWith("src/")) {
    return path.join(ROOT, specifier);
  }
  if (specifier === "app" || specifier.startsWith("app/")) {
    return path.join(ROOT, specifier);
  }
  if (specifier.startsWith(".")) {
    return path.resolve(path.dirname(filePath), specifier);
  }
  return null;
}

function checkSharedImportViolation(filePath: string, specifier: string): string | null {
  const resolved = resolveImportTarget(filePath, specifier);
  if (!resolved) return null;
  const relFromRoot = toPosix(path.relative(ROOT, resolved));
  if (
    relFromRoot === "app" ||
    relFromRoot.startsWith("app/") ||
    relFromRoot === "src/app" ||
    relFromRoot.startsWith("src/app/") ||
    relFromRoot === "src/features" ||
    relFromRoot.startsWith("src/features/")
  ) {
    return `${toPosix(path.relative(ROOT, filePath))} -> ${specifier}`;
  }
  return null;
}

function checkFeatureImportViolation(filePath: string, specifier: string): string | null {
  const resolved = resolveImportTarget(filePath, specifier);
  if (!resolved) return null;
  const relFromFeatures = toPosix(path.relative(path.join(SRC_DIR, "features"), filePath));
  const ownSlice = relFromFeatures.split("/")[0];
  const relFromRoot = toPosix(path.relative(ROOT, resolved));

  if (
    relFromRoot === "app" ||
    relFromRoot.startsWith("app/") ||
    relFromRoot === "src/app" ||
    relFromRoot.startsWith("src/app/")
  ) {
    return `${toPosix(path.relative(ROOT, filePath))} -> ${specifier} (imports app layer)`;
  }

  if (relFromRoot === "src/features" || relFromRoot.startsWith("src/features/")) {
    const targetSlice = relFromRoot.split("/")[2];
    if (targetSlice && targetSlice !== ownSlice) {
      return `${toPosix(path.relative(ROOT, filePath))} -> ${specifier} (cross-feature import: ${ownSlice} -> ${targetSlice})`;
    }
  }
  return null;
}

describe("FSD architecture and zero-mock invariants", () => {
  it("prevents src/shared from importing from src/features, src/app, or app/", () => {
    const sharedDir = path.join(SRC_DIR, "shared");
    const files = collectSourceFiles(sharedDir);
    const violations: string[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf8");
      for (const specifier of extractImportSpecifiers(content)) {
        const violation = checkSharedImportViolation(file, specifier);
        if (violation) {
          violations.push(violation);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("prevents src/features slices from importing from src/app, app/, or other feature slices", () => {
    const featuresDir = path.join(SRC_DIR, "features");
    const files = collectSourceFiles(featuresDir);
    const violations: string[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf8");
      for (const specifier of extractImportSpecifiers(content)) {
        const violation = checkFeatureImportViolation(file, specifier);
        if (violation) {
          violations.push(violation);
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

  it("detects root-relative baseUrl (src/..., app/...) and relative ../app/... FSD violations", () => {
    const homeFile = path.join(SRC_DIR, "features", "home", "ui", "home-screen.tsx");
    const sharedFile = path.join(SRC_DIR, "shared", "ui", "button.tsx");

    // Cross-feature via baseUrl root-relative path
    expect(checkFeatureImportViolation(homeFile, "src/features/tasks/api/tasks")).toContain(
      "cross-feature import: home -> tasks",
    );
    // Feature importing app/ route via baseUrl or relative path
    expect(checkFeatureImportViolation(homeFile, "app/_layout")).toContain("imports app layer");
    expect(checkFeatureImportViolation(homeFile, "src/app/composition")).toContain(
      "imports app layer",
    );
    // Feature importing own slice or shared is allowed
    expect(checkFeatureImportViolation(homeFile, "@/shared/ui/button")).toBeNull();
    expect(checkFeatureImportViolation(homeFile, "src/features/home/model/home")).toBeNull();

    // Shared importing app/ route via baseUrl root-relative path or relative traversal
    expect(checkSharedImportViolation(sharedFile, "app/_layout")).not.toBeNull();
    expect(checkSharedImportViolation(sharedFile, "../../../app/_layout")).not.toBeNull();
    expect(checkSharedImportViolation(sharedFile, "src/app/composition")).not.toBeNull();
    expect(checkSharedImportViolation(sharedFile, "src/features/tasks/api/tasks")).not.toBeNull();
    // Shared importing shared or external package is allowed
    expect(checkSharedImportViolation(sharedFile, "@/shared/ui/text")).toBeNull();
    expect(checkSharedImportViolation(sharedFile, "react-native")).toBeNull();
  });
});
