import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", ".next-ors/**", "public/maplibre/**", ".venv/**", "scripts/data-pipeline/cache/**", "node_modules/**", "next-env.d.ts", "playwright-report/**", "test-results/**"]),
]);
