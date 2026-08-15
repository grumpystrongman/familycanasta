import test from "node:test";
import assert from "node:assert/strict";
import { createWordFoundryGame, reduceWordFoundry } from "./engine.js";

const members = [{ uid:"a", nickname:"A", seat:0 }, { uid:"b", nickname:"B", seat:1 }];

test("Lexicon Forge deals seven tiles to each player", () => {
  const state = createWordFoundryGame(members);
  assert.equal(state.racks.a.length, 7);
  assert.equal(state.racks.b.length, 7);
  assert.equal(state.board.length, 225);
});

test("opening play must cover the center forge", () => {
  const state = createWordFoundryGame(members);
  const [first, second] = state.racks.a;
  assert.throws(() => reduceWordFoundry(state, "a", { type:"play", placements:[{ tileId:first.id, index:0, letter:first.letter === "?" ? "A" : undefined }, { tileId:second.id, index:1, letter:second.letter === "?" ? "T" : undefined }] }, members), /center forge/i);
  const next = reduceWordFoundry(state, "a", { type:"play", placements:[{ tileId:first.id, index:112, letter:first.letter === "?" ? "A" : undefined }, { tileId:second.id, index:113, letter:second.letter === "?" ? "T" : undefined }] }, members);
  assert.ok(next.scores.a >= 0);
  assert.equal(next.currentPlayerIndex, 1);
});
