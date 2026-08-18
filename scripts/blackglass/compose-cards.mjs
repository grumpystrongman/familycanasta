import path from "node:path";
import sharp from "sharp";
import { cardsRoot, findById, locations, methods, qaRoot, referenceRoot, scenesRoot, selectScenarios, settings, suspects } from "./config.mjs";
import { ensureDir, escapeXml, exists, readJson } from "./utils.mjs";

const WIDTH = 1122;
const HEIGHT = 1402;
const GOLD = "#c6a15a";
const GOLD_DARK = "#6f5226";
const PANEL_BG = "#080b0d";

function labelSize(text) {
  const n = String(text).length;
  if (n > 20) return 19;
  if (n > 16) return 21;
  return 24;
}

async function thumb(file, width, height, contain = false) {
  return sharp(file)
    .resize(width, height, { fit: contain ? "contain" : "cover", position: "attention", background: { r: 6, g: 8, b: 9, alpha: 1 } })
    .webp({ quality: 88 })
    .toBuffer();
}

function frameSvg(scenario) {
  const killer = findById(suspects, scenario.suspectId);
  const victim = findById(suspects, scenario.victimId);
  const room = findById(locations, scenario.locationId);
  const method = findById(methods, scenario.methodId);
  const cols = [145, 410, 675, 940];
  const names = [killer.name, victim.name, room.name, method.name];
  const headings = ["KILLER", "VICTIM", "LOCATION", "WEAPON"];
  const texts = cols.map((x, i) => `
    <text x="${x}" y="980" class="heading">${headings[i]}</text>
    <text x="${x}" y="1244" class="name" style="font-size:${labelSize(names[i])}px">${escapeXml(names[i])}</text>
  `).join("");
  const verticals = [278, 543, 808].map((x) => `<line x1="${x}" y1="955" x2="${x}" y2="1255" stroke="${GOLD_DARK}" stroke-width="1"/>`).join("");
  return Buffer.from(`<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <style>
      .heading{font-family:Georgia,'Times New Roman',serif;font-size:25px;font-weight:600;fill:${GOLD};text-anchor:middle;letter-spacing:1px}
      .name{font-family:Georgia,'Times New Roman',serif;fill:#e0c99b;text-anchor:middle}
      .brand{font-family:Georgia,'Times New Roman',serif;font-size:48px;font-weight:700;letter-spacing:8px;fill:${GOLD};text-anchor:middle}
      .tag{font-family:Arial,sans-serif;font-size:14px;letter-spacing:4px;fill:#b99146;text-anchor:middle}
    </style>
    <rect width="1122" height="1402" fill="#030506"/>
    <rect x="15" y="15" width="1092" height="1372" rx="25" fill="none" stroke="${GOLD}" stroke-width="3"/>
    <rect x="27" y="27" width="1068" height="1348" rx="20" fill="none" stroke="${GOLD_DARK}" stroke-width="1"/>
    <rect x="43" y="940" width="1036" height="330" rx="18" fill="${PANEL_BG}" fill-opacity="0.97" stroke="${GOLD_DARK}" stroke-width="2"/>
    ${verticals}
    ${texts}
    <text x="561" y="1340" class="brand">BLACKGLASS HOTEL</text>
    <text x="561" y="1370" class="tag">MURDER • MYSTERY • INTRIGUE</text>
  </svg>`);
}

function slotSvg(width, height) {
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="10" fill="#080b0d" stroke="${GOLD}" stroke-width="2"/></svg>`);
}

let composed = 0;
let skipped = 0;
for (const scenario of selectScenarios()) {
  const qa = readJson(path.join(qaRoot, `${scenario.id}.json`), null);
  const sceneFile = path.join(scenesRoot, scenario.locationId, `${scenario.id}.webp`);
  if (!qa?.pass || !exists(sceneFile)) { skipped += 1; console.warn(`SKIP ${scenario.id}: scene not QA-approved`); continue; }

  const killer = findById(suspects, scenario.suspectId);
  const victim = findById(suspects, scenario.victimId);
  const room = findById(locations, scenario.locationId);
  const method = findById(methods, scenario.methodId);
  const killerFile = path.join(referenceRoot, "characters", `${killer.id}.webp`);
  const victimFile = path.join(referenceRoot, "characters", `${victim.id}.webp`);
  const roomFile = path.join(referenceRoot, "rooms", `${room.id}.webp`);
  const methodFile = path.join(referenceRoot, "weapons", `${method.id}.webp`);
  for (const file of [killerFile, victimFile, roomFile, methodFile]) {
    if (!exists(file)) throw new Error(`Missing card reference asset: ${file}`);
  }

  const destDir = path.join(cardsRoot, scenario.locationId);
  ensureDir(destDir);
  const dest = path.join(destDir, `${scenario.id}.webp`);
  const mainScene = await sharp(sceneFile).resize(1070, 905, { fit: "cover", position: "attention" }).webp({ quality: 90 }).toBuffer();
  const boxW = 218;
  const boxH = 205;
  const lefts = [36, 301, 566, 831];
  const top = 1000;
  const composites = [
    { input: mainScene, left: 26, top: 26 },
    { input: frameSvg(scenario), left: 0, top: 0 },
  ];
  const files = [killerFile, victimFile, roomFile, methodFile];
  for (let i = 0; i < files.length; i += 1) {
    composites.push({ input: slotSvg(boxW, boxH), left: lefts[i], top });
    composites.push({ input: await thumb(files[i], boxW - 12, boxH - 12, i === 3), left: lefts[i] + 6, top: top + 6 });
  }

  await sharp({ create: { width: WIDTH, height: HEIGHT, channels: 4, background: { r: 3, g: 5, b: 6, alpha: 1 } } })
    .composite(composites)
    .webp({ quality: settings.cardQuality, smartSubsample: true })
    .toFile(dest);
  composed += 1;
  console.log(`CARD ${scenario.id}`);
}
console.log(`Card composition complete: composed=${composed}, skipped=${skipped}.`);
if (skipped) process.exitCode = 2;
