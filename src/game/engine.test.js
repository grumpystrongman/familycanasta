import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_RULES,
  cardPoints,
  dealHand,
  finishRound,
  openingRequirementForTeam,
  scoreTeamBoard,
} from "./engine.js";

const players = [
  { uid: "north", team: 0 },
  { uid: "south", team: 1 },
];

const card = (id, rank, suit = "S") => ({
  id,
  rank,
  suit,
  color: suit === "H" || suit === "D" ? "red" : "black",
});

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

test("scores a black three as a five-point hand penalty", () => {
  assert.equal(cardPoints(card("black-three", "3", "S")), 5);
});

test("does not award a going-out bonus when the stock ends the round", () => {
  const room = {
    status: "playing",
    rules: { ...DEFAULT_RULES, teamCount: 2 },
    members: {
      north: { uid: "north", nickname: "Jeff", team: 0 },
      south: { uid: "south", nickname: "Ruby", team: 1 },
    },
    privateHands: {
      north: [card("n1", "K")],
      south: [card("s1", "4")],
    },
    publicState: {
      phase: "playing",
      turnPhase: "draw",
      teamBoards: { 0: [], 1: [] },
      teamScores: [0, 0],
      redThrees: { north: [], south: [] },
    },
  };

  assert.equal(scoreTeamBoard(room, 0, null).goingOutPoints, 0);

  const result = finishRound(room, null, { reason: "stock-exhausted", blockedUid: "north" });

  assert.equal(result.publicState.phase, "handOver");
  assert.equal(result.publicState.turnPhase, "complete");
  assert.equal(result.publicState.roundEndReason, "stock-exhausted");
  assert.equal(result.publicState.roundBreakdowns[0].goingOutPoints, 0);
  assert.equal(result.publicState.roundBreakdowns[1].goingOutPoints, 0);
  assert.equal(result.publicState.roundBreakdowns[0].roundTotal, -10);
  assert.equal(result.publicState.roundBreakdowns[1].roundTotal, -5);
  assert.equal("wentOutUid" in result.publicState, false);
});
