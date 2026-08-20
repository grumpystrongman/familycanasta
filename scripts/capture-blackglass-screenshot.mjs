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

function overlaps(a, b) {
  if (!a || !b) return false;
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
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
    const rect = image.getBoundingClientRect();
    return {
      src: image.getAttribute("src") || "",
      complete: image.complete,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      renderedWidth: rect.width,
      renderedHeight: rect.height,
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
    if (art.src.includes("#suspects-") && !art.backgroundImage.includes("cast-atlas-hd.webp")) {
      throw new Error(`Suspect portrait is not using the HD cast source: ${JSON.stringify(art)}`);
    }
    if (art.src.includes("#weapons-") && !art.backgroundImage.includes("weapon-atlas-hd.svg")) {
      throw new Error(`Weapon evidence is not using the crisp vector source: ${JSON.stringify(art)}`);
    }
    if (art.src.includes("#rooms-") && !art.backgroundImage.includes("room-atlas-hd.webp")) {
      throw new Error(`Room evidence is not using the HD room source: ${JSON.stringify(art)}`);
    }
    if (art.src.includes("#suspects-") && Math.abs(art.renderedWidth - art.renderedHeight) > 1) {
      throw new Error(`Suspect portrait is stretched instead of square: ${JSON.stringify(art)}`);
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
    if (atlas.src.includes("cast-atlas-hd.webp") && (atlas.width < 2000 || atlas.height < 300)) {
      throw new Error(`HD cast atlas is below the quality floor: ${JSON.stringify(atlas)}`);
    }
    if (atlas.src.includes("room-atlas-hd.webp") && (atlas.width < 1500 || atlas.height < 900)) {
      throw new Error(`HD room atlas is below the quality floor: ${JSON.stringify(atlas)}`);
    }
    if (atlas.src.includes("weapon-atlas-hd.svg") && (atlas.width < 1200 || atlas.height < 700)) {
      throw new Error(`Vector weapon atlas is below the quality floor: ${JSON.stringify(atlas)}`);
    }
  }

  const roomSources = await page.locator(".bn-room").evaluateAll((rooms) => rooms.map((room) => {
    const style = getComputedStyle(room);
    const label = room.querySelector(".bn-room-label");
    return {
      background: style.backgroundImage,
      backgroundSize: style.backgroundSize,
      backgroundPosition: style.backgroundPosition,
      filter: style.filter,
      labelDisplay: label ? getComputedStyle(label).display : "missing",
    };
  }));
  for (const room of roomSources) {
    if (!room.background.includes("/blackglass/room-atlas-hd.webp")) {
      throw new Error(`Room is not using the HD Blackglass room artwork: ${JSON.stringify(room)}`);
    }
    if (room.backgroundSize !== "300% 300%") {
      throw new Error(`Room artwork is not cropped to a single room: ${JSON.stringify(room)}`);
    }
    if (room.filter !== "none") throw new Error(`Room image has unwanted grading: ${JSON.stringify(room)}`);
    if (room.labelDisplay !== "none") throw new Error(`Duplicate room-title overlay is still visible: ${JSON.stringify(room)}`);
  }

  const playerPortraits = await page.locator('.bn-players img[src*="#suspects-"]').evaluateAll((images) => images.map((image) => {
    const rect = image.getBoundingClientRect();
    const style = getComputedStyle(image);
    return { width: rect.width, height: rect.height, background: style.backgroundImage, filter: style.filter };
  }));
  for (const portrait of playerPortraits) {
    if (Math.abs(portrait.width - portrait.height) > 1) throw new Error(`Player portrait is visibly stretched: ${JSON.stringify(portrait)}`);
    if (!portrait.background.includes("cast-atlas-hd.webp")) throw new Error(`Player portrait is not HD: ${JSON.stringify(portrait)}`);
    if (portrait.filter !== "none") throw new Error(`Player portrait has unwanted grading: ${JSON.stringify(portrait)}`);
  }

  const rules = await page.locator(".game-learning-center .learning-launch").boundingBox();
  const brand = await page.locator(".bn-brand").boundingBox();
  if (overlaps(rules, brand)) throw new Error(`Rules control overlaps the Blackglass notebook crest: ${JSON.stringify({ rules, brand })}`);

  await page.screenshot({ path: `${outputDir}/blackglass-polished-board.png`, fullPage: false });
} finally {
  await browser.close();
}
