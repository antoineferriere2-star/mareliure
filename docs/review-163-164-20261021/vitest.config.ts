import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node", include: ["docs/review-163-164-20261021/*.test.ts"], maxWorkers: 1, testTimeout: 30_000 } });
