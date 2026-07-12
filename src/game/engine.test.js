import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_RULES,
  dealHand,
  openingRequirementForTeam,
} from "./engine.js";

const players = [
  { uid: "north", team: 0 },
  { uid: "south", team: 1 },
];

test("captures each team's opening requirement at the start of the hand", () => {
  const dealt = dealHand({
    players,
    rules: { ...DEFAULT_RULES, teamCount: 2, cardsPerPlayer: 1 },
    dealerIndex: 0,
    existingScores: [3100, 1499],
  });

  assert.deepEqual(dealt.publicState.openingRequirements, { 0: 120, 1: 50 });
});

test("publishes a newly dealt hand as immediately playable", () => {
  const dealt = dealHand({
    players,
    rules: { ...DEFAULT_RULES, teamCount: 2, cardsPerPlayer: 15 },
    dealerIndex: 0,
    existingScores: [0, 0],
  });

  assert.equal(dealt.publicState.phase, "playing");
  assert.equal(dealt.publicState.turnPhase, "draw");
  assert.equal(dealt.publicState.dealAnimationIndex, dealt.publicState.dealOrder.length);
  assert.equal(dealt.publicState.lastAction, "The first turn is ready.");
  assert.equal(dealt.privateHands.north.length, 15);
  assert.equal(dealt.privateHands.south.length, 15);
});

test("uses the hand-start opening requirement even if live score fields change", () => {
  const room = {
    publicState: {
      openingRequirements: { 0: 120 },
      teamScores: { 0: 0 },
      redThrees: { north: [{ id: "3h", rank: "3", suit: "H", color: "red" }] },
    },
  };

  assert.equal(openingRequirementForTeam(room, 0), 120);
});

test("falls back to the cumulative score for legacy rooms", () => {
  const room = { publicState: { teamScores: { 0: 1700 } } };
  assert.equal(openingRequirementForTeam(room, 0), 90);
});
