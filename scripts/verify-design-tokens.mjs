import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

async function main() {
  const verifierPath = path.join(ROOT, "src/test/design-token-verifier.ts");
  const { verifyAllDesignTokens } = await import(pathToFileURL(verifierPath).href);
  const summary = await verifyAllDesignTokens(ROOT);

  console.log(
    `OK: Verified ${summary.presetCount} presets x 2 modes x ${summary.colorTokenCount} color tokens, WCAG AA contrast, dark surface steps, DESIGN.md/CSS parity, typography (${summary.typographyCount}), radii (${summary.radiusCount}), and hygiene across ${summary.scannedFileCount} files.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
