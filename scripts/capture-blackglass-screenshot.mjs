import fs from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:4173";
const outputDir = process.env.SCREENSHOT_DIR || "artifacts/readme-screenshots";
await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1, colorScheme: "dark" });
await context.addInitScript(() => {
  localStorage.setItem("canastaNickname", "Jeff");
  localStorage.setItem("familyCardNickname", "Jeff");
  localStorage.setItem("canastaAvatar", "🕵️");
  localStorage.setItem("familyCardAvatar", "🕵️");
});

const page = await context.newPage();
page.setDefaultTimeout(30_000);

try {
  await page.goto(`${baseUrl}/?game=bloodalibi`, { waitUntil: "networkidle" });
  await page.locator(".game-start-panel").waitFor({ state: "visible" });
  await page.getByRole("button", { name: /open a case vs robot/i }).click();
  await page.locator("[data-testid=blackglass-noir-board]").waitFor({ state: "visible" });
  await page.waitForTimeout(900);

  const roll = page.getByRole("button", { name: /roll dice/i });
  if (await roll.isEnabled()) {
    await roll.click();
    await page.locator(".bn-hall.reachable, .bn-room.reachable").first().waitFor({ state: "visible" });
    await page.waitForTimeout(500);
  }

  const roomCount = await page.locator(".bn-room").count();
  const corridorCount = await page.locator(".bn-hall").count();
  const evidenceCount = await page.locator(".bn-notebook img").count();
  if (roomCount !== 9) throw new Error(`Expected 9 rooms, found ${roomCount}`);
  if (corridorCount < 180) throw new Error(`Expected a broad walkable floor, found ${corridorCount} corridor tiles`);
  if (evidenceCount < 20) throw new Error(`Expected notebook artwork, found ${evidenceCount} images`);

  const evidence = await page.locator(".bn-notebook img").evaluateAll((images) => images.map((image) => ({
    src: image.getAttribute("src") || "",
    complete: image.complete,
    width: image.naturalWidth,
    height: image.naturalHeight,
    filter: getComputedStyle(image).filter,
    blend: getComputedStyle(image).mixBlendMode,
    opacity: getComputedStyle(image).opacity,
  })));
  for (const art of evidence) {
    if (!art.src.includes("/games/bloodalibi/items/direct/") || !art.complete || art.width < 90 || art.height < 90) {
      throw new Error(`Evidence image failed to load: ${JSON.stringify(art)}`);
    }
    if (art.filter !== "none" || art.blend !== "normal" || Number(art.opacity) !== 1) {
      throw new Error(`Evidence image has unwanted grading: ${JSON.stringify(art)}`);
    }
  }

  const roomSources = await page.locator(".bn-room").evaluateAll((rooms) => rooms.map((room) => ({
    background: getComputedStyle(room).backgroundImage,
    filter: getComputedStyle(room).filter,
  })));
  for (const room of roomSources) {
    if (!room.background.includes("/games/bloodalibi/items/direct/rooms/") || !room.background.includes(".svg")) {
      throw new Error(`Room image source is not direct: ${JSON.stringify(room)}`);
    }
    if (room.filter !== "none") throw new Error(`Room image has unwanted grading: ${JSON.stringify(room)}`);
  }

  await page.locator(".bn-shell").screenshot({ path: `${outputDir}/blackglass-polished-board.png` });
} finally {
  await browser.close();
}
