import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { cardsRoot, qaRoot, selectScenarios } from "./config.mjs";
import { exists, readJson, writeJson } from "./utils.mjs";

const selected = selectScenarios();
const report = { checkedAt: new Date().toISOString(), expected: selected.length, passed: 0, missing: [], qaFailed: [], invalidDimensions: [], duplicateFiles: [] };
const hashes = new Map();
for (const scenario of selected) {
  const card = path.join(cardsRoot, scenario.locationId, `${scenario.id}.webp`);
  const qa = readJson(path.join(qaRoot, `${scenario.id}.json`), null);
  if (!exists(card)) {
    if (!qa?.pass) report.qaFailed.push(scenario.id);
    report.missing.push(scenario.id);
    continue;
  }
  const meta = await sharp(card).metadata();
  if (meta.width !== 1122 || meta.height !== 1402 || meta.format !== "webp") report.invalidDimensions.push({ id: scenario.id, width: meta.width, height: meta.height, format: meta.format });
  const hash = crypto.createHash("sha256").update(fs.readFileSync(card)).digest("hex");
  if (hashes.has(hash)) report.duplicateFiles.push([hashes.get(hash), scenario.id]);
  else hashes.set(hash, scenario.id);
  if (meta.width === 1122 && meta.height === 1402 && meta.format === "webp") report.passed += 1;
}
writeJson(path.join(cardsRoot, "verification.json"), report);
console.log(`Verification: ${report.passed}/${report.expected} valid cards; missing=${report.missing.length}; qaFailed=${report.qaFailed.length}; invalid=${report.invalidDimensions.length}; duplicates=${report.duplicateFiles.length}`);
if (report.passed !== report.expected || report.missing.length || report.qaFailed.length || report.invalidDimensions.length || report.duplicateFiles.length) process.exitCode = 2;
