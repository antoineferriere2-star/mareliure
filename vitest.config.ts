import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Les contrats qui parcourent tout le code ou le bundle dépassent 5 s sous charge (jusqu'à 69 s mesurés).
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
