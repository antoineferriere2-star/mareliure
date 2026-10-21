import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/partners",
  workers: 1,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 20_000 },
  reporter: [["list"], ["html", { outputFolder: "playwright-report/partners", open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:8089",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: process.env.E2E_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.E2E_CHROMIUM_EXECUTABLE_PATH }
      : {},
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 900 } } },
    { name: "mobile-375", use: { viewport: { width: 375, height: 812 } } },
  ],
  webServer: {
    command:
      "node node_modules/vite/bin/vite.js --mode partners-e2e --host 127.0.0.1 --port 8089 --strictPort",
    url: "http://127.0.0.1:8089/@vite/client",
    timeout: 180_000,
    env: {
      VITE_PUBLIC_BRAND: "mareliure",
      MARKETPLACE_BRAND_OVERRIDE: "MA_RELIURE",
      VITE_SUPABASE_URL: "https://partners-journey.invalid",
      SUPABASE_URL: "https://partners-journey.invalid",
      VITE_SUPABASE_PUBLISHABLE_KEY: "local-test-publishable",
      SUPABASE_PUBLISHABLE_KEY: "local-test-publishable",
      SUPABASE_SERVICE_ROLE_KEY: "",
      VITE_CACHE_DIR: "node_modules/.vite-partners-brief9",
    },
  },
});
