import test from "node:test";
import assert from "node:assert/strict";
import { buildRecoveredDealState, dealOrderLength } from "./dealRecovery.js";

test("counts array and Firebase object deal orders", () => {
  assert.equal(dealOrderLength({ dealOrder: [{}, {}, {}] }), 3);
  assert.equal(dealOrderLength({ dealOrder: { 0: {}, 1: {}, 2: {}, 3: {} } }), 4);
});

test("completes a stalled deal without changing the original state", () => {
  const original = {
    phase: "dealing",
    dealAnimationIndex: 2,
    dealOrder: [{}, {}, {}, {}, {}],
    turnPhase: "draw",
  };

  const recovered = buildRecoveredDealState(original);

  assert.notEqual(recovered, original);
  assert.equal(original.phase, "dealing");
  assert.equal(recovered.phase, "playing");
  assert.equal(recovered.dealAnimationIndex, 5);
  assert.equal(recovered.turnPhase, "draw");
  assert.equal(recovered.lastAction, "The first turn is ready.");
});

test("does not rewrite a room that is no longer dealing", () => {
  assert.equal(buildRecoveredDealState({ phase: "playing" }), null);
  assert.equal(buildRecoveredDealState(null), null);
});
