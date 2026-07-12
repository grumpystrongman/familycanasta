import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_RULES, dealHand } from "./engine.js";
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

test("recovers the exact state shape produced by a real two-player deal", () => {
  const players = [
    { uid: "human", nickname: "Jeff", seat: 0, team: 0 },
    { uid: "robot", nickname: "Ruby", seat: 1, team: 1, isRobot: true },
  ];
  const dealt = dealHand({
    players,
    rules: { ...DEFAULT_RULES, cardsPerPlayer: 15 },
    dealerIndex: 1,
    existingScores: [0, 0],
  });

  assert.equal(dealt.publicState.phase, "dealing");
  assert.equal(dealt.publicState.turnPhase, "draw");
  assert.equal(dealt.publicState.dealOrder.length, 30);
  assert.equal(dealt.publicState.discardPile.length, 1);
  assert.ok(dealt.privateHands.human.length >= 15);
  assert.ok(dealt.privateHands.robot.length >= 15);

  const recovered = buildRecoveredDealState(dealt.publicState);
  assert.equal(recovered.phase, "playing");
  assert.equal(recovered.dealAnimationIndex, dealt.publicState.dealOrder.length);
  assert.equal(recovered.currentPlayerIndex, dealt.publicState.currentPlayerIndex);
  assert.equal(recovered.stockCount, dealt.publicState.stockCount);
});

test("does not rewrite a room that is no longer dealing", () => {
  assert.equal(buildRecoveredDealState({ phase: "playing" }), null);
  assert.equal(buildRecoveredDealState(null), null);
});
