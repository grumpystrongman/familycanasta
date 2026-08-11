import fs from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:4173";
const outputDir = process.env.SCREENSHOT_DIR || "artifacts/slumlord-screenshots";

await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 1,
  colorScheme: "light",
});

const page = await context.newPage();
page.setDefaultTimeout(30_000);
page.on("pageerror", (error) => console.log(`[slumlord:browser-error] ${error.stack || error.message}`));

async function screenshot(name) {
  await page.screenshot({ path: `${outputDir}/${name}.png`, fullPage: false });
}

try {
  await page.goto(`${baseUrl}/?game=slumlord`, { waitUntil: "networkidle" });
  await page.locator(".sl-setup-card").waitFor({ state: "visible" });
  await page.waitForTimeout(600);

  const playerCount = page.locator(".sl-setup-options select").first();
  const goalMode = page.locator(".sl-setup-options select").nth(1);
  const secondSeat = page.getByLabel("Player 2 type");
  if (await playerCount.inputValue() !== "2") throw new Error("Slum Lord must default to two players.");
  if (await secondSeat.inputValue() !== "bot") throw new Error("Slum Lord player two must default to CPU.");
  if (await goalMode.inputValue() !== "bankruptcy") throw new Error("Slum Lord must default to Last Landlord Standing, not a round cap.");

  await screenshot("slumlord-setup");

  await page.getByRole("button", { name: /start the bad decisions/i }).click();
  await page.locator(".sl-game-shell").waitFor({ state: "visible" });
  await page.getByText("CPU", { exact: true }).first().waitFor({ state: "visible" });

  // Prove tactical movement and property schemes in the real application.
  await page.getByRole("button", { name: /sketchy cab/i }).click();
  await page.locator(".sl-cab-picker").waitFor({ state: "visible" });
  await page.locator(".sl-cab-picker button").filter({ hasText: /^3$/ }).click();
  await page.locator(".sl-game-modal h2", { hasText: "Leaky Roof Lane" }).waitFor({ state: "visible" });
  await page.getByRole("button", { name: /^buy$/i }).click();
  await page.getByText("Property management", { exact: true }).waitFor({ state: "visible" });

  const schemeSelect = page.getByLabel("Install a rent scheme");
  await schemeSelect.selectOption("drug-lord-lease");
  await page.getByRole("button", { name: /do something questionable/i }).click();
  await page.getByText("Drug Lord Executive Lease", { exact: true }).first().waitFor({ state: "visible" });
  await page.waitForTimeout(500);
  await screenshot("slumlord-gameplay");

  const themeSelect = page.getByLabel("Slum Lord board theme");
  await themeSelect.selectOption("sunset");
  await page.locator(".sl-theme-sunset").waitFor({ state: "visible" });
  await page.waitForTimeout(350);
  await screenshot("slumlord-sunset");
} finally {
  await browser.close();
}
