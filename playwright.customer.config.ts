import { defineConfig } from "@playwright/test";

// This suite has its own server and synthetic Auth/RPC fixtures. Never select the live E2E files.
export default defineConfig({
  testDir: "./e2e/customer",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 240_000,
  expect: { timeout: 20_000 },
  reporter: [["list"], ["html", { outputFolder: "playwright-report/customer", open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:8086",
    viewport: { width: 1280, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: process.env.E2E_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.E2E_CHROMIUM_EXECUTABLE_PATH }
      : {},
  },
  projects: [
    { name: "desktop", metadata: { frameWidth: 1280 } },
    { name: "mobile-375", metadata: { frameWidth: 375 } },
  ],
  webServer: {
    command:
      "node node_modules/vite/bin/vite.js --mode customer-e2e --host 127.0.0.1 --port 8086 --strictPort",
    url: "http://127.0.0.1:8086/@vite/client",
    reuseExistingServer: process.env.E2E_CUSTOMER_REUSE_SERVER === "1",
    timeout: 180_000,
    env: {
      VITE_PUBLIC_BRAND: "mareliure",
      VITE_SUPABASE_URL: "https://customer-journey.invalid",
      SUPABASE_URL: "https://customer-journey.invalid",
      VITE_SUPABASE_PUBLISHABLE_KEY: "local-test-publishable",
      SUPABASE_PUBLISHABLE_KEY: "local-test-publishable",
      SUPABASE_SERVICE_ROLE_KEY: "",
      VITE_CACHE_DIR: "node_modules/.vite-customer-journey",
    },
  },
});
