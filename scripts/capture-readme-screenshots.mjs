import fs from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:4173";
const outputDir = process.env.SCREENSHOT_DIR || "artifacts/readme-screenshots";

await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 1,
  colorScheme: "light",
});

await context.addInitScript(() => {
  localStorage.setItem("canastaNickname", "Family Host");
  localStorage.setItem("familyCardNickname", "Family Host");
  localStorage.setItem("canastaAvatar", "🦊");
  localStorage.setItem("familyCardAvatar", "🦊");
});

const page = await context.newPage();
page.setDefaultTimeout(30_000);

async function open(route, selector) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
  await page.locator(selector).first().waitFor({ state: "visible" });
  await page.waitForTimeout(700);
}

async function waitUntilEnabled(locator) {
  await locator.waitFor({ state: "visible" });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await locator.isEnabled()) return;
    await page.waitForTimeout(250);
  }
  throw new Error(`Control never became enabled: ${await locator.textContent()}`);
}

async function capture(name, selector = "main") {
  const target = page.locator(selector).first();
  await target.waitFor({ state: "visible" });
  await target.screenshot({ path: `${outputDir}/${name}.png` });
}

async function addRobots(buttonName, memberSelector, totalMembers) {
  const button = page.getByRole("button", { name: buttonName });
  for (let expected = 2; expected <= totalMembers; expected += 1) {
    await waitUntilEnabled(button);
    await button.click();
    await page.waitForFunction(
      ({ selector, count }) => document.querySelectorAll(selector).length >= count,
      { selector: memberSelector, count: expected },
    );
  }
}

async function captureHub() {
  await open("/", ".family-game-hub");
  await capture("family-card-room-hub", ".family-game-hub");
}

async function captureCanasta() {
  await open("/?game=canasta", "button.quick-robot");
  const quickPlay = page.getByRole("button", { name: /Play against one robot/i });
  await waitUntilEnabled(quickPlay);
  await quickPlay.click();
  await page.getByRole("heading", { name: "Choose the table" }).waitFor();
  const start = page.getByRole("button", { name: "Start game" });
  await waitUntilEnabled(start);
  await start.click();
  await page.locator("main.game-page").waitFor({ state: "visible" });
  await page.waitForTimeout(2600);
  await capture("canasta-game-table", "main.game-page");
}

async function captureHearts() {
  await open("/?game=hearts", "button.action-button");
  const create = page.getByRole("button", { name: "Create Hearts room" });
  await waitUntilEnabled(create);
  await create.click();
  await page.getByRole("heading", { name: "Gather four players" }).waitFor();
  await addRobots("Add robot", ".modular-member-row", 4);
  const deal = page.getByRole("button", { name: "Deal Hearts" });
  await waitUntilEnabled(deal);
  await deal.click();
  await page.locator(".hearts-table").waitFor({ state: "visible" });
  await page.waitForTimeout(1000);
  await capture("hearts-game-table", ".hearts-table");
}

async function captureSpades() {
  await open("/?game=spades", "button.action-button");
  const create = page.getByRole("button", { name: "Create Spades room" });
  await waitUntilEnabled(create);
  await create.click();
  await page.getByRole("heading", { name: "Build two partnerships" }).waitFor();
  await addRobots("Add robot", ".modular-member-row", 4);
  const deal = page.getByRole("button", { name: "Deal Spades" });
  await waitUntilEnabled(deal);
  await deal.click();
  await page.locator(".spades-table").waitFor({ state: "visible" });
  await page.waitForTimeout(1000);
  await capture("spades-game-table", ".spades-table");
}

async function captureRummy() {
  await open("/?game=rummy", "button.action-button");
  const create = page.getByRole("button", { name: "Create Rummy room" });
  await waitUntilEnabled(create);
  await create.click();
  await page.getByRole("heading", { name: "Gather 2–6 players" }).waitFor();
  await addRobots("Add robot", ".modular-member-row", 2);
  const deal = page.getByRole("button", { name: "Deal Rummy" });
  await waitUntilEnabled(deal);
  await deal.click();
  await page.locator(".rummy-table").waitFor({ state: "visible" });
  await page.waitForTimeout(1000);
  await capture("rummy-game-table", ".rummy-table");
}

try {
  await captureHub();
  await captureCanasta();
  await captureHearts();
  await captureSpades();
  await captureRummy();
} finally {
  await browser.close();
}
