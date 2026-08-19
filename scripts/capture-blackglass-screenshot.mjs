import fs from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:4173";
const outputDir = process.env.SCREENSHOT_DIR || "artifacts/readme-screenshots";
await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 1,
  colorScheme: "dark",
});

await context.addInitScript(() => {
  localStorage.setItem("canastaNickname", "Jeff");
  localStorage.setItem("familyCardNickname", "Jeff");
  localStorage.setItem("canastaAvatar", "🕵️");
  localStorage.setItem("familyCardAvatar", "🕵️");
});

const page = await context.newPage();
page.setDefaultTimeout(30_000);
page.on("pageerror", (error) => console.log(`[blackglass:error] ${error.stack || error.message}`));

try {
  await page.goto(`${baseUrl}/?game=bloodalibi`, { waitUntil: "networkidle" });
  await page.locator(".game-start-panel").waitFor({ state: "visible" });
  await page.getByRole("button", { name: /open a case vs robot/i }).click();
  await page.locator("[data-testid=blackglass-noir-board]").waitFor({ state: "visible" });
  await page.waitForTimeout(900);

  const learn = page.getByRole("button", { name: /learn & rules/i });
  if (await learn.count()) {
    const learnMeta = await learn.first().evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        className: element.className,
        parentClassName: element.parentElement?.className || "",
        top: style.top,
        left: style.left,
        width: style.width,
        height: style.height,
        fontSize: style.fontSize,
      };
    });
    console.log(`[blackglass:learning-control] ${JSON.stringify(learnMeta)}`);
  }

  const roll = page.getByRole("button", { name: /roll dice/i });
  if (await roll.isEnabled()) {
    await roll.click();
    await page.locator(".bn-hall.reachable, .bn-room.reachable").first().waitFor({ state: "visible" });
    await page.waitForTimeout(500);
  }

  const roomCount = await page.locator(".bn-room").count();
  const corridorCount = await page.locator(".bn-hall").count();
  const portraitCount = await page.locator(".bn-notebook img").count();
  if (roomCount !== 9) throw new Error(`Expected 9 rooms, found ${roomCount}`);
  if (corridorCount < 180) throw new Error(`Expected a broad walkable floor, found ${corridorCount} corridor tiles`);
  if (portraitCount < 20) throw new Error(`Expected notebook artwork for all evidence rows, found ${portraitCount} images`);

  const evidenceImages = await page.locator(".bn-notebook img").evaluateAll((images) => images.map((image) => {
    const style = getComputedStyle(image);
    return {
      src: image.getAttribute("src") || "",
      complete: image.complete,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      filter: style.filter,
      mixBlendMode: style.mixBlendMode,
      opacity: style.opacity,
    };
  }));

  for (const art of evidenceImages) {
    if (!art.src.includes("/games/bloodalibi/items/direct/")) {
      throw new Error(`Notebook still uses a non-direct Blackglass image: ${art.src}`);
    }
    if (!art.complete || art.naturalWidth < 300 || art.naturalHeight < 300) {
      throw new Error(`Blackglass evidence art failed to load at usable resolution: ${JSON.stringify(art)}`);
    }
    if (art.filter !== "none" || art.mixBlendMode !== "normal" || Number(art.opacity) !== 1) {
      throw new Error(`Blackglass evidence art is being visually graded: ${JSON.stringify(art)}`);
    }
  }

  const roomArt = await page.locator(".bn-room").evaluateAll(async (rooms) => {
    const load = (src) => new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve({ src, width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => resolve({ src, width: 0, height: 0 });
      image.src = src;
    });
    const results = [];
    for (const room of rooms) {
      const style = getComputedStyle(room);
      const match = style.backgroundImage.match(/url\(["']?(.*?)["']?\)/);
      const src = match?.[1] || "";
      const loaded = src ? await load(src) : { src, width: 0, height: 0 };
      results.push({ ...loaded, filter: style.filter });
    }
    return results;
  });

  for (const art of roomArt) {
    if (!art.src.includes("/games/bloodalibi/items/direct/rooms/")) {
      throw new Error(`Room still uses a missing/indirect source: ${art.src}`);
    }
    if (art.width < 700 || art.height < 430) {
      throw new Error(`Room art failed to load at board resolution: ${JSON.stringify(art)}`);
    }
    if (art.filter !== "none") throw new Error(`Room art is being filtered: ${JSON.stringify(art)}`);
  }

  const shell = page.locator(".bn-shell");
  await shell.screenshot({ path: `${outputDir}/blackglass-polished-board.png` });
} finally {
  await browser.close();
}
