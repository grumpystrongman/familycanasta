import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { LOCATIONS, METHODS, SUSPECTS } from "../../src/games/bloodalibi/engineV3.js";
import { SCENARIO_CATALOG, TOTAL_SCENARIO_CARDS } from "../../src/games/bloodalibi/scenarioCatalog.js";
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  CAST_ATLAS,
  DEFAULT_QA_MODEL,
  DEFAULT_SCENE_MODEL,
  DEFAULT_SCENE_QUALITY,
  ESCALATION_SCENE_MODEL,
  DEFAULT_ESCALATION_QUALITY,
  ROOM_ATLAS,
  WEAPON_ATLAS,
  buildQaPrompt,
  buildScenePrompt,
  evaluateQa,
  helpText,
  parseCli,
  scenarioCardRelativePath,
  scenarioCardStem,
} from "./cardFactoryCore.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const PUBLIC_BLACKGLASS = path.join(ROOT, "public", "blackglass");
const OUTPUT_ROOT = path.resolve(process.env.BLACKGLASS_CARD_OUTPUT_DIR || path.join(PUBLIC_BLACKGLASS, "cards"));
const WORK_ROOT = path.resolve(process.env.BLACKGLASS_CARD_WORK_DIR || path.join(HERE, ".work"));
const REFERENCE_ROOT = path.join(WORK_ROOT, "references");
const SCENE_ROOT = path.join(WORK_ROOT, "scenes");
const FAILURE_ROOT = path.join(WORK_ROOT, "failures");
const MANIFEST_PATH = path.join(OUTPUT_ROOT, "manifest.json");
const CAST_ATLAS_PATH = path.join(PUBLIC_BLACKGLASS, "canonical-cast-atlas.jpg");
const ROOM_ATLAS_PATH = path.join(PUBLIC_BLACKGLASS, "room-atlas.jpg");
const WEAPON_ATLAS_PATH = path.join(PUBLIC_BLACKGLASS, "weapon-atlas.jpg");
const TEMPLATE_REFERENCE_PATH = path.join(PUBLIC_BLACKGLASS, "card-template-reference.png");

const SCENE_MODEL = process.env.BLACKGLASS_IMAGE_MODEL || DEFAULT_SCENE_MODEL;
const ESCALATION_MODEL = process.env.BLACKGLASS_ESCALATION_IMAGE_MODEL || ESCALATION_SCENE_MODEL;
const QA_MODEL = process.env.BLACKGLASS_QA_MODEL || DEFAULT_QA_MODEL;
const SCENE_QUALITY = process.env.BLACKGLASS_IMAGE_QUALITY || DEFAULT_SCENE_QUALITY;
const ESCALATION_QUALITY = process.env.BLACKGLASS_ESCALATION_QUALITY || DEFAULT_ESCALATION_QUALITY;

const SUSPECT_BY_ID = Object.freeze(Object.fromEntries(SUSPECTS.map((item) => [item.id, item])));
const METHOD_BY_ID = Object.freeze(Object.fromEntries(METHODS.map((item) => [item.id, item])));
const LOCATION_BY_ID = Object.freeze(Object.fromEntries(LOCATIONS.map((item) => [item.id, item])));

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function escapeXml(value) { return String(value ?? "").replace(/[<>&'\"]/g, (char) => ({ "<":"&lt;", ">":"&gt;", "&":"&amp;", "'":"&apos;", '\"':"&quot;" }[char])); }
function dataUrl(buffer, mime = "image/png") { return `data:${mime};base64,${buffer.toString("base64")}`; }
function nowIso() { return new Date().toISOString(); }

async function exists(filePath) {
  try { await fs.access(filePath); return true; } catch { return false; }
}

async function readJson(filePath, fallback) {
  try { return JSON.parse(await fs.readFile(filePath, "utf8")); } catch { return fallback; }
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temp = `${filePath}.tmp`;
  await fs.writeFile(temp, `${JSON.stringify(value, null, 2)}\n`);
  await fs.rename(temp, filePath);
}

async function retry(label, fn, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try { return await fn(attempt); }
    catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      const status = Number(error?.status || error?.response?.status || 0);
      if (status && status < 429 && status < 500) throw error;
      const wait = Math.min(30_000, 1000 * (2 ** (attempt - 1)) + Math.floor(Math.random() * 700));
      console.warn(`[blackglass] ${label} failed (attempt ${attempt}/${attempts}); retrying in ${wait}ms: ${error?.message || error}`);
      await sleep(wait);
    }
  }
  throw lastError;
}

async function cropAtlasCell(sharp, sourcePath, spec, outputPath, { width = 768, height = 768, fit = "cover" } = {}) {
  if (await exists(outputPath)) return outputPath;
  const metadata = await sharp(sourcePath).metadata();
  if (!metadata.width || !metadata.height) throw new Error(`Unable to inspect atlas ${sourcePath}`);
  const left = Math.round(spec.col * metadata.width / spec.cols);
  const top = Math.round(spec.row * metadata.height / spec.rows);
  const right = Math.round((spec.col + 1) * metadata.width / spec.cols);
  const bottom = Math.round((spec.row + 1) * metadata.height / spec.rows);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await sharp(sourcePath)
    .extract({ left, top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) })
    .resize(width, height, { fit, background: { r: 6, g: 6, b: 6, alpha: 1 } })
    .png()
    .toFile(outputPath);
  return outputPath;
}

async function prepareReferences(sharp, scenario) {
  const killerPath = path.join(REFERENCE_ROOT, "cast", `${scenario.suspectId}.png`);
  const victimPath = path.join(REFERENCE_ROOT, "cast", `${scenario.victimId}.png`);
  const roomPath = path.join(REFERENCE_ROOT, "rooms", `${scenario.locationId}.png`);
  const weaponPath = path.join(REFERENCE_ROOT, "weapons", `${scenario.methodId}.png`);
  await Promise.all([
    cropAtlasCell(sharp, CAST_ATLAS_PATH, CAST_ATLAS[scenario.suspectId], killerPath, { width: 768, height: 768, fit: "cover" }),
    cropAtlasCell(sharp, CAST_ATLAS_PATH, CAST_ATLAS[scenario.victimId], victimPath, { width: 768, height: 768, fit: "cover" }),
    cropAtlasCell(sharp, ROOM_ATLAS_PATH, ROOM_ATLAS[scenario.locationId], roomPath, { width: 1024, height: 768, fit: "cover" }),
    cropAtlasCell(sharp, WEAPON_ATLAS_PATH, WEAPON_ATLAS[scenario.methodId], weaponPath, { width: 768, height: 512, fit: "contain" }),
  ]);
  return { killerPath, victimPath, roomPath, weaponPath };
}

async function generateScene({ OpenAI, toFile, client, scenario, refs, escalation = false }) {
  const killer = SUSPECT_BY_ID[scenario.suspectId];
  const victim = SUSPECT_BY_ID[scenario.victimId];
  const method = METHOD_BY_ID[scenario.methodId];
  const room = LOCATION_BY_ID[scenario.locationId];
  const model = escalation ? ESCALATION_MODEL : SCENE_MODEL;
  const quality = escalation ? ESCALATION_QUALITY : SCENE_QUALITY;
  const prompt = buildScenePrompt({
    killerName: killer.name,
    victimName: victim.name,
    roomName: room.name,
    weaponName: method.name,
    escalation,
  });
  const referenceFiles = await Promise.all([
    toFile(await fs.readFile(refs.killerPath), `${scenario.suspectId}.png`, { type: "image/png" }),
    toFile(await fs.readFile(refs.victimPath), `${scenario.victimId}.png`, { type: "image/png" }),
    toFile(await fs.readFile(refs.roomPath), `${scenario.locationId}.png`, { type: "image/png" }),
    toFile(await fs.readFile(refs.weaponPath), `${scenario.methodId}.png`, { type: "image/png" }),
  ]);
  const request = {
    model,
    image: referenceFiles,
    prompt,
    n: 1,
    size: "1536x1024",
    quality,
    output_format: "png",
    moderation: "auto",
  };
  if (escalation && model === "gpt-image-1") request.input_fidelity = "high";
  const response = await retry(`${model} image edit`, () => client.images.edit(request));
  const encoded = response?.data?.[0]?.b64_json;
  if (!encoded) throw new Error(`${model} returned no image data.`);
  return { buffer: Buffer.from(encoded, "base64"), model, quality, prompt };
}

async function qaScene({ client, sceneBuffer, refs, scenario }) {
  const killer = SUSPECT_BY_ID[scenario.suspectId];
  const victim = SUSPECT_BY_ID[scenario.victimId];
  const method = METHOD_BY_ID[scenario.methodId];
  const room = LOCATION_BY_ID[scenario.locationId];
  const [killerBuffer, victimBuffer] = await Promise.all([fs.readFile(refs.killerPath), fs.readFile(refs.victimPath)]);
  const response = await retry(`${QA_MODEL} QA`, () => client.responses.create({
    model: QA_MODEL,
    input: [{
      role: "user",
      content: [
        { type: "input_text", text: buildQaPrompt({ killerName:killer.name, victimName:victim.name, roomName:room.name, weaponName:method.name }) },
        { type: "input_image", image_url: dataUrl(sceneBuffer), detail: "low" },
        { type: "input_image", image_url: dataUrl(killerBuffer), detail: "low" },
        { type: "input_image", image_url: dataUrl(victimBuffer), detail: "low" },
      ],
    }],
  }));
  const text = String(response?.output_text || "").trim();
  const jsonText = text.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```$/, "").trim();
  let result;
  try { result = JSON.parse(jsonText); }
  catch { result = { familySafe:false, noGraphicViolence:false, noText:false, notes:`QA returned invalid JSON: ${text.slice(0, 500)}` }; }
  return { result, passed: evaluateQa(result), raw: text };
}

async function tileBuffer(sharp, filePath, width, height, fit = "cover") {
  return sharp(filePath)
    .resize(width, height, { fit, background: { r: 8, g: 8, b: 8, alpha: 1 } })
    .modulate({ brightness: 0.96, saturation: 0.9 })
    .webp({ quality: 92 })
    .toBuffer();
}

function cardBaseSvg() {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}">
    <rect width="100%" height="100%" fill="#050606"/>
    <rect x="14" y="14" width="1094" height="1374" rx="26" fill="none" stroke="#b58b45" stroke-width="3"/>
    <rect x="27" y="27" width="1068" height="1348" rx="19" fill="none" stroke="#6f542e" stroke-width="1.5"/>
    <rect x="40" y="930" width="1042" height="320" rx="12" fill="#090a0a" stroke="#9e773b" stroke-width="2"/>
    <rect x="42" y="1265" width="1038" height="102" fill="#050606"/>
  </svg>`);
}

function overlaySvg({ killer, victim, room, method }) {
  const columns = [54, 316, 578, 840];
  const headings = ["KILLER", "VICTIM", "LOCATION", "WEAPON"];
  const names = [killer.name, victim.name, room.name, method.name];
  const heading = headings.map((label,index) => `<text x="${columns[index]+112}" y="972" text-anchor="middle" fill="#d3a455" font-family="Georgia,serif" font-size="25" font-weight="700" letter-spacing="1.2">${escapeXml(label)}</text>`).join("");
  const labels = names.map((label,index) => `<text x="${columns[index]+112}" y="1226" text-anchor="middle" fill="#d8bd8a" font-family="Georgia,serif" font-size="23">${escapeXml(label)}</text>`).join("");
  const frames = columns.map((x,index) => `<rect x="${x}" y="990" width="224" height="190" rx="7" fill="none" stroke="#a77d3c" stroke-width="2"/>${index<3?`<line x1="${x+243}" y1="955" x2="${x+243}" y2="1238" stroke="#72552f" stroke-width="1"/>`:""}`).join("");
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}">
    <rect x="31" y="31" width="1060" height="884" rx="11" fill="none" stroke="#a77d3c" stroke-width="2"/>
    ${heading}${frames}${labels}
    <text x="561" y="1320" text-anchor="middle" fill="#c49345" font-family="Georgia,serif" font-size="43" font-weight="700" letter-spacing="8">BLACKGLASS HOTEL</text>
    <text x="561" y="1354" text-anchor="middle" fill="#9d7338" font-family="Arial,sans-serif" font-size="16" font-weight="600" letter-spacing="3.5">MURDER • MYSTERY • INTRIGUE</text>
  </svg>`);
}

async function composeCard(sharp, scenario, refs, sceneBuffer, outputPath) {
  const killer = SUSPECT_BY_ID[scenario.suspectId];
  const victim = SUSPECT_BY_ID[scenario.victimId];
  const method = METHOD_BY_ID[scenario.methodId];
  const room = LOCATION_BY_ID[scenario.locationId];
  const scene = await sharp(sceneBuffer).resize(1060, 884, { fit:"cover", position:"attention" }).modulate({ brightness:0.92, saturation:0.9 }).webp({ quality:94 }).toBuffer();
  const [killerTile, victimTile, roomTile, weaponTile] = await Promise.all([
    tileBuffer(sharp, refs.killerPath, 224, 190, "cover"),
    tileBuffer(sharp, refs.victimPath, 224, 190, "cover"),
    tileBuffer(sharp, refs.roomPath, 224, 190, "cover"),
    tileBuffer(sharp, refs.weaponPath, 224, 190, "contain"),
  ]);
  await fs.mkdir(path.dirname(outputPath), { recursive:true });
  await sharp(cardBaseSvg())
    .composite([
      { input:scene, left:31, top:31 },
      { input:killerTile, left:54, top:990 },
      { input:victimTile, left:316, top:990 },
      { input:roomTile, left:578, top:990 },
      { input:weaponTile, left:840, top:990 },
      { input:overlaySvg({ killer, victim, room, method }), left:0, top:0 },
    ])
    .webp({ quality:90, smartSubsample:true })
    .toFile(outputPath);
}

async function writeFailure(scenario, payload) {
  await fs.mkdir(FAILURE_ROOT, { recursive:true });
  await writeJson(path.join(FAILURE_ROOT, `${scenarioCardStem(scenario)}.json`), { scenario, at:nowIso(), ...payload });
}

function manifestSkeleton() {
  return {
    version: 1,
    pipeline: "blackglass-static-card-v1",
    expectedCards: TOTAL_SCENARIO_CARDS,
    generatedAt: null,
    cards: {},
    stats: { completed:0, failed:0, mini:0, escalated:0 },
  };
}

async function processScenario({ OpenAI, toFile, sharp, client, scenario, force }) {
  const relativePath = scenarioCardRelativePath(scenario);
  const outputPath = path.join(OUTPUT_ROOT, relativePath);
  if (!force && await exists(outputPath)) return { status:"skipped", scenario, relativePath };
  const refs = await prepareReferences(sharp, scenario);
  const scenePath = path.join(SCENE_ROOT, `${scenarioCardStem(scenario)}.png`);
  await fs.mkdir(path.dirname(scenePath), { recursive:true });

  let generation = await generateScene({ OpenAI, toFile, client, scenario, refs, escalation:false });
  let qa = await qaScene({ client, sceneBuffer:generation.buffer, refs, scenario });
  let escalated = false;
  if (!qa.passed) {
    console.warn(`[blackglass] QA rejected mini scene ${scenarioCardStem(scenario)}: ${qa.result?.notes || "no note"}`);
    escalated = true;
    generation = await generateScene({ OpenAI, toFile, client, scenario, refs, escalation:true });
    qa = await qaScene({ client, sceneBuffer:generation.buffer, refs, scenario });
  }
  if (!qa.passed) {
    await writeFailure(scenario, { qa:qa.result, model:generation.model, message:"Scene failed the production QA gate after escalation." });
    return { status:"failed", scenario, relativePath, qa:qa.result, model:generation.model, escalated };
  }

  await fs.writeFile(scenePath, generation.buffer);
  await composeCard(sharp, scenario, refs, generation.buffer, outputPath);
  if (process.env.BLACKGLASS_KEEP_SCENES !== "1") await fs.rm(scenePath, { force:true });
  return { status:"completed", scenario, relativePath, qa:qa.result, model:generation.model, escalated };
}

async function validateInputs() {
  for (const required of [CAST_ATLAS_PATH, ROOM_ATLAS_PATH, WEAPON_ATLAS_PATH, TEMPLATE_REFERENCE_PATH]) {
    if (!await exists(required)) throw new Error(`Missing Blackglass canonical asset: ${path.relative(ROOT, required)}`);
  }
}

async function main() {
  let options;
  try { options = parseCli(process.argv.slice(2)); }
  catch (error) { console.error(error.message); console.error(`\n${helpText()}`); process.exitCode = 2; return; }
  if (options.help) { console.log(helpText()); return; }

  const selected = SCENARIO_CATALOG
    .filter((scenario) => options.all || scenario.locationId === options.room)
    .slice(0, Number.isFinite(options.limit) ? options.limit : undefined);
  if (!selected.length) throw new Error(`No Blackglass scenarios matched ${options.room || "--all"}.`);
  console.log(`[blackglass] selected ${selected.length} card(s); ${options.room ? `room=${options.room}` : "all rooms"}; concurrency=${options.concurrency}`);
  if (options.dryRun) {
    const byRoom = Object.fromEntries(LOCATIONS.map((room) => [room.id, selected.filter((card) => card.locationId === room.id).length]).filter(([,count]) => count));
    console.log(JSON.stringify({ total:selected.length, byRoom, first:selected[0], last:selected.at(-1) }, null, 2));
    return;
  }

  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required for Blackglass card generation.");
  await validateInputs();
  await Promise.all([fs.mkdir(OUTPUT_ROOT,{recursive:true}), fs.mkdir(WORK_ROOT,{recursive:true})]);
  const [{ default:OpenAI, toFile }, { default:sharp }] = await Promise.all([import("openai"), import("sharp")]);
  const client = new OpenAI({ apiKey:process.env.OPENAI_API_KEY, maxRetries:0, timeout:180_000 });
  const manifest = await readJson(MANIFEST_PATH, manifestSkeleton());
  manifest.expectedCards = TOTAL_SCENARIO_CARDS;
  manifest.pipeline = "blackglass-static-card-v1";
  manifest.cards ||= {};
  manifest.stats ||= { completed:0, failed:0, mini:0, escalated:0 };

  for (let start = 0; start < selected.length; start += options.concurrency) {
    const batch = selected.slice(start, start + options.concurrency);
    const results = await Promise.all(batch.map((scenario) => processScenario({ OpenAI, toFile, sharp, client, scenario, force:options.force }).catch((error) => ({ status:"failed", scenario, error }))));
    for (const result of results) {
      const key = scenarioCardStem(result.scenario);
      if (result.status === "completed" || result.status === "skipped") {
        if (result.status === "completed") {
          manifest.stats.completed = Number(manifest.stats.completed || 0) + 1;
          if (result.escalated) manifest.stats.escalated = Number(manifest.stats.escalated || 0) + 1;
          else manifest.stats.mini = Number(manifest.stats.mini || 0) + 1;
        }
        manifest.cards[key] = {
          src:`/blackglass/cards/${result.relativePath}`,
          locationId:result.scenario.locationId,
          suspectId:result.scenario.suspectId,
          victimId:result.scenario.victimId,
          methodId:result.scenario.methodId,
          qa:result.qa || manifest.cards[key]?.qa || null,
          model:result.model || manifest.cards[key]?.model || null,
        };
        console.log(`[blackglass] ${result.status} ${key}`);
      } else {
        manifest.stats.failed = Number(manifest.stats.failed || 0) + 1;
        const message = result.error?.message || result.qa?.notes || "unknown failure";
        await writeFailure(result.scenario, { message, stack:result.error?.stack || null, qa:result.qa || null });
        console.error(`[blackglass] failed ${key}: ${message}`);
      }
    }
    manifest.generatedAt = nowIso();
    manifest.cardCount = Object.keys(manifest.cards).length;
    await writeJson(MANIFEST_PATH, manifest);
    console.log(`[blackglass] progress ${Math.min(start + batch.length, selected.length)}/${selected.length}; manifest=${manifest.cardCount}/${TOTAL_SCENARIO_CARDS}`);
  }

  console.log(`[blackglass] done. ${Object.keys(manifest.cards).length}/${TOTAL_SCENARIO_CARDS} cards registered in ${path.relative(ROOT, MANIFEST_PATH)}.`);
}

main().catch((error) => {
  console.error(`[blackglass] fatal: ${error?.stack || error}`);
  process.exitCode = 1;
});
