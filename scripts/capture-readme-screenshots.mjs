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
  await page.waitForTimeout(900);
}

async function capture(name, selector = "main") {
  const target = page.locator(selector).first();
  await target.waitFor({ state: "visible" });
  await target.screenshot({ path: `${outputDir}/${name}.png` });
}

async function captureHub() {
  await open("/", ".family-game-hub");
  await capture("family-card-room-hub", ".family-game-hub");
}

async function captureCanasta() {
  await open("/?game=canasta", "main.landing");
  await capture("canasta-entry", "main.landing");
}

async function captureHearts() {
  await open("/?game=hearts", ".hearts-shell .modular-game-panel");
  await capture("hearts-entry", ".hearts-shell .modular-game-panel");
}

async function captureSpades() {
  await open("/?game=spades", ".spades-shell .modular-game-panel");
  await capture("spades-entry", ".spades-shell .modular-game-panel");
}

async function captureRummy() {
  await open("/?game=rummy", ".rummy-shell .modular-game-panel");
  await capture("rummy-entry", ".rummy-shell .modular-game-panel");
}

async function captureTabletopEntry(gameId, name) {
  await open(`/?game=${gameId}`, ".game-start-panel");
  await capture(name, ".game-start-panel");
}

async function captureChompageddon() {
  await open("/?game=chompageddon", ".chomp-launchpad");
  await capture("chompageddon-entry", ".chompageddon-page");
}

try {
  await captureHub();
  await captureCanasta();
  await captureHearts();
  await captureSpades();
  await captureRummy();
  await captureTabletopEntry("hnefatafl", "hnefatafl-entry");
  await captureTabletopEntry("connect4", "connect4-entry");
  await captureTabletopEntry("battleship", "battleship-entry");
  await captureTabletopEntry("gofish", "gofish-entry");
  await captureChompageddon();
} finally {
  await browser.close();
}
