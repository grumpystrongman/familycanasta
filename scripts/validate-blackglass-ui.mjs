import fs from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:4173";
const outputDir = process.env.SCREENSHOT_DIR || "artifacts/readme-screenshots";
await fs.mkdir(outputDir, { recursive: true });

function assert(condition, message) {
  if (!condition) throw new Error(`Blackglass UI validation failed: ${message}`);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1, colorScheme: "dark" });
await context.addInitScript(() => {
  localStorage.setItem("familyCardNickname", "UI Test Host");
  localStorage.setItem("familyCardAvatar", "🕵️");
});
const page = await context.newPage();
page.setDefaultTimeout(30_000);
page.on("pageerror", (error) => console.log(`[blackglass:browser-error] ${error.stack || error.message}`));

async function waitForHumanTurn() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const roll = page.locator(".blackglass-roll-button");
    const theory = page.locator(".blackglass-theory-submit");
    if (await roll.isEnabled().catch(() => false) || await theory.isEnabled().catch(() => false)) return;
    await page.waitForTimeout(350);
  }
}

try {
  await page.goto(`${baseUrl}/?game=bloodalibi`, { waitUntil: "networkidle" });
  await page.locator(".game-start-panel").waitFor({ state: "visible" });
  await page.getByRole("button", { name: /open a case vs robot/i }).click();
  await page.locator('[data-testid="blackglass-game-layout"]').waitFor({ state: "visible" });
  await page.waitForTimeout(900);

  const geometry = await page.evaluate(() => {
    const board = document.querySelector('[data-testid="blackglass-board"]')?.getBoundingClientRect();
    const rooms = [...document.querySelectorAll(".bg-board-room")].map((node) => {
      const box = node.getBoundingClientRect();
      return [Math.round(box.width), Math.round(box.height)];
    });
    const uniqueRoomShapes = new Set(rooms.map(([w, h]) => `${w}x${h}`)).size;
    const notebook = getComputedStyle(document.querySelector(".bg-notebook-scroll"));
    return {
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      boardWidth: board?.width || 0,
      boardHeight: board?.height || 0,
      uniqueRoomShapes,
      notebookOverflow: notebook.overflowY,
      passageCount: document.querySelectorAll(".bg-passage-overlay path").length,
    };
  });

  assert(geometry.scrollWidth <= geometry.viewportWidth + 4, `desktop page horizontally scrolls (${geometry.scrollWidth} > ${geometry.viewportWidth})`);
  assert(geometry.scrollHeight <= geometry.viewportHeight + 8, `desktop page vertically scrolls (${geometry.scrollHeight} > ${geometry.viewportHeight})`);
  assert(geometry.boardWidth >= 700, `board is not visually dominant enough (${geometry.boardWidth}px wide)`);
  assert(geometry.boardHeight >= 560, `board is not tall enough in the viewport (${geometry.boardHeight}px)`);
  assert(geometry.uniqueRoomShapes >= 5, `room layout still looks too uniform (${geometry.uniqueRoomShapes} unique shapes)`);
  assert(geometry.passageCount === 2, `expected two visible secret-passage routes, found ${geometry.passageCount}`);
  assert(["auto", "scroll"].includes(geometry.notebookOverflow), `notebook does not own its scrolling (${geometry.notebookOverflow})`);

  await page.locator('[data-testid="blackglass-game-layout"]').screenshot({ path: `${outputDir}/blackglass-board-ui.png` });

  await page.getByRole("button", { name: /intel/i }).click();
  await page.waitForTimeout(120);
  assert(await page.locator(".bg-board-shell.intel").count() === 1, "Intel mode did not activate");

  const note = page.locator(".bg-note-row:not(.cleared)").first();
  const before = await note.getAttribute("class");
  await note.click();
  const after = await note.getAttribute("class");
  assert(before !== after && /watch/.test(after || ""), "detective notebook row did not cycle to Watch");

  for (let attempt = 0; attempt < 14; attempt += 1) {
    const theory = page.locator(".blackglass-theory-submit");
    if (await theory.isEnabled().catch(() => false)) break;
    await waitForHumanTurn();
    const roll = page.locator(".blackglass-roll-button");
    if (await roll.isEnabled().catch(() => false)) {
      await roll.click();
      await page.waitForTimeout(250);
    }
    const roomTargets = page.locator(".bg-board-room.reachable");
    if (await roomTargets.count()) {
      await roomTargets.first().click();
      await page.waitForTimeout(300);
      continue;
    }
    const hallTargets = page.locator(".bg-hall-space.reachable");
    const hallCount = await hallTargets.count();
    if (hallCount) await hallTargets.nth(hallCount - 1).click();
    await page.waitForTimeout(1000);
  }

  const theory = page.locator(".blackglass-theory-submit");
  assert(await theory.isEnabled().catch(() => false), "could not reach a room and enable the theory interaction during browser playthrough");
  await theory.click();
  const reconstruction = page.locator('[data-testid="blackglass-scenario-modal"]');
  await reconstruction.waitFor({ state: "visible" });
  assert(/AI RECONSTRUCTION/i.test(await reconstruction.innerText()), "scenario reveal is missing its cinematic reconstruction treatment");
  await reconstruction.screenshot({ path: `${outputDir}/blackglass-theory-reconstruction.png` });
  await page.getByRole("button", { name: /continue investigation/i }).click();

  await page.getByRole("button", { name: /action log/i }).click();
  const logMetrics = await page.locator('[data-testid="blackglass-action-log"]').evaluate((node) => ({ overflowY: getComputedStyle(node).overflowY, clientHeight: node.clientHeight, scrollHeight: node.scrollHeight }));
  assert(["auto", "scroll"].includes(logMetrics.overflowY), `action log is not independently scrollable (${logMetrics.overflowY})`);
  assert(logMetrics.clientHeight > 120, "action log panel is too cramped to be usable");

  console.log("Blackglass UI/UX validation passed", { geometry, logMetrics });
} finally {
  await browser.close();
}
