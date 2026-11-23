import path from "node:path";
import { transform as esbuildTransform } from "esbuild";
import { defineConfig } from "vitest/config";
import { reactNative } from "vitest-native";

/**
 * Some React Native ecosystem packages (e.g. `@rn-primitives/*`) publish raw JSX
 * inside `.js` / `.mjs` files. Transform them before Vite import analysis.
 */
function transformRnEcosystemJsx() {
  return {
    name: "transform-rn-ecosystem-jsx",
    enforce: "pre" as const,
    async transform(code: string, id: string) {
      if (
        id.includes("node_modules/@rn-primitives/") &&
        (id.endsWith(".js") || id.endsWith(".mjs"))
      ) {
        const result = await esbuildTransform(code, {
          loader: "jsx",
          jsx: "automatic",
          sourcefile: id,
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
    alias: {
      nativewind: path.resolve(__dirname, "src/test/mocks/adapters/mock-nativewind.ts"),
      "expo-system-ui": path.resolve(__dirname, "src/test/mocks/adapters/mock-system-ui.ts"),
      "expo-haptics": path.resolve(__dirname, "src/test/mocks/adapters/mock-haptics.ts"),
    },
  },
  test: {
    setupFiles: ["src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", "dist", "ios", "android", ".expo"],
    server: {
      deps: {
        inline: [/@rn-primitives\//, /^nativewind$/, /^react-native-css-interop/, /^expo-/],
      },
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["src/shared/api/generated/**", "src/test/**", "**/*.d.ts"],
    },
  },
});
