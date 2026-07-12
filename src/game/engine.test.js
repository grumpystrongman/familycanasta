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
