/**
 * Captures README screenshots from the running demo (real model, Duffel test mode, fictional data only).
 * Run: npx playwright test -c playwright.screenshots.config.ts
 * Target defaults to production; override with E2E_BASE_URL.
 */
import { expect, test, type Page } from "@playwright/test";

const DIR = "docs/screenshots";
test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1440, height: 900 }, colorScheme: "light", deviceScaleFactor: 1 });

async function freshDemo(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.removeItem("sayso-demo");
      localStorage.removeItem("sayso-flow-hotkey");
    } catch {}
  });
  await page.goto("/app");
  await expect(page.getByRole("heading", { name: /questions to answer/ })).toBeVisible({ timeout: 45_000 });
}

async function draft(page: Page, text: string) {
  const composer = page.getByPlaceholder(/Hold your Wispr Flow key/);
  await composer.fill(text);
  await composer.press("Control+Enter");
  const panel = page.getByRole("complementary", { name: "What Sayso understood" });
  await expect(panel.getByLabel("Reply body, editable")).toBeVisible({ timeout: 60_000 });
  return panel;
}

test("01 landing", async ({ page }) => {
  await page.goto("/");
  // Let the hero loop reach its end state: transcript, ticks, flags, draft, calendar chip.
  await expect(page.getByText("Call with Mira, ready to confirm")).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: `${DIR}/01-landing.png` });
});

test("02 thread and composer", async ({ page }) => {
  await freshDemo(page);
  await page
    .getByPlaceholder(/Hold your Wispr Flow key/)
    .fill("Okay so she's arriving the 14th, talk is 30 minutes, yes we cover the hotel, and set a call with her Friday 4 pm, no wait, 5.");
  await expect(page.getByRole("button", { name: /Draft reply/ })).toBeEnabled();
  // Let the ask list's entrance animation and the composer's "heard you" ring settle.
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${DIR}/02-thread-composer.png` });
});

test("03 understood panel, 04 calendar conflict", async ({ page }) => {
  await freshDemo(page);
  const panel = await draft(
    page,
    "Okay so she's arriving the 14th, talk is 30 minutes, yes we cover the hotel, and set a call with her Friday 4 pm, no wait, 5.",
  );
  await expect(panel.getByText(/You didn.t answer/)).toBeVisible();
  await page.screenshot({ path: `${DIR}/03-understood-and-gaps.png` });

  const invite = panel.getByRole("region", { name: "Calendar invite" });
  await invite.scrollIntoViewIfNeeded();
  await expect(invite.getByText("Clashes with an event")).toBeVisible();
  await page.screenshot({ path: `${DIR}/04-calendar-conflict.png` });
});

test("05 travel card", async ({ page }) => {
  await freshDemo(page);
  await page.getByRole("complementary", { name: "Inbox" }).getByRole("button", { name: /Priya Raman/ }).click();
  const panel = await draft(
    page,
    "Haan we're coming, sirf do log, me and Rohan. We'll fly in from Mumbai that morning and land around 9:30. No projector needed. Find us morning flights.",
  );
  const flights = panel.getByRole("region", { name: "Flight options" });
  await flights.getByRole("button", { name: "Search test flights" }).click();
  await expect(flights.getByText("Always books in test mode")).toBeVisible({ timeout: 45_000 });
  await flights.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${DIR}/05-travel.png` });
});

test("06 suspicious email", async ({ page }) => {
  await freshDemo(page);
  await page.getByRole("complementary", { name: "Inbox" }).getByRole("button", { name: /Accounts Desk/ }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Suspicious email" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "What Sayso understood" }).getByText(/No genuine questions|No direct questions|questions? to answer/)).toBeVisible({ timeout: 45_000 });
  await page.screenshot({ path: `${DIR}/06-suspicious-email.png` });
});
