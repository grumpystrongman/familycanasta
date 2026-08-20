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

function extractUrl(backgroundImage = "") {
  const match = backgroundImage.match(/url\(["']?(.*?)["']?\)/);
  return match?.[1] || "";
}

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

  const evidence = await page.locator(".bn-notebook img").evaluateAll((images) => images.map((image) => {
    const style = getComputedStyle(image);
    return {
      src: image.getAttribute("src") || "",
      complete: image.complete,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      backgroundImage: style.backgroundImage,
      backgroundSize: style.backgroundSize,
      backgroundPosition: style.backgroundPosition,
      filter: style.filter,
      blend: style.mixBlendMode,
      opacity: style.opacity,
    };
  }));

  for (const art of evidence) {
    if (!art.complete || art.naturalWidth < 1 || art.naturalHeight < 1) {
      throw new Error(`Evidence carrier failed to load: ${JSON.stringify(art)}`);
    }
    if (!art.backgroundImage.includes("/blackglass/") || art.backgroundImage === "none") {
      throw new Error(`Evidence art is not using committed Blackglass artwork: ${JSON.stringify(art)}`);
    }
    if (!art.backgroundSize || art.backgroundSize === "auto") {
      throw new Error(`Evidence art is missing a crop size: ${JSON.stringify(art)}`);
    }
    if (art.filter !== "none" || art.blend !== "normal" || Number(art.opacity) !== 1) {
      throw new Error(`Evidence image has unwanted grading: ${JSON.stringify(art)}`);
    }
  }

  const atlasUrls = [...new Set(evidence.map((art) => extractUrl(art.backgroundImage)).filter(Boolean))];
  const atlasLoads = await page.evaluate(async (urls) => Promise.all(urls.map((src) => new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ src, width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve({ src, width: 0, height: 0 });
    image.src = src;
  }))), atlasUrls);
  for (const atlas of atlasLoads) {
    if (atlas.width < 300 || atlas.height < 100) {
      throw new Error(`Blackglass atlas failed to load: ${JSON.stringify(atlas)}`);
    }
  }

  const roomSources = await page.locator(".bn-room").evaluateAll((rooms) => rooms.map((room) => {
    const style = getComputedStyle(room);
    return {
      background: style.backgroundImage,
      backgroundSize: style.backgroundSize,
      backgroundPosition: style.backgroundPosition,
      filter: style.filter,
    };
  }));
  for (const room of roomSources) {
    if (!room.background.includes("/blackglass/room-atlas-polished.webp")) {
      throw new Error(`Room is not using the polished Blackglass room artwork: ${JSON.stringify(room)}`);
    }
    if (room.backgroundSize !== "300% 300%") {
      throw new Error(`Room artwork is not cropped to a single room: ${JSON.stringify(room)}`);
    }
    if (room.filter !== "none") throw new Error(`Room image has unwanted grading: ${JSON.stringify(room)}`);
  }

  await page.locator(".bn-shell").screenshot({ path: `${outputDir}/blackglass-polished-board.png` });
} finally {
  await browser.close();
}
