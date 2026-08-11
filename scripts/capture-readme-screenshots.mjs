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
  localStorage.setItem("familyGameAdultAccepted", "yes");
});

const page = await context.newPage();
page.setDefaultTimeout(30_000);
page.on("console", (message) => console.log(`[browser:${message.type()}] ${message.text()}`));
page.on("pageerror", (error) => console.log(`[browser:error] ${error.stack || error.message}`));

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

async function captureFrom(targetPage, name, selector = "main") {
  const target = targetPage.locator(selector).first();
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

async function captureGameEntry(gameId, name) {
  await open(`/?game=${gameId}`, ".game-start-panel");
  await capture(name, ".game-start-panel");
}

async function capturePartyEntry(gameId, name) {
  await open(`/?game=${gameId}`, ".party-entry-card");
  await capture(name, ".party-entry-card");
}

async function captureChompageddon() {
  await open("/?game=chompageddon", ".chomp-launchpad");
  await capture("chompageddon-entry", ".chompageddon-page");
  await page.getByRole("button", { name: /release the ballz/i }).click();
  await page.locator(".chomp-arena-frame canvas").waitFor({ state: "visible" });
  await page.waitForTimeout(1200);
  await capture("chompageddon-gameplay", ".chompageddon-page");
}

async function capturePixelQuest() {
  await open("/?game=pixelquest", ".pq-title-screen");
  await capture("pixelquest-entry", ".pq-title-screen");

  await page.getByRole("button", { name: /create adventure room/i }).click();
  await page.locator(".pq-lobby-screen").waitFor({ state: "visible" });
  const roomCode = (await page.locator(".pq-lobby-banner strong").first().innerText()).trim();
  if (!/^[A-Z0-9]{6}$/.test(roomCode)) throw new Error(`PixelQuest did not create a valid room code: ${roomCode}`);

  const guestContext = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 1,
    colorScheme: "light",
  });
  await guestContext.addInitScript(() => {
    localStorage.setItem("familyCardNickname", "Remote Guest");
    localStorage.setItem("familyCardAvatar", "🦉");
  });
  const guestPage = await guestContext.newPage();
  guestPage.setDefaultTimeout(30_000);
  guestPage.on("console", (message) => console.log(`[pixelquest-guest:${message.type()}] ${message.text()}`));
  guestPage.on("pageerror", (error) => console.log(`[pixelquest-guest:error] ${error.stack || error.message}`));

  try {
    await guestPage.goto(`${baseUrl}/?game=pixelquest`, { waitUntil: "networkidle" });
    await guestPage.locator(".pq-title-screen").waitFor({ state: "visible" });
    await guestPage.locator('input[placeholder="ROOM CODE"]').fill(roomCode);
    await guestPage.getByRole("button", { name: /join party/i }).click();
    await guestPage.locator(".pq-lobby-screen").waitFor({ state: "visible" });
    await page.locator(".pq-seat.filled").nth(1).waitFor({ state: "visible" });

    await page.getByRole("button", { name: /open character roster/i }).click();
    await Promise.all([
      page.locator(".pq-roster-screen").waitFor({ state: "visible" }),
      guestPage.locator(".pq-roster-screen").waitFor({ state: "visible" }),
    ]);

    await page.getByRole("button", { name: /Brom Stoneguard/i }).click();
    await guestPage.getByRole("button", { name: /Aldren Oathfire/i }).click();
    await page.getByRole("button", { name: /begin adventure/i }).click();
    await Promise.all([
      page.locator(".pq-game-screen").waitFor({ state: "visible" }),
      guestPage.locator(".pq-game-screen").waitFor({ state: "visible" }),
    ]);

    await page.getByRole("button", { name: /^continue/i }).click();
    await Promise.all([
      page.getByRole("heading", { name: /How do you enter Blackhollow/i }).waitFor({ state: "visible" }),
      guestPage.getByRole("heading", { name: /How do you enter Blackhollow/i }).waitFor({ state: "visible" }),
    ]);

    await page.getByRole("button", { name: /Investigate the lit mill/i }).click();
    await page.waitForTimeout(1200);
    console.log(`PIXELQUEST_HOST_AFTER_FIRST_VOTE: ${(await page.locator(".pq-main-stage").innerText()).replaceAll("\n", " | ")}`);
    console.log(`PIXELQUEST_GUEST_AFTER_HOST_VOTE: ${(await guestPage.locator(".pq-main-stage").innerText()).replaceAll("\n", " | ")}`);
    const hostErrors = await page.locator(".pq-error").allInnerTexts();
    const guestErrors = await guestPage.locator(".pq-error").allInnerTexts();
    if (hostErrors.length) console.log(`PIXELQUEST_HOST_ERRORS: ${hostErrors.join(" | ")}`);
    if (guestErrors.length) console.log(`PIXELQUEST_GUEST_ERRORS: ${guestErrors.join(" | ")}`);
    await page.locator(".pq-choice-list button.chosen").waitFor({ state: "visible" });

    await guestPage.getByRole("button", { name: /Investigate the lit mill/i }).click();
    await Promise.all([
      page.getByRole("heading", { name: /this choice is yours/i }).waitFor({ state: "visible" }),
      guestPage.getByRole("heading", { name: /this choice is yours/i }).waitFor({ state: "visible" }),
    ]);

    await page.getByRole("button", { name: /reveal my choice/i }).click();
    await guestPage.getByRole("button", { name: /reveal my choice/i }).click();
    await captureFrom(guestPage, "pixelquest-private-choice", ".pq-game-screen");

    await page.getByRole("button", { name: /Pocket the silver key without telling anyone/i }).click();
    await page.locator(".pq-private-wait").waitFor({ state: "visible" });
    await guestPage.getByRole("button", { name: /Show the key and ledger to the party/i }).click();
    await Promise.all([
      page.getByRole("heading", { name: /Blackhollow Square/i }).waitFor({ state: "visible" }),
      guestPage.getByRole("heading", { name: /Blackhollow Square/i }).waitFor({ state: "visible" }),
    ]);

    await page.getByRole("button", { name: /Enter the abandoned chapel/i }).click();
    await page.locator(".pq-choice-list button.chosen").waitFor({ state: "visible" });
    await guestPage.getByRole("button", { name: /Enter the abandoned chapel/i }).click();
    await page.getByRole("button", { name: /roll initiative/i }).click();
    await Promise.all([
      page.locator(".pq-board").waitFor({ state: "visible" }),
      guestPage.locator(".pq-board").waitFor({ state: "visible" }),
    ]);

    const hostTurn = await page.getByRole("button", { name: /end my turn/i }).isVisible().catch(() => false);
    const guestTurn = await guestPage.getByRole("button", { name: /end my turn/i }).isVisible().catch(() => false);
    if (hostTurn === guestTurn) throw new Error(`Exactly one online player must own the current combat controls. host=${hostTurn} guest=${guestTurn}`);

    await capture("pixelquest-combat", ".pq-game-screen");
    const firstTurnPage = hostTurn ? page : guestPage;
    const nextTurnPage = hostTurn ? guestPage : page;
    await firstTurnPage.getByRole("button", { name: /end my turn/i }).click();
    await nextTurnPage.getByRole("button", { name: /end my turn/i }).waitFor({ state: "visible" });
  } finally {
    await guestContext.close();
  }
}

try {
  await captureHub();
  await capturePixelQuest();
  await captureCanasta();
  await captureHearts();
  await captureSpades();
  await captureRummy();
  await capturePartyEntry("punchline", "punchline-entry");
  await capturePartyEntry("lastonealive", "last-one-alive-entry");
  await capturePartyEntry("doodlealibi", "doodle-alibi-entry");
  await captureGameEntry("hnefatafl", "hnefatafl-entry");
  await captureGameEntry("connect4", "connect4-entry");
  await captureGameEntry("battleship", "battleship-entry");
  await captureGameEntry("gofish", "gofish-entry");
  await captureGameEntry("gofyourself", "go-f-yourself-entry");
  await captureGameEntry("ers", "egyptian-rat-screw-entry");
  await captureGameEntry("spoons", "spoons-entry");
  await captureGameEntry("indians", "indians-entry");
  await captureGameEntry("poker", "five-card-draw-entry");
  await captureGameEntry("golf", "six-card-golf-entry");
  await captureChompageddon();
} finally {
  await browser.close();
}
