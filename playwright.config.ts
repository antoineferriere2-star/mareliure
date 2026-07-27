import { defineConfig, devices } from "@playwright/test";

// E2E scope (see e2e/README.md): deterministic, side-effect-free coverage of
// the public marketing site against a local dev server. Authenticated
// self-service flows (signup -> onboarding -> publish -> visitor submission)
// need a disposable test workspace/teardown strategy before they can run
// safely against the live Supabase project and are intentionally not here yet.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: "http://localhost:8080",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:8080",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
