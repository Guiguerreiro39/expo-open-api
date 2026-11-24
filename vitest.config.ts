import fs from "node:fs";
import path from "node:path";
import { transform as esbuildTransform } from "esbuild";
import { defineConfig } from "vitest/config";
import { reactNative } from "vitest-native";

/**
 * Some React Native ecosystem packages (e.g. `@rn-primitives/*`) publish raw JSX
 * inside `.js` / `.mjs` files and use extensionless relative re-exports in `.mjs`
 * entrypoints (`export * from "./label"`). Prefer `.mjs` siblings and transform JSX
 * before Vite import analysis.
 */
function transformRnEcosystemJsx() {
  return {
    name: "transform-rn-ecosystem-jsx",
    enforce: "pre" as const,
    resolveId(source: string, importer?: string) {
      if (
        importer?.includes("node_modules/@rn-primitives/") &&
        source.startsWith(".") &&
        !path.extname(source)
      ) {
        const cleanImporter = importer.split("?")[0] ?? importer;
        const mjsCandidate = path.resolve(path.dirname(cleanImporter), `${source}.mjs`);
        if (fs.existsSync(mjsCandidate)) {
          return mjsCandidate;
        }
      }
      return null;
    },
    async transform(code: string, id: string) {
      const cleanId = id.split("?")[0] ?? id;
      if (
        cleanId.endsWith("src/shared/storage/kv-store.ts") &&
        code.includes('require("react-native-mmkv")')
      ) {
        return {
          code: `import * as __vitestMmkv from "react-native-mmkv";\n${code.replaceAll(
            'require("react-native-mmkv")',
            "__vitestMmkv",
          )}`,
          map: null,
        };
      }
      if (
        cleanId.includes("node_modules/@rn-primitives/") &&
        (cleanId.endsWith(".js") || cleanId.endsWith(".mjs"))
      ) {
        const result = await esbuildTransform(code, {
          loader: "jsx",
          jsx: "automatic",
          sourcefile: cleanId,
          sourcemap: true,
        });
        return { code: result.code, map: result.map };
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [
    transformRnEcosystemJsx(),
    reactNative({
      engine: "mock",
      diagnostics: false,
    }),
  ],
  resolve: {
    tsconfigPaths: true,
    alias: [
      {
        find: "nativewind",
        replacement: path.resolve(__dirname, "src/test/mocks/adapters/mock-nativewind.ts"),
      },
      {
        find: "expo-system-ui",
        replacement: path.resolve(__dirname, "src/test/mocks/adapters/mock-system-ui.ts"),
      },
      {
        find: "expo-haptics",
        replacement: path.resolve(__dirname, "src/test/mocks/adapters/mock-haptics.ts"),
      },
      {
        find: "expo-secure-store",
        replacement: path.resolve(__dirname, "src/test/mocks/adapters/mock-secure-store.ts"),
      },
      {
        find: "expo-constants",
        replacement: path.resolve(__dirname, "src/test/mocks/adapters/mock-expo-constants.ts"),
      },
      {
        find: "expo-linking",
        replacement: path.resolve(__dirname, "src/test/mocks/adapters/mock-expo-linking.ts"),
      },
      {
        find: "expo-font",
        replacement: path.resolve(__dirname, "src/test/mocks/adapters/mock-expo-font.ts"),
      },
      {
        find: /^@expo-google-fonts\/(?:quicksand|jetbrains-mono)(?:\/.*)?$/,
        replacement: path.resolve(__dirname, "src/test/mocks/adapters/mock-google-fonts.ts"),
      },
      {
        find: "expo-splash-screen",
        replacement: path.resolve(__dirname, "src/test/mocks/adapters/mock-expo-splash-screen.ts"),
      },
      {
        find: "expo-file-system/legacy",
        replacement: path.resolve(__dirname, "src/test/mocks/adapters/mock-expo-file-system.ts"),
      },
      {
        find: "expo-file-system",
        replacement: path.resolve(__dirname, "src/test/mocks/adapters/mock-expo-file-system.ts"),
      },
      {
        find: "expo-document-picker",
        replacement: path.resolve(
          __dirname,
          "src/test/mocks/adapters/mock-expo-document-picker.ts",
        ),
      },
      {
        find: "expo-image-picker",
        replacement: path.resolve(__dirname, "src/test/mocks/adapters/mock-expo-image-picker.ts"),
      },
      {
        find: "expo-sharing",
        replacement: path.resolve(__dirname, "src/test/mocks/adapters/mock-expo-sharing.ts"),
      },
      {
        find: "expo-web-browser",
        replacement: path.resolve(__dirname, "src/test/mocks/adapters/mock-expo-web-browser.ts"),
      },
      {
        find: "expo-router/react-navigation",
        replacement: path.resolve(
          __dirname,
          "src/test/mocks/adapters/mock-expo-router-react-navigation.ts",
        ),
      },
      {
        find: "expo-router",
        replacement: path.resolve(__dirname, "src/test/mocks/adapters/mock-expo-router.tsx"),
      },
      {
        find: "react-native-svg",
        replacement: path.resolve(__dirname, "src/test/mocks/adapters/mock-react-native-svg.tsx"),
      },
      {
        find: "lucide-react-native",
        replacement: path.resolve(
          __dirname,
          "src/test/mocks/adapters/mock-lucide-react-native.tsx",
        ),
      },
      {
        find: "react-native-mmkv",
        replacement: path.resolve(__dirname, "src/test/mocks/adapters/mock-react-native-mmkv.ts"),
      },
      {
        find: "@react-native-community/netinfo",
        replacement: path.resolve(__dirname, "src/test/mocks/adapters/mock-netinfo.ts"),
      },
      {
        find: "expo/fetch",
        replacement: path.resolve(__dirname, "src/test/mocks/adapters/mock-expo-fetch.ts"),
      },
    ],
  },
  test: {
    setupFiles: ["src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", "dist", "ios", "android", ".expo"],
    server: {
      deps: {
        inline: [
          /@rn-primitives\//,
          /^nativewind$/,
          /^react-native-css-interop/,
          /^expo-/,
          /@better-auth\//,
          /better-auth\//,
        ],
      },
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["src/shared/api/generated/**", "src/test/**", "**/*.d.ts"],
    },
  },
});
