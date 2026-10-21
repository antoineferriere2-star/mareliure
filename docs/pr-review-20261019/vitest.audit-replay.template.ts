import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import { fileURLToPath } from "node:url";
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  plugins: [tsconfigPaths({ projects: ["./tsconfig.json"] })],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/audits/*.test.ts", "docs/pr-review-20261019/*.test.ts"],
    maxWorkers: 1,
    hookTimeout: 30000,
    testTimeout: 30000,
  },
});
