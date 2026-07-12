import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_RULES,
  dealHand,
  finishRound,
  openingRequirementForTeam,
  teamCanGoOut,
  teamSeatTargets,
} from "./engine.js";

const players = [
  { uid: "north", team: 0 },
  { uid: "south", team: 1 },
];

function card(id, rank = "8") {
  return { id, rank, suit: "S", color: "black" };
}

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

test("creates valid two-to-six-player team distributions", () => {
  assert.deepEqual(teamSeatTargets(2, 2), [1, 1]);
  assert.deepEqual(teamSeatTargets(3, 3), [1, 1, 1]);
  assert.deepEqual(teamSeatTargets(4, 2), [2, 2]);
  assert.deepEqual(teamSeatTargets(5, 2), [3, 2]);
  assert.deepEqual(teamSeatTargets(5, 3), [2, 2, 1]);
  assert.deepEqual(teamSeatTargets(6, 2), [3, 3]);
  assert.deepEqual(teamSeatTargets(6, 3), [2, 2, 2]);
});

test("requires the configured number of canastas before a team can go out", () => {
  const room = {
    rules: { ...DEFAULT_RULES, canastasToGoOut: 1 },
    members: { north: { uid: "north", team: 0 } },
    privateHands: { north: [] },
    publicState: {
      teamBoards: { 0: [{ rank: "8", cards: [1,2,3,4,5,6,7].map((index) => card(`c${index}`)) }] },
      redThrees: {},
    },
  };

  assert.equal(teamCanGoOut(room, 0), true);
  room.rules.canastasToGoOut = 2;
  assert.equal(teamCanGoOut(room, 0), false);
});


test("finishes and scores the round when the final card is discarded", () => {
  const cleanCanasta = (prefix, rank) => ({
    rank,
    cards: Array.from({ length: 7 }, (_, index) => card(`${prefix}${index}`, rank)),
  });
  const room = {
    status: "playing",
    rules: { ...DEFAULT_RULES, teamCount: 2, targetScore: 5000, goingOutBonus: 100 },
    members: {
      north: { uid: "north", nickname: "North", team: 0 },
      south: { uid: "south", nickname: "South", team: 1 },
    },
    privateHands: { north: [], south: [card("south-k", "K")] },
    publicState: {
      phase: "playing",
      turnPhase: "play",
      teamScores: [0, 0],
      teamBoards: {
        0: [cleanCanasta("eight", "8"), cleanCanasta("nine", "9")],
        1: [],
      },
      redThrees: {},
    },
  };

  const finished = finishRound(room, "north");

  assert.equal(finished.publicState.phase, "handOver");
  assert.equal(finished.publicState.turnPhase, "complete");
  assert.equal(finished.publicState.wentOutUid, "north");
  assert.equal(finished.publicState.roundBreakdowns[0].cleanCanastas, 2);
  assert.equal(finished.publicState.roundBreakdowns[0].goingOutPoints, 100);
  assert.equal(finished.publicState.teamScores[0], finished.publicState.roundBreakdowns[0].roundTotal);
  assert.equal(finished.publicState.teamScores[1], -10);
});
