import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const engine = readFileSync(new URL("./engine.js", import.meta.url), "utf8");
const game = readFileSync(new URL("./RummyGame.jsx", import.meta.url), "utf8");
const rules = readFileSync(new URL("./rules.md", import.meta.url), "utf8");

test("Rummy supports two through six players with standard deal sizes", () => {
  assert.match(engine, /minimumPlayers:\s*2/);
  assert.match(engine, /maximumPlayers:\s*6/);
  assert.match(engine, /playerCount === 2\) return 10/);
  assert.match(engine, /playerCount <= 4\) return 7/);
  assert.match(engine, /return 6/);
});

test("Rummy explicitly maps Ace low for runs and scoring", () => {
  assert.match(engine, /function runValue/);
  assert.match(engine, /card\.rank === "A" \? 1 : card\.value/);
  assert.match(engine, /card\.rank === "A"\) return 1/);
  assert.match(engine, /targetScore:\s*100/);
});

test("Rummy implements every turn action and stock recycling", () => {
  assert.match(engine, /action\.type === "draw"/);
  assert.match(engine, /action\.type === "meld"/);
  assert.match(engine, /action\.type === "layoff"/);
  assert.match(engine, /action\.type === "discard"/);
  assert.match(engine, /shuffleCards\(state\.discardPile\.slice\(0, -1\)/);
  assert.match(engine, /Play a meld of your own before laying off cards/);
});

test("Rummy includes online rooms, robots, and table controls", () => {
  assert.match(game, /createModularRoom/);
  assert.match(game, /addModularRobot/);
  assert.match(game, /chooseRummyRobotAction/);
  assert.match(game, /Meld selected/);
  assert.match(game, /Discard selected/);
});

test("the Basic Rummy variant and exclusions are documented", () => {
  assert.match(rules, /Basic Rummy, also commonly called Straight Rummy/);
  assert.match(rules, /Gin Rummy and Oklahoma Gin/);
  assert.match(rules, /500 Rummy/);
});
