import test from "node:test";
import assert from "node:assert/strict";
import { LOCATIONS, METHODS, SUSPECTS } from "../../src/games/bloodalibi/engineV3.js";
import { SCENARIO_CATALOG, TOTAL_SCENARIO_CARDS } from "../../src/games/bloodalibi/scenarioCatalog.js";
import {
  buildScenePrompt,
  evaluateQa,
  parseCli,
  scenarioCardRelativePath,
  scenarioCardStem,
} from "./cardFactoryCore.mjs";

test("factory sees the full 1620-card catalog", () => {
  assert.equal(SUSPECTS.length, 6);
  assert.equal(METHODS.length, 6);
  assert.equal(LOCATIONS.length, 9);
  assert.equal(TOTAL_SCENARIO_CARDS, 1620);
  assert.equal(SCENARIO_CATALOG.length, 1620);
  assert.equal(new Set(SCENARIO_CATALOG.map(scenarioCardStem)).size, 1620);
});

test("filenames are deterministic and organized by room", () => {
  const scenario = { locationId:"penthouse", suspectId:"june-mercer", victimId:"ruby-ash", methodId:"revolver" };
  assert.equal(scenarioCardStem(scenario), "penthouse__june-mercer__ruby-ash__revolver");
  assert.equal(scenarioCardRelativePath(scenario), "penthouse/penthouse__june-mercer__ruby-ash__revolver.webp");
});

test("killer and victim may not be the same person", () => {
  assert.throws(() => scenarioCardStem({ locationId:"penthouse", suspectId:"ruby-ash", victimId:"ruby-ash", methodId:"revolver" }), /different characters/);
});

test("scene prompt locks identity and family-game safety", () => {
  const prompt = buildScenePrompt({ killerName:"June Mercer", victimName:"Ruby Ash", roomName:"Penthouse Suite", weaponName:"Antique Revolver" });
  assert.match(prompt, /Preserve that person's face/);
  assert.match(prompt, /no blood, no gore/i);
  assert.match(prompt, /never touching or striking a person/i);
  assert.match(prompt, /Do not add text/i);
});

test("QA gate rejects unsafe or weak images", () => {
  const good = { killerIdentity:.93, victimIdentity:.91, roomMatch:.9, weaponMatch:.9, visualQuality:.91, familySafe:true, noGraphicViolence:true, noText:true };
  assert.equal(evaluateQa(good), true);
  assert.equal(evaluateQa({ ...good, familySafe:false }), false);
  assert.equal(evaluateQa({ ...good, killerIdentity:.4 }), false);
  assert.equal(evaluateQa({ ...good, noGraphicViolence:false }), false);
});

test("CLI requires an explicit room or explicit all", () => {
  assert.deepEqual(parseCli(["--room","penthouse","--limit","10"]), { room:"penthouse", all:false, dryRun:false, force:false, limit:10, concurrency:2 });
  assert.equal(parseCli(["--all","--dry-run"]).all, true);
  assert.throws(() => parseCli([]), /Choose one room/);
});
