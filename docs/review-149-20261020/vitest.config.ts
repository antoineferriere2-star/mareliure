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
    hookTimeout: 30000,
    testTimeout: 30000,
    include: ["docs/review-149-20261020/*.test.ts"],
  },
});
