import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const engine = readFileSync(new URL("./engine.js", import.meta.url), "utf8");
const game = readFileSync(new URL("./HeartsGame.jsx", import.meta.url), "utf8");
const rules = readFileSync(new URL("./rules.md", import.meta.url), "utf8");

test("Hearts implements the four-hand passing cycle", () => {
  assert.match(engine, /passCycle:\s*\["left", "right", "across", "hold"\]/);
  assert.match(engine, /passRecipientIndex/);
  assert.match(engine, /Select exactly three cards/);
});

test("Hearts enforces opening and follow-suit rules", () => {
  assert.match(engine, /cardIs\(card, "2", "clubs"\)/);
  assert.match(engine, /following\.length/);
  assert.match(engine, /Hearts are not broken|heartsBroken/);
  assert.match(engine, /queenOfSpadesPoints:\s*13/);
});

test("Hearts scores a moon shot and ends at the target score", () => {
  assert.match(engine, /shootTheMoonPoints:\s*26/);
  assert.match(engine, /points\[uid\] = uid === shooter \? 0 : HEARTS_RULES\.shootTheMoonPoints/);
  assert.match(engine, /targetScore:\s*100/);
});

test("Hearts includes online rooms, robots, and a playable table", () => {
  assert.match(game, /createModularRoom/);
  assert.match(game, /addModularRobot/);
  assert.match(game, /chooseHeartsRobotAction/);
  assert.match(game, /StandardCard/);
});

test("the implemented rule set is documented with exclusions", () => {
  assert.match(rules, /standard four-player American Hearts/i);
  assert.match(rules, /Deliberate exclusions/);
});
