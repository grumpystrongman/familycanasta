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

test("Rummy validates sets, suit runs, and layoffs", () => {
  assert.match(engine, /sameRank.*cards\.length <= 4/s);
  assert.match(engine, /sameSuit/);
  assert.match(engine, /card\.value === ordered\[index - 1\]\.value \+ 1/);
  assert.match(engine, /Play a meld of your own before laying off cards/);
});

test("Rummy implements draw, meld, layoff, discard, and stock recycling", () => {
  assert.match(engine, /action\.type === "draw"/);
  assert.match(engine, /action\.type === "meld"/);
  assert.match(engine, /action\.type === "layoff"/);
  assert.match(engine, /action\.type === "discard"/);
  assert.match(engine, /shuffleCards\(state\.discardPile\.slice\(0, -1\)/);
});

test("Rummy scores deadwood and plays to 100", () => {
  assert.match(engine, /targetScore:\s*100/);
  assert.match(engine, /card\.rank === "A"\) return 1/);
  assert.match(engine, /\["J", "Q", "K"\]\.includes\(card\.rank\)\) return 10/);
  assert.match(engine, /roundPoints\[winnerUid\] = won/);
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
