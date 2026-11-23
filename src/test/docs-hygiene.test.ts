import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT_DIR = process.cwd();

const INTERNAL_MOCK_TOKEN = ["vi", "mock()"].join(".");

const MARKDOWN_LINK_RE = /(?<!!)\[[^\]]+\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

function extractRelativeLinks(markdown: string): string[] {
  // Strip fenced code blocks before scanning for markdown links
  const stripped = markdown.replace(/```[\s\S]*?```/g, "");
  const links: string[] = [];

  for (const match of stripped.matchAll(MARKDOWN_LINK_RE)) {
    const rawTarget = match[1];
    if (!rawTarget) continue;
    if (
      rawTarget.startsWith("http://") ||
      rawTarget.startsWith("https://") ||
      rawTarget.startsWith("mailto:") ||
      rawTarget.startsWith("#")
    ) {
      continue;
    }
    const withoutFragment = rawTarget.split("#")[0]?.split("?")[0] ?? "";
    if (withoutFragment.length > 0) {
      links.push(withoutFragment);
    }
  }

  return links;
}

describe("Documentation Suite & Runtime Verification Skill Hygiene", () => {
  describe("Root README.md", () => {
    const readmePath = resolve(ROOT_DIR, "README.md");

    it("exists and has fewer than 120 lines", () => {
      expect(existsSync(readmePath)).toBe(true);
      const content = readFileSync(readmePath, "utf8");
      const lines = content.split("\n");
      expect(lines.length).toBeLessThan(120);
    });

    it("contains value proposition paired with hono-open-api and core tech stack", () => {
      const content = readFileSync(readmePath, "utf8");
      expect(content).toContain("Expo");
      expect(content).toContain("Expo Router");
      expect(content).toContain("Effect");
      expect(content).toContain("OpenAPI");
      expect(content).toContain("hono-open-api");
      expect(content).toContain("TanStack Query");
      expect(content).toContain("Better Auth");
      expect(content).toContain("NativeWind");
      expect(content).toContain("React Native Reusables");
      expect(content).toContain("Biome");
      expect(content).toContain("Vitest");
      expect(content).toContain("MSW");
      expect(content).toMatch(/Sentry|Datadog/);
    });

    it("contains quickstart commands and all package.json project scripts", () => {
      const content = readFileSync(readmePath, "utf8");
      expect(content).toContain("pnpm install");
      expect(content).toContain("pnpm start");
      expect(content).toContain("pnpm test");
      expect(content).toContain("pnpm prebuild");
      expect(content).toContain("pnpm export");

      const requiredScripts = [
        "start",
        "android",
        "ios",
        "web",
        "prebuild",
        "export",
        "typecheck",
        "lint",
        "lint:fix",
        "test",
        "test:watch",
        "test:coverage",
        "generate:api",
        "sync:api",
        "verify:tokens",
      ];
      for (const script of requiredScripts) {
        expect(content, `Expected script \`${script}\` in README.md`).toContain(`\`${script}\``);
      }
    });

    it("contains route & feature slice architecture map and links to all canonical docs", () => {
      const content = readFileSync(readmePath, "utf8");
      expect(content).toContain("(auth)");
      expect(content).toContain("(app)");
      expect(content).toContain("login");
      expect(content).toContain("register");
      expect(content).toContain("tasks");
      expect(content).toContain("files");
      expect(content).toContain("showcase");

      expect(content).toContain("docs/architecture.md");
      expect(content).toContain("docs/development.md");
      expect(content).toContain("AGENTS.md");
      expect(content).toContain("DESIGN.md");
      expect(content).toContain("GLOSSARY.md");
      expect(content).toContain("docs/adr/");
      expect(content).toContain(".agents/skills/verify-expo-open-api/SKILL.md");
    });
  });

  describe("docs/architecture.md", () => {
    const archPath = resolve(ROOT_DIR, "docs/architecture.md");

    it("exists and references all 13 ADRs (ADR-0001 through ADR-0013)", () => {
      expect(existsSync(archPath)).toBe(true);
      const content = readFileSync(archPath, "utf8");
      for (let i = 1; i <= 13; i++) {
        const adrNum = String(i).padStart(4, "0");
        expect(content, `Missing ADR-${adrNum} in docs/architecture.md`).toContain(`ADR-${adrNum}`);
      }
    });

    it("documents Mobile FSD layers and side-effect-free Composition Root", () => {
      const content = readFileSync(archPath, "utf8");
      expect(content).toContain("app/");
      expect(content).toContain("src/app/");
      expect(content).toContain("src/features/");
      expect(content).toContain("src/shared/");
      expect(content).toContain("createAppComposition");
      expect(content).toContain("createAppRuntime");
      expect(content).toContain("useAppBootstrap");
    });

    it("documents Orval dual-target codegen, Effect contracts, and 11-status error taxonomy", () => {
      const content = readFileSync(archPath, "utf8");
      expect(content).toContain("defineContract");
      expect(content).toContain("useEffectQuery");
      expect(content).toContain("useEffectMutation");
      expect(content).toContain("matchEffect");
      expect(content).toContain("Data.TaggedError");
      expect(content).toContain("src/shared/api/generated");
    });

    it("documents Better Auth mobile session, SecureStore Bearer cache, Layout Guards, and RBAC", () => {
      const content = readFileSync(archPath, "utf8");
      expect(content).toContain("@better-auth/expo");
      expect(content).toContain("expo-secure-store");
      expect(content).toContain("cachedBearerToken");
      expect(content).toContain("AppLayoutGuard");
      expect(content).toContain("<Can");
      expect(content).toContain("auth-session-bridge");
    });

    it("documents Realtime SSE useLiveQuery, mutation buffering, and MMKV persistence", () => {
      const content = readFileSync(archPath, "utf8");
      expect(content).toContain("useLiveQuery");
      expect(content).toContain("/api/v1/tasks/live");
      expect(content).toContain("eventsource-parser");
      expect(content).toContain('["tasks", "mutation"]');
      expect(content).toContain("queueMicrotask");
      expect(content).toMatch(/MMKV|react-native-mmkv/);
    });

    it("documents ObservabilityPort, trace headers, OKLCH-to-HSL tokens, Reusables, File Transfer, and Testing/CI", () => {
      const content = readFileSync(archPath, "utf8");
      expect(content).toContain("ObservabilityPort");
      expect(content).toContain("traceparent");
      expect(content).toContain("X-Request-Id");
      expect(content).toContain("warm-tactile");
      expect(content).toContain("editorial-slate");
      expect(content).toContain("neo-brutalist");
      expect(content).toContain("TactilePressable");
      expect(content).toContain("PortalHost");
      expect(content).toContain("ToastProvider");
      expect(content).toContain("FormScrollView");
      expect(content).toContain("useAppForm");
      expect(content).toContain("FileTransferPort");
      expect(content).toContain("useUploadQueue");
      expect(content).toContain("expo-sharing");
      expect(content).toContain("vitest-native");
      expect(content).toContain("expo prebuild");
      expect(content).toContain("expo export");
    });
  });

  describe("docs/development.md", () => {
    const devPath = resolve(ROOT_DIR, "docs/development.md");

    it("exists and describes the 3 local development modes and mobile network addressing", () => {
      expect(existsSync(devPath)).toBe(true);
      const content = readFileSync(devPath, "utf8");
      expect(content).toMatch(/Mode 1/i);
      expect(content).toMatch(/Mode 2/i);
      expect(content).toMatch(/Mode 3/i);
      expect(content).toContain("MSW");
      expect(content).toContain("localhost:9999");
      expect(content).toContain("10.0.2.2:9999");
      expect(content).toMatch(/LAN/i);
      expect(content).toContain("--tunnel");
      expect(content).toMatch(/expo run:ios|expo run:android/);
    });

    it("contains all 4 template onboarding playbooks and 7-step feature scaffolding checklist", () => {
      const content = readFileSync(devPath, "utf8");
      expect(content).toMatch(/Rebrand/i);
      expect(content).toMatch(/Restyle/i);
      expect(content).toMatch(/OpenAPI.*Sync/i);
      expect(content).toMatch(/Demo-Slice Pruning|Pruning/i);

      for (let step = 1; step <= 7; step++) {
        expect(content, `Missing Step ${step} in docs/development.md`).toContain(`Step ${step}`);
      }
    });

    it("contains testing guide, environment variables table, and git governance", () => {
      const content = readFileSync(devPath, "utf8");
      expect(content).toContain("Vitest");
      expect(content).toContain("vitest-native");
      expect(content).toContain(INTERNAL_MOCK_TOKEN);
      expect(content).toContain("assertNoDefects()");
      expect(content).toContain("MockEventSource");
      expect(content).toContain("MockXMLHttpRequest");

      expect(content).toContain("ClientEnvSchema");
      expect(content).toContain("EXPO_PUBLIC_API_URL");
      expect(content).toContain("EXPO_PUBLIC_APP_VERSION");
      expect(content).toContain("EXPO_PUBLIC_SENTRY_DSN");
      expect(content).toContain("EXPO_PUBLIC_DATADOG_APPLICATION_ID");
      expect(content).toContain("EXPO_PUBLIC_DATADOG_CLIENT_TOKEN");
      expect(content).toContain("SENTRY_AUTH_TOKEN");
      expect(content).toContain("DATADOG_API_KEY");

      expect(content).toContain("Lefthook");
      expect(content).toContain("Commitlint");
      expect(content).toContain("Release-Please");
    });
  });

  describe("AGENTS.md", () => {
    const agentsPath = resolve(ROOT_DIR, "AGENTS.md");

    it("exists and codifies strict mobile engineering guardrails", () => {
      expect(existsSync(agentsPath)).toBe(true);
      const content = readFileSync(agentsPath, "utf8");
      expect(content).toContain("app/");
      expect(content).toContain("src/app/");
      expect(content).toContain("src/features/");
      expect(content).toContain("src/shared/");
      expect(content).toContain("index.ts");
      expect(content).toContain("50 LOC");
      expect(content).toContain("kebab-case");
      expect(content).toContain("process.env");
      expect(content).toContain("src/shared/config/env.ts");
      expect(content).toContain("ObservabilityPort");
      expect(content).toContain(INTERNAL_MOCK_TOKEN);
      expect(content).toContain("<PortalHost />");
      expect(content).toContain("pnpm verify:tokens");
      expect(content).toContain("pnpm prebuild");
      expect(content).toContain("pnpm export");
      expect(content).toContain(".agents/skills/verify-expo-open-api/SKILL.md");
    });
  });

  describe("Runtime Verification Skill (.agents/skills/verify-expo-open-api/)", () => {
    const skillPath = resolve(ROOT_DIR, ".agents/skills/verify-expo-open-api/SKILL.md");
    const featuresDir = resolve(ROOT_DIR, ".agents/skills/verify-expo-open-api/features");

    it("SKILL.md exists with valid YAML frontmatter and 5 canonical phases", () => {
      expect(existsSync(skillPath)).toBe(true);
      const content = readFileSync(skillPath, "utf8");
      expect(content).toMatch(
        /^---\n[\s\S]*?name:\s*verify-expo-open-api[\s\S]*?description:[\s\S]*?\n---/,
      );
      expect(content).toContain("Launch");
      expect(content).toContain("Doctor");
      expect(content).toContain("Drive");
      expect(content).toContain("Evidence");
      expect(content).toContain("Cleanup");
    });

    it("SKILL.md references all 5 core feature flows", () => {
      const content = readFileSync(skillPath, "utf8");
      expect(content).toContain("showcase-and-theming");
      expect(content).toContain("auth-and-rbac");
      expect(content).toContain("live-tasks");
      expect(content).toContain("files-upload-and-download");
      expect(content).toContain("observability-and-headers");
    });

    it("features/ directory contains all 6 feature flow guides", () => {
      expect(existsSync(featuresDir)).toBe(true);
      const expectedFiles = [
        "README.md",
        "showcase-and-theming.md",
        "auth-and-rbac.md",
        "live-tasks.md",
        "files-upload-and-download.md",
        "observability-and-headers.md",
      ];
      for (const file of expectedFiles) {
        const filePath = resolve(featuresDir, file);
        expect(existsSync(filePath), `Expected ${file} to exist in features/`).toBe(true);
      }
    });
  });

  describe("Relative Markdown Links & Repository Hygiene", () => {
    const docsToCheck = [
      "README.md",
      "AGENTS.md",
      "docs/architecture.md",
      "docs/development.md",
      ".agents/skills/verify-expo-open-api/SKILL.md",
      ".agents/skills/verify-expo-open-api/features/README.md",
      ".agents/skills/verify-expo-open-api/features/showcase-and-theming.md",
      ".agents/skills/verify-expo-open-api/features/auth-and-rbac.md",
      ".agents/skills/verify-expo-open-api/features/live-tasks.md",
      ".agents/skills/verify-expo-open-api/features/files-upload-and-download.md",
      ".agents/skills/verify-expo-open-api/features/observability-and-headers.md",
    ];

    it("resolves every relative markdown link across documentation and verification skill files", () => {
      const brokenLinks: string[] = [];

      for (const relDoc of docsToCheck) {
        const absDoc = resolve(ROOT_DIR, relDoc);
        if (!existsSync(absDoc)) {
          brokenLinks.push(`${relDoc} (file missing)`);
          continue;
        }
        const content = readFileSync(absDoc, "utf8");
        const docDir = dirname(absDoc);
        for (const target of extractRelativeLinks(content)) {
          const resolvedTarget = resolve(docDir, target);
          if (!existsSync(resolvedTarget)) {
            brokenLinks.push(`${relDoc} -> ${target}`);
          }
        }
      }

      expect(brokenLinks).toEqual([]);
    });

    it("ignores .verification/ artifacts in .gitignore", () => {
      const gitignore = readFileSync(resolve(ROOT_DIR, ".gitignore"), "utf8");
      expect(gitignore).toMatch(/^\.verification\/?$/m);
    });
  });
});
