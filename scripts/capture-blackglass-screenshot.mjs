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

function overlaps(a, b) {
  if (!a || !b) return false;
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function isRichSvgDataUrl(src = "") {
  return src.startsWith("data:image/svg+xml") && src.length > 900 && src.includes("viewBox%3D%22");
}

try {
  await page.goto(`${baseUrl}/?game=bloodalibi`, { waitUntil: "networkidle" });
  await page.locator(".game-start-panel").waitFor({ state: "visible" });
  await page.getByRole("button", { name: /open a case vs robot/i }).click();
  await page.locator("[data-testid=blackglass-noir-board]").waitFor({ state: "visible" });
  await page.waitForTimeout(650);

  const roll = page.getByRole("button", { name: /roll dice/i });
  if (await roll.isEnabled()) {
    await roll.click();
    await page.locator(".bn-hall.reachable, .bn-room.reachable").first().waitFor({ state: "visible" });
    await page.waitForTimeout(350);
  }

  const roomCount = await page.locator(".bn-room").count();
  const corridorCount = await page.locator(".bn-hall").count();
  const evidenceCount = await page.locator(".bn-notebook img").count();
  if (roomCount !== 9) throw new Error(`Expected 9 rooms, found ${roomCount}`);
  if (corridorCount < 180) throw new Error(`Expected a broad walkable floor, found ${corridorCount} corridor tiles`);
  if (evidenceCount < 20) throw new Error(`Expected notebook artwork, found ${evidenceCount} images`);

  const evidence = await page.locator(".bn-notebook img").evaluateAll((images) => images.map((image) => {
    const style = getComputedStyle(image);
    const rect = image.getBoundingClientRect();
    return {
      src: image.getAttribute("src") || "",
      complete: image.complete,
      renderedWidth: rect.width,
      renderedHeight: rect.height,
      filter: style.filter,
      blend: style.mixBlendMode,
      opacity: style.opacity,
      objectFit: style.objectFit,
    };
  }));

  for (const art of evidence) {
    if (!isRichSvgDataUrl(art.src)) throw new Error(`Evidence is not rich direct vector noir artwork: ${JSON.stringify(art)}`);
    if (!art.complete) throw new Error(`Evidence vector failed to load: ${JSON.stringify(art)}`);
    if (art.renderedWidth < 28 || art.renderedHeight < 28) throw new Error(`Evidence thumbnail is too small to read: ${JSON.stringify(art)}`);
    if (art.filter !== "none" || art.blend !== "normal" || Number(art.opacity) !== 1) throw new Error(`Evidence image has unwanted grading: ${JSON.stringify(art)}`);
  }

  const roomSources = await page.locator(".bn-room").evaluateAll((rooms) => rooms.map((room) => {
    const style = getComputedStyle(room);
    const label = room.querySelector(".bn-room-label");
    const rect = room.getBoundingClientRect();
    return {
      background: style.backgroundImage,
      backgroundSize: style.backgroundSize,
      backgroundPosition: style.backgroundPosition,
      filter: style.filter,
      labelDisplay: label ? getComputedStyle(label).display : "missing",
      borderColor: style.borderColor,
      width: rect.width,
      height: rect.height,
    };
  }));
  for (const room of roomSources) {
    if (!room.background.includes("data:image/svg+xml")) throw new Error(`Room is not using direct illustrated noir artwork: ${JSON.stringify(room)}`);
    if (room.background.length < 1500) throw new Error(`Room artwork is unexpectedly sparse: ${JSON.stringify(room)}`);
    if (room.backgroundSize !== "cover") throw new Error(`Room artwork is not filling the room cleanly: ${JSON.stringify(room)}`);
    if (room.filter !== "none") throw new Error(`Room image has unwanted grading: ${JSON.stringify(room)}`);
    if (room.labelDisplay !== "none") throw new Error(`Duplicate room-title overlay is still visible: ${JSON.stringify(room)}`);
    if (room.width < 120 || room.height < 90) throw new Error(`Room is too small to read as illustrated space: ${JSON.stringify(room)}`);
  }

  const playerPortraits = await page.locator(".bn-players img").evaluateAll((images) => images.map((image) => {
    const rect = image.getBoundingClientRect();
    const style = getComputedStyle(image);
    return { width: rect.width, height: rect.height, src: image.getAttribute("src") || "", filter: style.filter, objectFit: style.objectFit };
  }));
  if (!playerPortraits.length) throw new Error("Expected player portrait cards in the bottom dock");
  for (const portrait of playerPortraits) {
    const ratio = portrait.width / portrait.height;
    if (ratio < .48 || ratio > .82) throw new Error(`Player portrait has the wrong portrait-card proportion: ${JSON.stringify(portrait)}`);
    if (!isRichSvgDataUrl(portrait.src)) throw new Error(`Player portrait is not rich direct vector art: ${JSON.stringify(portrait)}`);
    if (portrait.filter !== "none" || portrait.objectFit !== "cover") throw new Error(`Player portrait is visually degraded: ${JSON.stringify(portrait)}`);
  }

  const roomLabel = await page.locator(".bn-room-label").first().evaluate((node) => getComputedStyle(node).display);
  if (roomLabel !== "none") throw new Error("Room title is printed twice instead of living only in the artwork");

  const goldButton = await page.locator(".bn-theory-form .bn-primary").evaluate((node) => getComputedStyle(node).backgroundImage);
  if (!goldButton.includes("gradient")) throw new Error("Theory builder lost the cinematic brass action treatment");

  const rules = await page.locator(".game-learning-center .learning-launch").boundingBox();
  const brand = await page.locator(".bn-brand").boundingBox();
  if (overlaps(rules, brand)) throw new Error(`Rules control overlaps the Blackglass notebook crest: ${JSON.stringify({ rules, brand })}`);

  await page.screenshot({ path: `${outputDir}/blackglass-polished-board.png`, fullPage: false });
} finally {
  await browser.close();
}
