/**
 * Records the demo scenes against the deployed app (real model, Duffel test mode, fictional demo data).
 * Writes video/raw/*.webm and video/marks.json: for each scene part, the second in the recording where it starts.
 * Dictation is shown as text appearing in the composer (Wispr Flow itself can't be captured headlessly).
 */
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, renameSync } from "node:fs";

const BASE = process.env.BASE || "https://sayso-delta.vercel.app";
const SEG = Object.fromEntries(JSON.parse(readFileSync("video/segments.json", "utf8")).map((s) => [s.id, s.end - s.start]));
const W = 1920, H = 1080;

mkdirSync("video/raw", { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
  colorScheme: "light",
  recordVideo: { dir: "video/raw", size: { width: W, height: H } },
});
const t0 = Date.now();
const marks = [];
const mark = (id, part = 0) => marks.push({ id, part, at: (Date.now() - t0) / 1000 });
const page = await context.newPage();

// A visible cursor: headless recordings don't draw one.
await page.addInitScript(() => {
  addEventListener("DOMContentLoaded", () => {
    const c = document.createElement("div");
    c.id = "__cursor";
    c.style.cssText = "position:fixed;z-index:2147483647;left:0;top:0;width:22px;height:22px;pointer-events:none;transform:translate(-3px,-2px);transition:transform .05s";
    c.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 2l16 9-7 2-3 7z" fill="#111" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    document.body.appendChild(c);
    addEventListener("mousemove", (e) => { c.style.left = e.clientX + "px"; c.style.top = e.clientY + "px"; }, true);
    addEventListener("mousedown", () => (c.style.transform = "translate(-3px,-2px) scale(.85)"), true);
    addEventListener("mouseup", () => (c.style.transform = "translate(-3px,-2px)"), true);
  });
  try { localStorage.removeItem("sayso-demo"); localStorage.removeItem("sayso-flow-hotkey"); } catch {}
});

const sleep = (s) => page.waitForTimeout(s * 1000);

async function moveTo(locatorOrXY, seconds = 0.8) {
  let x, y;
  if (Array.isArray(locatorOrXY)) [x, y] = locatorOrXY;
  else {
    const b = await locatorOrXY.boundingBox();
    x = b.x + Math.min(b.width / 2, 120);
    y = b.y + b.height / 2;
  }
  await page.mouse.move(x, y, { steps: Math.max(8, Math.round(seconds * 40)) });

}
async function click(locator, seconds = 0.7) {
  await locator.scrollIntoViewIfNeeded();
  await moveTo(locator, seconds);
  await page.mouse.down();
  await page.mouse.up();
}
/** Types text into the composer word by word across `seconds`, like a dictation landing. */
async function dictate(text, seconds, append = false) {
  const words = text.split(" ");
  const base = append ? await page.locator("#composer").inputValue() : "";
  const per = (seconds * 1000) / words.length;
  for (let i = 1; i <= words.length; i++) {
    const v = (base ? base.replace(/\s*$/, " ") : "") + words.slice(0, i).join(" ");
    await page.locator("#composer").evaluate((el, val) => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(el, val);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, v);
    await page.waitForTimeout(per);
  }
}
const panel = () => page.getByRole("complementary", { name: "What Sayso understood" });
async function scrollPanelTo(locator, seconds = 1.2) {
  await locator.evaluate((el, ms) => {
    const box = el.closest("aside");
    const target = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 90;
    const start = box.scrollTop, t0 = performance.now();
    return new Promise((res) => {
      const step = (t) => {
        const k = Math.min(1, (t - t0) / ms);
        box.scrollTop = start + (target - start) * (1 - Math.pow(1 - k, 3));
        if (k < 1) requestAnimationFrame(step);
        else res();
      };
      requestAnimationFrame(step);
    });
  }, seconds * 1000);
}
async function waitDraft() {
  await panel().getByLabel("Reply body, editable").waitFor({ timeout: 90_000 });
  await sleep(0.6);
}

// p00 Intro: landing hero with the product loop running.
await page.goto(BASE + "/");
await page.getByText("Call with Mira, ready to confirm").waitFor({ timeout: 40_000 }).catch(() => {});
await page.goto(BASE + "/"); // restart the loop so it plays during the intro
await sleep(2.2);
mark("p00");
await moveTo([960, 700], 2);
await sleep(SEG.p00 - 2);

// p01 Email problem: open the demo, Mira's five questions.
await page.goto(BASE + "/app");
await page.getByRole("heading", { name: /questions to answer/ }).waitFor({ timeout: 60_000 });
await sleep(1.2);
mark("p01");
const body = page.locator("article section").first();
await moveTo(body.getByText("1. Which date should I plan to arrive in Goa?"), 1.5);
for (const q of ["2. How long is my talk slot?", "3. What AV will be set up", "4. Is the hotel covered", "5. Do you need my dietary"]) {
  await moveTo(body.getByText(q, { exact: false }), 1.2);
  await sleep(1.2);
}
await sleep(Math.max(0, SEG.p01 - 1.5 - 4 * 2.4));

// p02 I built Sayso: the composer.
mark("p02");
await moveTo(page.locator("#composer"), 1.4);
await sleep(SEG.p02 - 1.4);

// p03 Reads the thread: the ask list.
mark("p03");
await moveTo(panel().getByRole("heading", { name: /questions to answer/ }), 1.2);
for (const i of [0, 2, 4]) {
  await moveTo(panel().locator("ol li").nth(i), 0.9);
}
await sleep(Math.max(0, SEG.p03 - 3.9));

// p04 Okay watch: click into the composer.
mark("p04");
await click(page.locator("#composer"), 1.2);
await sleep(SEG.p04 - 1.2);

// p05 Dictation 1.
mark("p05");
await dictate("Okay so she's arriving the 14th, talk is 30 minutes, yes we cover the hotel, and set a call with her Friday 4 pm, no wait, 5.", SEG.p05 - 1.2);
await sleep(1.2);

// Draft (model time is cut in the edit).
await page.locator("#composer").press("Control+Enter");
await waitDraft();
await panel().evaluate((el) => (el.scrollTop = 0));
await sleep(0.4);

// p06 It matched everything: coverage → gaps → what I understood.
mark("p06");
await moveTo(panel().getByText(/\d of \d/).first(), 1);
await sleep(2.2);
await scrollPanelTo(panel().getByText(/You didn.t answer/), 1.2);
await moveTo(panel().getByText(/You didn.t answer/), 0.8);
await sleep(2.2);
await scrollPanelTo(panel().getByRole("heading", { name: "What I understood" }), 1.2);
await sleep(Math.max(0, SEG.p06 - 7.6));

// p07 Missing bit: Add an answer by voice.
await scrollPanelTo(panel().getByRole("button", { name: /Add an answer by voice/ }), 0.01);
mark("p07");
await click(panel().getByRole("button", { name: /Add an answer by voice/ }), 0.9);
await sleep(Math.max(0, SEG.p07 - 0.9));

// p08 Dictation 2.
mark("p08");
await dictate("Oh and AV, she can use her own laptop, we'll have HDMI and a clicker. Dietary, yeah, send it by Monday.", SEG.p08 - 1, true);
await sleep(1);
await page.locator("#composer").press("Control+Enter");
await page.getByRole("button", { name: /Drafting/ }).waitFor({ timeout: 10_000 }).catch(() => {});
await waitDraft();

// p09 Calendar clash: card, clash, book the free slot, draft updates.
const invite = panel().getByRole("region", { name: "Calendar invite" });
await scrollPanelTo(invite, 0.01);
await sleep(0.3);
mark("p09");
await moveTo(invite.getByText(/Fri \d+ Oct/), 1);
await sleep(1.6);
const clash = invite.getByText("Clashes with an event");
if (await clash.count()) { await moveTo(clash, 0.9); await sleep(1.6); }
const alt = invite.getByRole("button", { name: /instead/ });
if (await alt.count()) await click(alt, 0.8); else await click(invite.getByRole("button", { name: /Add to calendar/ }), 0.8);
await sleep(1.2);
await scrollPanelTo(panel().getByLabel("Reply body, editable"), 1.2);
await sleep(Math.max(0, SEG.p09 - 8.3));

// p10 Send.
mark("p10");
await page.keyboard.press("Control+Shift+Enter");
await sleep(1.4);
await click(page.getByRole("complementary", { name: "Inbox" }).getByRole("tab", { name: /Sent/ }), 0.9);
await sleep(Math.max(0, SEG.p10 - 2.3));

// p11 Hinglish: Priya's thread.
mark("p11");
await page.getByRole("complementary", { name: "Inbox" }).getByRole("tab", { name: /Inbox/ }).click();
await click(page.getByRole("complementary", { name: "Inbox" }).getByRole("button", { name: /Priya Raman/ }), 0.6);
await sleep(Math.max(0, SEG.p11 - 0.6));

// p12 Dictation 3.
await page.locator("#composer").click();
mark("p12");
await dictate("Haan we're coming, sirf do log, me and Rohan, morning flight from Mumbai. Find us flights.", SEG.p12 - 0.8);
await sleep(0.8);
await page.locator("#composer").press("Control+Enter");
await waitDraft();

// p13 Flights: fares (part 0), confirmation (part 1).
const flights = panel().getByRole("region", { name: "Flight options" });
await scrollPanelTo(flights, 0.01);
await flights.getByRole("button", { name: "Search test flights" }).click();
await flights.getByText("Always books in test mode").waitFor({ timeout: 60_000 });
await scrollPanelTo(flights, 0.01);
await sleep(0.3);
mark("p13", 0);
await moveTo(flights.getByText("Always books in test mode"), 0.9);
await sleep(0.6);
await click(flights.getByRole("button", { name: "Book test flight" }), 0.8);
await flights.getByText(/Booking reference/).waitFor({ timeout: 90_000 });
await scrollPanelTo(flights, 0.01);
await sleep(0.2);
mark("p13", 1);
await moveTo(flights.getByText(/Booking reference/), 0.8);
await sleep(4);

// p14 Injection.
mark("p14");
await click(page.getByRole("complementary", { name: "Inbox" }).getByRole("button", { name: /Accounts Desk/ }), 0.8);
await sleep(1.4);
await moveTo(page.getByRole("alert").filter({ hasText: "Suspicious email" }), 1.2);
await sleep(2.5);
await moveTo(page.locator("article section").getByText(/AI ASSISTANT INSTRUCTIONS/), 1.2);
await sleep(Math.max(0, SEG.p14 - 7.1));

// p15 Outro.
await page.goto(BASE + "/");
await sleep(1.5);
mark("p15");
await moveTo([960, 640], 1.5);
await sleep(SEG.p15 + 0.5);

await context.close();
await browser.close();
const vid = readdirSync("video/raw").filter((f) => f.endsWith(".webm")).sort().at(-1);
renameSync(`video/raw/${vid}`, "video/raw/take.webm");
writeFileSync("video/marks.json", JSON.stringify(marks, null, 1));
console.log("recorded", marks.length, "marks");
