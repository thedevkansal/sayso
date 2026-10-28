import { defineConfig, devices } from "@playwright/test";

/** README screenshots against a running deployment (real model, fictional demo data). */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "screenshots.capture.ts",
  timeout: 120_000,
  workers: 1,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.E2E_BASE_URL || "https://sayso-delta.vercel.app",
  },
});
