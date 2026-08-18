import path from "node:path";
import { qaRoot, scenesRoot, selectScenarios } from "./config.mjs";
import { buildReferenceSheet } from "./reference-sheet.mjs";
import { qaScene } from "./qa.mjs";
import { exists, writeJson } from "./utils.mjs";

if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required to validate Blackglass scenes.");
let missing = 0;
let failed = 0;
for (const scenario of selectScenarios()) {
  const sceneFile = path.join(scenesRoot, scenario.locationId, `${scenario.id}.webp`);
  if (!exists(sceneFile)) { missing += 1; console.error(`MISSING ${scenario.id}`); continue; }
  const sheetFile = await buildReferenceSheet(scenario);
  const result = await qaScene(sceneFile, sheetFile, scenario);
  writeJson(path.join(qaRoot, `${scenario.id}.json`), result);
  if (!result.pass) failed += 1;
  console.log(`${result.pass ? "PASS" : "FAIL"} ${scenario.id} score=${result.score ?? "?"}`);
}
if (missing || failed) {
  console.error(`Validation incomplete: missing=${missing}, failed=${failed}`);
  process.exitCode = 2;
}
