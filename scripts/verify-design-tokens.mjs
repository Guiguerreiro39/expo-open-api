import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

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
];

const HSL_CHANNEL_REGEX = /^(\d{1,3})\s+(\d{1,3})%\s+(\d{1,3})%$/;

function isValidHslChannels(value) {
  if (typeof value !== "string") return false;
  const match = value.trim().match(HSL_CHANNEL_REGEX);
  if (!match) return false;
  const h = Number(match[1]);
  const s = Number(match[2]);
  const l = Number(match[3]);
  return h >= 0 && h <= 360 && s >= 0 && s <= 100 && l >= 0 && l <= 100;
}

function parseDesignFrontmatter(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(match, "DESIGN.md must contain YAML frontmatter");
  const lines = match[1].split("\n");

  const presets = [];
  const colors = [];
  const typography = [];
  const rounded = [];

  let section = null;
  for (const line of lines) {
    if (/^[a-zA-Z0-9_-]+:/.test(line)) {
      const key = line.split(":")[0].trim();
      section = key;
      continue;
    }

    if (section === "presets") {
      const item = line.match(/^\s+-\s+([a-z0-9-]+)\s*$/);
      if (item) presets.push(item[1]);
    } else if (section === "colors") {
      const entry = line.match(/^\s+([a-z0-9-]+):\s*'(#[0-9a-fA-F]{6})'\s*$/);
      if (entry) colors.push(entry[1]);
    } else if (section === "typography") {
      const entry = line.match(/^ {2}([a-z0-9-]+):\s*$/);
      if (entry) typography.push(entry[1]);
    } else if (section === "rounded") {
      const entry = line.match(/^\s+([a-z0-9-]+):\s*\d+\s*$/);
      if (entry && entry[1] !== "seed") rounded.push(entry[1]);
    }
  }

  return { presets, colors, typography, rounded };
}

function walkSourceFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
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

async function main() {
  const designMd = fs.readFileSync(path.join(ROOT, "DESIGN.md"), "utf8");
  const spec = parseDesignFrontmatter(designMd);

  assert.deepEqual(
    spec.presets,
    ["warm-tactile", "editorial-slate", "neo-brutalist"],
    "DESIGN.md presets should match canonical 3 presets",
  );
  assert.ok(
    spec.colors.length >= 45,
    `Expected >=45 colors in DESIGN.md, got ${spec.colors.length}`,
  );

  const allColorTokens = [...new Set([...spec.colors, ...SEMANTIC_ALIAS_COLORS])];

  // 1. Verify tailwind.config.ts
  const tailwindConfigPath = path.join(ROOT, "tailwind.config.ts");
  assert.ok(fs.existsSync(tailwindConfigPath), "tailwind.config.ts must exist");
  const tailwindConfig = fs.readFileSync(tailwindConfigPath, "utf8");

  for (const token of allColorTokens) {
    const expectedBinding = `hsl(var(--${token}) / <alpha-value>)`;
    assert.ok(
      tailwindConfig.includes(expectedBinding),
      `tailwind.config.ts missing color token binding: ${expectedBinding}`,
    );
  }

  for (const typeKey of spec.typography) {
    assert.ok(
      tailwindConfig.includes(`"${typeKey}"`) || tailwindConfig.includes(`'${typeKey}'`),
      `tailwind.config.ts missing typography scale token: ${typeKey}`,
    );
  }

  for (const radiusKey of spec.rounded) {
    assert.ok(
      tailwindConfig.includes(`${radiusKey}:`) || tailwindConfig.includes(`"${radiusKey}":`),
      `tailwind.config.ts missing borderRadius token: ${radiusKey}`,
    );
  }

  // 2. Verify global.css
  const globalCssPath = path.join(ROOT, "global.css");
  assert.ok(fs.existsSync(globalCssPath), "global.css must exist");
  const globalCss = fs.readFileSync(globalCssPath, "utf8");

  assert.ok(globalCss.includes("@tailwind base;"), "global.css missing @tailwind base;");
  assert.ok(
    globalCss.includes("@tailwind components;"),
    "global.css missing @tailwind components;",
  );
  assert.ok(globalCss.includes("@tailwind utilities;"), "global.css missing @tailwind utilities;");

  const rootBlockMatch = globalCss.match(/:root\s*\{([\s\S]*?)\}/);
  const darkBlockMatch = globalCss.match(/\.dark\s*\{([\s\S]*?)\}/);
  assert.ok(rootBlockMatch, "global.css missing :root block");
  assert.ok(darkBlockMatch, "global.css missing .dark block");

  for (const [blockName, blockBody] of [
    [":root", rootBlockMatch[1]],
    [".dark", darkBlockMatch[1]],
  ]) {
    for (const token of allColorTokens) {
      const re = new RegExp(`--${token}:\\s*([^;]+);`);
      const match = blockBody.match(re);
      assert.ok(match, `global.css ${blockName} missing --${token}`);
      assert.ok(
        isValidHslChannels(match[1]),
        `global.css ${blockName} --${token} invalid HSL channels: "${match[1]}"`,
      );
    }
  }

  // 3. Verify src/shared/lib/theme/tokens.ts & presets.ts
  const tokensPath = path.join(ROOT, "src/shared/lib/theme/tokens.ts");
  const presetsPath = path.join(ROOT, "src/shared/lib/theme/presets.ts");
  assert.ok(fs.existsSync(tokensPath), "src/shared/lib/theme/tokens.ts must exist");
  assert.ok(fs.existsSync(presetsPath), "src/shared/lib/theme/presets.ts must exist");

  const tokensModule = await import(pathToFileURL(tokensPath).href);
  const { THEME_PRESETS, resolveThemeColor, getThemeTokenMap } = tokensModule;
  assert.ok(THEME_PRESETS, "THEME_PRESETS must be exported");
  assert.equal(typeof resolveThemeColor, "function", "resolveThemeColor must be exported");
  assert.equal(typeof getThemeTokenMap, "function", "getThemeTokenMap must be exported");

  for (const presetId of spec.presets) {
    const preset = THEME_PRESETS[presetId];
    assert.ok(preset, `THEME_PRESETS missing preset: ${presetId}`);
    assert.ok(preset.pressTranslate, `${presetId} missing pressTranslate metadata`);
    assert.equal(typeof preset.pressTranslate.x, "number");
    assert.equal(typeof preset.pressTranslate.y, "number");
    assert.ok(preset.elevation?.light?.boxShadow, `${presetId} missing light boxShadow`);
    assert.ok(preset.elevation?.dark?.boxShadow, `${presetId} missing dark boxShadow`);

    for (const scheme of ["light", "dark"]) {
      const palette = preset[scheme];
      assert.ok(palette, `${presetId} missing ${scheme} palette`);

      const tokenMap = getThemeTokenMap(presetId, scheme);
      for (const token of allColorTokens) {
        const cssVar = `--${token}`;
        const value = palette[cssVar];
        assert.ok(value, `${presetId}.${scheme} missing ${cssVar}`);
        assert.ok(
          isValidHslChannels(value),
          `${presetId}.${scheme}.${cssVar} invalid HSL channels: "${value}"`,
        );
        assert.equal(tokenMap[cssVar], value);

        const resolved = resolveThemeColor(presetId, scheme, token);
        assert.equal(resolved, `hsl(${value})`);
      }
    }
  }

  const presetsSource = fs.readFileSync(presetsPath, "utf8");
  assert.ok(
    presetsSource.includes("export function getThemeVars"),
    "src/shared/lib/theme/presets.ts must export getThemeVars",
  );

  // 3b. Verify cn() preserves custom typography scale alongside semantic text colors
  const utilsPath = path.join(ROOT, "src/shared/lib/utils.ts");
  assert.ok(fs.existsSync(utilsPath), "src/shared/lib/utils.ts must exist");
  const { cn } = await import(pathToFileURL(utilsPath).href);
  assert.equal(
    cn("text-body-md text-foreground"),
    "text-body-md text-foreground",
    "cn() must not strip custom typography scale classes when merged with text color classes",
  );
  assert.equal(
    cn("text-headline-md", "text-body-sm", "text-primary"),
    "text-body-sm text-primary",
    "cn() must deduplicate conflicting custom typography scale classes while preserving color",
  );

  // 4. Hygiene: zero hardcoded hex / rgb / rgba / hsl color literals in src/features & src/shared/ui
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
    { name: "hardcoded hex color literal", regex: /["']#[0-9a-fA-F]{3,8}["']/ },
    { name: "hardcoded rgb/rgba color literal", regex: /["']rgba?\(\s*\d+/ },
  ];

  for (const dir of checkedDirs) {
    for (const file of walkSourceFiles(dir)) {
      const content = fs.readFileSync(file, "utf8");
      const rel = path.relative(ROOT, file);
      for (const { name, regex } of forbiddenPatterns) {
        assert.equal(
          regex.test(content),
          false,
          `Design token hygiene violation (${name}) in ${rel}`,
        );
      }
    }
  }

  console.log(
    `OK: Verified ${spec.presets.length} presets x 2 modes x ${allColorTokens.length} color tokens, typography (${spec.typography.length}), radii (${spec.rounded.length}), and UI token hygiene.`,
  );
}

main().catch((error) => {
  console.error("Design token verification failed:", error.message);
  process.exit(1);
});
