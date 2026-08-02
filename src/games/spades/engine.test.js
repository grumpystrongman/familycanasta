import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const engine = readFileSync(new URL("./engine.js", import.meta.url), "utf8");
const game = readFileSync(new URL("./SpadesGame.jsx", import.meta.url), "utf8");
const rules = readFileSync(new URL("./rules.md", import.meta.url), "utf8");

test("Spades provides bidding, nil, and fixed partnerships", () => {
  assert.match(engine, /phase: "bidding"/);
  assert.match(engine, /nilBonus:\s*100/);
  assert.match(engine, /function teamForIndex\(index\) \{ return index % 2; \}/);
  assert.match(engine, /Bid from zero \(nil\) through thirteen/);
});

test("Spades enforces trump and follow suit", () => {
  assert.match(engine, /spadesBroken/);
  assert.match(engine, /hand\.filter\(\(card\) => card\.suit !== "spades"\)/);
  assert.match(engine, /const spades = trick\.filter/);
  assert.match(engine, /following\.length \? following : hand/);
});

test("Spades scores contracts, bags, and a 500 point game", () => {
  assert.match(engine, /targetScore:\s*500/);
  assert.match(engine, /contract \* 10 \+ bags/);
  assert.match(engine, /bagPenalty:\s*100/);
  assert.match(engine, /roundScore\[team\] \+= Number\(state\.playerTricks/);
});

test("Spades includes online rooms and robot turns", () => {
  assert.match(game, /createModularRoom/);
  assert.match(game, /addModularRobot/);
  assert.match(game, /chooseSpadesRobotAction/);
  assert.match(game, /StandardCard/);
});

test("the standard partnership rules and exclusions are documented", () => {
  assert.match(rules, /standard four-player partnership Spades/i);
  assert.match(rules, /Blind nil and blind bids/);
});
