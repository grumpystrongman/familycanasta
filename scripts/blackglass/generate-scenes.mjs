import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import { cardsRoot, models, qaRoot, scenesRoot, selectScenarios, settings, workRoot } from "./config.mjs";
import { buildReferenceSheet, scenePrompt } from "./reference-sheet.mjs";
import { qaScene } from "./qa.mjs";
import { ensureDir, exists, readJson, sleep, writeJson } from "./utils.mjs";

if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required to generate Blackglass scenes.");
const client = new OpenAI();
ensureDir(scenesRoot);
ensureDir(qaRoot);
ensureDir(workRoot);
const progressFile = path.join(workRoot, "progress.json");
const progress = readJson(progressFile, { version: 1, cards: {} });

async function generateImage(sheetFile, prompt, quality) {
  const options = {
    model: models.scene,
    image: fs.createReadStream(sheetFile),
    prompt,
    size: "1024x1536",
    quality,
    output_format: "webp",
    output_compression: 90,
    moderation: "auto",
  };
  if (models.scene === "gpt-image-1" || models.scene.startsWith("gpt-image-1.5")) options.input_fidelity = "high";
  const response = await client.images.edit(options);
  const b64 = response.data?.[0]?.b64_json;
  if (!b64) throw new Error("Image API returned no scene image data.");
  return Buffer.from(b64, "base64");
}

async function renderAttempt(scenario, sceneFile, sheetFile, attempt, previousQa) {
  const quality = attempt === 1 ? "medium" : "high";
  let prompt = scenePrompt(scenario);
  if (previousQa?.issues?.length) {
    prompt += `\n\nCORRECT THE PRIOR QA FAILURES: ${previousQa.issues.join("; ")}. Preserve the canonical faces and family-safe rules above.`;
  }
  for (let apiTry = 1; apiTry <= 3; apiTry += 1) {
    try {
      const bytes = await generateImage(sheetFile, prompt, quality);
      ensureDir(path.dirname(sceneFile));
      fs.writeFileSync(sceneFile, bytes);
      return;
    } catch (error) {
      if (apiTry === 3) throw error;
      await sleep(apiTry * 3000);
    }
  }
}

async function processScenario(scenario) {
  const finalCard = path.join(cardsRoot, scenario.locationId, `${scenario.id}.webp`);
  if (exists(finalCard)) {
    progress.cards[scenario.id] = { status: "already-composed", card: finalCard };
    return;
  }
  const sceneFile = path.join(scenesRoot, scenario.locationId, `${scenario.id}.webp`);
  const qaFile = path.join(qaRoot, `${scenario.id}.json`);
  const existingQa = readJson(qaFile, null);
  if (exists(sceneFile) && existingQa?.pass) {
    progress.cards[scenario.id] = { status: "qa-passed", scene: sceneFile, qa: qaFile };
    return;
  }

  const sheetFile = await buildReferenceSheet(scenario);
  let previousQa = existingQa;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    if (!(attempt === 1 && exists(sceneFile) && !existingQa)) {
      await renderAttempt(scenario, sceneFile, sheetFile, attempt, previousQa);
    }
    const result = await qaScene(sceneFile, sheetFile, scenario);
    writeJson(qaFile, result);
    progress.cards[scenario.id] = {
      status: result.pass ? "qa-passed" : "qa-failed",
      attempt,
      score: result.score,
      identity: result.identity,
      style: result.style,
      scene: sceneFile,
      qa: qaFile,
      updatedAt: new Date().toISOString(),
    };
    writeJson(progressFile, progress);
    console.log(`${result.pass ? "PASS" : "FAIL"} ${scenario.id} score=${result.score ?? "?"} attempt=${attempt}`);
    if (result.pass) return;
    previousQa = result;
  }

  console.error(`Scene requires manual review after two attempts: ${scenario.id}`);
}

const work = selectScenarios();
let cursor = 0;
async function worker() {
  while (cursor < work.length) {
    const scenario = work[cursor++];
    try {
      await processScenario(scenario);
    } catch (error) {
      progress.cards[scenario.id] = { status: "error", error: error.message, updatedAt: new Date().toISOString() };
      writeJson(progressFile, progress);
      console.error(`ERROR ${scenario.id}: ${error.message}`);
    }
  }
}

await Promise.all(Array.from({ length: settings.concurrency }, () => worker()));
const selectedIds = new Set(work.map((item) => item.id));
const passed = Object.entries(progress.cards).filter(([id, item]) => selectedIds.has(id) && (item.status === "qa-passed" || item.status === "already-composed")).length;
console.log(`Scene run complete: ${passed}/${work.length} selected scenarios passed QA.`);
if (passed !== work.length) process.exitCode = 2;
