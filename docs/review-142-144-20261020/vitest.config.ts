import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("../../src", import.meta.url)) } },
  plugins: [
    tsconfigPaths({ projects: [fileURLToPath(new URL("../../tsconfig.json", import.meta.url))] }),
  ],
  test: {
    environment: "node",
    maxWorkers: 1,
    hookTimeout: 30_000,
    testTimeout: 30_000,
    include: [
      "docs/review-142-144-20261020/pdf-orders.repro.test.ts",
      "docs/review-142-144-20261020/originalP1Review.test.ts",
      "docs/review-142-144-20261020/grants-detector.repro.test.ts",
      "src/marketplace/shipping/roundTripLabelStore.server.test.ts",
    ],
  },
});
