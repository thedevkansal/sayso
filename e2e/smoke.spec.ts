import { expect, test } from "@playwright/test";
import { HERO_DICTATION, mockLLM, openDemo } from "./mocks";

test.describe("marketing site", () => {
  test("landing page renders and leads to the demo", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Answer email by talking." })).toBeVisible();
    await page.getByText("Will it ever send something on its own?").click();
    await expect(page.getByText("Every send, calendar event and booking sits on a confirm card")).toBeVisible();
    await page.getByRole("link", { name: "Try the demo" }).first().click();
    // First visit compiles /app on the dev server; give navigation room.
    await page.waitForURL(/\/app$/, { timeout: 45_000 });
  });

  test("privacy and 404 pages", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { level: 1, name: "Privacy" })).toBeVisible();
    const res = await page.goto("/definitely-not-a-page");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Nothing here." })).toBeVisible();
  });
});

test.describe("demo flow", () => {
  test.beforeEach(async ({ page }) => {
    await mockLLM(page);
    await openDemo(page);
  });

  test("ramble to reply: coverage, gaps, correction, conflict, send", async ({ page }) => {
    // Hero thread opens by default on desktop and its asks are listed.
    await expect(page.getByRole("heading", { name: "Aurora Summit: a few logistics questions" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "6 questions to answer" })).toBeVisible();

    // "Dictate" (Flow types the text in) and draft with the keyboard shortcut.
    const composer = page.getByPlaceholder(/Hold your Wispr Flow key/);
    await composer.fill(HERO_DICTATION);
    await composer.press("Control+Enter");

    const panel = page.getByRole("complementary", { name: "What Sayso understood" });
    await expect(panel.getByText("4 of 6")).toBeVisible();
    await expect(panel.getByText("You didn't answer these")).toBeVisible();
    await expect(panel.getByText("Correction applied")).toBeVisible();

    // Calendar card: absolute time, the seeded clash, and a free slot offered.
    const invite = panel.getByRole("region", { name: "Calendar invite" });
    await expect(invite.getByText("Fri 30 Oct, 5:00–5:30 pm IST")).toBeVisible();
    await expect(invite.getByText("Clashes with an event")).toBeVisible();
    await expect(invite.getByText(/Sponsor review: Kestrel Cloud/)).toBeVisible();

    // The draft streamed in and is editable.
    const draft = panel.getByLabel("Reply body, editable");
    await expect(draft).toHaveValue(/Thrilled to have you speaking/);

    // Book the free slot: the draft is rewritten to match.
    await invite.getByRole("button", { name: "Book 5:15 pm instead" }).click();
    await expect(invite.getByText("Added")).toBeVisible();
    await expect(draft).toHaveValue(/Fri 30 Oct, 5:15–5:45 pm IST/);
    await expect(page.getByRole("listitem").filter({ hasText: "Call: Mira Okafor / Asha Menon" }).first()).toBeVisible();

    // Send with the shortcut; it lands in Sent and the thread is marked replied.
    await page.keyboard.press("Control+Shift+Enter");
    await expect(page.getByText("Reply sent", { exact: true })).toBeVisible();
    await expect(page.getByText("Replied")).toBeVisible();
    const inbox = page.getByRole("complementary", { name: "Inbox" });
    await inbox.getByRole("tab", { name: /Sent/ }).click();
    await expect(inbox.getByText("Re: Aurora Summit: a few logistics questions")).toBeVisible();

    // Reset brings everything back.
    await page.getByRole("button", { name: /Reset demo/ }).click();
    await expect(page.getByText("Nothing sent yet")).toBeVisible();
  });

  test("injection email is flagged and its instructions ignored", async ({ page }) => {
    const inbox = page.getByRole("complementary", { name: "Inbox" });
    await expect(inbox.getByText("Suspicious")).toBeVisible();
    await inbox.getByRole("button", { name: /Accounts Desk/ }).click();
    const alert = page.getByRole("alert").filter({ hasText: "Suspicious email" });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("Only your own words can");
  });

  test("Flow hotkey hint shows a default and records the user's own key", async ({ page }) => {
    await expect(page.getByText("Hold your Flow key")).toBeVisible();
    await page.getByRole("button", { name: "Set your key" }).click();
    await expect(page.getByText(/Press and release your Wispr Flow shortcut/)).toBeVisible();
    await page.keyboard.down("Alt");
    await page.keyboard.up("Alt");
    await expect(page.getByRole("button", { name: "Change" })).toBeVisible();
  });
});

test("live mode requires sign-in", async ({ page, request }) => {
  const res = await request.get("/api/live/threads");
  expect(res.status()).toBe(401);
  await page.goto("/app/live");
  // The session check streams in behind Suspense, then redirects.
  await page.waitForURL(/\/connect/, { timeout: 45_000 });
  await expect(page.getByRole("button", { name: "Connect Google" })).toBeVisible();
});
